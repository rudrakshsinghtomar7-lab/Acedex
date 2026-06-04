// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import SelectionLayer from './pdf/SelectionLayer.jsx';
import HighlightBands from './pdf/HighlightBands.jsx';
import { wordsFromDemoSpans, wordsFromTextLayer, bandsForRange, normalizeBands } from './pdf/words.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// US Letter at 72dpi — matches react-pdf's default scale=1 footprint.
const PAGE_W = 612;
const PAGE_H = 792;

// Cap the raster resolution at 2x. iPhones report devicePixelRatio 3, which is
// visually overkill for a PDF and makes the canvas ~2.25x heavier to composite/
// scroll than 2x. 2x stays crisp and moves much more smoothly. (react-pdf
// defaults to window.devicePixelRatio if we don't pass this.)
const RASTER_DPR = Math.min(
  typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
  2,
);

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
  highlights, onLoadSuccess, onLoadError, onPageLoadSuccess, onRenderDone,
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

  // ONE highlight system: every highlight renders via HighlightBands from real
  // rects. Highlights created by word-selection already carry rects. Demo
  // highlights instead carry a word-index range (bbox.range) which we resolve
  // into rects here through the SAME bandsForRange → normalizeBands path the
  // live selection uses — feeding the engine valid input, not a second render
  // branch. content is derived from the actual words so it can't drift.
  const prepared = highlights.map(h => {
    if (Array.isArray(h.bbox?.rects) && h.bbox.rects.length) return h;
    const range = h.bbox?.range;
    if (range && words.length) {
      const bands = bandsForRange(words, range.from, range.to);
      if (bands.length) {
        const lo = Math.max(0, Math.min(range.from, range.to));
        const hi = Math.min(words.length - 1, Math.max(range.from, range.to));
        const text = words.slice(lo, hi + 1).map(w => w.text).join(' ');
        return { ...h, content: h.content || text, bbox: { ...h.bbox, rects: normalizeBands(bands, pageW, pageH) } };
      }
    }
    return h;
  });

  // Defense in depth (Step 4): only rect-bearing highlights render. Anything
  // still rect-less is skipped + logged — except a demo range whose words just
  // haven't been measured yet (transient on first paint), which resolves next
  // render and must not spam warnings.
  const renderHighlights = [];
  for (const h of prepared) {
    if (Array.isArray(h.bbox?.rects) && h.bbox.rects.length) { renderHighlights.push(h); continue; }
    const awaitingMeasure = h.bbox?.range && !words.length;
    if (!awaitingMeasure) console.warn(`[pdf] highlight ${h.id} has no rects — skipped`);
  }

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
              devicePixelRatio={RASTER_DPR}
              onLoadSuccess={page => onPageLoadSuccess?.({
                w: page.originalWidth ?? page.width,
                h: page.originalHeight ?? page.height,
              })}
              onRenderTextLayerSuccess={measure}
              onRenderSuccess={() => { measure(); onRenderDone?.(); }}
            />
          </Document>
        ) : (
          <div className="empty"><div className="spin" style={{ margin: '0 auto' }}/></div>
        )
      )}

      {/* Saved highlights — one path: real rect-based bands over the words. */}
      <div className="pdf-hl-layer" style={{ width: pageW, height: pageH }}>
        {renderHighlights.map(h => (
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
  onPageLoadSuccess,
  onRenderDone,
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
      onPageLoadSuccess={onPageLoadSuccess}
      onRenderDone={onRenderDone}
      activeHighlightId={activeHighlightId}
      onHighlightClick={onHighlightClick}
      onHighlightDelete={onHighlightDelete}
      onSelectionChange={onSelectionChange}
      clearToken={clearToken}
    />
  );
}
