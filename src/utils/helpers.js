// © 2026 Rudraksh Singh Tomar. All rights reserved.
export const avatarBg = (n) => {
  // Direction C — warm plum/mauve/rose family (no cold indigo/violet); white
  // initials stay legible on every gradient. Hash picks one per name.
  const p=["linear-gradient(135deg,#A98BD0,#C9A8E0)","linear-gradient(135deg,#6E4F94,#A98BD0)","linear-gradient(135deg,#B98AB0,#D9A8C8)","linear-gradient(135deg,#8E6FB0,#B98AD0)","linear-gradient(135deg,#C08A9E,#E0A8B8)","linear-gradient(135deg,#7E5A94,#A87FB0)"];
  let h=0; for(let c of n) h=(h*31+c.charCodeAt(0))%p.length; return p[h];
};
export const initials = (n) => n.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
