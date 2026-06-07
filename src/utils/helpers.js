// © 2026 Rudraksh Singh Tomar. All rights reserved.
export const avatarBg = (n) => {
  // Library — plum-family monogram circles (Spectral initials, set in CSS).
  // Deep plum → soft mauve gradients; white initials stay legible on every
  // one, in both Bookshelf (light) and Library (dark). Hash picks per name.
  const p=["linear-gradient(135deg,#6E4F94,#9B7BC4)","linear-gradient(135deg,#7E5A94,#B79BDC)","linear-gradient(135deg,#8E6FB0,#C9A8E0)","linear-gradient(135deg,#9B6FA8,#C08AC0)","linear-gradient(135deg,#6E5A9C,#A98BD0)","linear-gradient(135deg,#A87FB0,#D9B8E0)"];
  let h=0; for(let c of n) h=(h*31+c.charCodeAt(0))%p.length; return p[h];
};
export const initials = (n) => n.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
