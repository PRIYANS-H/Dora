import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, ImagePlus, RotateCcw, ScanLine } from 'lucide-react';
import Modal from './Modal';
import Spinner from './Spinner';
import '../styles/measure.css';

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const PACKAGE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs';
const LINKS = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];

// Body proportions used to calibrate when the whole body isn't in frame yet:
// shoulder→hip is ~30% of standing height, shoulder-joint span ~20%.
const TORSO_TO_HEIGHT = 0.30;
const SHOULDERS_TO_HEIGHT = 0.20;
// Pose landmarks sit on joint centres, so breadths and girths are scaled up from
// them with typical adult ratios (front view only — tailors confirm by tape).
const RATIO = { shoulder: 1.15, chest: 2.65, waistFromShoulder: 1.95, waistFromHip: 3.9, hip: 5.1 };

let visionPromise;
let landmarkerPromise;

async function getLandmarker(mode) {
  if (!visionPromise) visionPromise = import(/* @vite-ignore */ PACKAGE_URL);
  const vision = await visionPromise;
  if (!landmarkerPromise) {
    landmarkerPromise = vision.FilesetResolver.forVisionTasks(WASM_URL).then((fileset) => vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL },
      runningMode: mode,
      numPoses: 1,
      minPoseDetectionConfidence: 0.55,
      minPosePresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    }));
  }
  const task = await landmarkerPromise;
  await task.setOptions({ runningMode: mode });
  return task;
}

const visible = (point, threshold = 0.45) => Boolean(point) && (point.visibility ?? 1) >= threshold;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// Turns landmarks into on-body measurement lines (pixel space) plus cm values.
// Calibrates from full height when head and feet are visible, otherwise from the
// torso or shoulders so lines appear as soon as the upper body is in frame.
function computeBodyMetrics(landmarks, width, height, heightCm, mirrored) {
  if (!landmarks || !width || !height || !(heightCm >= 80 && heightCm <= 250)) return null;
  const at = (index) => {
    const raw = landmarks[index];
    return raw && { x: (mirrored ? 1 - raw.x : raw.x) * width, y: raw.y * height, visibility: raw.visibility };
  };
  const [ls, rs, le, re, lw, rw, lh, rh, lk, rk, la, ra] = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].map(at);
  const shouldersIn = visible(ls) && visible(rs);
  const hipsIn = visible(lh) && visible(rh);
  if (!shouldersIn) return null;

  const head = [0, 7, 8].map(at).filter((point) => visible(point, 0.35));
  const feet = [31, 32, 27, 28].map(at).filter((point) => visible(point, 0.35));
  const top = head.length ? Math.min(...head.map((point) => point.y)) : null;
  const bottom = feet.length ? Math.max(...feet.map((point) => point.y)) : null;
  const shoulderMid = mid(ls, rs);
  const hipMid = hipsIn ? mid(lh, rh) : null;
  const shoulderPx = dist(ls, rs);

  let cmPerPx;
  let mode;
  if (top !== null && bottom !== null && bottom - top > height * 0.35) { cmPerPx = heightCm / (bottom - top); mode = 'full'; }
  else if (hipMid && hipMid.y - shoulderMid.y > 12) { cmPerPx = (heightCm * TORSO_TO_HEIGHT) / (hipMid.y - shoulderMid.y); mode = 'torso'; }
  else { cmPerPx = (heightCm * SHOULDERS_TO_HEIGHT) / shoulderPx; mode = 'shoulders'; }

  const lines = [];
  const cm = { height: heightCm };
  const push = (key, label, points, valueCm, anchor) => { cm[key] = valueCm; lines.push({ key, label, points, valueCm, anchor }); };

  push('shoulder', 'Shoulder', [ls, rs], shoulderPx * cmPerPx * RATIO.shoulder, { x: shoulderMid.x, y: shoulderMid.y - shoulderPx * 0.18 });

  if (hipMid) {
    const hipPx = dist(lh, rh);
    const torsoLen = hipMid.y - shoulderMid.y;
    const chestY = shoulderMid.y + torsoLen * 0.26;
    const chestHalf = shoulderPx * 0.44;
    const waistY = shoulderMid.y + torsoLen * 0.64;
    const waistHalf = ((shoulderPx * 0.72 + hipPx * 0.78) / 2) / 2;
    const centerX = (shoulderMid.x + hipMid.x) / 2;
    push('chest', 'Chest', [{ x: centerX - chestHalf, y: chestY }, { x: centerX + chestHalf, y: chestY }], shoulderPx * cmPerPx * RATIO.chest, { x: centerX, y: chestY - 14 });
    push('waist', 'Waist', [{ x: centerX - waistHalf, y: waistY }, { x: centerX + waistHalf, y: waistY }], ((shoulderPx * RATIO.waistFromShoulder + hipPx * RATIO.waistFromHip) / 2) * cmPerPx, { x: centerX, y: waistY - 14 });
    push('hip', 'Hip', [lh, rh], hipPx * cmPerPx * RATIO.hip, { x: hipMid.x, y: hipMid.y + 18 });
    const torsoX = Math.max(ls.x, rs.x) + shoulderPx * 0.28;
    push('half_length', 'Torso', [{ x: torsoX, y: shoulderMid.y }, { x: torsoX, y: hipMid.y }], torsoLen * cmPerPx, { x: torsoX + 8, y: (shoulderMid.y + hipMid.y) / 2, align: 'start' });
  }

  const arm = [[ls, le, lw], [rs, re, rw]].find(([s, e, w]) => visible(s) && visible(e) && visible(w));
  if (arm) {
    const [s, e, w] = arm;
    push('sleeve', 'Sleeve', [s, e, w], (dist(s, e) + dist(e, w)) * cmPerPx, { x: e.x, y: e.y, align: e.x < shoulderMid.x ? 'end' : 'start', dx: e.x < shoulderMid.x ? -10 : 10 });
  }

  const leg = [[lh, lk, la], [rh, rk, ra]].find(([h, k, a]) => visible(h) && visible(k) && visible(a));
  if (leg && hipMid) {
    const [h, k, a] = leg;
    const legPx = dist(h, k) + dist(k, a);
    push('outseam', 'Leg', [h, k, a], legPx * cmPerPx, { x: k.x, y: k.y, align: k.x < hipMid.x ? 'end' : 'start', dx: k.x < hipMid.x ? -10 : 10 });
    cm.inseam = legPx * cmPerPx * 0.82;
    cm.leg_length = legPx * cmPerPx;
  }

  if (mode === 'full') {
    const heightX = Math.min(ls.x, rs.x) - shoulderPx * 0.55;
    lines.push({ key: 'height', label: 'Height', points: [{ x: heightX, y: top }, { x: heightX, y: bottom }], valueCm: heightCm, anchor: { x: heightX - 8, y: (top + bottom) / 2, align: 'end' }, ticks: true });
    cm.full_length = (bottom - shoulderMid.y) * cmPerPx;
  }
  cm.bust = cm.chest;
  cm.chest_or_bust = cm.chest;
  cm.shirt_length = cm.half_length;
  cm.length = cm.half_length;
  return { mode, lines, cm };
}

