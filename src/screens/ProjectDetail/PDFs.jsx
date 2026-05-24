// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useEffect, useState } from 'react';
import Avatar from '../../components/Avatar.jsx';
import PdfCardModal from '../../components/PdfCardModal.jsx';
import PdfFullViewer from '../../components/PdfFullViewer.jsx';
import { useAuth } from '../../providers/SessionProvider.jsx';
import { useDemoMode } from '../../hooks/useDemoMode.jsx';
import {
  formatFileSize,
  formatRelativeTime,
  formatShortDate,
  listPdfCommentPreviews,
  listPdfDocuments,
  uploadPdfDocument,
  validatePdfFile,
} from '../../lib/pdfs.js';

const PREVIEW_LIMIT = 2;
const SNIPPET_LIMIT = 60;

function snippet(text) {
  if (!text) return '';
  const s = text.replace(/\s+/g, ' ').trim();
  return s.length > SNIPPET_LIMIT ? `${s.slice(0, SNIPPET_LIMIT)}…` : s;
}

function CommentPreviewRow({ row }) {
  const author = row.author?.full_name || 'User';
  const isProf = row.author?.role === 'professor';
  return (
    <div className="pdf-preview-comment">
      <Avatar name={author} size={22}/>
      <div className="pdf-preview-body">
        <div className="pdf-preview-meta">
          <strong>{author}</strong>
          {isProf && <span className="pdf-prof-badge" title="Professor">Prof</span>}
          <span className="pdf-preview-time">{formatRelativeTime(row.created_at)}</span>
        </div>
        <div className="pdf-preview-snippet">"{snippet(row.content)}"</div>
      </div>
    </div>
  );
}

const DEMO_TOOLTIP = 'Upload disabled in demo mode';

// Adapt the per-project demo PDF rows (project.pdfs) into the canonical
// pdf_documents shape so the card modal + full viewer render unchanged.
function adaptDemoPdf(p) {
  return {
    id: p.id,
    title: p.title,
    uploader: { full_name: p.uploaded_by },
    created_at: p.uploaded_at ? `${p.uploaded_at}, 2026` : null,
    file_size_bytes: p.file_size_bytes,
    page_count: p.pages,
    storage_path: null,
  };
}

