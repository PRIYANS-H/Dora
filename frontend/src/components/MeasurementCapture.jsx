import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ImagePlus, LoaderCircle, RotateCcw, ScanLine, X } from 'lucide-react';

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const PACKAGE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs';
const LINKS = [[0,11],[0,12],[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,31],[28,32]];

function PoseOverlay({ landmarks, width, height }) {
  if (!landmarks || !width || !height) return null;
  const point = (index) => ({ x: landmarks[index].x * width, y: landmarks[index].y * height });
  return <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    {LINKS.map(([from, to]) => {
      if ((landmarks[from].visibility ?? 1) <= 0.45 || (landmarks[to].visibility ?? 1) <= 0.45) return null;
      const a = point(from), b = point(to);
      return <line key={`${from}-${to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
    })}
    {landmarks.map((item, index) => {
      if ((item.visibility ?? 1) <= 0.45) return null;
      const p = point(index);
      return <circle key={index} cx={p.x} cy={p.y} r={Math.max(width, height) * 0.006} />;
    })}
  </svg>;
}

let visionPromise;
let landmarkerPromise;

async function getLandmarker(mode) {
  if (!visionPromise) visionPromise = import(/* @vite-ignore */ PACKAGE_URL);
  const vision = await visionPromise;
  if (!landmarkerPromise) {
    landmarkerPromise = vision.FilesetResolver.forVisionTasks(WASM_URL).then((fileset) =>
      vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: mode,
        numPoses: 1,
        minPoseDetectionConfidence: 0.55,
        minPosePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      })
    );
  }
  const task = await landmarkerPromise;
  await task.setOptions({ runningMode: mode });
  return task;
}

function distance(a, b, width, height) {
  if (!a || !b || (a.visibility ?? 1) < 0.35 || (b.visibility ?? 1) < 0.35) return 0;
  return Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
}

function midpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1) }; }

function estimateMeasurements(points, width, height, knownHeightCm, fields, unit) {
  const shoulderWidth = distance(points[11], points[12], width, height);
  const hipWidth = distance(points[23], points[24], width, height);
  const shoulders = midpoint(points[11], points[12]);
  const hips = midpoint(points[23], points[24]);
  const ankles = midpoint(points[27], points[28]);
  const visibleHead = [points[0], points[7], points[8]].filter((p) => p && (p.visibility ?? 1) >= 0.35);
  const visibleFeet = [points[31], points[32], points[27], points[28]].filter((p) => p && (p.visibility ?? 1) >= 0.35);
  if (!shoulderWidth || !hipWidth || !visibleHead.length || !visibleFeet.length) throw new Error('Keep your shoulders, hips, head, and ankles visible in the frame.');
  const top = Math.min(...visibleHead.map((p) => p.y * height));
  const bottom = Math.max(...visibleFeet.map((p) => p.y * height));
  if (bottom <= top) throw new Error('Could not find a full-body pose. Retake the photo with your full body visible.');
  const cmPerPixel = knownHeightCm / (bottom - top);
  const cm = {
    height: knownHeightCm,
    shoulder: shoulderWidth * cmPerPixel,
    sleeve: (distance(points[11], points[13], width, height) + distance(points[13], points[15], width, height) + distance(points[12], points[14], width, height) + distance(points[14], points[16], width, height)) * 0.5 * cmPerPixel,
    half_length: distance(shoulders, hips, width, height) * cmPerPixel,
    shirt_length: distance(shoulders, hips, width, height) * cmPerPixel,
    full_length: knownHeightCm,
    length: distance(shoulders, hips, width, height) * cmPerPixel,
    inseam: Math.max(0, (ankles.y - hips.y) * height * cmPerPixel * 0.82),
    outseam: Math.max(0, (ankles.y - hips.y) * height * cmPerPixel),
    leg_length: Math.max(0, (ankles.y - hips.y) * height * cmPerPixel),
    chest: shoulderWidth * cmPerPixel * 2.35,
    bust: shoulderWidth * cmPerPixel * 2.35,
    chest_or_bust: shoulderWidth * cmPerPixel * 2.35,
    waist: ((shoulderWidth * 0.72 + hipWidth * 0.78) / 2) * cmPerPixel * 2.25,
    hip: hipWidth * cmPerPixel * 2.35,
  };
  const factor = unit === 'in' ? 1 / 2.54 : 1;
  return Object.fromEntries(fields.map(([key]) => [key, cm[key] ? String(Math.round(cm[key] * factor * 10) / 10) : '']));
}

export default function MeasurementCapture({ fields, unit, onClose, onApply }) {
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(0);
  const gestureStartRef = useRef(0);
  const gestureCaptureRef = useRef(true);
  const captureRef = useRef(null);
  const imageUrlRef = useRef('');
  const [source, setSource] = useState('');
  const [photo, setPhoto] = useState(null);
  const [cameraSnapshot, setCameraSnapshot] = useState('');
  const [landmarks, setLandmarks] = useState(null);
  const [knownHeight, setKnownHeight] = useState('170');
  const [cameraReady, setCameraReady] = useState(false);
  const [gestureCapture, setGestureCapture] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Enter your height, then choose a camera or full-body photo.');
  const [review, setReview] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const releaseCamera = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  const cleanup = useCallback(() => {
    releaseCamera();
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
  }, [releaseCamera]);

  useEffect(() => cleanup, [cleanup]);

  const analyze = useCallback((points, width, height) => {
    setLandmarks(points);
    setDimensions({ width, height });
    setError('');
    setStatus('Pose found. Check that your whole body is visible, then capture for review.');
  }, []);

  const startCamera = async () => {
    setError(''); setReview(null); setPhoto(null); setSource('camera');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access needs a secure connection (HTTPS or localhost).');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', aspectRatio: { ideal: 0.5625 }, width: { ideal: 720 }, height: { ideal: 1280 } } });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      const task = await getLandmarker('VIDEO');
      setCameraReady(true);
      setStatus('Stand facing the camera with your full body visible. Hold your arms close to your sides for automatic capture, or capture manually.');
      let lastFrame = 0;
      const detect = (time) => {
        if (!streamRef.current) return;
        if (time - lastFrame > 180 && video.readyState >= 2) {
          lastFrame = time;
          try {
            const result = task.detectForVideo(video, time);
            const points = result.landmarks?.[0];
            if (points?.length) {
              analyze(points, video.videoWidth, video.videoHeight);
              const center = (points[11].x + points[12].x) / 2;
              const shoulderSpan = Math.abs(points[11].x - points[12].x);
              const leftWrist = points[15], rightWrist = points[16];
              const armsRelaxed = leftWrist && rightWrist && (leftWrist.visibility ?? 1) > 0.55 && (rightWrist.visibility ?? 1) > 0.55 &&
                leftWrist.y > points[11].y && rightWrist.y > points[12].y &&
                Math.abs(leftWrist.x - center) < shoulderSpan * 1.15 && Math.abs(rightWrist.x - center) < shoulderSpan * 1.15;
              if (gestureCaptureRef.current && armsRelaxed) {
                if (!gestureStartRef.current) gestureStartRef.current = time;
                if (time - gestureStartRef.current > 1400) { gestureStartRef.current = 0; captureRef.current?.(); }
              } else gestureStartRef.current = 0;
            } else gestureStartRef.current = 0;
          } catch { /* Keep the preview responsive while a frame is unavailable. */ }
        }
        frameRef.current = requestAnimationFrame(detect);
      };
      frameRef.current = requestAnimationFrame(detect);
    } catch (cause) {
      releaseCamera();
      setError(cause.name === 'NotAllowedError' ? 'Allow camera access in your browser, or upload a photo instead.' : cause.message || 'Could not start the camera.');
      setSource('');
    }
  };

  const uploadPhoto = async (event) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return; }
    if (file.size > 12 * 1024 * 1024) { setError('Choose an image smaller than 12 MB.'); return; }
    releaseCamera(); setError(''); setReview(null); setBusy(true); setSource('photo');
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    const url = URL.createObjectURL(file); imageUrlRef.current = url;
    const image = new Image();
    image.onload = async () => {
      try {
        const task = await getLandmarker('IMAGE');
        const points = task.detect(image).landmarks?.[0];
        if (!points?.length) throw new Error('No full-body pose found. Try a clear front-facing photo with your whole body visible.');
        setPhoto(url); analyze(points, image.naturalWidth, image.naturalHeight);
      } catch (cause) { setError(cause.message || 'Could not analyze this photo.'); }
      finally { setBusy(false); }
    };
    image.onerror = () => { setBusy(false); setError('Could not open that photo.'); };
    image.src = url;
  };

  const capture = () => {
    if (!landmarks || !dimensions.width) return setError('Wait for the pose guide to detect your full body.');
    const heightCm = Number(knownHeight);
    if (!Number.isFinite(heightCm) || heightCm < 80 || heightCm > 250) return setError('Enter your height between 80 and 250 cm to calibrate the estimates.');
    try {
      const estimates = estimateMeasurements(landmarks, dimensions.width, dimensions.height, heightCm, fields, unit);
      if (source === 'camera' && videoRef.current?.videoWidth) {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
        setCameraSnapshot(canvas.toDataURL('image/jpeg', 0.82));
      }
      setReview(estimates); releaseCamera();
      setStatus('Review these visual estimates and edit any value before using them.');
    } catch (cause) { setError(cause.message); }
  };
  captureRef.current = capture;

  const points = useMemo(() => landmarks?.map((point) => `${point.x},${point.y}`).join(' '), [landmarks]);

  const clearCapture = () => {
    releaseCamera(); setSource(''); setPhoto(null); setCameraSnapshot(''); setLandmarks(null); setReview(null); setError('');
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    imageUrlRef.current = '';
  };

  return <div className="measurement-capture-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="measurement-capture-dialog" role="dialog" aria-modal="true" aria-labelledby="measurement-capture-title">
      <header><div><span className="dori-kicker">CV measurement guide</span><h2 id="measurement-capture-title">Measure with your camera</h2><p>Pose detection runs in your browser. Photos stay on this device.</p></div><button type="button" onClick={onClose} aria-label="Close measurement guide"><X /></button></header>
      <div className="measurement-capture-body">
        {!review && <>
          <label className="measurement-height-input">Your height (cm)<input type="number" min="80" max="250" step="0.5" value={knownHeight} onChange={(event) => setKnownHeight(event.target.value)} /></label>
          <p className="measurement-capture-status" role="status">{busy && <LoaderCircle className="w-4 h-4 animate-spin" />}{status}</p>
          {(source === 'camera' || source === 'photo') && <div className={`measurement-pose-stage ${source === 'camera' ? 'measurement-live-stage' : ''}`}>
            {source === 'camera' && <video ref={videoRef} autoPlay muted playsInline />}
            {source === 'photo' && photo && <img src={photo} alt="Uploaded pose preview" />}
            <PoseOverlay landmarks={landmarks} width={dimensions.width} height={dimensions.height} />
            {source === 'camera' && cameraReady && <span className="measurement-live-badge"><i /> LIVE CAMERA</span>}
            {landmarks && <span className="measurement-height-overlay">Height calibration · {knownHeight} cm</span>}
          </div>}
          <div className="measurement-capture-actions">
            {!cameraReady && <button type="button" className="dori-primary-button" onClick={startCamera}><Camera size={17} /> Open camera</button>}
            <button type="button" className="measurement-secondary-button" onClick={() => fileRef.current?.click()}><ImagePlus size={17} /> Upload a full-body photo</button>
            <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={uploadPhoto} hidden />
            {cameraReady && <label className="measurement-gesture-toggle"><input type="checkbox" checked={gestureCapture} onChange={(event) => { gestureCaptureRef.current = event.target.checked; setGestureCapture(event.target.checked); gestureStartRef.current = 0; }} /> Auto-capture when arms are close</label>}
            {cameraReady && <button type="button" className="dori-primary-button" onClick={capture}><ScanLine size={17} /> Capture & review</button>}
            {source === 'photo' && landmarks && <button type="button" className="dori-primary-button" onClick={capture}><ScanLine size={17} /> Review measurements</button>}
            {source && <button type="button" className="measurement-secondary-button" onClick={clearCapture}><RotateCcw size={16} /> Retake</button>}
          </div>
        </>}
        {review && <>
          <div className="measurement-pose-stage measurement-review-image">
            <img src={source === 'camera' ? cameraSnapshot : photo} alt="Captured pose preview with detected body landmarks" />
            <PoseOverlay landmarks={landmarks} width={dimensions.width} height={dimensions.height} />
            <span className="measurement-height-overlay">Height calibration · {knownHeight} cm</span>
          </div>
          <div className="measurement-review-note"><ScanLine size={18} /><span>Visual estimates · {unit === 'in' ? 'inches' : 'centimeters'}. Circumferences are rough front-view estimates. Please edit them to match your tape measurements.</span></div>
          <div className="measurement-review-grid">{fields.map(([key, label]) => <label key={key}>{label} ({unit})<input type="number" min="1" max="500" step="0.1" value={review[key] ?? ''} onChange={(event) => setReview((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div>
          <div className="measurement-capture-actions"><button type="button" className="measurement-secondary-button" onClick={() => setReview(null)}>Back to camera</button><button type="button" className="dori-primary-button" onClick={() => onApply(review)}>Use measurements</button></div>
        </>}
        {error && <p className="shop-error" role="alert">{error}</p>}
        <p className="measurement-privacy-note">For best results: face the camera, use even lighting, wear fitted clothing, and keep your head, shoulders, hips, and ankles in frame. Estimates are a starting point, not tailor-grade measurements.</p>
      </div>
    </section>
  </div>;
}
