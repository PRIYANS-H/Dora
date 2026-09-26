import React, { useCallback, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import { ImagePlus, LoaderCircle, Scissors, Send, X, Sparkles } from 'lucide-react';
import { createPost, uploadImage, generateCaption } from '../api/client';
import getCroppedImg from '../utils/cropImage';

const GARMENT_TYPES = ['Dress', 'Shirt', 'Blouse', 'Jacket', 'Trousers', 'Skirt', 'Suit', 'Tie', 'Custom'];

export default function CreatePostPage({ profile, onPosted }) {
  const fileRef = useRef(null);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [garmentType, setGarmentType] = useState('Dress');
  const [customGarmentType, setCustomGarmentType] = useState('');
  const [startingPrice, setStartingPrice] = useState('');
  const [image, setImage] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);

  const onCropComplete = useCallback((_area, pixels) => setCroppedAreaPixels(pixels), []);

  const chooseImage = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return; }
    if (file.size > 12 * 1024 * 1024) { setError('Images must be 12 MB or smaller.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setImage({ src: reader.result, file });
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setCropOpen(true);
      setError('');
    };
    reader.onerror = () => setError('Could not read that image. Please try another file.');
    reader.readAsDataURL(file);
  };

  const publish = async (event) => {
    event.preventDefault();
    setError(''); setStatus('');
    if (!image) return setError('Upload a design image before publishing.');
    const price = Number(startingPrice);
    if (!Number.isFinite(price) || price < 0) return setError('Enter a valid starting price, or enter 0 if you want to quote later.');
    setSaving(true);
    try {
      const cropped = croppedAreaPixels ? await getCroppedImg(image.src, croppedAreaPixels) : image.file;
      if (!cropped) throw new Error('Could not crop this image. Please try again.');
      const imageUrl = await uploadImage(cropped, 'posts');
      await createPost({
        title: title.trim(), image_url: imageUrl, caption: caption.trim(), garment_type: garmentType === 'Custom' ? customGarmentType.trim() : garmentType,
        base_attributes: { description: caption.trim(), garment_type: garmentType === 'Custom' ? customGarmentType.trim() : garmentType },
        starting_price_minor: Math.round(price * 100), currency: 'INR'
      });
      setStatus('Your design is live in the DORI feed.');
      setTitle(''); setCaption(''); setStartingPrice(''); setImage(null); setCroppedAreaPixels(null);
      onPosted?.();
    } catch (publishError) {
      setError(publishError.message || 'Could not publish this design.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateCaption = async () => {
    if (!title) {
      setError('Enter a design name first to generate a caption.');
      return;
    }
    setIsGeneratingCaption(true);
    setError('');
    try {
      const type = garmentType === 'Custom' ? customGarmentType : garmentType;
      const res = await generateCaption({ title: title.trim(), garment_type: type.trim(), base_attributes: {} });
      if (res && res.caption) {
        setCaption(res.caption);
      }
    } catch (err) {
      setError(err.message || 'Could not generate an AI caption.');
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  return (
    <>
      <form onSubmit={publish} className="create-post-page lp-glass-panel">
        <button type="button" className="create-post-art" onClick={() => fileRef.current?.click()} aria-label="Upload a design photo">
          {image ? <img src={image.src} alt="Design crop preview" /> : <><ImagePlus className="w-10 h-10" /><span>Upload a design photo</span><small>JPG, PNG, or WebP · up to 12 MB</small></>}
          {image && <span className="create-post-change-photo"><Scissors className="w-4 h-4" /> Adjust crop</span>}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} className="hidden" />
        <div className="create-post-fields">
          <span className="dori-kicker">Professional / New post</span>
          <h2>Put your work in the orbit.</h2>
          <p>Share a garment, set its starting price, and show customers what they can remix.</p>
          <label>Design name<input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A name for this piece" /></label>
          <label>Garment type<select value={garmentType} onChange={(event) => setGarmentType(event.target.value)}>{GARMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
          {garmentType === 'Custom' && <label>Custom garment name<input required maxLength={80} value={customGarmentType} onChange={(event) => setCustomGarmentType(event.target.value)} placeholder="Name your piece type" /></label>}
          <label>Starting price (₹)<input type="number" min="0" step="0.01" value={startingPrice} onChange={(event) => setStartingPrice(event.target.value)} placeholder="0.00 — quote later" required /></label>
          <label>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span>Caption</span>
              <button type="button" onClick={handleGenerateCaption} disabled={isGeneratingCaption} style={{background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 'bold'}}>
                {isGeneratingCaption ? <LoaderCircle className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {isGeneratingCaption ? 'Drafting caption…' : 'Draft with AI'}
              </button>
            </div>
            <textarea rows="4" maxLength={3000} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Tell people about the fabric, fit, and inspiration behind this design." />
          </label>
          <button type="submit" disabled={saving} className="dori-primary-button"><Send className="w-4 h-4" />{saving ? 'Publishing…' : 'Publish design'}</button>
          {status && <p className="settings-success" role="status">{status}</p>}
          {error && <p className="settings-error" role="alert">{error}</p>}
        </div>
      </form>
      {cropOpen && image && <div className="image-crop-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCropOpen(false); }}>
        <section className="image-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="post-crop-title">
          <header><div><span className="dori-kicker">Image framing</span><h2 id="post-crop-title">Crop your design</h2></div><button type="button" onClick={() => setCropOpen(false)} aria-label="Close crop tool"><X /></button></header>
          <div className="image-crop-stage"><Cropper image={image.src} crop={crop} zoom={zoom} aspect={4 / 5} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} /></div>
          <div className="image-crop-controls"><label>Zoom<input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label><button type="button" className="dori-primary-button" onClick={() => setCropOpen(false)}><Scissors className="w-4 h-4" /> Use this crop</button></div>
        </section>
      </div>}
      {saving && <div className="create-post-saving" role="status"><LoaderCircle className="w-5 h-5 animate-spin" />Uploading and publishing your design…</div>}
    </>
  );
}
