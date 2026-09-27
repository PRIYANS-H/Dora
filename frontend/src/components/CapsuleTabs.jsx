import React, { useEffect, useRef, useState } from 'react';
import { capsuleStyle, useCapsule } from '../utils/useCapsule';

// The landing page controller: a glass track whose capsule follows the pointer
// and settles back on the selected option.
export default function CapsuleTabs({ options, value, onChange, size = 'md', className = '', ariaLabel }) {
  const trackRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [ready, setReady] = useState(false);
  const box = useCapsule(trackRef, hovered ?? value);

  useEffect(() => {
    if (!box || ready) return undefined;
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, [box, ready]);

  return (
    <div
      ref={trackRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`capsule-track glass is-${size} ${className}`}
      onPointerLeave={() => setHovered(null)}
    >
      <span className={`capsule-thumb glass-capsule ${ready ? 'is-ready' : ''}`} style={capsuleStyle(box)} aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          data-capsule={option.id}
          className={`capsule-cell ${value === option.id ? 'is-active' : ''}`}
          onPointerEnter={() => setHovered(option.id)}
          onFocus={() => setHovered(option.id)}
          onBlur={() => setHovered(null)}
          onClick={() => onChange(option.id)}
        >
          {option.icon}{option.label}
        </button>
      ))}
    </div>
  );
}
