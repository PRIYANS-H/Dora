import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Box, Image as ImageIcon, Loader2, Sparkles, Upload } from 'lucide-react';
import { startTryOn, fetchTryOn, startModel3D, fetchModel3D, uploadImage } from '../api/client';
import '@google/model-viewer';

export default function TryOnPage({ garment, onBack }) {
  const [personImage, setPersonImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [tryOnJobId, setTryOnJobId] = useState(null);
  const [tryOnResult, setTryOnResult] = useState(null);
  const [tryOnStatus, setTryOnStatus] = useState(null);
  const [error, setError] = useState('');

  const [modelJobId, setModelJobId] = useState(null);
  const [modelResult, setModelResult] = useState(null);
  const [modelStatus, setModelStatus] = useState(null);

  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    setError('');
    try {
      const url = await uploadImage(file, 'tryon');
      setPersonImage(url);
    } catch (err) {
      setError(err.message || 'Failed to upload photo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartTryOn = async () => {
    if (!personImage || !garment) return;
    setError('');
    try {
      const job = await startTryOn({
        garment_image_url: garment.image_url,
        person_image_url: personImage,
        garment_description: garment.description || 'garment',
      });
      setTryOnJobId(job.job_id);
      setTryOnStatus(job);
    } catch (err) {
      setError(err.message || 'Failed to start try-on.');
    }
  };

  useEffect(() => {
    if (!tryOnJobId) return;
    let timer = setInterval(async () => {
      try {
        const job = await fetchTryOn(tryOnJobId);
        setTryOnStatus(job);
        if (job.status === 'success') {
          setTryOnResult(job.image_url);
          clearInterval(timer);
        } else if (job.status === 'failed') {
          setError(job.error || 'Try-on failed.');
          clearInterval(timer);
        }
      } catch (err) {
        // Ignore network blips during polling
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [tryOnJobId]);

  const handleStart3DModel = async () => {
    const imageUrl = tryOnResult || garment?.image_url;
    if (!imageUrl) return;
    setError('');
    try {
      const job = await startModel3D(imageUrl);
      setModelJobId(job.task_id);
      setModelStatus(job);
    } catch (err) {
      setError(err.message || 'Failed to start 3D model generation.');
    }
  };

  useEffect(() => {
    if (!modelJobId) return;
    let timer = setInterval(async () => {
      try {
        const job = await fetchModel3D(modelJobId);
        setModelStatus(job);
        if (job.status === 'success') {
          setModelResult(job.model_url);
          clearInterval(timer);
        } else if (['failed', 'cancelled', 'banned', 'expired'].includes(job.status)) {
          setError(job.error || '3D generation failed.');
          clearInterval(timer);
        }
      } catch (err) {
        // Ignore network blips
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [modelJobId]);

  if (!garment) {
    return (
      <div className="p-8 text-center">
        <p>No garment selected.</p>
        <button className="btn mt-4" onClick={onBack}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="tryon-page" style={{ padding: '24px clamp(16px, 4vw, 40px)', maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ marginBottom: 32 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 16 }}><ArrowLeft /> Back to Remix</button>
        <h1 className="display title-lg">Virtual Try-On & 3D</h1>
        <p className="lede">See how {garment.title || 'this garment'} looks on you, or generate a 3D model.</p>
      </header>

      {error && <div className="notice tone-bad" style={{ marginBottom: 24 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>
        <div className="glass" style={{ padding: 24, borderRadius: 16 }}>
          <h2 className="display title-md" style={{ marginBottom: 16 }}>1. Try It On</h2>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <p className="muted tiny" style={{ marginBottom: 8 }}>Garment</p>
              <img src={garment.image_url} alt="Garment" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 8 }} />
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <p className="muted tiny" style={{ marginBottom: 8 }}>You</p>
              {personImage ? (
                <div style={{ position: 'relative' }}>
                  <img src={personImage} alt="You" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 8 }} />
                  <button className="btn btn-sm btn-glass" style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)' }} onClick={() => fileInputRef.current?.click()}>Change</button>
                </div>
              ) : (
                <button className="btn btn-glass" style={{ width: '100%', aspectRatio: '3/4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }} onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  {isUploading ? <Loader2 className="animate-spin" /> : <><Upload style={{ marginBottom: 8 }} /> Upload Photo</>}
                </button>
              )}
              <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />
            </div>
          </div>
          
          <button className="btn btn-solid w-full" onClick={handleStartTryOn} disabled={!personImage || tryOnStatus?.status === 'running' || tryOnStatus?.status === 'queued'} style={{ width: '100%', justifyContent: 'center' }}>
            {tryOnStatus?.status === 'running' || tryOnStatus?.status === 'queued' ? (
              <><Loader2 className="animate-spin" /> {tryOnStatus.stage || 'Processing'}...</>
            ) : (
              <><Sparkles /> Try It On</>
            )}
          </button>

          {tryOnResult && (
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <h3 className="display" style={{ marginBottom: 16 }}>Result</h3>
              <img src={tryOnResult} alt="Try-On Result" style={{ width: '100%', borderRadius: 8 }} />
            </div>
          )}
        </div>

        <div className="glass" style={{ padding: 24, borderRadius: 16 }}>
          <h2 className="display title-md" style={{ marginBottom: 16 }}>2. Generate 3D Model</h2>
          <p className="muted text-sm" style={{ marginBottom: 24 }}>Turn the garment (or your try-on result) into a 3D model using Tripo.</p>
          
          <button className="btn btn-solid w-full" onClick={handleStart3DModel} disabled={(!garment.image_url && !tryOnResult) || ['queued', 'running', 'progressing'].includes(modelStatus?.status)} style={{ width: '100%', justifyContent: 'center' }}>
            {['queued', 'running', 'progressing'].includes(modelStatus?.status) ? (
              <><Loader2 className="animate-spin" /> Generating ({modelStatus.progress || 0}%)...</>
            ) : (
              <><Box /> Create 3D Model</>
            )}
          </button>

          {modelResult && (
            <div style={{ marginTop: 24, background: '#000', borderRadius: 8, overflow: 'hidden', aspectRatio: '1' }}>
              <model-viewer
                src={modelResult}
                auto-rotate
                camera-controls
                ar
                shadow-intensity="1"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
