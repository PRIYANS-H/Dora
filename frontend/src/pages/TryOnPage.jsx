import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Box, Camera, Download, ImagePlus, RefreshCw, Shirt, Sparkles, Trash2, Upload } from 'lucide-react';
import { fetchModel3D, fetchTryOn, startModel3D, startTryOn, uploadImage } from '../api/client';
import Avatar from '../components/Avatar';
import BeforeAfter from '../components/BeforeAfter';
import CapsuleTabs from '../components/CapsuleTabs';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import { describeGarment } from '../utils/attributes';
import { getPosts } from '../utils/postsCache';
import { toast } from '../utils/toast';
import '../styles/tryon.css';

const PHOTO_KEY = 'dori:tryon-photo';
const TRYON_ESTIMATE_SECONDS = 45;
const VIEWS = [{ id: 'look', label: 'Your look' }, { id: '3d', label: '3D model' }];

const readSavedPhoto = () => { try { return window.localStorage.getItem(PHOTO_KEY) || ''; } catch { return ''; } };
const savePhoto = (url) => { try { if (url) window.localStorage.setItem(PHOTO_KEY, url); else window.localStorage.removeItem(PHOTO_KEY); } catch { /* storage unavailable */ } };

// Polls a job until it leaves the running state; returns a cancel function.
function pollJob(fetcher, id, onUpdate, interval = 2500) {
  let stopped = false;
  let timer;
  const tick = async () => {
    try {
      const job = await fetcher(id);
      if (stopped) return;
      onUpdate(job);
      if (job.status === 'running' || job.status === 'queued') timer = window.setTimeout(tick, interval);
    } catch {
      if (!stopped) timer = window.setTimeout(tick, interval * 2);
    }
  };
  timer = window.setTimeout(tick, interval);
  return () => { stopped = true; window.clearTimeout(timer); };
}

function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1440 } }, audio: false })
      .then((media) => { stream = media; if (videoRef.current) { videoRef.current.srcObject = media; videoRef.current.play().then(() => setReady(true)).catch(() => {}); } })
      .catch((cause) => setError(cause.name === 'NotAllowedError' ? 'Allow camera access in your browser, or upload a photo instead.' : 'Couldn’t start the camera here — upload a photo instead.'));
    return () => stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.translate(canvas.width, 0);
    context.scale(-1, 1); // save what the mirrored preview showed
    context.drawImage(video, 0, 0);
    canvas.toBlob((blob) => { if (blob) onCapture(new File([blob], 'tryon-camera.jpg', { type: 'image/jpeg' })); }, 'image/jpeg', 0.92);
  };

  return (
    <Modal onClose={onClose} size="md" labelledBy="tryon-camera-title" className="tryon-camera">
      <div className="tryon-camera-body">
        <h2 id="tryon-camera-title" className="display title-sm">Take a photo</h2>
        <p className="muted tiny">Face the camera, step back so your upper body fits the frame, and use even light.</p>
        <div className="tryon-camera-stage">
          <video ref={videoRef} muted playsInline />
          {!ready && !error && <span className="tryon-camera-wait"><Spinner size="md" /> Starting camera…</span>}
          <span className="tryon-camera-guide" aria-hidden="true" />
        </div>
        {error && <p className="notice tone-bad">{error}</p>}
        <button type="button" className="btn btn-solid btn-lg btn-block" onClick={capture} disabled={!ready}><Camera /> Capture</button>
      </div>
    </Modal>
  );
}

function GarmentPicker({ onPick, onClose }) {
  const [posts, setPosts] = useState(null);
  useEffect(() => { getPosts().then(setPosts).catch(() => setPosts([])); }, []);
  return (
    <Modal onClose={onClose} size="lg" labelledBy="tryon-picker-title" className="tryon-picker">
      <div className="tryon-picker-body">
        <h2 id="tryon-picker-title" className="display title-sm">Choose a garment</h2>
        <div className="maker-portfolio tryon-picker-grid">
          {(posts || Array.from({ length: 6 }, (_, index) => ({ id: `s${index}` }))).map((post, index) => (post.image_url ? (
            <button type="button" key={post.id} className="maker-portfolio-item rise" style={{ '--i': index }} onClick={() => onPick(post)}>
              <img src={post.image_url} alt="" loading="lazy" />
              <span><strong>{post.title}</strong><em>{post.designer_name}</em></span>
            </button>
          ) : <div key={post.id} className="maker-portfolio-item dori-skeleton" />))}
        </div>
      </div>
    </Modal>
  );
}

