// © 2026 Rudraksh Singh Tomar. All rights reserved.
export default function Bell({ count = 0, onClick }) {
  const has = count > 0;
  return (
    <button
      className="icon-btn"
      onClick={onClick}
      aria-label={has ? `Notifications, ${count} unread` : 'Notifications'}
    >
      <span style={{ fontSize: 17, lineHeight: 1 }}>◔</span>
      {has && (
        <span className="bell-badge">{count > 9 ? '9+' : count}</span>
      )}
    </button>
  );
}
