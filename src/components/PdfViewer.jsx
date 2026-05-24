// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// US Letter at 72dpi — matches react-pdf's default scale=1 footprint so the
// dark frame around mock and real pages looks identical.
const PAGE_W = 612;
const PAGE_H = 792;

function lineWidth(page, i) {
  return 60 + ((i * 11 + page * 17) % 36);
}

// Position for highlights without a saved bbox (demo highlights + real ones,
// since our schema stores zero-width placeholder bboxes). Deterministic per
// (page, index) so highlights don't reshuffle on re-render.
function highlightTop(page, idx) {
  return 130 + ((idx * 88 + page * 47) % 480);
}

function HighlightOverlay({ row, top, isActive, onClick, onDelete }) {
  const author = row.author?.full_name || 'User';
  return (
    <button
      type="button"
      className={`pdf-mock-highlight ${isActive ? 'active' : ''}`}
      style={{ top, background: row.color || '#facc15' }}
      onClick={e => { e.stopPropagation(); onClick?.(row); }}
      aria-label={`Highlight by ${author}`}
    >
      <span className="pdf-mock-highlight-text">{row.content || row.bbox?.text || 'Highlight'}</span>
      {isActive && (
        <span
          className="pdf-highlight-popover"
          onClick={e => e.stopPropagation()}
          role="dialog"
        >
          <span>Highlighted by <strong>{author}</strong></span>
          {onDelete && (
            <button
              type="button"
              className="pdf-link-btn pdf-link-btn-warn"
              onClick={() => onDelete(row)}
            >Delete</button>
          )}
        </span>
      )}
    </button>
  );
}

function MockPage({
  doc, pageNumber, zoom, highlights,
  highlightMode, pendingMockLine, onMockLineClick,
  activeHighlightId, onHighlightClick, onHighlightDelete,
}) {
  const lines = Array.from({ length: 22 }, (_, i) => i);
  return (
    <div
      className="pdf-mock-page"
      style={{
        width: PAGE_W * zoom,
        height: PAGE_H * zoom,
        '--pdf-zoom': zoom,
      }}
    >
      <div className="pdf-mock-inner">
        <div className="pdf-mock-header">
          <div className="pdf-mock-title">{doc.title}</div>
          <div className="pdf-mock-subtitle">
            {doc.uploader?.full_name || 'Unknown'} · Page {pageNumber}
          </div>
        </div>
        <div className="pdf-mock-body">
          {lines.map(i => {
            const pickable = !!highlightMode;
            const selected = pendingMockLine === i;
            return (
              <div
                key={i}
                className={`pdf-mock-line ${pickable ? 'mock-line-pickable' : ''} ${selected ? 'mock-line-selected' : ''}`}
                style={{ width: `${lineWidth(pageNumber, i)}%` }}
                onClick={pickable ? () => onMockLineClick?.(i) : undefined}
              />
            );
          })}
        </div>
        <div className="pdf-mock-footer">— {pageNumber} —</div>
        <div className="pdf-mock-overlay">
          {highlights.map((h, idx) => {
            // Demo highlights saved via the picker carry their mock line index.
            const mockLine = h.bbox?.mock_line;
            const top = mockLine != null ? 152 + mockLine * 19 : highlightTop(pageNumber, idx);
            return (
              <HighlightOverlay
                key={h.id}
                row={h}
                top={top}
                isActive={activeHighlightId === h.id}
                onClick={onHighlightClick}
                onDelete={onHighlightDelete}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RealPage({
  viewerUrl, pageNumber, zoom, highlights,
  onLoadSuccess, onLoadError,
  activeHighlightId, onHighlightClick, onHighlightDelete,
}) {
  if (!viewerUrl) {
    return <div className="empty"><div className="spin" style={{ margin: '0 auto' }}/></div>;
  }
  return (
    <div
      className="pdf-real-page"
      style={{ width: PAGE_W * zoom, '--pdf-zoom': zoom }}
    >
      <Document
        file={viewerUrl}
        loading={<div className="empty"><div className="spin" style={{ margin: '0 auto' }}/></div>}
        onLoadSuccess={onLoadSuccess}
        onLoadError={onLoadError}
      >
        <Page pageNumber={pageNumber} scale={zoom} />
      </Document>
      {/* Real highlights — schema stores placeholder bboxes, so position by
          index for now. Replaced when we capture real text-layer coords. */}
      <div className="pdf-mock-overlay">
        {highlights.map((h, idx) => (
          <HighlightOverlay
            key={h.id}
            row={h}
            top={highlightTop(pageNumber, idx) * zoom}
            isActive={activeHighlightId === h.id}
            onClick={onHighlightClick}
            onDelete={onHighlightDelete}
          />
        ))}
      </div>
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
  highlightMode,
  pendingMockLine,
  onMockLineClick,
  activeHighlightId,
  onHighlightClick,
  onHighlightDelete,
}) {
  if (isDemo) {
    if (!doc) {
      return <div className="empty"><div className="spin" style={{ margin: '0 auto' }}/></div>;
    }
    return (
      <MockPage
        doc={doc}
        pageNumber={pageNumber}
        zoom={zoom}
        highlights={highlights}
        highlightMode={highlightMode}
        pendingMockLine={pendingMockLine}
        onMockLineClick={onMockLineClick}
        activeHighlightId={activeHighlightId}
        onHighlightClick={onHighlightClick}
        onHighlightDelete={onHighlightDelete}
      />
    );
  }
  return (
    <RealPage
      viewerUrl={viewerUrl}
      pageNumber={pageNumber}
      zoom={zoom}
      highlights={highlights}
      onLoadSuccess={onLoadSuccess}
      onLoadError={onLoadError}
      activeHighlightId={activeHighlightId}
      onHighlightClick={onHighlightClick}
      onHighlightDelete={onHighlightDelete}
    />
  );
}