function ModelViewer({ src, poster, alt }) {
  // three.js + model-viewer are ~1 MB, so load them only when a model is shown.
  useEffect(() => { import('@google/model-viewer'); }, []);
  return (
    <model-viewer
      class="tryon-model"
      src={src}
      poster={poster || undefined}
      alt={alt}
      camera-controls=""
      auto-rotate=""
      auto-rotate-delay="600"
      shadow-intensity="1"
      exposure="1.05"
      environment-image="neutral"
      ar=""
      ar-modes="webxr scene-viewer quick-look"
      touch-action="pan-y"
      interaction-prompt="auto"
    >
      <button slot="ar-button" type="button" className="btn btn-sm btn-glass tryon-ar"><Box /> View in your space</button>
    </model-viewer>
  );
}

export default function TryOnPage({ garment: initialGarment, onBack }) {
  const [garment, setGarment] = useState(initialGarment || null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [personImage, setPersonImage] = useState(readSavedPhoto);
  const [uploading, setUploading] = useState(false);
  const [view, setView] = useState('look');
  const [tryOn, setTryOn] = useState(null);
  const [model, setModel] = useState(null);
  const [modelSource, setModelSource] = useState('look');
  const [modelPhoto, setModelPhoto] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const modelFileRef = useRef(null);
  const stopTryOnPoll = useRef(null);
  const stopModelPoll = useRef(null);

  useEffect(() => () => { stopTryOnPoll.current?.(); stopModelPoll.current?.(); }, []);

  const tryOnRunning = tryOn?.status === 'running';
  const modelRunning = model?.status === 'running' || model?.status === 'queued';
  const lookUrl = tryOn?.status === 'success' ? tryOn.image_url : '';

  const pickPost = (post) => {
    setGarment({ image_url: post.image_url, title: post.title, description: describeGarment(post, post.base_attributes || {}), remixed: false, post });
    setPickerOpen(false);
    setTryOn(null);
  };

  const upload = async (file, onDone) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return; }
    if (file.size > 12 * 1024 * 1024) { setError('Photos must be 12 MB or smaller.'); return; }
    setUploading(true);
    setError('');
    try { onDone(await uploadImage(file, 'tryon')); }
    catch (cause) { setError(cause.message || 'Couldn’t upload that photo.'); }
    finally { setUploading(false); }
  };

  const choosePersonPhoto = (url) => { setPersonImage(url); savePhoto(url); setTryOn(null); };

  const runTryOn = async () => {
    if (!personImage || !garment) return;
    setError('');
    setView('look');
    try {
      const job = await startTryOn({ person_image_url: personImage, garment_image_url: garment.image_url, garment_description: garment.description || garment.title || 'garment' });
      setTryOn(job);
      stopTryOnPoll.current?.();
      stopTryOnPoll.current = pollJob(fetchTryOn, job.job_id, (next) => {
        setTryOn(next);
        if (next.status === 'success') toast('Your look is ready');
        if (next.status === 'failed') setError(next.error || 'The try-on didn’t work this time.');
      });
    } catch (cause) { setError(cause.message || 'Couldn’t start the try-on.'); }
  };

  const modelImage = modelSource === 'look' ? lookUrl : modelSource === 'garment' ? garment?.image_url : modelPhoto;

  const runModel = async () => {
    if (!modelImage) return;
    setError('');
    try {
      const job = await startModel3D(modelImage);
      setModel(job);
      stopModelPoll.current?.();
      stopModelPoll.current = pollJob(fetchModel3D, job.task_id, (next) => {
        setModel(next);
        if (next.status === 'success') toast('3D model ready — drag to spin it');
        if (!['running', 'queued', 'success'].includes(next.status)) setError(next.error || 'The 3D model couldn’t be built from this photo.');
      }, 4000);
    } catch (cause) { setError(cause.message || 'Couldn’t start the 3D model.'); }
  };

  const tryOnProgress = tryOnRunning ? Math.min(94, Math.round(((tryOn.elapsed_seconds || 0) / TRYON_ESTIMATE_SECONDS) * 100)) : 0;
  const sources = [
    lookUrl && { id: 'look', label: 'Your look', image: lookUrl },
    garment && { id: 'garment', label: 'The garment', image: garment.image_url },
    { id: 'photo', label: 'Any photo', image: modelPhoto },
  ].filter(Boolean);
  const activeSource = sources.some((source) => source.id === modelSource) ? modelSource : sources[0].id;

  return (
    <div className="tryon">
      <header className="tryon-head">
        <div>
          <span className="kicker live">Try-On Studio</span>
          <h2 className="display title-lg">See it on you.</h2>
          <p className="lede">Add a photo of yourself and DORI fits the garment onto you — then spin the look in 3D.</p>
        </div>
        {onBack && initialGarment?.post && <button type="button" className="btn btn-sm btn-ghost" onClick={onBack}><ArrowLeft /> Back to Remix</button>}
      </header>

      {error && <p className="notice tone-bad" role="alert">{error}</p>}

      <div className="tryon-grid">
        <aside className="tryon-inputs glass">
          <div className="tryon-step">
            <span className="step-num">1</span>
            <div><h3>The garment</h3><p>{garment ? `${garment.title}${garment.remixed ? ' · your remix' : ''}` : 'Pick something from the feed'}</p></div>
          </div>
          {garment ? (
            <div className="tryon-garment">
              <img src={garment.image_url} alt={garment.title} />
              <button type="button" className="btn btn-sm btn-glass" onClick={() => setPickerOpen(true)}><Shirt /> Change</button>
            </div>
          ) : (
            <button type="button" className="tryon-drop" onClick={() => setPickerOpen(true)}><Shirt /><strong>Choose a garment</strong><span>From the feed or your remixes</span></button>
          )}

          <div className="tryon-step">
            <span className="step-num">2</span>
            <div><h3>Your photo</h3><p>Front-facing, upper body or full length, even light.</p></div>
          </div>
          {personImage ? (
            <div className="tryon-person">
              <img src={personImage} alt="You" />
              <div className="tryon-person-actions">
                <button type="button" className="btn btn-sm btn-glass" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? <Spinner size="sm" /> : <Upload />} Replace</button>
                <button type="button" className="btn btn-sm btn-glass btn-icon" onClick={() => choosePersonPhoto('')} aria-label="Remove photo"><Trash2 /></button>
              </div>
            </div>
          ) : (
            <div className="tryon-photo-options">
              <button type="button" className="tryon-drop" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Spinner size="lg" /> : <ImagePlus />}<strong>{uploading ? 'Uploading…' : 'Upload a photo'}</strong><span>JPG or PNG, up to 12 MB</span>
              </button>
              <button type="button" className="btn btn-block btn-ghost" onClick={() => setCameraOpen(true)} disabled={uploading}><Camera /> Use camera</button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => { upload(event.target.files?.[0], choosePersonPhoto); event.target.value = ''; }} />

          <button type="button" className="btn btn-solid btn-lg btn-block" onClick={runTryOn} disabled={!garment || !personImage || tryOnRunning || uploading}>
            {tryOnRunning ? <><Spinner size="sm" /> Rendering…</> : <><Sparkles /> {lookUrl ? 'Try again' : 'Try it on'}</>}
          </button>
          <p className="tryon-privacy">Your photo is saved to your DORI uploads and sent to the open-source IDM-VTON model on Hugging Face to render the look.</p>
        </aside>

        <section className="tryon-stage glass">
          <CapsuleTabs options={VIEWS} value={view} onChange={setView} size="sm" ariaLabel="Result view" />

          {view === 'look' && (
            <div className="tryon-view" key="look">
              {lookUrl ? (
                <>
                  <BeforeAfter beforeSrc={personImage} afterSrc={lookUrl} beforeLabel="You" afterLabel="Wearing it" sweepKey={lookUrl} kicker="Try-on result" />
                  <div className="tryon-actions">
                    <a className="btn btn-ghost" href={lookUrl} target="_blank" rel="noreferrer" download><Download /> Save image</a>
                    <button type="button" className="btn btn-solid" onClick={() => { setModelSource('look'); setView('3d'); }}><Box /> Make it 3D</button>
                  </div>
                </>
              ) : tryOnRunning ? (
                <div className="tryon-running">
                  {personImage && <img src={personImage} alt="" />}
                  <span className="viz-busy-sheen" />
                  <div className="tryon-running-card glass">
                    <Spinner size="lg" />
                    <strong>{tryOn.stage || 'Rendering'}…</strong>
                    <span>{tryOn.elapsed_seconds || 0}s · usually about {TRYON_ESTIMATE_SECONDS}s</span>
                    <div className="tryon-bar"><i style={{ width: `${tryOnProgress}%` }} /></div>
                  </div>
                </div>
              ) : (
                <div className="empty tryon-empty">
                  <Avatar size={56} />
                  <strong>Your look appears here</strong>
                  <p>{!garment ? 'Choose a garment, then add your photo.' : !personImage ? 'Add a photo of yourself to try it on.' : 'Press “Try it on” — it takes about 45 seconds.'}</p>
                </div>
              )}
            </div>
          )}

          {view === '3d' && (
            <div className="tryon-view" key="3d">
              {model?.status === 'success' && model.model_url ? (
                <>
                  <div className="tryon-model-frame"><ModelViewer src={model.model_url} poster={model.preview_url} alt={`3D model of ${garment?.title || 'your look'}`} /></div>
                  <div className="tryon-actions">
                    <a className="btn btn-ghost" href={model.model_url} download><Download /> Download .glb</a>
                    <button type="button" className="btn" onClick={() => setModel(null)}><RefreshCw /> Build another</button>
                  </div>
                </>
              ) : modelRunning ? (
                <div className="tryon-building">
                  <div className="tryon-ring" style={{ '--p': model.progress || 5 }}><span>{model.progress || 5}%</span></div>
                  <strong>{model.stage || 'Building your model'}…</strong>
                  <p className="muted tiny">InstantMesh reconstructs a textured mesh from one photo — usually 1–2 minutes.</p>
                </div>
              ) : (
                <div className="tryon-3d-setup">
                  <p className="lede">Turn a photo into a 3D model you can rotate, zoom and place in your room on a phone.</p>
                  <div className="tryon-sources" role="radiogroup" aria-label="3D model source">
                    {sources.map((source) => (
                      <button type="button" key={source.id} role="radio" aria-checked={activeSource === source.id} className={`tryon-source ${activeSource === source.id ? 'is-selected' : ''}`} onClick={() => { setModelSource(source.id); if (source.id === 'photo' && !modelPhoto) modelFileRef.current?.click(); }}>
                        <span className="tryon-source-thumb">{source.image ? <img src={source.image} alt="" /> : <Upload />}</span>
                        <span>{source.label}</span>
                      </button>
                    ))}
                  </div>
                  <input ref={modelFileRef} type="file" accept="image/*" hidden onChange={(event) => { upload(event.target.files?.[0], (url) => { setModelPhoto(url); setModelSource('photo'); }); event.target.value = ''; }} />
                  <button type="button" className="btn btn-solid btn-lg" onClick={runModel} disabled={!modelImage || uploading}><Box /> Create 3D model</button>
                  <p className="tryon-privacy">Runs the open-source InstantMesh model on Hugging Face. Plain backgrounds and a single subject work best.</p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {pickerOpen && <GarmentPicker onPick={pickPost} onClose={() => setPickerOpen(false)} />}
      {cameraOpen && <CameraCapture onClose={() => setCameraOpen(false)} onCapture={(file) => { setCameraOpen(false); upload(file, choosePersonPhoto); }} />}
    </div>
  );
}
