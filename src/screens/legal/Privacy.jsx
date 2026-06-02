// © 2026 Rudraksh Singh Tomar. All rights reserved.
// DRAFT — pending legal review. Not final legal text. See [LAWYER REVIEW] notes.
import { useNavigate, useLocation } from 'react-router-dom';

const LAST_UPDATED = '2 June 2026';

// All styling via theme tokens → renders correctly in light + dark.
const wrap = { padding: '18px 22px 64px', maxWidth: 720, margin: '0 auto' };
const draft = {
  display: 'flex', gap: 8, alignItems: 'flex-start',
  background: 'rgba(var(--warn-rgb),.12)', border: '1px solid rgba(var(--warn-rgb),.4)',
  color: 'var(--text)', borderRadius: 'var(--r-md)', padding: '11px 13px', fontSize: 12.5, lineHeight: 1.5, marginBottom: 18,
};
const metaRow = { fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 22 };
const h2 = { fontSize: 15.5, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.01em', margin: '26px 0 8px' };
const p = { fontSize: 13.5, lineHeight: 1.62, color: 'var(--text-2)', margin: '8px 0' };
const li = { ...p, margin: '5px 0 5px 2px' };
const lr = {
  display: 'block', background: 'rgba(var(--accent-rgb),.10)', border: '1px dashed rgba(var(--accent-rgb),.5)',
  color: 'var(--indigo-bright)', borderRadius: 8, padding: '9px 11px', fontSize: 12, lineHeight: 1.5,
  fontWeight: 600, margin: '10px 0',
};

function H({ children }) { return <h2 style={h2}>{children}</h2>; }
function P({ children }) { return <p style={p}>{children}</p>; }
function LI({ children }) { return <li style={li}>{children}</li>; }
function LR({ children }) { return <div style={lr}>⚖︎ [LAWYER REVIEW: {children}]</div>; }

export default function Privacy() {
  const navigate = useNavigate();
  const location = useLocation();
  // Public, shareable URL — on a direct deep-link there's no history, so
  // navigate(-1) would do nothing. Fall back to '/' (RootRedirect → home/login).
  const onBack = () => {
    if (location.key === 'default') navigate('/', { replace: true });
    else navigate(-1);
  };
  return (
    <>
      <div className="sh-head">
        <button className="back" onClick={onBack}>←</button>
        <div className="sh-title">Privacy Policy</div>
        <div style={{ width: 36, height: 36 }} aria-hidden />
      </div>

      <div style={wrap}>
        <div style={draft}>
          <span aria-hidden>⚠️</span>
          <div><strong>DRAFT — pending legal review.</strong> This is a working draft prepared for a lawyer to refine. It is not final legal advice and may change before it takes effect.</div>
        </div>

        <div style={metaRow}>Last updated: {LAST_UPDATED} · Current version (draft)</div>

        <P>This Privacy Policy explains how Acedex (“Acedex”, “we”, “us”) collects, uses, discloses, and protects personal information. Acedex is operated by <strong>Rudraksh Singh Tomar</strong>, an individual based in Brisbane, Queensland, Australia. The operator is a sole individual and is <strong>not an incorporated company</strong>.</P>
        <P>We handle personal information in accordance with the <strong>Privacy Act 1988 (Cth)</strong> and the <strong>Australian Privacy Principles (APPs)</strong>. By creating an account or using Acedex, you acknowledge this Policy.</P>
        <LR>Confirm whether the operator, as a sole individual below the small-business turnover threshold, is an “APP entity” bound by the Privacy Act, or is voluntarily opting in. Acedex handles sensitive academic records and information about minors, which may bring it within scope regardless — please advise and adjust the framing throughout.</LR>

        <H>1. Who we are & how to contact us</H>
        <P>Operator: Rudraksh Singh Tomar (individual). Location: Brisbane, Queensland, Australia.</P>
        <P>Privacy contact: <strong>rudrakshsinghtomar7@gmail.com</strong> · phone <strong>7389581234</strong>. You can use these details to ask about this Policy, request access to or correction of your information, or make a privacy complaint.</P>

        <H>2. What personal information we collect</H>
        <P>We collect the following categories of information that you or your institution provide, or that are generated as you use Acedex:</P>
        <ul>
          <LI><strong>Account & identity:</strong> name, email address, username, password (stored only as a salted hash — we never store your password in plain text), and your university/institution.</LI>
          <LI><strong>Profile:</strong> department, biography, interests, and role (student or professor).</LI>
          <LI><strong>Academic content:</strong> uploaded PDF documents, comments, highlights and annotations, assignments, submissions, grades and feedback, tasks, milestones, and team/project membership.</LI>
          <LI><strong>Usage information:</strong> activity logs and document access logs (for example, records of who viewed a PDF and when), used for collaboration features, security, and the integrity/contribution insights described below.</LI>
        </ul>
        <P>Some academic content may incidentally contain sensitive information if you choose to include it. Please do not upload identity documents or sensitive personal records that are not required for your coursework.</P>
        <LR>Academic records and information revealing a person’s performance may be “sensitive information” or otherwise heightened-risk under the Privacy Act and Queensland norms. Advise on consent and handling requirements, and on whether a collection notice (APP 5) at point of upload is required.</LR>

        <H>3. Why we collect it and how we use it</H>
        <P>We use personal information to: create and manage accounts and authentication; operate the core product (teams, assignments, submissions, tasks, milestones, PDF review and annotation); deliver grades and feedback between professors and students; send transactional email (one-time codes, password resets, and notifications); provide AI-assisted originality/quality review and study assistance (see §5); maintain security and audit logs; and respond to support and privacy requests.</P>
        <P><strong>Legal basis / collection:</strong> we collect this information because it is reasonably necessary to provide a collaborative academic workspace you (or your institution) have asked to use. Where the APPs require consent — including for users under 18 (see §7) — we rely on consent.</P>
        <LR>Confirm the correct lawful basis framing under the Privacy Act (the APPs are “reasonably necessary” / consent-based rather than the GDPR “legal basis” model). Align this language with the Act, not GDPR.</LR>

        <H>4. Who we share it with (sub-processors)</H>
        <P>We do not sell personal information. We use the following third-party service providers (“sub-processors”) to run Acedex. Each receives only the data needed for its function:</P>
        <ul>
          <LI><strong>Supabase</strong> — our database, authentication, and file storage provider. Supabase hosts essentially all of the data in §2, including your account details, academic content, uploaded files, and logs.</LI>
          <LI><strong>Google (Gmail) </strong> — transactional email delivery (one-time login codes, password resets, and notifications). Google receives your email address and the contents of those messages.</LI>
          <LI><strong>Anthropic (Claude API)</strong> — powers the AI features. When AI review or assistance is used, <strong>the text of submitted academic content (including extracted PDF text) may be sent to Anthropic’s API for analysis</strong>, along with related prompt context. We do not control Anthropic’s independent processing; please review Anthropic’s own terms.</LI>
        </ul>

        <H>5. Overseas disclosure (APP 8)</H>
        <P>The sub-processors above may store or process personal information on servers <strong>outside Australia</strong>. This means using Acedex involves the overseas disclosure of personal information, including the academic content sent to Anthropic for AI analysis.</P>
        <LR>This is a priority item. Confirm the actual hosting region for the Supabase project and each sub-processor, and draft an APP 8-compliant disclosure (including whether we take “reasonable steps” to ensure overseas recipients comply with the APPs, or whether an APP 8.2 exception/consent applies). The overseas transfer of student academic content — potentially including minors’ work — to an overseas AI provider needs explicit, careful treatment here.</LR>
        <LR>Advise whether sending student submissions to a third-party AI (Anthropic) requires separate, informed consent, what students/professors must be told before that transfer occurs, and whether an opt-out is required.</LR>

        <H>6. Data retention & deletion</H>
        <P><strong>Project deletion is currently a full, permanent deletion.</strong> When a professor or administrator deletes a project, Acedex permanently removes the associated database records <em>and</em> the stored files (including uploaded PDFs) for that project. We do not currently retain a separate copy or archive of deleted project data, and deleted content cannot be recovered.</P>
        <P>Account information is retained while your account is active and for as long as needed to provide the service. You may contact us to request deletion of your personal information (see §8).</P>
        <LR>A future version may retain limited audit metadata after deletion for institutional access/integrity purposes. That behaviour is NOT live today and is intentionally not described here — disclose it only once built. Also advise on minimum retention periods we may be legally required to keep, and on backup-retention windows at sub-processors (e.g., Supabase backups) that may delay true erasure.</LR>

        <H>7. Children & users under 18</H>
        <P><strong>Acedex is expected to be used by people under the age of 18.</strong> We take the handling of minors’ personal information seriously.</P>
        <ul>
          <LI>Where a user is under 18, we may require verifiable consent from a parent or guardian, and/or rely on the consent and authority of the user’s educational institution, before collecting or using their personal information.</LI>
          <LI>We aim to collect only the information reasonably necessary for the educational purpose, and to apply the team-visible-status / private-grades model described in our Terms so that a student’s grades and feedback are not exposed to other students.</LI>
          <LI>A parent or guardian may contact us at the details in §1 to access, correct, or request deletion of their child’s information.</LI>
        </ul>
        <LR>HIGH PRIORITY. This section needs your review against Australian requirements for children’s personal information under the Privacy Act/APPs and any Queensland-specific or sector (education) obligations: the age at which a minor can consent on their own behalf, when verifiable parental/guardian consent is required, the role of the institution’s consent, and what notices must be given. Please rewrite to be compliant — the text above states our intended approach, not a legal determination.</LR>

        <H>8. Your rights — access & correction (APPs 12 & 13)</H>
        <P>You may request access to the personal information we hold about you, and ask us to correct it if it is inaccurate, out of date, incomplete, irrelevant, or misleading. Contact us using the details in §1 and we will respond within a reasonable period. Where we cannot give access or make a correction, we will explain why, as the APPs require.</P>
        <P>Some information is also directly viewable and editable in the app (for example, your profile).</P>
        <LR>Confirm statutory response timeframes, permitted grounds for refusing access/correction, and any fees that may (or may not) be charged under the APPs.</LR>

        <H>9. Security</H>
        <P>We take reasonable steps to protect personal information. Measures include hashed passwords, authenticated access, database row-level security so users can generally only reach data for their own teams, signed time-limited links for file downloads, and access logging. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.</P>
        <LR>Confirm we are not overstating our security posture, and advise on data-breach notification obligations (Notifiable Data Breaches scheme under the Privacy Act), including our response plan and notification timeframes.</LR>

        <H>10. Changes to this Policy</H>
        <P>We may update this Policy from time to time. The “Last updated” date at the top reflects the current version. For material changes we will take reasonable steps to notify users (for example, by in-app notice or email). Continued use after a change takes effect indicates acknowledgement of the updated Policy.</P>

        <H>11. Complaints</H>
        <P>If you have a privacy concern, contact us first using the details in §1. If you are not satisfied with our response, you may be able to complain to the Office of the Australian Information Commissioner (OAIC).</P>
        <LR>Confirm the correct complaints pathway and any wording the OAIC expects, and whether a Queensland body is also relevant.</LR>

        <P style={{ marginTop: 28, fontSize: 12.5 }}>See also our <button className="pdf-link-btn" onClick={() => navigate('/legal/terms')}>Terms of Service</button>.</P>
      </div>
    </>
  );
}
