// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ breaks: true });

export function sanitize(text) {
  if (typeof text !== 'string') return { __html: '' };
  const raw = marked.parse(text);
  return { __html: DOMPurify.sanitize(raw) };
}
