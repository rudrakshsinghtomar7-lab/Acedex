// © 2026 Rudraksh Singh Tomar. All rights reserved.
const PDF_BUCKET = 'pdfs';
const MAX_PDF_BYTES = 10 * 1024 * 1024;

const PDF_SELECT = `
  id, team_id, assignment_id, uploaded_by, title, storage_path, file_size_bytes,
  page_count, access_level, created_at, updated_at,
  uploader:profiles!pdf_documents_uploaded_by_fkey(id, full_name, avatar_url)
`;

const ANNOTATION_SELECT = `
  id, document_id, author_id, parent_annotation_id, page_number, bbox, content,
  annotation_type, resolved, color, created_at, updated_at,
  author:profiles!pdf_annotations_author_id_fkey(id, full_name, avatar_url, role)
`;

export function validatePdfFile(file) {
  if (!file) return 'Choose a PDF file.';
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return 'Only PDF files are supported.';
  if (file.size > MAX_PDF_BYTES) return 'PDF must be 10MB or smaller.';
  return null;
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function formatShortDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatRelativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffMs = Date.now() - then;
  if (diffMs < 0) return 'just now';
  const m = Math.round(diffMs / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(diffMs / 3600000);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(diffMs / 86400000);
  if (d < 7) return `${d}d ago`;
  return formatShortDate(iso);
}

export async function listPdfDocuments(supabase, teamId) {
  const { data, error } = await supabase
    .from('pdf_documents')
    .select(PDF_SELECT)
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPdfSignedUrl(supabase, storagePath) {
  const { data, error } = await supabase
    .storage
    .from(PDF_BUCKET)
    .createSignedUrl(storagePath, 60 * 30);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

export async function uploadPdfDocument(supabase, { teamId, userId, file, assignmentId = null, onProgress }) {
  const validationError = validatePdfFile(file);
  if (validationError) throw new Error(validationError);

  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'document.pdf';
  const storagePath = `${teamId}/${id}/${safeName}`;

  onProgress?.(15);
  const { data: doc, error: insertError } = await supabase
    .from('pdf_documents')
    .insert({
      id,
      team_id: teamId,
      assignment_id: assignmentId,
      uploaded_by: userId,
      title: file.name,
      storage_path: storagePath,
      file_size_bytes: file.size,
      access_level: 'team',
    })
    .select(PDF_SELECT)
    .single();
  if (insertError) throw insertError;

  try {
    onProgress?.(55);
    const { error: uploadError } = await supabase
      .storage
      .from(PDF_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        contentType: 'application/pdf',
        upsert: false,
      });
    if (uploadError) throw uploadError;
    onProgress?.(100);
    return doc;
  } catch (error) {
    await supabase.from('pdf_documents').delete().eq('id', id);
    throw error;
  }
}

export async function listPdfAnnotations(supabase, documentId) {
  const { data, error } = await supabase
    .from('pdf_annotations')
    .select(ANNOTATION_SELECT)
    .eq('document_id', documentId)
    .in('annotation_type', ['comment', 'highlight'])
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addPdfComment(supabase, { documentId, userId, pageNumber, body, parentId = null }) {
  const { data, error } = await supabase
    .from('pdf_annotations')
    .insert({
      document_id: documentId,
      author_id: userId,
      parent_annotation_id: parentId,
      page_number: pageNumber,
      bbox: { x: 0, y: 0, w: 0, h: 0 },
      content: body.trim(),
      annotation_type: 'comment',
    })
    .select(ANNOTATION_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function addPdfHighlight(supabase, { documentId, userId, pageNumber, text, color = '#facc15' }) {
  const { data, error } = await supabase
    .from('pdf_annotations')
    .insert({
      document_id: documentId,
      author_id: userId,
      page_number: pageNumber,
      bbox: { x: 0, y: 0, w: 100, h: 20, text: text.trim() },
      content: text.trim(),
      annotation_type: 'highlight',
      color,
    })
    .select(ANNOTATION_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function setPdfCommentResolved(supabase, id, resolved) {
  const { error } = await supabase
    .from('pdf_annotations')
    .update({ resolved })
    .eq('id', id);
  if (error) throw error;
}

// Returns { [documentId]: comments[] } sorted newest-first. One round trip
// for all docs in the project — small enough that grouping client-side is
// cheaper than per-doc queries.
export async function listPdfCommentPreviews(supabase, documentIds) {
  if (!documentIds || documentIds.length === 0) return {};
  const { data, error } = await supabase
    .from('pdf_annotations')
    .select(ANNOTATION_SELECT)
    .in('document_id', documentIds)
    .eq('annotation_type', 'comment')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const grouped = {};
  for (const row of (data ?? [])) {
    (grouped[row.document_id] ??= []).push(row);
  }
  return grouped;
}

export async function deletePdfAnnotation(supabase, id) {
  const { error } = await supabase
    .from('pdf_annotations')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

