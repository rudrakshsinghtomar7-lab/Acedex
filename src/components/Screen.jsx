// © 2026 Rudraksh Singh Tomar. All rights reserved.
import AppFooter from './AppFooter.jsx';

// Single scroll container for a route. The shared © footer renders as the
// last in-flow child so it always sits below the content and scrolls with it,
// regardless of page height — no overlap at any scroll position.
export default function Screen({ children }) {
  return (
    <div className="screen">
      {children}
      <AppFooter/>
    </div>
  );
}
