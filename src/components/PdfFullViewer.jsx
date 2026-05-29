// © 2026 Rudraksh Singh Tomar. All rights reserved.
//
// Full-page PDF review workspace (.pdfx). Edge-to-edge surface with chrome
// (header + bottom toolbar + zoom) that slides away on a tap. Highlighting is
// the shipped Adobe-style word-snap system: press-and-hold a word to select,
// then the FloatingToolbar offers Highlight / Comment / Copy. Saved highlights
// carry real word-range rects so they render exactly over the selected words.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

// US Letter point width — the inner page renders at this * zoom.
const PAGE_W = 612;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;
const FIT_MAX = 1.0;        // cap the auto fit-to-width so big screens don't over-scale
const FIT_PAD = 24;         // horizontal padding inside the doc surface

// Gesture thresholds. A "tap" is brief + still (toggles chrome); a long-press
// is held (the word-snap SelectionLayer takes it over); a swipe moves
// horizontally (flips pages). These keep tap-to-toggle from firing during
// selection, scrolling, paging, or pinch-zoom.
const TAP_MAX_MS = 300;
const LONG_PRESS_MS = 400;
const MOVE_TOL = 10;
const SWIPE_MIN = 60;

// Targets that own their own tap behaviour — a tap landing on any of these
// must NOT toggle chrome (saved highlights, the selection bands/handles, the
// floating toolbar, popovers, and any real control).
const NO_TOGGLE_SEL =
  '.pdf-hl-band, .pdf-mock-highlight, .pdf-highlight-popover, .pdf-sel-band, ' +
  '.pdf-sel-handle, .pdf-fl-toolbar, button, a, input, textarea, select, [data-no-toggle]';

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function newId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

// "Dr. Sarah Rivera" → "Sarah"; "Marcus Lee" → "Marcus". Strips a leading
// honorific so the professor prefix below doesn't read "Prof. Dr.".
function shortName(fullName) {
  if (!fullName) return 'Someone';
  const parts = fullName.trim().split(/\s+/);
  const HONORIFICS = new Set(['dr.', 'dr', 'prof.', 'prof', 'mr.', 'mr', 'ms.', 'ms', 'mrs.', 'mrs']);
  while (parts.length > 1 && HONORIFICS.has(parts[0].toLowerCase())) parts.shift();
  return parts[0];
}
function reviewerLabel(author) {
  const name = shortName(author?.full_name);
  return author?.role === 'professor' ? `Prof. ${name}` : name;
}