function formatLength(valueCm, unit) {
  const value = unit === 'in' ? valueCm / 2.54 : valueCm;
  return `${Math.round(value * 10) / 10}${unit === 'in' ? '″' : ' cm'}`;
}

function MeasureOverlay({ metrics, landmarks, width, height, unit, mirrored }) {
  if (!width || !height) return null;
  const font = Math.max(width, height) * 0.021;
  const approx = metrics && metrics.mode !== 'full';
  const point = (index) => landmarks && { x: (mirrored ? 1 - landmarks[index].x : landmarks[index].x) * width, y: landmarks[index].y * height };
  return (
    <svg className="measure-overlay" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {landmarks && LINKS.map(([from, to]) => (visible(landmarks[from]) && visible(landmarks[to]) ? (
        <line key={`${from}-${to}`} className="measure-bone" x1={point(from).x} y1={point(from).y} x2={point(to).x} y2={point(to).y} />
      ) : null))}
      {metrics?.lines.map((line) => {
        const text = `${line.label} ${approx && line.key !== 'height' ? '≈ ' : ''}${formatLength(line.valueCm, unit)}`;
        const padX = font * 0.55;
        const boxW = text.length * font * 0.56 + padX * 2;
        const boxH = font * 1.7;
        const align = line.anchor.align || 'middle';
        const x = line.anchor.x + (line.anchor.dx || 0);
        const boxX = align === 'start' ? x : align === 'end' ? x - boxW : x - boxW / 2;
        const clampedX = Math.min(Math.max(boxX, 4), width - boxW - 4);
        return (
          <g key={line.key} className="measure-line-group">
            <polyline className="measure-line" points={line.points.map((p) => `${p.x},${p.y}`).join(' ')} />
            {line.points.map((p, index) => <circle key={index} className="measure-node" cx={p.x} cy={p.y} r={font * 0.28} />)}
            {line.ticks && line.points.map((p, index) => <line key={`t${index}`} className="measure-line" x1={p.x - font * 0.6} y1={p.y} x2={p.x + font * 0.6} y2={p.y} />)}
            <rect className="measure-label-box" x={clampedX} y={line.anchor.y - boxH / 2} width={boxW} height={boxH} rx={boxH / 2} />
            <text className="measure-label" x={clampedX + boxW / 2} y={line.anchor.y} fontSize={font} textAnchor="middle" dominantBaseline="central">{text}</text>
          </g>
        );
      })}
    </svg>
  );
}

