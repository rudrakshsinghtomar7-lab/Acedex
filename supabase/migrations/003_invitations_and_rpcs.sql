-- ============================================================================
-- Acedex — invitations + team management RPCs (migration 003)
-- ============================================================================
-- Depends on 001_initial_schema.sql and 002_auth_trigger_storage.sql.
--
-- Adds:
--   - activity_event_type value 'team_invite_sent'
--   - invitations table (separate state machine from notifications)
--   - RLS for invitations (SELECT only; writes go through RPCs)
--   - RPCs: invite_to_team, accept_team_invitation, decline_team_invitation,
--           remove_team_member
--
-- All RPCs are SECURITY DEFINER and check authorization manually inside the
-- body, so they can write rows that the caller's RLS would otherwise forbid
-- (notifications.INSERT is admin-only at the RLS layer; we route the invite
-- flow through these functions instead of widening the policy).
-- ============================================================================

-- ── enum extension ─────────────────────────────────────────────────────────
-- ALTER TYPE ADD VALUE works inside a transaction since PG 12, as long as
-- the new value isn't used in the same transaction. Function bodies are
-- stored as text and only validate the value at call time, so referencing
-- 'team_invite_sent' inside function bodies in this same migration is fine.

ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'team_invite_sent';


-- ── invitation status enum ─────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending','accepted','declined','cancelled','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── invitations table ──────────────────────────────────────────────────────
-- Either invitee_profile_id or invitee_email must be set. If a profile is
-- known up front we link directly; for email-only invites the row stays
-- dormant (no notification yet) until the recipient signs up. The
-- notification_id field lets accept/decline mark the related notification
-- as read in one round-trip.

CREATE TABLE invitations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id            uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  inviter_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_email      text,
  status             invitation_status NOT NULL DEFAULT 'pending',
  message            text,
  notification_id    uuid REFERENCES notifications(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  responded_at       timestamptz,
  expires_at         timestamptz,
  CHECK (invitee_profile_id IS NOT NULL OR invitee_email IS NOT NULL)
);

CREATE INDEX idx_invitations_team             ON invitations(team_id);
CREATE INDEX idx_invitations_invitee_profile  ON invitations(invitee_profile_id, status);
CREATE INDEX idx_invitations_invitee_email    ON invitations(lower(invitee_email), status);
CREATE INDEX idx_invitations_inviter          ON invitations(inviter_id);

-- Prevent duplicate pending invites for the same (team, profile) / (team, email).
-- Declined / cancelled rows don't block a fresh re-invite.
CREATE UNIQUE INDEX idx_invitations_unique_pending_profile
  ON invitations(team_id, invitee_profile_id)
  WHERE status = 'pending' AND invitee_profile_id IS NOT NULL;

CREATE UNIQUE INDEX idx_invitations_unique_pending_email
  ON invitations(team_id, lower(invitee_email))
  WHERE status = 'pending' AND invitee_email IS NOT NULL;


-- ── RLS: SELECT only; writes via RPCs ──────────────────────────────────────

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY invitations_select ON invitations FOR SELECT TO authenticated
USING (
  invitee_profile_id = auth.uid()
  OR inviter_id = auth.uid()
  OR is_team_professor(team_id)
  OR is_admin()
);

-- No INSERT/UPDATE/DELETE policies → RLS denies. RPCs run SECURITY DEFINER.


-- ── RPC: invite_to_team ────────────────────────────────────────────────────
-- Caller (team member, team professor, or admin) creates an invitation
-- pointing at either a profile or an email. If a profile is resolved, a
-- team_invite notification is created. Also logs activity_event
-- ('team_invite_sent') so the team Activity feed renders it.