export default function PdfFullViewer({ isDemo, doc, projectId, supabase, user, demoData, onClose, initialPage }) {
  const [viewerUrl, setViewerUrl] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [pageNumber, setPageNumber] = useState(Math.max(1, Number(initialPage) || 1));
  const [pageCount, setPageCount] = useState(doc?.page_count ?? null);
  const [fitZoom, setFitZoom] = useState(0.6);
  const [zoom, setZoom] = useState(0.6);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Chrome (header + toolbar) visibility — resets to visible on every open.
  const [chromeVisible, setChromeVisible] = useState(true);
  // On-demand surfaces.
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [activeHighlightId, setActiveHighlightId] = useState(null);
  const [eraseMode, setEraseMode] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Word-snap selection (reported up by SelectionLayer via PdfViewer).
  const [selection, setSelection] = useState(null);
  const [clearToken, setClearToken] = useState(0);
  const [savingHl, setSavingHl] = useState(false);

  const rootRef = useRef(null);
  const docRef = useRef(null);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // iOS Safari (and especially the home-screen PWA) can still *begin* a native
  // text selection on the PDF even with user-select:none, which is what pops the
  // OS Copy/Look Up/Share callout. Cancelling selectstart on the doc surface
  // stops it before it starts. The comment composer lives outside docRef, so its
  // editing/selection is untouched; our word-snap overlay uses pointer events
  // (not native selection), so long-press selection keeps working.
  useEffect(() => {
    const el = docRef.current;
    if (!el) return;
    const blockNativeSelect = e => e.preventDefault();
    el.addEventListener('selectstart', blockNativeSelect);
    return () => el.removeEventListener('selectstart', blockNativeSelect);
  }, []);

  // Reset everything when the open document changes (deep-link re-open included).
  useEffect(() => {
    if (!doc) return;
    setError(null);
    setToast(null);
    setPageNumber(Math.max(1, Number(initialPage) || 1));
    setPageCount(doc.page_count ?? null);
    setAnnotations([]);
    setViewerUrl(null);
    setActiveHighlightId(null);
    setChromeVisible(true);
    setCommentsOpen(false);
    setCommentText('');
    setSelection(null);
    setEraseMode(false);
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

  // Fit the page to the surface width so the PDF is the dominant element.
  useLayoutEffect(() => {
    function measure() {
      const el = docRef.current;
      if (!el) return;
      const z = clamp((el.clientWidth - FIT_PAD) / PAGE_W, MIN_ZOOM, FIT_MAX);
      setFitZoom(z);
      setZoom(z);
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [doc]);

  // ── Review context (document-wide) ──────────────────────────────────────
  const allComments = useMemo(
    () => annotations.filter(a => a.annotation_type === 'comment'), [annotations]);
  const reviewLine = useMemo(() => {
    const cCount = allComments.length;
    const seen = new Set();
    const names = [];
    for (const h of annotations) {
      if (h.annotation_type !== 'highlight' || !h.author) continue;
      const key = h.author.id || h.author.full_name;
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(reviewerLabel(h.author));
    }
    if (cCount === 0 && names.length === 0) return 'No comments or highlights yet';
    const parts = [`${cCount} comment${cCount === 1 ? '' : 's'}`];
    if (names.length) parts.push(`highlighted by ${names.join(', ')}`);
    return parts.join(' · ');
  }, [annotations, allComments]);

  // Current-page slices for the inner viewer + comments sheet.
  const pageComments = annotations.filter(a =>
    a.annotation_type === 'comment' && a.page_number === pageNumber);
  const pageHighlights = annotations.filter(a =>
    a.annotation_type === 'highlight' && a.page_number === pageNumber);

  function flipPage(dir) {
    setActiveHighlightId(null);
    if (dir > 0 && (pageCount ? pageNumber < pageCount : true)) setPageNumber(n => n + 1);
    else if (dir < 0 && pageNumber > 1) setPageNumber(n => Math.max(1, n - 1));
  }

  // Drop the live selection and tell the overlay to clear (bumping clearToken).
  const clearSelection = useCallback(() => {
    setSelection(null);
    setClearToken(t => t + 1);
  }, []);

  function openComments() {
    clearSelection();
    setActiveHighlightId(null);
    setEraseMode(false);
    setChromeVisible(true);
    setCommentsOpen(true);
  }

  // Eraser toggle: while on, a tap on any highlight deletes it (no popover) so
  // students/profs can quickly clear a highlight and re-highlight.
  function toggleErase() {
    clearSelection();
    setActiveHighlightId(null);
    setCommentsOpen(false);
    setChromeVisible(true);
    setEraseMode(v => !v);
  }

  // ── Empty-area tap routing (called only after the gesture filter passes) ──
  function onDocTap() {
    if (selection) { clearSelection(); return; }
    if (activeHighlightId != null) { setActiveHighlightId(null); return; }
    if (eraseMode) { setEraseMode(false); return; }
    if (commentsOpen) { setCommentsOpen(false); return; }
    setChromeVisible(v => !v);
  }

  // ── Unified pointer gesture detector (tap / swipe / long-press / pinch) ──
  // Per-gesture mutable state lives in refs so it survives across events; the
  // handlers themselves read live state (zoom, selection…) from the latest
  // render closure. The word-snap SelectionLayer below owns the long-press →
  // selection gesture; this detector only acts on plain taps, swipes, pinches.
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const pinch = useRef(null);
  const longTimer = useRef(null);

  function endGesture() {
    pointers.current.clear();
    gesture.current = null;
    pinch.current = null;
    clearTimeout(longTimer.current);
  }

  function onPointerDown(e) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const size = pointers.current.size;
    if (size === 1) {
      gesture.current = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false, long: false, multi: false };
      clearTimeout(longTimer.current);
      longTimer.current = setTimeout(() => { if (gesture.current) gesture.current.long = true; }, LONG_PRESS_MS);
    } else if (size === 2) {
      if (gesture.current) gesture.current.multi = true;
      clearTimeout(longTimer.current);
      const [a, b] = [...pointers.current.values()];
      pinch.current = { startDist: dist(a, b) || 1, startZoom: zoom, active: true };
    }
  }

  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current?.active && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const ratio = dist(a, b) / pinch.current.startDist;
      setZoom(clamp(Number((pinch.current.startZoom * ratio).toFixed(3)), MIN_ZOOM, MAX_ZOOM));
      return;
    }
    const g = gesture.current;
    if (g && pointers.current.size === 1) {
      // Keep the running delta on the gesture so a swipe can still be resolved
      // if iOS fires pointercancel before pointerup (common on a scrollable
      // surface with touch-action:pan-y).
      g.dx = e.clientX - g.x;
      g.dy = e.clientY - g.y;
      if (Math.abs(g.dx) > MOVE_TOL || Math.abs(g.dy) > MOVE_TOL) {
        g.moved = true;
        clearTimeout(longTimer.current);
      }
    }
  }

  // A horizontal swipe flips pages — only at fit zoom, never while a word
  // selection is active (so a selection-extend drag never paginates). Called
  // from both pointerup and pointercancel so the gesture survives either ending.
  function maybeSwipe(g, dx, dy) {
    if (!g || g.multi || g.long || selection) return;
    if (zoom > fitZoom + 0.02) return; // zoomed in — leave horizontal to panning
    if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dy) <= Math.abs(dx) * 0.7) {
      flipPage(dx < 0 ? 1 : -1);
    }
  }

  function onPointerUp(e) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) {
      if (pointers.current.size < 2 && pinch.current) pinch.current.active = false;
      return;
    }
    const g = gesture.current;
    endGesture();
    if (!g || g.multi) return;

    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;

    if (g.moved) { maybeSwipe(g, dx, dy); return; }
    if (g.long) return;                              // long-press → word selection
    if (Date.now() - g.t > TAP_MAX_MS) return;       // too slow for a tap
    if (e.target.closest?.(NO_TOGGLE_SEL)) return;   // landed on a control
    onDocTap();
  }

  function onPointerCancel(e) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) {
      if (pointers.current.size < 2 && pinch.current) pinch.current.active = false;
      return;
    }
    // iOS can cancel a single-finger horizontal drag mid-swipe; resolve the
    // flip from the last recorded delta before tearing the gesture down.
    const g = gesture.current;
    endGesture();
    if (g && g.moved) maybeSwipe(g, g.dx ?? 0, g.dy ?? 0);
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  async function submitComment() {
    const body = commentText.trim();
    if (!body) return;
    if (isDemo) {
      const row = {
        id: newId('demo-c'), document_id: doc.id, annotation_type: 'comment',
        page_number: pageNumber, content: body, resolved: false, color: null,
        bbox: { x: 0, y: 0, w: 0, h: 0 }, created_at: new Date().toISOString(),
        author: { id: 'demo-you', full_name: 'You', avatar_url: null, role: user?.role || 'student' },
      };
      setAnnotations(cur => [...cur, row]);
      setCommentText('');
      return;
    }
    try {
      const row = await addPdfComment(supabase, { documentId: doc.id, userId: user.id, pageNumber, body });
      setAnnotations(cur => [...cur, row]);
      setCommentText('');
    } catch (e) { setError(e.message || String(e)); }
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
        id: newId('demo-h'), document_id: doc.id, annotation_type: 'highlight',
        page_number: pageNumber, content: text, color, resolved: false,
        bbox: { x: 0, y: 0, w: 0, h: 0, text, rects },
        created_at: new Date().toISOString(),
        author: { id: 'demo-you', full_name: 'You', avatar_url: null, role: user?.role || 'student' },
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

  // FloatingToolbar → Comment: drop the selection and open the comment sheet.
  function commentFromSelection() {
    clearSelection();
    openComments();
  }

  // FloatingToolbar → Copy: copy the selected text to the clipboard.
  async function copySelection() {
    const text = selection?.text?.trim();
    clearSelection();
    if (!text) return;
    try { await navigator.clipboard?.writeText(text); flashToast('Copied'); }
    catch { /* clipboard may be blocked */ }
  }

  async function toggleResolved(row) {
    if (isDemo) {
      setAnnotations(cur => cur.map(a => a.id === row.id ? { ...a, resolved: !row.resolved } : a));
      return;
    }
    try {
      await setPdfCommentResolved(supabase, row.id, !row.resolved);
      setAnnotations(cur => cur.map(a => a.id === row.id ? { ...a, resolved: !row.resolved } : a));
    } catch (e) { setError(e.message || String(e)); }
  }

  async function deleteHighlight(row) {
    setActiveHighlightId(null);
    if (isDemo) { setAnnotations(cur => cur.filter(a => a.id !== row.id)); return; }
    try {
      await deletePdfAnnotation(supabase, row.id);
      setAnnotations(cur => cur.filter(a => a.id !== row.id));
    } catch (e) { setError(e.message || String(e)); }
  }

  function flashToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(t => (t === msg ? null : t)), 1800);
  }

  async function onDownload() {
    if (isDemo || downloading) return;
    setDownloading(true);
    try {
      const url = await getPdfSignedUrl(supabase, doc.storage_path);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = doc.title || 'document.pdf';
      a.rel = 'noopener';
      a.target = '_blank';
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
    } catch (e) { setError(e.message || String(e)); }
    finally { setDownloading(false); }
  }

  // Share the in-Acedex deep LINK (never the file blob) so RLS/team
  // permissions still gate who can open it.
  async function onShare() {
    if (isDemo) return;
    const url = `${window.location.origin}/Acedex/projects/${projectId}/pdfs/${doc.id}`;
    const shareData = { title: doc.title, text: `Review “${doc.title}” on Acedex`, url };
    try {
      if (navigator.share) { await navigator.share(shareData); return; }
      await navigator.clipboard.writeText(url);
      flashToast('Link copied');
    } catch (e) {
      if (e?.name === 'AbortError') return; // user dismissed the share sheet
      try { await navigator.clipboard.writeText(url); flashToast('Link copied'); }
      catch { flashToast('Could not share'); }
    }
  }

  const pageLabel = `${pageNumber} / ${pageCount ?? '–'}`;
  const chromeHidden = !chromeVisible;
  const showHint = chromeVisible && !commentsOpen && !selection;
  const hintText = eraseMode
    ? '✦ Tap a highlight to remove it'
    : '✦ Press & hold a word to highlight';

  return (
    <div
      className={`pdfx ${eraseMode ? 'pdfx-erasing' : ''}`}
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={doc?.title || 'PDF'}
    >
      {/* Document surface — the gesture target. Fixed padding clears the chrome
          so the page never shifts when chrome toggles. */}
      <div
        className="pdfx-doc"
        ref={docRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div className="pdfx-stage">
          <PdfViewer
            isDemo={isDemo}
            doc={doc}
            pageNumber={pageNumber}
            zoom={zoom}
            highlights={pageHighlights}
            viewerUrl={viewerUrl}
            onLoadSuccess={({ numPages }) => setPageCount(numPages)}
            onLoadError={e => setError(e.message || String(e))}
            activeHighlightId={activeHighlightId}
            onHighlightClick={row => eraseMode
              ? deleteHighlight(row)
              : setActiveHighlightId(prev => prev === row.id ? null : row.id)}
            onHighlightDelete={deleteHighlight}
            onSelectionChange={setSelection}
            clearToken={clearToken}
          />
        </div>
      </div>

      {/* Top header — review context. */}
      <header className={`pdfx-header ${chromeHidden ? 'pdfx-hidden-top' : ''}`}>
        <div className="pdfx-head-row">
          <button type="button" className="btn-icon-x" aria-label="Close" onClick={onClose}>×</button>
          <div className="pdfx-title" title={doc?.title}>{doc?.title}</div>
          <div className="pdfx-pagenav">
            <button
              type="button"
              className="pdfx-pagebtn"
              aria-label="Previous page"
              disabled={pageNumber <= 1}
              onClick={() => flipPage(-1)}
            >‹</button>
            <span className="pdfx-pageind" aria-label={`Page ${pageLabel}`}>{pageLabel}</span>
            <button
              type="button"
              className="pdfx-pagebtn"
              aria-label="Next page"
              disabled={pageCount ? pageNumber >= pageCount : false}
              onClick={() => flipPage(1)}
            >›</button>
          </div>
        </div>
        <div className="pdfx-review" title={reviewLine}>{reviewLine}</div>
      </header>

      {/* Compact zoom control — part of the chrome, slides away with it. */}
      <div className={`pdfx-zoom ${chromeHidden ? 'pdfx-hidden-zoom' : ''}`}>
        <button type="button" aria-label="Zoom out"
          onClick={() => setZoom(z => clamp(Number((z - 0.15).toFixed(3)), MIN_ZOOM, MAX_ZOOM))}>−</button>
        <button type="button" aria-label="Fit width" className="pdfx-zoom-fit" onClick={() => setZoom(fitZoom)}>Fit</button>
        <button type="button" aria-label="Zoom in"
          onClick={() => setZoom(z => clamp(Number((z + 0.15).toFixed(3)), MIN_ZOOM, MAX_ZOOM))}>+</button>
      </div>

      {/* Hint — fades with the chrome, hidden during select/sheet. Reflects the
          current mode (highlight vs erase). */}
      {showHint && (
        <div className={`pdfx-hint ${eraseMode ? 'pdfx-hint-erase' : ''}`} aria-hidden>{hintText}</div>
      )}

      {/* Bottom toolbar — Erase / Comment / Download / Share. Adding a highlight
          lives in the on-selection FloatingToolbar (press & hold), so it isn't a
          toolbar button; Erase is the quick way to clear one and re-highlight. */}
      <nav className={`pdfx-toolbar ${chromeHidden ? 'pdfx-hidden-bottom' : ''}`} aria-label="PDF actions">
        <button
          type="button"
          className={`pdfx-tool pdfx-tool-erase ${eraseMode ? 'active' : ''}`}
          aria-pressed={eraseMode}
          onClick={toggleErase}
        >
          <span className="pdfx-tool-i" aria-hidden>⌫</span>
          <span className="pdfx-tool-l">{eraseMode ? 'Done' : 'Erase'}</span>
        </button>
        <button
          type="button"
          className={`pdfx-tool ${commentsOpen ? 'active' : ''}`}
          onClick={() => (commentsOpen ? setCommentsOpen(false) : openComments())}
        >
          <span className="pdfx-tool-i" aria-hidden>💬</span>
          <span className="pdfx-tool-l">Comment{allComments.length ? ` · ${allComments.length}` : ''}</span>
        </button>
        <button
          type="button"
          className="pdfx-tool"
          disabled={isDemo || downloading}
          title={isDemo ? 'Download disabled in demo mode' : undefined}
          onClick={onDownload}
        >
          <span className="pdfx-tool-i" aria-hidden>⬇</span>
          <span className="pdfx-tool-l">{downloading ? 'Preparing…' : 'Download'}</span>
        </button>
        <button
          type="button"
          className="pdfx-tool"
          disabled={isDemo}
          title={isDemo ? 'Share disabled in demo mode' : 'Share link'}
          onClick={onShare}
        >
          <span className="pdfx-tool-i" aria-hidden>🔗</span>
          <span className="pdfx-tool-l">Share</span>
        </button>
      </nav>

      {/* Floating action bar over the live word selection (Highlight/Comment/Copy). */}
      <FloatingToolbar
        selection={selection}
        containerRef={rootRef}
        colors={HIGHLIGHT_COLORS}
        busy={savingHl}
        onHighlight={saveHighlight}
        onComment={commentFromSelection}
        onCopy={copySelection}
      />

      {/* Comments — on-demand bottom sheet. */}
      {commentsOpen && (
        <>
          <div className="pdfx-sheet-scrim" onClick={() => setCommentsOpen(false)} />
          <section className="pdfx-sheet" role="dialog" aria-label="Comments">
            <div className="pdfx-sheet-grab" />
            <div className="pdf-section-head">
              <h3>Comments</h3>
              <span className="pdf-muted">Page {pageNumber} · {pageComments.length}</span>
            </div>
            <div className="pdfx-sheet-list">
              {pageComments.length === 0 ? (
                <div className="pdf-muted">No comments on this page yet.</div>
              ) : pageComments.map(row => (
                <div key={row.id} className={`pdf-comment ${row.resolved ? 'resolved' : ''}`}>
                  <Avatar name={row.author?.full_name || 'User'} size={26} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="pdf-comment-meta">
                      <strong>{row.author?.full_name || 'User'}</strong>
                      <span>{formatShortDate(row.created_at)}</span>
                    </div>
                    <div className="pdf-comment-body">{row.content}</div>
                    <button className="pdf-link-btn" onClick={() => toggleResolved(row)}>
                      {row.resolved ? 'Reopen' : 'Resolve'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="pdfx-composer">
              <textarea
                className="textarea"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder={`Comment on page ${pageNumber}`}
              />
              <button className="btn btn-p btn-sm" disabled={!commentText.trim()} onClick={submitComment}>Send</button>
            </div>
          </section>
        </>
      )}

      {error && (
        <div className="pdfx-err alert" role="alert">
          <span>◇</span><div>{error}</div>
          <button type="button" className="pdfx-err-x" aria-label="Dismiss" onClick={() => setError(null)}>×</button>
        </div>
      )}
      {toast && <div className="pdfx-toast" role="status">{toast}</div>}
    </div>
  );
}
