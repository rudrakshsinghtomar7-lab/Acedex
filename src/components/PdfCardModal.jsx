import { useEffect, useState } from 'react';
import Avatar from './Avatar.jsx';
import { formatFileSize, formatShortDate, getPdfSignedUrl } from '../lib/pdfs.js';

export default function PdfCardModal({ doc, isDemo, supabase, onClose, onOpen }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function onDownload() {
    if (isDemo || downloading) return;
    setError(null);
    setDownloading(true);
    try {
      const url = await getPdfSignedUrl(supabase, doc.storage_path);
      // Force a download by opening in a hidden anchor with the `download`
      // attribute. The signed URL points at object storage which serves the
      // PDF inline; the attribute tells the browser to save instead.
      const a = window.document.createElement('a');
      a.href = url;
      a.download = doc.title || 'document.pdf';
      a.rel = 'noopener';
      a.target = '_blank';
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="ovl pdf-modal-ovl" onClick={onClose}>
      <div className="pdf-card-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pdf-card-head">
          <div className="pdf-file-icon">PDF</div>
          <div className="pdf-card-titleblock">
            <div className="pdf-card-title">{doc.title}</div>
            <div className="pdf-card-meta">
              {doc.page_count ? `${doc.page_count} pages · ` : ''}
              {formatFileSize(doc.file_size_bytes)}
            </div>
          </div>
          <button type="button" className="btn-icon-x" aria-label="Close" onClick={onClose}>×</button>
        </div>

        <div className="pdf-card-uploader">
          <Avatar name={doc.uploader?.full_name || 'User'} size={28}/>
          <div>
            <div className="pdf-card-uploader-name">{doc.uploader?.full_name || 'Unknown'}</div>
            <div className="pdf-card-uploader-when">Uploaded {formatShortDate(doc.created_at)}</div>
          </div>
        </div>

        {error && (
          <div className="alert" style={{ marginBottom: 12 }}>
            <span>◇</span><div>{error}</div>
          </div>
        )}

        <div className="pdf-card-actions">
          <button
            type="button"
            className={`btn btn-g pdf-card-btn ${(isDemo || downloading) ? 'disabled' : ''}`}
            title={isDemo ? 'Download disabled in demo mode' : undefined}
            disabled={isDemo || downloading}
            onClick={onDownload}
          >
            {downloading ? 'Preparing…' : 'Download PDF'}
          </button>
          <button
            type="button"
            className="btn btn-p pdf-card-btn"
            onClick={() => onOpen(doc)}
          >
            Open PDF
          </button>
        </div>
      </div>
    </div>
  );
}
