import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import CapsuleTabs from './CapsuleTabs';
import Spinner from './Spinner';

const MODES = [{ id: 'split', label: 'Split' }, { id: 'side', label: 'Side by side' }];

function Busy({ label }) {
  return (
    <div className="viz-busy" role="status">
      <span className="viz-busy-sheen" />
      <span className="viz-busy-label glass-capsule"><Spinner size="sm" /> {label}</span>
    </div>
  );
}

// Before/after comparison: drag (or arrow-key) the divider, or view side by side.
// `sweepKey` changing replays a reveal sweep so a fresh result is noticed.
export default function BeforeAfter({
  beforeSrc, afterSrc, beforeLabel = 'Original', afterLabel = 'Your remix',
  tint = null, tintLabel, busy = false, busyLabel = 'Weaving your remix…', sweepKey, kicker = 'Visualizer',
}) {
  const [mode, setMode] = useState('split');
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef(null);

  useEffect(() => {
    if (!sweepKey) return undefined;
    const timers = [[80, 80], [760, 20], [1440, 50]].map(([delay, value]) => window.setTimeout(() => setPosition(value), delay));
    return () => timers.forEach(window.clearTimeout);
  }, [sweepKey]);

  const moveTo = (clientX) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (rect?.width) setPosition(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  };
  const onPointerDown = (event) => {
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    moveTo(event.clientX);
  };
  const onKeyDown = (event) => {
    const step = event.shiftKey ? 12 : 4;
    const next = { ArrowLeft: position - step, ArrowRight: position + step, Home: 0, End: 100 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setPosition(Math.min(100, Math.max(0, next)));
  };

  const tintLayer = tint && <span className="viz-tint" style={{ background: tint }} aria-hidden="true" />;

  return (
    <div className="viz">
      <div className="viz-head">
        <span className={`kicker ${busy ? 'live' : ''}`}>{kicker}</span>
        <CapsuleTabs size="sm" options={MODES} value={mode} onChange={setMode} ariaLabel="Compare mode" />
      </div>

      {mode === 'split' ? (
        <div
          ref={stageRef}
          className={`viz-stage ${dragging ? 'is-dragging' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={(event) => { if (dragging) moveTo(event.clientX); }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
        >
          <div className="viz-layer">
            <img src={afterSrc} alt={afterLabel} draggable={false} />
            {tintLayer}
          </div>
          <div className="viz-layer is-before" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
            <img src={beforeSrc} alt={beforeLabel} draggable={false} />
          </div>
          <span className="viz-tag is-before glass-capsule">{beforeLabel}</span>
          <span className="viz-tag is-after glass-capsule"><Sparkles />{tint && tintLabel ? tintLabel : afterLabel}</span>
          <div className="viz-divider" style={{ left: `${position}%` }}>
            <button
              type="button"
              className="viz-handle glass-capsule"
              role="slider"
              aria-label={`Compare ${beforeLabel} and ${afterLabel}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(position)}
              onKeyDown={onKeyDown}
            >
              <ChevronLeft /><ChevronRight />
            </button>
          </div>
          {busy && <Busy label={busyLabel} />}
        </div>
      ) : (
        <div className="viz-side">
          <figure><img src={beforeSrc} alt={beforeLabel} /><figcaption className="glass-capsule">{beforeLabel}</figcaption></figure>
          <figure>
            <img src={afterSrc} alt={afterLabel} />
            {tintLayer}
            <figcaption className="glass-capsule"><Sparkles />{tint && tintLabel ? tintLabel : afterLabel}</figcaption>
            {busy && <Busy label={busyLabel} />}
          </figure>
        </div>
      )}
    </div>
  );
}
