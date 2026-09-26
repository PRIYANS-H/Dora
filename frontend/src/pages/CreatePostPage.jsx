import React, { useEffect, useRef, useState } from 'react';
import {
  UploadCloud,
  Sparkles,
  Layers,
  Check,
  User,
  Film,
  Image as ImageIcon,
  X,
  Key,
  AlertCircle,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../api/supabase';

const AESTHETIC_TONES = [
  { id: 'Creative', label: 'Creative', desc: 'Evocative & artistic' },
  { id: 'Luxury', label: 'Luxury', desc: 'Atelier couture elegance' },
  { id: 'Streetwear', label: 'Streetwear', desc: 'Edgy & urban' },
  { id: 'Minimal', label: 'Minimal', desc: 'Understated & crisp' },
  { id: 'Editorial', label: 'Editorial', desc: 'Structured & refined' },
  { id: 'Casual', label: 'Casual', desc: 'Effortless everyday' },
];

export default function CreatePostPage({ profile, onPosted }) {
  const fileInputRef = useRef(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [caption, setCaption] = useState('');
  const [selectedTone, setSelectedTone] = useState('Creative');

  // Media State
  const [files, setFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Status & Key State
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [feedCount, setFeedCount] = useState(0);
  const [hasEnvKey, setHasEnvKey] = useState(false);
  const [apiKey, setApiKey] = useState(() => {
    try {
      return localStorage.getItem('dori_gemini_api_key') || '';
    } catch {
      return '';
    }
  });
  const [showKeyDrawer, setShowKeyDrawer] = useState(false);

  // Check Gemini Status & Feed count on mount
  useEffect(() => {
    fetch('/api/ai/status')
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        if (data && data.configured) setHasEnvKey(true);
      })
      .catch(() => {});

    fetch('/api/posts')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setFeedCount(data.length);
      })
      .catch(() => {});
  }, []);

  const saveManualApiKey = (newKey) => {
    setApiKey(newKey);
    try {
      if (newKey) localStorage.setItem('dori_gemini_api_key', newKey);
      else localStorage.removeItem('dori_gemini_api_key');
    } catch {}
  };

  // Handle file additions
  const handleFiles = (incomingList) => {
    if (!incomingList || incomingList.length === 0) return;
    const valid = Array.from(incomingList).filter(
      (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
    );

    if (valid.length === 0) {
      setStatus({ type: 'error', text: 'Please select valid image or video files (JPG, PNG, WEBP, MP4).' });
      return;
    }

    const newUrls = valid.map((f) => URL.createObjectURL(f));
    setFiles((prev) => [...prev, ...valid]);
    setPreviewUrls((prev) => [...prev, ...newUrls]);
    setActiveFileIndex(files.length); // point to first new file
    setStatus(null);
  };

  const handleFileChange = (e) => {
    handleFiles(e.target.files);
  };

  const removeFile = (idx, e) => {
    e?.stopPropagation();
    const updatedFiles = files.filter((_, i) => i !== idx);
    const updatedUrls = previewUrls.filter((_, i) => i !== idx);
    setFiles(updatedFiles);
    setPreviewUrls(updatedUrls);
    if (activeFileIndex >= updatedFiles.length) {
      setActiveFileIndex(Math.max(0, updatedFiles.length - 1));
    }
  };

  // Drag and Drop
  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Convert image/video frame to base64 for Gemini Vision
  const extractMediaBase64 = async (file) => {
    if (!file) return null;
    if (file.type.startsWith('image/')) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    } else if (file.type.startsWith('video/')) {
      return new Promise((resolve) => {
        try {
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.src = URL.createObjectURL(file);
          video.muted = true;
          video.playsInline = true;
          video.currentTime = 0.5;
          video.onseeked = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = Math.min(video.videoWidth || 640, 800);
              canvas.height = Math.min(video.videoHeight || 480, 600);
              const ctx = canvas.getContext('2d');
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              resolve(canvas.toDataURL('image/jpeg', 0.8));
            } catch {
              resolve(null);
            }
          };
          video.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    }
    return null;
  };

  // Generate AI Caption using Gemini
  const generateAiCaption = async () => {
    if (!hasEnvKey && !apiKey.trim()) {
      setShowKeyDrawer(true);
      setStatus({
        type: 'error',
        text: 'Please enter your Gemini API key below or set GEMINI_API_KEY in backend/.env',
      });
      return;
    }

    setGeneratingCaption(true);
    setStatus(null);

    try {
      const activeFile = files[activeFileIndex] || files[0];
      const mediaData = activeFile ? await extractMediaBase64(activeFile) : null;

      const payload = {
        tone: selectedTone,
        title: title.trim(),
        image_data: mediaData,
        api_key: apiKey.trim() || undefined,
      };

      const res = await fetch('/api/ai/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to generate AI caption.');
      }

      setCaption(data.caption);
      setStatus({
        type: 'success',
        text: `AI caption generated successfully with ${data.model_used || 'Gemini Vision'} (${selectedTone} aesthetic).`,
      });
    } catch (err) {
      setStatus({
        type: 'error',
        text: err.message || 'Gemini caption generation error. Verify your API key.',
      });
    } finally {
      setGeneratingCaption(false);
    }
  };

  // Upload image to backend or Supabase storage
  const uploadImage = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        const url = data.image_url || data.url;
        if (url) return url;
      }
    } catch {}

    if (supabase) {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `posts/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;

      const { error: uploadError } = await supabase.storage.from('posts').upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
      if (!uploadError) {
        return supabase.storage.from('posts').getPublicUrl(path).data.publicUrl;
      }

      const { error: avatarError } = await supabase.storage.from('avatars').upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
      if (!avatarError) {
        return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      }
    }

    throw new Error('Failed to upload media. Please try again.');
  };

  // Submit Post
  const submit = async (event) => {
    event.preventDefault();
    if (files.length === 0) {
      setStatus({ type: 'error', text: 'Please upload at least one fashion asset (image or video).' });
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      const primaryFile = files[activeFileIndex] || files[0];
      const finalMediaUrl = await uploadImage(primaryFile);

      const postPayload = {
        title: title.trim() || 'Untitled Silhouette',
        image_url: finalMediaUrl,
        designer_name: profile?.full_name || 'Elena Rostova',
        designer_handle: profile?.username ? `@${profile.username}` : '@elena_couture',
        base_attributes: {
          description: caption.trim(),
          tone: selectedTone,
          fabric: 'heavy cotton twill',
          fit: 'regular',
          color: 'onyx',
          neckline: 'mandarin',
          sleeves: 'full',
          media_type: primaryFile.type.startsWith('video/') ? 'video' : 'image',
        },
        price_reference: parseInt(price, 10) || 350,
      };

      // Always route post creation through backend /api/posts with service role to prevent RLS violations
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postPayload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to publish post');
      }

      const createdPost = await res.json();
      setStatus({ type: 'success', text: 'Design published! Redirecting to couture feed...' });

      // Clean form state
      setTitle('');
      setPrice('');
      setCaption('');
      setFiles([]);
      setPreviewUrls([]);
      setSaving(false);

      // Return immediately to feed so the user sees the newly published post
      if (onPosted) {
        onPosted(createdPost);
      }
    } catch (err) {
      setStatus({ type: 'error', text: err.message || 'An error occurred while publishing.' });
      setSaving(false);
    }
  };

  const activeFile = files[activeFileIndex];
  const activePreviewUrl = previewUrls[activeFileIndex];

  return (
    <div className="w-full max-w-6xl mx-auto pb-12 text-gray-100">
      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <header className="ai-studio-banner rounded-2xl p-6 sm:p-8 mb-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
            Designer Social Feed & AI Studio
          </h1>
          <p className="text-sm text-gray-300 max-w-2xl leading-relaxed">
            Upload design media, generate fashion captions with Gemini AI, publish to the couture feed,
            and test engagement (likes, comments, shares).
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onPosted && onPosted()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-semibold text-gray-200 transition-all cursor-pointer"
          >
            <Layers className="w-4 h-4 text-purple-400" />
            <span>Live Feed ({feedCount})</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#eab308] hover:bg-[#facc15] text-black text-xs font-bold transition-all shadow-md shadow-amber-900/30 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Upload & Publish</span>
          </button>
        </div>
      </header>

      {/* ── Status Alert Banner ────────────────────────────────────────────── */}
      {status && (
        <div
          className={`mb-6 p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium animate-fadeIn ${
            status.type === 'error'
              ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
              : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {status.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            ) : (
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            )}
            <span>{status.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatus(null)}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Main Studio Grid ───────────────────────────────────────────────── */}
      <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ── Section 1: UPLOAD IMAGES OR VIDEOS ────────────────────────────── */}
        <section className="ai-studio-card rounded-2xl p-6 sm:p-7 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-200">
                <UploadCloud className="w-4 h-4 text-amber-400" />
                <span>1. Upload Images or Videos</span>
              </div>
              {files.length > 0 && (
                <span className="text-[11px] font-mono text-gray-400 bg-white/5 px-2.5 py-1 rounded-md border border-white/10">
                  {files.length} {files.length === 1 ? 'asset' : 'assets'} selected
                </span>
              )}
            </div>

            {/* Dropzone container */}
            <div
              className={`ai-studio-dropzone rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer min-h-[300px] relative overflow-hidden ${
                isDragging ? 'dragging' : ''
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {activePreviewUrl ? (
                <div className="w-full flex flex-col items-center gap-4 relative z-10" onClick={(e) => e.stopPropagation()}>
                  <div className="w-full max-h-[360px] rounded-lg overflow-hidden flex items-center justify-center bg-black/60 border border-white/10 relative shadow-inner">
                    {activeFile?.type.startsWith('video/') ? (
                      <video
                        src={activePreviewUrl}
                        controls
                        className="max-h-[360px] w-full object-contain"
                      />
                    ) : (
                      <img
                        src={activePreviewUrl}
                        alt="Selected couture design"
                        className="max-h-[360px] w-full object-contain"
                      />
                    )}

                    <button
                      type="button"
                      onClick={(e) => removeFile(activeFileIndex, e)}
                      title="Remove asset"
                      className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/70 hover:bg-rose-950/80 text-gray-300 hover:text-rose-200 border border-white/20 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Thumbnail Row for Multi-Upload */}
                  {files.length > 1 && (
                    <div className="w-full flex items-center gap-2 overflow-x-auto pb-1">
                      {files.map((f, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setActiveFileIndex(i)}
                          className={`relative w-14 h-14 rounded-lg overflow-hidden shrink-0 border transition-all cursor-pointer ${
                            i === activeFileIndex
                              ? 'border-amber-400 ring-2 ring-amber-400/40'
                              : 'border-white/20 opacity-70 hover:opacity-100'
                          }`}
                        >
                          {f.type.startsWith('video/') ? (
                            <div className="w-full h-full bg-black flex items-center justify-center text-gray-300">
                              <Film className="w-5 h-5" />
                            </div>
                          ) : (
                            <img
                              src={previewUrls[i]}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Asset Info & Action */}
                  <div className="w-full flex items-center justify-between text-[11px] text-gray-400 pt-2 border-t border-white/10">
                    <span className="truncate max-w-[200px] font-mono">
                      {activeFile?.name} ({(activeFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer underline"
                    >
                      + Add more assets
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-amber-400 group-hover:scale-105 transition-transform">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-semibold text-gray-100 mb-1">
                    Click to browse or drop multiple fashion assets
                  </p>
                  <p className="text-xs text-gray-400">
                    Select multiple images at once • JPG, PNG, WEBP, MP4
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Section 2: AI FASHION CAPTION (GEMINI VISION) ─────────────────── */}
        <section className="ai-studio-card rounded-2xl p-6 sm:p-7 flex flex-col gap-5 shadow-xl">
          {/* Card Header & Gemini Vision Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-200">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>2. AI Fashion Caption</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-purple-950/80 text-purple-300 border border-purple-500/40 flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                Gemini Vision
              </span>

              {/* API Key settings toggle */}
              <button
                type="button"
                onClick={() => setShowKeyDrawer(!showKeyDrawer)}
                className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all cursor-pointer ${
                  apiKey || hasEnvKey
                    ? 'bg-purple-950/40 border-purple-500/30 text-purple-300 hover:bg-purple-900/50'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
                title="Configure Gemini API Key"
              >
                <Key className="w-3.5 h-3.5" />
                <span className="text-[10px] hidden sm:inline">
                  {apiKey ? 'Manual Key' : hasEnvKey ? 'Env Key' : 'API Key'}
                </span>
              </button>
            </div>
          </div>

          {/* Optional Inline API Key Drawer */}
          {showKeyDrawer && (
            <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-2 text-xs animate-fadeIn">
              <div className="flex items-center justify-between text-gray-300 font-medium">
                <span>Gemini API Key:</span>
                <span className="text-[10px] text-gray-400">
                  {hasEnvKey ? '✓ Found GEMINI_API_KEY in backend/.env' : 'No key in .env'}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => saveManualApiKey(e.target.value)}
                  placeholder="Paste manual Gemini API key here..."
                  className="flex-1 bg-black/50 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 font-mono"
                />
                {apiKey && (
                  <button
                    type="button"
                    onClick={() => saveManualApiKey('')}
                    className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] text-gray-300 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="text-[10px] text-gray-400">
                You can also add <code className="text-purple-300 font-mono">GEMINI_API_KEY=...</code> directly to{' '}
                <code className="text-purple-300 font-mono">backend/.env</code>.
              </p>
            </div>
          )}

          {/* Aesthetic Tone Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2.5">
              Select Aesthetic Tone:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {AESTHETIC_TONES.map((tone) => {
                const isSelected = selectedTone === tone.id;
                return (
                  <button
                    key={tone.id}
                    type="button"
                    onClick={() => setSelectedTone(tone.id)}
                    className={`ai-tone-btn text-left p-3 rounded-xl border cursor-pointer ${
                      isSelected
                        ? 'selected'
                        : 'bg-[#0d1424]/60 border-white/10 hover:border-white/20 text-gray-300 hover:bg-[#131e36]'
                    }`}
                  >
                    <div className="font-bold text-xs leading-tight mb-0.5">{tone.label}</div>
                    <div
                      className={`text-[10px] leading-snug ${
                        isSelected ? 'text-purple-100' : 'text-gray-400'
                      }`}
                    >
                      {tone.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate AI Caption Button */}
          <button
            type="button"
            onClick={generateAiCaption}
            disabled={generatingCaption}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-950/70 via-indigo-950/60 to-purple-950/70 hover:from-purple-900/90 hover:to-indigo-900/90 border border-purple-500/40 text-purple-200 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-950/40 cursor-pointer disabled:opacity-50"
          >
            {generatingCaption ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-purple-300" />
                <span>Analyzing Silhouette with Gemini Vision...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-purple-300" />
                <span>Generate AI Caption</span>
                <span className="text-base">🪄</span>
              </>
            )}
          </button>

          {/* Caption Textarea with Character Counter */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-xs text-gray-300">
              <label htmlFor="caption-input" className="font-semibold">
                Post Caption (Review or write manually):
              </label>
              <span className="font-mono text-[11px] text-gray-500">
                {caption.length} / 2200
              </span>
            </div>
            <textarea
              id="caption-input"
              rows={4}
              maxLength={2200}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Describe your silhouette, tailoring notes, or generate with AI above..."
              className="w-full box-border bg-[#080d18] border border-white/10 rounded-xl p-3.5 text-white placeholder-gray-500 text-xs sm:text-sm focus:border-purple-500 focus:outline-none transition-colors resize-y leading-relaxed font-sans"
            />
          </div>

          {/* Design Title & Price Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="title-input" className="block text-xs font-semibold text-gray-300 mb-1.5">
                Design Title
              </label>
              <input
                id="title-input"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Noir Asymmetric Trench"
                className="w-full box-border bg-[#080d18] border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-gray-500 text-xs sm:text-sm focus:border-purple-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label htmlFor="price-input" className="block text-xs font-semibold text-gray-300 mb-1.5">
                Price Reference ($)
              </label>
              <input
                id="price-input"
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="350"
                className="w-full box-border bg-[#080d18] border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-gray-500 text-xs sm:text-sm focus:border-purple-500 focus:outline-none transition-colors font-mono"
              />
            </div>
          </div>

          {/* Posting Identity Pill */}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#080d17] border border-white/10 text-xs text-gray-300">
            <User className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-gray-400">Posting as:</span>
            <strong className="text-white">
              {profile?.full_name || 'Elena Rostova'}
            </strong>
            <span className="text-gray-400 font-mono text-[11px]">
              ({profile?.username ? `@${profile.username}` : '@elena_couture'})
            </span>
          </div>

          {/* Publish CTA Button */}
          <button
            type="submit"
            disabled={saving || files.length === 0}
            className="w-full py-3.5 px-4 rounded-xl bg-[#eab308] hover:bg-[#facc15] text-black font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-950/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{saving ? 'Publishing Design...' : 'Publish Design to Feed →'}</span>
          </button>
        </section>
      </form>
    </div>
  );
}
