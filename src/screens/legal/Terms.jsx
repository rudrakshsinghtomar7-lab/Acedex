// © 2026 Rudraksh Singh Tomar. All rights reserved.
// DRAFT — pending legal review. Not final legal text. See [LAWYER REVIEW] notes.
import { useNavigate } from 'react-router-dom';

const LAST_UPDATED = '2 June 2026';

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

export default function Terms() {
  const navigate = useNavigate();
  return (
    <>
      <div className="sh-head">
        <button className="back" onClick={() => navigate(-1)}>←</button>
        <div className="sh-title">Terms of Service</div>
        <div style={{ width: 36, height: 36 }} aria-hidden />
      </div>

      <div style={wrap}>
        <div style={draft}>
          <span aria-hidden>⚠️</span>
          <div><strong>DRAFT — pending legal review.</strong> This is a working draft prepared for a lawyer to refine. It is not final legal advice and may change before it takes effect.</div>
        </div>

        <div style={metaRow}>Last updated: {LAST_UPDATED} · Current version (draft)</div>

        <P>These Terms of Service (“Terms”) govern your use of Acedex. Acedex is operated by <strong>Rudraksh Singh Tomar</strong>, an individual based in Brisbane, Queensland, Australia. The operator is a sole individual and is <strong>not an incorporated company</strong>. By creating an account or using Acedex, you agree to these Terms. If you do not agree, do not use Acedex.</P>

        <H>1. Who can use Acedex</H>
        <P>Acedex is an academic collaboration tool intended for students and professors, typically through an educational institution. <strong>We expect some users to be under 18.</strong> If you are under 18, you may use Acedex only with the consent of a parent or guardian and/or the authority and consent of your educational institution, and your continued use confirms that such consent has been given.</P>
        <P>You are responsible for keeping your account credentials secure and for activity under your account.</P>
        <LR>HIGH PRIORITY. Confirm the minimum age and consent mechanics for minors in Australia/Queensland (parental vs. guardian vs. institutional consent), what must be presented at sign-up, and whether a separate parental-consent flow is legally required before an under-18 can transact with these Terms.</LR>

        <H>2. Acceptable use</H>
        <P>You agree not to: upload unlawful, infringing, or harmful content; upload personal or identity documents that are not necessary for your coursework; attempt to access data belonging to teams or users you are not a member of; disrupt, probe, or circumvent the security of the service; misuse the AI features; or use Acedex to harass others or to facilitate academic dishonesty against the rules of your institution.</P>

        <H>3. Academic integrity & the AI review (read this carefully)</H>
        <P>Acedex includes AI-assisted features that can review submitted work for originality/quality signals and provide study assistance. <strong>These features assist human judgement; they do not produce an infallible or final verdict.</strong> AI output can be incomplete, mistaken, or biased. A flag from Acedex is a prompt for a human (such as a professor) to review — it is not, by itself, proof of misconduct, and an absence of flags is not a guarantee of originality.</P>
        <P>Professors and institutions remain responsible for any academic-integrity decision. Acedex does not make academic-integrity determinations and is not a substitute for an institution’s own process. To provide these features, submitted academic content (including extracted PDF text) may be sent to a third-party AI provider (Anthropic) for analysis, as described in our Privacy Policy.</P>
        <LR>Confirm liability-limiting language is adequate given that AI output may influence academic-integrity outcomes for students, including minors. Advise whether we must require professors to acknowledge that AI output is advisory before relying on it.</LR>

        <H>4. Your content & ownership</H>
        <P><strong>You retain ownership of the work and content you create or upload</strong> (your documents, comments, annotations, submissions, and other materials). We do not claim ownership of your work.</P>
        <P>To operate Acedex, you grant us a limited, non-exclusive licence to host, store, copy, display, and process your content <em>solely</em> to provide the service to you and your team — including transmitting it to the sub-processors in our Privacy Policy (for storage, email, and AI analysis). This licence ends when the content is deleted, except for any processing already completed and to the extent residual copies persist in routine backups for a limited period.</P>
        <LR>Confirm the licence scope is broad enough to operate (incl. AI processing by Anthropic) but no broader, and that it correctly survives/terminates on deletion given the full-delete behaviour in §6.</LR>

        <H>5. Roles & visibility (professors and students)</H>
        <P>Acedex has student and professor roles. To support collaboration while protecting privacy, the platform applies this model:</P>
        <ul>
          <LI><strong>Team-visible status:</strong> members of a team can see the status of tasks, milestones, and assignments (for example, whether work is Not started, In progress, Submitted, or Done) and who is assigned.</LI>
          <LI><strong>Private grades & feedback:</strong> grades, points, and a professor’s written feedback are <strong>not</strong> shown to other students. They are visible to the relevant student and to the professor/administrator.</LI>
          <LI><strong>Professor controls:</strong> the course professor (and administrators) can create and manage assignments, tasks, and milestones, review and grade submissions, and delete a project.</LI>
        </ul>
        <P>This model is enforced in the platform’s access rules, but you should still treat shared workspaces with appropriate care.</P>

        <H>6. Deletion of projects and content</H>
        <P><strong>Project deletion is permanent.</strong> When a professor or administrator deletes a project, Acedex permanently removes the project’s records and stored files (including uploaded PDFs). Deleted content is not retained by Acedex and cannot be recovered. Do not delete a project unless you intend to permanently remove its contents.</P>
        <LR>Mirror any future “retained audit metadata” behaviour here only once it exists; today’s behaviour is a full delete. Confirm whether a confirmation/consent step is sufficient where deletion may remove other users’ (incl. minors’) work.</LR>

        <H>7. Service availability & changes</H>
        <P>Acedex is offered on an “as is” and “as available” basis. It is operated by a single individual and may change, be interrupted, or be discontinued at any time. We may modify or remove features, and we may update these Terms (see §11).</P>

        <H>8. Disclaimers & limitation of liability</H>
        <P>To the maximum extent permitted by law, Acedex is provided without warranties of any kind, and the operator is not liable for indirect, incidental, or consequential loss, or for loss of data, arising from your use of (or inability to use) Acedex, including reliance on AI output. Nothing in these Terms excludes rights or guarantees that cannot lawfully be excluded, including under the Australian Consumer Law.</P>
        <LR>HIGH PRIORITY for a solo operator. Draft enforceable, proportionate disclaimers and liability caps that remain valid under the Australian Consumer Law (which limits how far consumer guarantees can be excluded), and that account for the operator being an individual rather than a company. Advise on whether the operator should incorporate or obtain insurance before scaling.</LR>

        <H>9. Termination</H>
        <P>You may stop using Acedex at any time and contact us to close your account. We may suspend or terminate access if you breach these Terms, if required for security or legal reasons, or if the service is discontinued. Provisions that by their nature should survive (including ownership, disclaimers, and limitation of liability) survive termination.</P>

        <H>10. Governing law</H>
        <P>These Terms are governed by the laws of <strong>Queensland, Australia</strong>, and you submit to the non-exclusive jurisdiction of the courts of Queensland.</P>

        <H>11. Changes to these Terms</H>
        <P>We may update these Terms from time to time. The “Last updated” date reflects the current version. For material changes we will take reasonable steps to notify users. Continued use after a change takes effect indicates acceptance of the updated Terms.</P>

        <H>12. Contact</H>
        <P>Operator: Rudraksh Singh Tomar (individual), Brisbane, Queensland, Australia. Contact: <strong>rudrakshsinghtomar7@gmail.com</strong> · phone <strong>7389581234</strong>.</P>

        <P style={{ marginTop: 28, fontSize: 12.5 }}>See also our <button className="pdf-link-btn" onClick={() => navigate('/legal/privacy')}>Privacy Policy</button>.</P>
      </div>
    </>
  );
}
