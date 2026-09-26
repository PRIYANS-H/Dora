import React from 'react';

// Line-art flats for each structured attribute, drawn on a shared bodice /
// dress-form so options can be compared at a glance.

const TORSO = 'M40 18 L23 24 Q17 27 18 35 L25 92 L75 92 L82 35 Q83 27 77 24 L60 18';

const NECKLINES = {
  mandarin: <><path d={`${TORSO}`} /><path d="M40 18 L40 11 Q50 9 60 11 L60 18" /><path d="M40 18 Q50 22 60 18" /><path d="M49 11 L49 19 M51 11 L51 19" className="fine" /></>,
  'v-neck': <><path d={TORSO} /><path d="M40 18 L50 42 L60 18" /></>,
  sweetheart: <><path d="M37 27 L25 30 Q18 32 19 40 L25 92 L75 92 L81 40 Q82 32 75 30 L63 27" /><path d="M37 27 Q43 20 50 31 Q57 20 63 27" /><path d="M40 27 L42 14 M60 27 L58 14" className="fine" /></>,
  turtleneck: <><path d={TORSO} /><path d="M40 18 L40 5 Q50 3 60 5 L60 18" /><path d="M40 11 Q50 13.5 60 11" /><path d="M40 18 Q50 21 60 18" className="fine" /></>,
  'open lapel': <><path d={TORSO} /><path d="M40 18 L50 46 L60 18" /><path d="M40 18 L32 31 L45 34" /><path d="M60 18 L68 31 L55 34" /></>,
  'funnel neck': <><path d={TORSO} /><path d="M40 18 L36 6 Q50 3 64 6 L60 18" /><path d="M38 12 Q50 15 62 12" className="fine" /></>,
  'shawl collar': <><path d={TORSO} /><path d="M40 18 Q31 34 48 52" /><path d="M60 18 Q69 34 52 52" /><path d="M43 18 Q46 36 50 50 Q54 36 57 18" className="fine" /></>,
};

const BODY = 'M40 16 Q50 21 60 16 L74 22 L71 92 L29 92 L26 22 Z';
const mirror = (node) => <>{node}<g transform="translate(100 0) scale(-1 1)">{node}</g></>;

const SLEEVES = {
  full: <><path d={BODY} />{mirror(<path d="M26 22 L11 74 L19 76 L29 40" />)}</>,
  sleeveless: <><path d="M40 16 Q50 21 60 16 L66 20 Q68 32 74 36 L71 92 L29 92 L26 36 Q32 32 34 20 Z" /></>,
  bell: <><path d={BODY} />{mirror(<path d="M26 22 L17 56 L5 80 L25 80 L23 58 L29 40" />)}</>,
  'three-quarter': <><path d={BODY} />{mirror(<path d="M26 22 L14 60 L22 62 L29 40" />)}{mirror(<path d="M14 60 L22 62" className="fine" />)}</>,
  'off-shoulder': <><path d="M22 30 Q50 38 78 30 L71 92 L29 92 Z" /><path d="M22 30 Q50 26 78 30" className="fine" />{mirror(<path d="M22 30 Q12 36 13 46 L25 47 L28 40" />)}</>,
  'cap sleeves': <><path d={BODY} />{mirror(<path d="M26 22 L18 34 Q23 37 28 36" />)}</>,
};

// Dress-form silhouettes: [half-width, y] from shoulder to hem, mirrored.
const FIT_SHAPES = {
  regular: [[15, 14], [16, 32], [13, 56], [16, 84], [19, 126]],
  relaxed: [[18, 14], [19, 34], [18, 58], [21, 92], [24, 126]],
  oversized: [[25, 18], [26, 42], [26, 72], [26, 100], [25, 112]],
  slim: [[14, 14], [14, 32], [10, 56], [12, 84], [13, 126]],
  bodycon: [[14, 14], [15, 32], [8.5, 54], [14, 78], [9.5, 124]],
  tailored: [[19, 13], [16, 32], [10, 54], [15, 78], [14, 100]],
  draped: [[15, 14], [16, 32], [13, 56], [20, 92], [26, 126]],
  flared: [[13, 14], [14, 32], [9, 52], [23, 96], [35, 126]],
};

// Catmull-Rom through the points, emitted as cubic Béziers for smooth sides.
function smooth(points) {
  let d = '';
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const [p1, p2] = [points[i], points[i + 1]];
    const p3 = points[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function silhouette(points) {
  const left = points.map(([w, y]) => [50 - w, y]);
  const right = points.map(([w, y]) => [50 + w, y]).reverse();
  const [top] = points;
  return `M${left[0][0]} ${left[0][1]}${smooth(left)} L${right[0][0]} ${right[0][1]}${smooth(right)} Q50 ${top[1] + 5} ${left[0][0]} ${left[0][1]} Z`;
}

const FIT_EXTRAS = {
  tailored: <><path d="M50 13 L50 100" className="fine" /><path d="M41 13 L47 34 M59 13 L53 34" className="fine" /></>,
  draped: <><path d="M38 34 Q54 62 68 122" className="fine" /><path d="M44 40 Q58 70 62 124" className="fine" /></>,
  bodycon: <path d="M41.5 54 Q50 56 58.5 54" className="fine" />,
  flared: <path d="M41 52 Q50 55 59 52" className="fine" />,
  oversized: <path d="M25 18 L25 44 M75 18 L75 44" className="fine" />,
};

function FitArt({ fit }) {
  const shape = FIT_SHAPES[fit] || FIT_SHAPES.regular;
  const hem = shape[shape.length - 1][1];
  return (
    <>
      <path d="M46 2 L46 12 Q50 14 54 12 L54 2" className="form" />
      <path d={silhouette(shape)} />
      {FIT_EXTRAS[fit]}
      <path d={`M50 ${hem + 2} L50 142 M38 144 L62 144`} className="form" />
    </>
  );
}

export function hasArt(category, value) {
  const key = String(value || '').toLowerCase();
  if (category === 'neckline') return Boolean(NECKLINES[key]);
  if (category === 'sleeves') return Boolean(SLEEVES[key]);
  if (category === 'fit') return Boolean(FIT_SHAPES[key]);
  return false;
}

export default function AttributeArt({ category, value, className = '' }) {
  const key = String(value || '').toLowerCase();
  if (category === 'fit') {
    return <svg className={`attr-art is-fit ${className}`} viewBox="0 0 100 148" aria-hidden="true"><FitArt fit={key} /></svg>;
  }
  const art = category === 'neckline' ? NECKLINES[key] : category === 'sleeves' ? SLEEVES[key] : null;
  if (!art) return null;
  return <svg className={`attr-art ${className}`} viewBox="0 0 100 96" aria-hidden="true">{art}</svg>;
}
