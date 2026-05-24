// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { avatarBg, initials } from '../utils/helpers.js';

export default function Avatar({name, size=28}) {
  return <div className="av" style={{width:size,height:size,fontSize:size*.36,background:avatarBg(name)}}>{initials(name)}</div>;
}
