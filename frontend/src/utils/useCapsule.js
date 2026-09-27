import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

// Measures the element tagged data-capsule="<key>" inside `containerRef` so a
// single glass capsule can glide between items — the landing's controller move.
export function useCapsule(containerRef, activeKey) {
  const [box, setBox] = useState(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container || activeKey == null) { setBox(null); return; }
    const target = container.querySelector(`[data-capsule="${CSS.escape(String(activeKey))}"]`);
    if (!target) { setBox(null); return; }
    const outer = container.getBoundingClientRect();
    const inner = target.getBoundingClientRect();
    setBox({
      x: inner.left - outer.left + container.scrollLeft - container.clientLeft,
      y: inner.top - outer.top + container.scrollTop - container.clientTop,
      w: inner.width,
      h: inner.height,
    });
  }, [containerRef, activeKey]);

  useLayoutEffect(measure, [measure]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [containerRef, measure]);

  return box;
}

export function capsuleStyle(box) {
  if (!box) return { opacity: 0 };
  return { transform: `translate(${box.x}px, ${box.y}px)`, width: box.w, height: box.h, opacity: 1, willChange: 'transform, width, height' };
}