function estimate(metrics, fields, unit) {
  const factor = unit === 'in' ? 1 / 2.54 : 1;
  return Object.fromEntries(fields.map(([key]) => [key, metrics?.cm[key] ? String(Math.round(metrics.cm[key] * factor * 10) / 10) : '']));
}

const GUIDANCE = {
  none: 'Step into the frame and face the camera.',
  shoulders: 'Great — step back until your hips are in view for chest, waist and hip lines.',
  torso: 'Nearly there — step back until your feet are visible to lock the height calibration.',
  full: 'Full body found — hold still with arms relaxed to auto-capture, or press Capture.',
};

export default function MeasurementCapture({ fields, unit, onClose, onApply }) {
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(0);
  const holdStartRef = useRef(0);
  const autoCaptureRef = useRef(true);
  const captureRef = useRef(null);
  const photoUrlRef = useRef('');
  const [source, setSource] = useState('');
  const [photo, setPhoto] = useState('');
  const [snapshot, setSnapshot] = useState('');
  const [landmarks, setLandmarks] = useState(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [heightCm, setHeightCm] = useState('170');
  const [cameraReady, setCameraReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [autoCapture, setAutoCapture] = useState(true);
  const [holding, setHolding] = useState(false);
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');

  const mirrored = source === 'camera';
  const metrics = useMemo(() => computeBodyMetrics(landmarks, dims.width, dims.height, Number(heightCm), mirrored), [landmarks, dims, heightCm, mirrored]);
  const live = useMemo(() => estimate(metrics, fields, unit), [metrics, fields, unit]);

  const releaseCamera = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  useEffect(() => () => {
    releaseCamera();
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
  }, [releaseCamera]);

  const reset = () => {
    releaseCamera();
    setSource(''); setPhoto(''); setSnapshot(''); setLandmarks(null); setReview(null); setError(''); setHolding(false);
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    photoUrlRef.current = '';
  };

  const startCamera = async () => {
    reset();
    setSource('camera');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access needs a secure connection (HTTPS or localhost).');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      setModelLoading(true);
      const task = await getLandmarker('VIDEO');
      setModelLoading(false);
      setCameraReady(true);
      let last = 0;
      const detect = (time) => {
        if (!streamRef.current) return;
        if (time - last > 120 && video.readyState >= 2) {
          last = time;
          try {
            const points = task.detectForVideo(video, time).landmarks?.[0];
            setDims({ width: video.videoWidth, height: video.videoHeight });
            setLandmarks(points?.length ? points : null);
            const relaxed = points?.length && [15, 16, 11, 12].every((index) => visible(points[index], 0.55))
              && points[15].y > points[11].y && points[16].y > points[12].y
              && Math.abs(points[15].x - points[16].x) < Math.abs(points[11].x - points[12].x) * 2.3;
            const full = points?.length && [0, 27, 28].every((index) => visible(points[index], 0.4));
            if (autoCaptureRef.current && relaxed && full) {
              if (!holdStartRef.current) holdStartRef.current = time;
              setHolding(true);
              if (time - holdStartRef.current > 1600) { holdStartRef.current = 0; setHolding(false); captureRef.current?.(); }
            } else { holdStartRef.current = 0; setHolding(false); }
          } catch { /* a dropped frame shouldn't stop the preview */ }
        }
        frameRef.current = requestAnimationFrame(detect);
      };
      frameRef.current = requestAnimationFrame(detect);
    } catch (cause) {
      releaseCamera();
      setModelLoading(false);
      setSource('');
      setError(cause.name === 'NotAllowedError' ? 'Allow camera access in your browser, or upload a full-body photo instead.' : cause.message || 'Couldn’t start the camera. The pose model loads from a CDN the first time — check your connection.');
    }
  };

  const uploadPhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return; }
    reset();
    setSource('photo');
    const url = URL.createObjectURL(file);
    photoUrlRef.current = url;
    const image = new Image();
    image.onload = async () => {
      try {
        setModelLoading(true);
        const task = await getLandmarker('IMAGE');
        const points = task.detect(image).landmarks?.[0];
        if (!points?.length) throw new Error('No body found. Try a clear, front-facing photo with your whole body in frame.');
        setPhoto(url);
        setDims({ width: image.naturalWidth, height: image.naturalHeight });
        setLandmarks(points);
      } catch (cause) { setError(cause.message || 'Couldn’t analyse this photo.'); }
      finally { setModelLoading(false); }
    };
    image.onerror = () => setError('Couldn’t open that photo.');
    image.src = url;
  };

  const capture = () => {
    if (!metrics) { setError('Keep at least your shoulders in the frame so we can measure.'); return; }
    if (source === 'camera' && videoRef.current?.videoWidth) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(video, 0, 0);
      setSnapshot(canvas.toDataURL('image/jpeg', 0.85));
    }
    setReview(estimate(metrics, fields, unit));
    releaseCamera();
  };
  captureRef.current = capture;

  const stageImage = source === 'photo' ? photo : snapshot;
  const readings = review || live;

  return (
    <Modal onClose={onClose} size="xl" labelledBy="measure-title" className="measure-modal">
      <div className="measure-grid">
        <div className={`measure-stage ${mirrored && !review ? 'is-mirrored' : ''}`}>
          {source === 'camera' && !review && <video ref={videoRef} muted playsInline />}
          {(review || source === 'photo') && stageImage && <img src={stageImage} alt="Your measurement capture" />}
          {source && <MeasureOverlay metrics={metrics} landmarks={landmarks} width={dims.width} height={dims.height} unit={unit} mirrored={mirrored} />}
          {!source && (
            <div className="measure-stage-empty">
              <ScanLine />
              <strong>Measure with your camera</strong>
              <p>Green lines will mark your shoulder, chest, waist, hips, arms and legs right on the video.</p>
            </div>
          )}
          {modelLoading && <div className="measure-stage-wait"><Spinner size="lg" /> Loading the pose model…</div>}
          {cameraReady && !review && <span className={`measure-live glass-capsule ${holding ? 'is-holding' : ''}`}><i /> {holding ? 'Hold still…' : 'Live'}</span>}
          {metrics && metrics.mode !== 'full' && !review && <span className="measure-approx glass-capsule">≈ Estimated until your full body is in frame</span>}
        </div>

        <aside className="measure-panel">
          <div className="measure-panel-head">
            <span className="kicker live">Camera measurements</span>
            <h2 id="measure-title" className="display title-md">{review ? 'Check your numbers' : 'Stand back & face the camera'}</h2>
            <p className="muted tiny">Pose detection runs in your browser — your video never leaves this device.</p>
          </div>

          {!review && <>
            <label className="field">
              <span className="field-label">Your height <em className="muted">calibrates every line</em></span>
              <span className="measure-input"><input className="input" type="number" min="80" max="250" step="0.5" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} /><i>cm</i></span>
            </label>
            <p className="notice tone-info measure-guide">{GUIDANCE[source ? (metrics?.mode || 'none') : 'none']}</p>
          </>}

          <div className="measure-readings">
            {fields.map(([key, label]) => (
              <label key={key} className={`measure-reading ${readings[key] ? 'is-on' : ''}`}>
                <span>{label}</span>
                {review
                  ? <span className="measure-input"><input className="input" type="number" step="0.1" min="1" value={review[key] ?? ''} onChange={(event) => setReview((current) => ({ ...current, [key]: event.target.value }))} /><i>{unit}</i></span>
                  : <strong>{readings[key] ? `${readings[key]} ${unit}` : '—'}</strong>}
              </label>
            ))}
          </div>

          {error && <p className="notice tone-bad" role="alert">{error}</p>}

          <div className="measure-actions">
            {review ? <>
              <button type="button" className="btn btn-ghost" onClick={() => { setReview(null); setSnapshot(''); if (source === 'camera') startCamera(); }}><RotateCcw /> Retake</button>
              <button type="button" className="btn btn-solid" onClick={() => onApply(review)}><Check /> Use these</button>
            </> : <>
              {!cameraReady && <button type="button" className="btn btn-solid" onClick={startCamera} disabled={modelLoading}><Camera /> {source === 'camera' ? 'Starting…' : 'Open camera'}</button>}
              {cameraReady && <button type="button" className="btn btn-solid" onClick={capture} disabled={!metrics}><ScanLine /> Capture</button>}
              {source === 'photo' && landmarks && <button type="button" className="btn btn-solid" onClick={capture}><ScanLine /> Review</button>}
              <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}><ImagePlus /> Upload photo</button>
              {cameraReady && (
                <label className="measure-auto">
                  <input type="checkbox" checked={autoCapture} onChange={(event) => { autoCaptureRef.current = event.target.checked; setAutoCapture(event.target.checked); holdStartRef.current = 0; }} />
                  Auto-capture when I hold still
                </label>
              )}
            </>}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadPhoto} />
          </div>
          <p className="measure-note">Circumferences are front-view estimates — a starting point for your tailor, who’ll confirm them with you.</p>
        </aside>
      </div>
    </Modal>
  );
}
