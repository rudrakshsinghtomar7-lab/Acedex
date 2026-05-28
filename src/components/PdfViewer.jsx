// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import SelectionLayer from './pdf/SelectionLayer.jsx';
import HighlightBands from './pdf/HighlightBands.jsx';
import { wordsFromDemoSpans, wordsFromTextLayer } from './pdf/words.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// US Letter at 72dpi — matches react-pdf's default scale=1 footprint.
const PAGE_W = 612;
const PAGE_H = 792;

// Legacy fallback position for highlights with no real rects (old placeholder
// bboxes). Deterministic per (page, index) so they don't reshuffle.
function highlightTop(page, idx) {
  return 130 + ((idx * 88 + page * 47) % 480);
}

// Deterministic placeholder prose for demo pages so the SAME word-selection
// engine runs in demo and real. Not lorem-random — seeded by page so demo
// highlights/screenshots are stable.
const WORD_BANK = ('the model detects and mitigates factual errors in large language '
  + 'systems using a curated dataset of common knowledge questions while retrieval '
  + 'augmented generation reduces fabrication across three evaluated domains with '
  + 'consistent gains over the baseline approach and a careful human study').split(' ');

function demoLines(pageNumber) {
  const lines = [];
  let seed = pageNumber * 7;
  for (let r = 0; r < 20; r++) {
    const n = 7 + ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 5); // 7–11 words
    const line = [];
    for (let i = 0; i < n; i++) {
      line.push(WORD_BANK[(seed + i * 13 + r * 5) % WORD_BANK.length]);
    }
    lines.push(line);
  }
  return lines;
}

