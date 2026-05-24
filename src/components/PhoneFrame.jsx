// © 2026 Rudraksh Singh Tomar. All rights reserved.
export default function PhoneFrame({children}) {
  return (
    <div className="phone">
      {children}
      {/* Shared muted copyright footer. Pinned to the bottom of the
          phone frame; safe-area-inset-bottom respected, and shifted
          above the bottom nav (via .phone:has(.bnav)) so it never
          collides with the tab strip. Hidden inside full-screen
          modals (PDF viewer etc.) via .phone:has(.pdf-fullviewer). */}
      <div className="app-footer" aria-hidden>© 2026 Acedex. All rights reserved.</div>
    </div>
  );
}