export default function PDFs({ project, initialPdfId, initialPage }) {
  const { supabase, user } = useAuth();
  const { demoData } = useDemoMode();
  const isDemo = typeof project?.id === 'string' && project.id.startsWith('demo-');

  const [docs, setDocs] = useState(null);
  const [commentsByDoc, setCommentsByDoc] = useState({});
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Two modal slots — at most one is open at a time. Click in the list opens
  // the card; the card's Open button transfers the doc to the full viewer.
  const [cardDoc, setCardDoc] = useState(null);
  const [viewerDoc, setViewerDoc] = useState(null);
  // initialPage is consumed once per viewer-open so closing+reopening manually
  // doesn't keep jumping to the deep-linked page.
  const [viewerPage, setViewerPage] = useState(1);

  useEffect(() => {
    setError(null);
    setCommentsByDoc({});
    if (isDemo) {
      const rows = (project.pdfs || []).map(adaptDemoPdf);
      setDocs(rows);
      // Group demo comments by document_id, newest first. demoData may not be
      // hydrated yet on first paint; the next effect below handles that case.
      const all = demoData?.DEMO_PDF_COMMENTS ?? [];
      const grouped = {};
      for (const c of all) (grouped[c.document_id] ??= []).push(c);
      for (const id of Object.keys(grouped)) {
        grouped[id].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
      setCommentsByDoc(grouped);
      return;
    }
    let cancelled = false;
    setDocs(null);
    listPdfDocuments(supabase, project.id)
      .then(async rows => {
        if (cancelled) return;
        setDocs(rows);
        try {
          const grouped = await listPdfCommentPreviews(supabase, rows.map(r => r.id));
          if (!cancelled) setCommentsByDoc(grouped);
        } catch (e) {
          if (!cancelled) setError(e.message || String(e));
        }
      })
      .catch(e => { if (!cancelled) setError(e.message || String(e)); });
    return () => { cancelled = true; };
  }, [supabase, project.id, project.pdfs, isDemo, demoData]);

  // Deep-link: when a notification routes to /projects/:id/pdfs/:pdfId?page=N
  // and the docs have loaded, auto-open the full viewer on the right PDF and
  // page. Re-fires when initialPdfId changes (new notification with different
  // PDF), but not on every render — the dependency list pins it to changes
  // in either the link target or the loaded docs.
  useEffect(() => {
    if (!initialPdfId || !docs) return;
    const match = docs.find(d => d.id === initialPdfId);
    if (!match) return;
    if (viewerDoc?.id === match.id) return;
    setViewerPage(Math.max(1, Number(initialPage) || 1));
    setCardDoc(null);
    setViewerDoc(match);
  }, [initialPdfId, initialPage, docs]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onFileChange(event) {
    if (isDemo) { event.target.value = ''; return; }
    const file = event.target.files?.[0];
    event.target.value = '';
    const validation = validatePdfFile(file);
    if (validation) { setError(validation); return; }
    setUploading(true);
    setUploadProgress(0);
    setError(null);
    try {
      const doc = await uploadPdfDocument(supabase, {
        teamId: project.id,
        userId: user.id,
        file,
        onProgress: setUploadProgress,
      });
      setDocs(current => [doc, ...(current ?? [])]);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  return (
    <div className="pdf-workspace">
      <div className="pdf-toolbar">
        <div>
          <div className="pdf-kicker">Project PDFs</div>
          <div className="pdf-title">{docs?.length ? `${docs.length} document${docs.length === 1 ? '' : 's'}` : 'No documents yet'}</div>
        </div>
        <label
          className={`btn btn-p btn-sm ${(uploading || isDemo) ? 'disabled' : ''}`}
          title={isDemo ? DEMO_TOOLTIP : undefined}
          aria-disabled={uploading || isDemo}
          onClick={(e) => { if (uploading || isDemo) e.preventDefault(); }}
        >
          Upload
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={onFileChange}
            disabled={uploading || isDemo}
            hidden
          />
        </label>
      </div>

      {uploading && (
        <div className="pdf-upload">
          <div className="pb"><div className="pb-fill" style={{ width: `${uploadProgress}%` }}/></div>
          <div>{uploadProgress < 100 ? 'Uploading PDF...' : 'Finalizing...'}</div>
        </div>
      )}

      {error && (
        <div className="alert" style={{ marginBottom: 14 }}>
          <span>◇</span>
          <div>{error}</div>
        </div>
      )}

      {docs === null ? (
        <div className="empty"><div className="spin" style={{ margin: '0 auto' }}/></div>
      ) : docs.length === 0 ? (
        <div className="empty">
          <div className="empty-i">▧</div>
          <div className="empty-h">No PDFs yet</div>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {isDemo
              ? 'This demo project has no sample PDFs.'
              : 'Upload a project PDF to start review comments and highlights.'}
          </p>
        </div>
      ) : (
        <div className="pdf-grid">
          {docs.map(doc => {
            const allComments = commentsByDoc[doc.id] ?? [];
            const previews = allComments.slice(0, PREVIEW_LIMIT);
            const count = allComments.length;
            return (
              <button
                key={doc.id}
                type="button"
                className="pdf-row pdf-row-grid"
                onClick={() => setCardDoc(doc)}
              >
                <div className="pdf-row-top">
                  <div className="pdf-file-icon">PDF</div>
                  <div className="pdf-row-main">
                    <div className="pdf-row-title">{doc.title}</div>
                    <div className="pdf-row-meta">
                      {doc.uploader?.full_name || 'Unknown'} · {formatShortDate(doc.created_at)} · {formatFileSize(doc.file_size_bytes)}
                    </div>
                  </div>
                </div>
                <div className="pdf-row-comments">
                  <div className="pdf-row-comments-head">
                    <span aria-hidden>💬</span>
                    <span>{count === 0 ? 'No comments yet' : `${count} comment${count === 1 ? '' : 's'}`}</span>
                  </div>
                  {previews.map(c => <CommentPreviewRow key={c.id} row={c}/>)}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {cardDoc && (
        <PdfCardModal
          doc={cardDoc}
          isDemo={isDemo}
          supabase={supabase}
          onClose={() => setCardDoc(null)}
          onOpen={doc => { setCardDoc(null); setViewerPage(1); setViewerDoc(doc); }}
        />
      )}

      {viewerDoc && (
        <PdfFullViewer
          doc={viewerDoc}
          isDemo={isDemo}
          supabase={supabase}
          user={user}
          demoData={demoData}
          initialPage={viewerPage}
          onClose={() => setViewerDoc(null)}
        />
      )}
    </div>
  );
}
