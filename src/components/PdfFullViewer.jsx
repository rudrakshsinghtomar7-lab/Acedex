// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useCallback, useEffect, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import PdfViewer from './PdfViewer.jsx';
import FloatingToolbar from './pdf/FloatingToolbar.jsx';
import {
  addPdfComment,
  addPdfHighlight,
  deletePdfAnnotation,
  formatShortDate,
  getPdfSignedUrl,
  listPdfAnnotations,
  setPdfCommentResolved,
} from '../lib/pdfs.js';

const HIGHLIGHT_COLORS = [
  { value: '#facc15', label: 'Yellow' },
  { value: '#86efac', label: 'Green' },
  { value: '#fda4af', label: 'Pink' },
  { value: '#a5b4fc', label: 'Indigo' },
];

// Smaller default than the inline viewer because the phone-frame canvas is
// only 390px wide; 0.52 fits a 612pt page with a little margin.
const DEFAULT_ZOOM = 0.52;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.2;

function newId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

export default function PdfFullViewer({ isDemo, doc, supabase, user, demoData, onClose, initialPage }) {
  const [viewerUrl, setViewerUrl] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [pageNumber, setPageNumber] = useState(Math.max(1, Number(initialPage) || 1));
  const [pageCount, setPageCount] = useState(doc?.page_count ?? null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [error, setError] = useState(null);
  const [addingComment, setAddingComment] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [selection, setSelection] = useState(null);
  const [clearToken, setClearToken] = useState(0);
  const [savingHl, setSavingHl] = useState(false);
  const [activeHighlightId, setActiveHighlightId] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!doc) return;
    setError(null);
    setPageNumber(Math.max(1, Number(initialPage) || 1));
    setPageCount(doc.page_count ?? null);
    setAnnotations([]);
    setViewerUrl(null);
    setActiveHighlightId(null);
    setSelection(null);
    if (isDemo) {
      const comments = (demoData?.DEMO_PDF_COMMENTS ?? []).filter(a => a.document_id === doc.id);
      const highlights = (demoData?.DEMO_PDF_HIGHLIGHTS ?? []).filter(a => a.document_id === doc.id);
      setAnnotations([...comments, ...highlights]);
      return;
    }
    let cancelled = false;
    Promise.all([
      getPdfSignedUrl(supabase, doc.storage_path),
      listPdfAnnotations(supabase, doc.id),
    ])
      .then(([url, rows]) => {
        if (cancelled) return;
        setViewerUrl(url);
        setAnnotations(rows);
      })
      .catch(e => { if (!cancelled) setError(e.message || String(e)); });
    return () => { cancelled = true; };
  }, [doc, isDemo, supabase, demoData, initialPage]);

  const comments = annotations.filter(a =>
    a.annotation_type === 'comment' && a.page_number === pageNumber);
  const highlights = annotations.filter(a =>
    a.annotation_type === 'highlight' && a.page_number === pageNumber);

  // Drop the live selection and tell the overlay to clear (bumping clearToken).
  const clearSelection = useCallback(() => {
    setSelection(null);
    setClearToken(t => t + 1);
  }, []);

  function startAddComment() {
    setAddingComment(true);
  }

  async function submitComment() {
    const body = commentText.trim();
    if (!body) return;
    if (isDemo) {
      const row = {
        id: newId('demo-c'),
        document_id: doc.id,
        annotation_type: 'comment',
        page_number: pageNumber,
        content: body,
        resolved: false,
        color: null,
        bbox: { x: 0, y: 0, w: 0, h: 0 },
        created_at: new Date().toISOString(),
        author: { id: 'demo-you', full_name: 'You', avatar_url: null },
      };
      setAnnotations(cur => [...cur, row]);
      setCommentText('');
      setAddingComment(false);
      return;
    }
    try {
      const row = await addPdfComment(supabase, {
        documentId: doc.id, userId: user.id, pageNumber, body,
      });
      setAnnotations(cur => [...cur, row]);
      setCommentText('');
      setAddingComment(false);
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  // Highlight the live selection in `color`. New highlights carry real
  // word-range rects (selection.normBands) so they render exactly over the
  // selected words; storage is the existing addPdfHighlight (bbox JSON).
  async function saveHighlight(color) {
    const sel = selection;
    if (!sel || !sel.normBands?.length) return;
    const text = sel.text?.trim() || 'Highlighted passage';
    const rects = sel.normBands;
    if (isDemo) {
      const row = {
        id: newId('demo-h'),
        document_id: doc.id,
        annotation_type: 'highlight',
        page_number: pageNumber,
        content: text,
        color,
        resolved: false,
        bbox: { x: 0, y: 0, w: 0, h: 0, text, rects },
        created_at: new Date().toISOString(),
        author: { id: 'demo-you', full_name: 'You', avatar_url: null },
      };
      setAnnotations(cur => [...cur, row]);
      clearSelection();
      return;
    }
    setSavingHl(true);
    try {
      const row = await addPdfHighlight(supabase, {
        documentId: doc.id, userId: user.id, pageNumber, text, color, rects,
      });
      setAnnotations(cur => [...cur, row]);
      clearSelection();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSavingHl(false);
    }
  }

  // Toolbar → Comment: reuse the existing comment composer for this page.
  function commentFromSelection() {
    clearSelection();
    setAddingComment(true);
  }

  // Toolbar → Copy: copy the selected text to the clipboard.
  async function copySelection() {
    const text = selection?.text?.trim();
    clearSelection();
    if (!text) return;
    try { await navigator.clipboard?.writeText(text); } catch { /* clipboard may be blocked */ }
  }

  async function toggleResolved(row) {
    if (isDemo) {
      setAnnotations(cur => cur.map(a =>
        a.id === row.id ? { ...a, resolved: !row.resolved } : a));
      return;
    }
    try {
      await setPdfCommentResolved(supabase, row.id, !row.resolved);
      setAnnotations(cur => cur.map(a =>
        a.id === row.id ? { ...a, resolved: !row.resolved } : a));
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  async function deleteHighlight(row) {
    setActiveHighlightId(null);
    if (isDemo) {
      setAnnotations(cur => cur.filter(a => a.id !== row.id));
      return;
    }
    try {
      await deletePdfAnnotation(supabase, row.id);
      setAnnotations(cur => cur.filter(a => a.id !== row.id));
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  function dismissActiveHighlight() {
    if (activeHighlightId != null) setActiveHighlightId(null);
  }

  // Swipe-left/right to flip pages. We track the starting touch point and
  // only fire when the gesture is dominantly horizontal — vertical scrolls
  // and pinches are left alone. Disabled while the user is in highlight
  // mode so dragging across text to select doesn't accidentally page.
  const touchStartRef = useRef(null);
  function onTouchStart(e) {
    if (selection) return; // don't page-swipe while a selection is active
    if (e.touches.length !== 1) { touchStartRef.current = null; return; }
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 60) return;
    if (Math.abs(dy) > Math.abs(dx) * 0.7) return;
    if (dx < 0 && (pageCount ? pageNumber < pageCount : true)) {
      setPageNumber(n => n + 1);
    } else if (dx > 0 && pageNumber > 1) {
      setPageNumber(n => Math.max(1, n - 1));
    }
  }

  return (
    <div className="ovl pdf-full-ovl" onClick={onClose}>
      <div
        ref={containerRef}
        className="pdf-fullviewer"
        onClick={e => { e.stopPropagation(); dismissActiveHighlight(); }}
        role="dialog"
        aria-modal="true"
      >
        <header className="pdf-fullviewer-head">
          <div className="pdf-fullviewer-titleblock">
            <div className="pdf-kicker">{isDemo ? 'Demo PDF' : 'Viewing'}</div>
            <div className="pdf-title">{doc?.title}</div>
          </div>
          <div className="pdf-fullviewer-actions">
            <button
              type="button"
              className={`btn btn-p btn-sm ${addingComment ? 'btn-active' : ''}`}
              onClick={() => addingComment ? setAddingComment(false) : startAddComment()}
            >Add Comment</button>
            <button
              type="button"
              className="btn-icon-x"
              aria-label="Close"
              onClick={onClose}
            >×</button>
          </div>
        </header>

        <div className="pdf-mode-banner pdf-sel-hint">
          <span aria-hidden>✦</span> Press and hold any word to select, then highlight.
        </div>

        {error && (
          <div className="alert pdf-fullviewer-err">
            <span>◇</span><div>{error}</div>
          </div>
        )}

        <div className="pdf-fullviewer-body">
          <div
            className="pdf-fullviewer-doc"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div className="pdf-viewer-controls">
              <button className="btn btn-g btn-sm" disabled={pageNumber <= 1} onClick={() => setPageNumber(n => Math.max(1, n - 1))}>Prev</button>
              <span>Page {pageNumber}{pageCount ? ` / ${pageCount}` : ''}</span>
              <button className="btn btn-g btn-sm" disabled={pageCount ? pageNumber >= pageCount : false} onClick={() => setPageNumber(n => n + 1)}>Next</button>
              <button className="btn btn-g btn-sm" onClick={() => setZoom(z => Math.max(MIN_ZOOM, Number((z - 0.1).toFixed(2))))}>−</button>
              <button className="btn btn-g btn-sm" onClick={() => setZoom(z => Math.min(MAX_ZOOM, Number((z + 0.1).toFixed(2))))}>+</button>
            </div>
            <div className="pdf-document-frame pdf-document-frame-lg">
              <PdfViewer
                isDemo={isDemo}
                doc={doc}
                pageNumber={pageNumber}
                zoom={zoom}
                highlights={highlights}
                viewerUrl={viewerUrl}
                onLoadSuccess={({ numPages }) => setPageCount(numPages)}
                onLoadError={e => setError(e.message || String(e))}
                activeHighlightId={activeHighlightId}
                onHighlightClick={row => setActiveHighlightId(prev => prev === row.id ? null : row.id)}
                onHighlightDelete={deleteHighlight}
                onSelectionChange={setSelection}
                clearToken={clearToken}
              />
            </div>
          </div>

          <aside className="pdf-fullviewer-side">
            <div className="pdf-section-head">
              <h3>Comments</h3>
              <span className="pdf-muted">Page {pageNumber} · {comments.length}</span>
            </div>

            {addingComment && (
              <div className="pdf-comment-box">
                <textarea
                  className="textarea"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder={`Comment on page ${pageNumber}`}
                  autoFocus
                />
                <div className="pdf-comment-box-actions">
                  <button
                    className="btn btn-p btn-sm"
                    disabled={!commentText.trim()}
                    onClick={submitComment}
                  >Save</button>
                  <button
                    className="btn btn-g btn-sm"
                    onClick={() => { setAddingComment(false); setCommentText(''); }}
                  >Cancel</button>
                </div>
              </div>
            )}

            {comments.length === 0 ? (
              <div className="pdf-muted">No comments on this page yet.</div>
            ) : comments.map(row => (
              <div key={row.id} className={`pdf-comment ${row.resolved ? 'resolved' : ''}`}>
                <Avatar name={row.author?.full_name || 'User'} size={26}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="pdf-comment-meta">
                    <strong>{row.author?.full_name || 'User'}</strong>
                    <span>{formatShortDate(row.created_at)}</span>
                  </div>
                  <div className="pdf-comment-body">{row.content}</div>
                  <button
                    className="pdf-link-btn"
                    onClick={() => toggleResolved(row)}
                  >{row.resolved ? 'Reopen' : 'Resolve'}</button>
                </div>
              </div>
            ))}
          </aside>
        </div>

        <FloatingToolbar
          selection={selection}
          containerRef={containerRef}
          colors={HIGHLIGHT_COLORS}
          busy={savingHl}
          onHighlight={saveHighlight}
          onComment={commentFromSelection}
          onCopy={copySelection}
        />
      </div>
    </div>
  );
}
