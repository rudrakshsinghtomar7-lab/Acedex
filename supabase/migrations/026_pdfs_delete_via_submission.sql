-- © 2026 Rudraksh Singh Tomar. All rights reserved.
-- ============================================================================
-- 026 — let a submission authorize deleting its own binary in the 'pdfs' bucket
-- ============================================================================
--
-- Retention bug this fixes. Submissions live in the 'pdfs' bucket, not
-- 'submissions': submitAssignment uploads through uploadPdfDocument, so a
-- submission's storage_path is its pdf_documents row's path. But
-- submissions.pdf_document_id is ON DELETE SET NULL, so deleting that PDF on
-- its own leaves the submission row holding the only reference to the object.
--
-- storage_pdfs_delete authorized deletes ONLY via storage_owns_pdf(), which
-- requires a pdf_documents row with that path. Once the row is gone, nothing
-- can delete the binary: the professor deleting the whole project got a
-- silently successful remove() (Supabase omits RLS-denied paths instead of
-- erroring) while the file stayed in the bucket forever. Deleted student
-- submissions have to actually leave storage, so the submission row itself
-- must be able to authorize the delete.
--
-- Scope of the widening is narrow — storage_owns_submission() already requires
-- a submissions row with that exact path AND that the caller is the submitter,
-- the team's professor, or an admin. It grants nothing on paths that no
-- submission references.
--
-- SELECT has to be widened alongside DELETE: the storage API resolves an
-- object through SELECT before deleting it, so a path the caller cannot SEE
-- is silently skipped by remove() — no error, file left behind. Fixing DELETE
-- alone changes nothing. INSERT/UPDATE keep their pdf_documents-based rules.

DROP POLICY IF EXISTS storage_pdfs_select ON storage.objects;

CREATE POLICY storage_pdfs_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pdfs'
  AND (
    public.storage_can_view_pdf(name)
    OR public.storage_can_view_submission(name)
  )
);

DROP POLICY IF EXISTS storage_pdfs_delete ON storage.objects;

CREATE POLICY storage_pdfs_delete ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'pdfs'
  AND (
    public.storage_owns_pdf(name)
    OR public.storage_owns_submission(name)
  )
);
