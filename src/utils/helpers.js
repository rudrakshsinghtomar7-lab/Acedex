// © 2026 Rudraksh Singh Tomar. All rights reserved.
export const avatarBg = (n) => {
  const p=["linear-gradient(135deg,#7c6cff,#a875ff)","linear-gradient(135deg,#5848d6,#7c6cff)","linear-gradient(135deg,#a875ff,#c891ff)","linear-gradient(135deg,#6bb5f5,#7c6cff)","linear-gradient(135deg,#9d8eff,#a875ff)","linear-gradient(135deg,#7c6cff,#5848d6)"];
  let h=0; for(let c of n) h=(h*31+c.charCodeAt(0))%p.length; return p[h];
};
export const initials = (n) => n.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