CREATE OR REPLACE FUNCTION public.invite_to_team(
  _team_id            uuid,
  _invitee_profile_id uuid DEFAULT NULL,
  _invitee_email      text DEFAULT NULL,
  _message            text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _inviter         uuid := auth.uid();
  _resolved        uuid := _invitee_profile_id;
  _invitation_id   uuid;
  _notification_id uuid;
  _team_name       text;
  _inviter_name    text;
BEGIN
  IF _inviter IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated' USING ERRCODE = '42501';
  END IF;

  IF _invitee_profile_id IS NULL AND (_invitee_email IS NULL OR length(trim(_invitee_email)) = 0) THEN
    RAISE EXCEPTION 'Must provide invitee_profile_id or invitee_email' USING ERRCODE = '22023';
  END IF;

  IF NOT (is_team_member(_team_id) OR is_team_professor(_team_id) OR is_admin()) THEN
    RAISE EXCEPTION 'Not authorized to invite to this team' USING ERRCODE = '42501';
  END IF;

  -- Resolve email → profile (same-university scoping is enforced by client
  -- search; we don't restrict here, so cross-university invites are possible
  -- via direct profile_id but the resolver below stays case-insensitive).
  IF _resolved IS NULL AND _invitee_email IS NOT NULL THEN
    SELECT id INTO _resolved FROM profiles WHERE lower(email) = lower(_invitee_email);
  END IF;

  -- Block re-invites to existing members.
  IF _resolved IS NOT NULL AND EXISTS (
    SELECT 1 FROM team_members WHERE team_id = _team_id AND profile_id = _resolved
  ) THEN
    RAISE EXCEPTION 'User is already a team member' USING ERRCODE = '23505';
  END IF;

  SELECT name      INTO _team_name    FROM teams    WHERE id = _team_id;
  SELECT full_name INTO _inviter_name FROM profiles WHERE id = _inviter;

  INSERT INTO invitations (team_id, inviter_id, invitee_profile_id, invitee_email, message)
  VALUES (_team_id, _inviter, _resolved, NULLIF(trim(_invitee_email), ''), _message)
  RETURNING id INTO _invitation_id;

  IF _resolved IS NOT NULL THEN
    INSERT INTO notifications (recipient_id, type, title, body, related_team_id)
    VALUES (
      _resolved,
      'team_invite',
      COALESCE(_inviter_name, 'Someone') || ' invited you to join '
        || COALESCE(_team_name, 'a team'),
      _message,
      _team_id
    )
    RETURNING id INTO _notification_id;

    UPDATE invitations SET notification_id = _notification_id WHERE id = _invitation_id;
  END IF;

  INSERT INTO activity_events (team_id, profile_id, event_type, target_type, target_id, metadata)
  VALUES (
    _team_id, _inviter, 'team_invite_sent', 'invitation', _invitation_id,
    jsonb_build_object(
      'invitee_profile_id', _resolved,
      'invitee_email',      _invitee_email
    )
  );

  RETURN _invitation_id;
END;
$$;


-- ── RPC: accept_team_invitation ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.accept_team_invitation(_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _inv invitations%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _inv FROM invitations WHERE id = _invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = '02000';
  END IF;

  -- Authorization: either invitee_profile_id matches the caller, or the
  -- invitation was email-only and the caller's email matches.
  IF _inv.invitee_profile_id IS NOT NULL THEN
    IF _inv.invitee_profile_id <> _uid THEN
      RAISE EXCEPTION 'Invitation not addressed to this user' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF _inv.invitee_email IS NULL OR NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = _uid AND lower(email) = lower(_inv.invitee_email)
    ) THEN
      RAISE EXCEPTION 'Invitation not addressed to this user' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF _inv.status <> 'pending' THEN
    RAISE EXCEPTION 'Invitation is no longer pending' USING ERRCODE = '22023';
  END IF;

  UPDATE invitations
  SET status = 'accepted', responded_at = now(), invitee_profile_id = _uid
  WHERE id = _invitation_id;

  INSERT INTO team_members (team_id, profile_id)
  VALUES (_inv.team_id, _uid)
  ON CONFLICT DO NOTHING;

  INSERT INTO activity_events (team_id, profile_id, event_type)
  VALUES (_inv.team_id, _uid, 'team_join');

  IF _inv.notification_id IS NOT NULL THEN
    UPDATE notifications
    SET read = true, read_at = now()
    WHERE id = _inv.notification_id;
  END IF;

  RETURN jsonb_build_object('team_id', _inv.team_id, 'invitation_id', _invitation_id);
END;
$$;


-- ── RPC: decline_team_invitation ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.decline_team_invitation(_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _inv invitations%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _inv FROM invitations WHERE id = _invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = '02000';
  END IF;

  IF _inv.invitee_profile_id IS NOT NULL THEN
    IF _inv.invitee_profile_id <> _uid THEN
      RAISE EXCEPTION 'Invitation not addressed to this user' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF _inv.invitee_email IS NULL OR NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = _uid AND lower(email) = lower(_inv.invitee_email)
    ) THEN
      RAISE EXCEPTION 'Invitation not addressed to this user' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF _inv.status <> 'pending' THEN
    RAISE EXCEPTION 'Invitation is no longer pending' USING ERRCODE = '22023';
  END IF;

  UPDATE invitations
  SET status = 'declined', responded_at = now()
  WHERE id = _invitation_id;

  IF _inv.notification_id IS NOT NULL THEN
    UPDATE notifications
    SET read = true, read_at = now()
    WHERE id = _inv.notification_id;
  END IF;
END;
$$;


-- ── RPC: remove_team_member ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.remove_team_member(_team_id uuid, _profile_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT (is_team_professor(_team_id) OR is_admin()) THEN
    RAISE EXCEPTION 'Not authorized to remove members from this team' USING ERRCODE = '42501';
  END IF;

  DELETE FROM team_members WHERE team_id = _team_id AND profile_id = _profile_id;

  INSERT INTO activity_events (team_id, profile_id, event_type)
  VALUES (_team_id, _profile_id, 'team_leave');
END;
$$;


-- ── GRANTS ─────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.invite_to_team(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_team_invitation(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_team_member(uuid, uuid)         TO authenticated;
