import React, { useEffect, useRef, useState } from 'react';
import { compactNumber } from '../utils/time';

// Counts up from the previous value with the landing's ease-out curve.
function useCountUp(target, duration = 1100) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const to = Number(target) || 0;
    const from = fromRef.current;
    if (from === to) return undefined;
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 4;
      setValue(from + (to - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    frame = requestAnimationFrame(tick);
    // rAF pauses in background tabs; make sure the real number always lands.
    const settle = window.setTimeout(() => { cancelAnimationFrame(frame); setValue(to); fromRef.current = to; }, duration + 80);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(settle); fromRef.current = to; };
  }, [target, duration]);
  return value;
}

function Stat({ value, label, format, loading }) {
  const animated = useCountUp(loading ? 0 : value);
  const display = format ? format(animated) : compactNumber(Math.round(animated));
  return (
    <div className="stat">
      <strong className={loading ? 'is-loading' : ''}>{loading ? '—' : display}</strong>
      <span>{label}</span>
    </div>
  );
}

export default function StatRow({ stats, className = '' }) {
  return (
    <div className={`stat-row ${className}`}>
      {stats.map((stat) => <Stat key={stat.label} {...stat} />)}
    </div>
  );
}
