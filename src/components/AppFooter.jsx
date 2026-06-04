// © 2026 Rudraksh Singh Tomar. All rights reserved.
// Shared muted copyright footer. Rendered as the last in-flow child of the
// scroll container (.screen) via <Screen>, so it always sits below the content
// and scrolls with it — never overlapping mid-scroll the way an absolutely
// pinned footer did. Hidden inside full-screen overlays (PDF reader / modals)
// via the .phone:has(...) rules in index.css.
export default function AppFooter() {
  return <div className="app-footer" aria-hidden>© 2026 Acedex. All rights reserved.</div>;
}