// One rendered page: content + word measurement + selection overlay + saved
// highlights. Demo and real share everything below the content render.
function PdfPage({
  isDemo, doc, viewerUrl, pageNumber, zoom,
  highlights, onLoadSuccess, onLoadError,
  activeHighlightId, onHighlightClick, onHighlightDelete,
  onSelectionChange, clearToken,
}) {
  const pageRef = useRef(null);
  const [words, setWords] = useState([]);
  // Rendered content size. Demo is Letter*zoom; a real PDF page can be any
  // aspect ratio, so we read the actual rendered page box after render.
  const [size, setSize] = useState({ w: PAGE_W * zoom, h: PAGE_H * zoom });
  const pageW = size.w;
  const pageH = size.h;

  const measure = useCallback(() => {
    const el = pageRef.current;
    if (!el) return;
    if (isDemo) {
      setSize({ w: PAGE_W * zoom, h: PAGE_H * zoom });
      setWords(wordsFromDemoSpans(el));
    } else {
      const pageEl = el.querySelector('.react-pdf__Page');
      if (pageEl) setSize({ w: pageEl.clientWidth, h: pageEl.clientHeight });
      setWords(wordsFromTextLayer(el));
    }
  }, [isDemo, zoom]);

  // Demo: words are our own spans — measure after layout + on zoom.
  useLayoutEffect(() => {
    if (!isDemo) return;
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [isDemo, zoom, pageNumber, measure]);

  // Re-measure on viewport resize (rotation / safe-area changes).
  useEffect(() => {
    const onResize = () => requestAnimationFrame(measure);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure]);

  const newHighlights = highlights.filter(h => Array.isArray(h.bbox?.rects) && h.bbox.rects.length);
  const legacyHighlights = highlights.filter(h => !(Array.isArray(h.bbox?.rects) && h.bbox.rects.length));

  return (
    <div
      ref={pageRef}
      className={isDemo ? 'pdf-mock-page' : 'pdf-real-page'}
      style={{ width: isDemo ? pageW : undefined, height: isDemo ? pageH : undefined, '--pdf-zoom': zoom }}
    >
      {isDemo ? (
        <div className="pdf-mock-inner">
          <div className="pdf-mock-header">
            <div className="pdf-mock-title">{doc.title}</div>
            <div className="pdf-mock-subtitle">
              {doc.uploader?.full_name || 'Unknown'} · Page {pageNumber}
            </div>
          </div>
          <div className="pdf-mock-body">
            {demoLines(pageNumber).map((line, li) => (
              <p key={li} className="pdf-mock-para">
                {line.map((w, wi) => (
                  <span key={wi} data-w>{w}</span>
                ))}
              </p>
            ))}
          </div>
          <div className="pdf-mock-footer">— {pageNumber} —</div>
        </div>
      ) : (
        viewerUrl ? (
          <Document
            file={viewerUrl}
            loading={<div className="empty"><div className="spin" style={{ margin: '0 auto' }}/></div>}
            onLoadSuccess={onLoadSuccess}
            onLoadError={onLoadError}
          >
            <Page
              pageNumber={pageNumber}
              scale={zoom}
              onRenderTextLayerSuccess={measure}
            />
          </Document>
        ) : (
          <div className="empty"><div className="spin" style={{ margin: '0 auto' }}/></div>
        )
      )}

      {/* Saved highlights — new ones render as real bands over the words. */}
      <div className="pdf-hl-layer" style={{ width: pageW, height: pageH }}>
        {newHighlights.map(h => (
          <HighlightBands
            key={h.id}
            row={h}
            pageW={pageW}
            pageH={pageH}
            isActive={activeHighlightId === h.id}
            onClick={onHighlightClick}
            onDelete={onHighlightDelete}
          />
        ))}
        {/* Legacy + demo-fixture highlights keep the chip rendering. */}
        {legacyHighlights.map((h, idx) => {
          const mockLine = h.bbox?.mock_line;
          const top = mockLine != null ? (152 + mockLine * 19) * (isDemo ? 1 : zoom) : highlightTop(pageNumber, idx) * (isDemo ? 1 : zoom);
          const author = h.author?.full_name || 'User';
          const isActive = activeHighlightId === h.id;
          return (
            <button
              key={h.id}
              type="button"
              className={`pdf-mock-highlight ${isActive ? 'active' : ''}`}
              style={{ top, background: h.color || '#facc15' }}
              onClick={e => { e.stopPropagation(); onHighlightClick?.(h); }}
              aria-label={`Highlight by ${author}`}
            >
              <span className="pdf-mock-highlight-text">{h.content || h.bbox?.text || 'Highlight'}</span>
              {isActive && (
                <span className="pdf-highlight-popover" onClick={e => e.stopPropagation()} role="dialog">
                  <span>Highlighted by <strong>{author}</strong></span>
                  {onHighlightDelete && (
                    <button type="button" className="pdf-link-btn pdf-link-btn-warn" onClick={() => onHighlightDelete(h)}>Delete</button>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom selection overlay (native selection suppressed via CSS). */}
      <SelectionLayer
        words={words}
        pageW={pageW}
        pageH={pageH}
        clearToken={clearToken}
        onSelectionChange={onSelectionChange}
      />
    </div>
  );
}

export default function PdfViewer({
  isDemo,
  doc,
  pageNumber,
  zoom,
  highlights,
  viewerUrl,
  onLoadSuccess,
  onLoadError,
  activeHighlightId,
  onHighlightClick,
  onHighlightDelete,
  onSelectionChange,
  clearToken,
}) {
  if (isDemo && !doc) {
    return <div className="empty"><div className="spin" style={{ margin: '0 auto' }}/></div>;
  }
  return (
    <PdfPage
      isDemo={isDemo}
      doc={doc}
      viewerUrl={viewerUrl}
      pageNumber={pageNumber}
      zoom={zoom}
      highlights={highlights}
      onLoadSuccess={onLoadSuccess}
      onLoadError={onLoadError}
      activeHighlightId={activeHighlightId}
      onHighlightClick={onHighlightClick}
      onHighlightDelete={onHighlightDelete}
      onSelectionChange={onSelectionChange}
      clearToken={clearToken}
    />
  );
}
