import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Sliders,
  User,
  Scissors,
  RefreshCw,
  ChevronDown,
  Zap,
  Activity,
  ShieldCheck
} from 'lucide-react';
import ThreeModelViewer from '../components/ThreeModelViewer';
import {
  generateVirtualTryon,
  fetchTryonHealth,
  getGlbModelDownloadUrl
} from '../api/client';

const COLOR_PRESETS = [
  { name: 'Onyx Black', hex: '#18181b' },
  { name: 'Amber Gold', hex: '#d97706' },
  { name: 'Royal Navy', hex: '#1e3a8a' },
  { name: 'Emerald Silk', hex: '#065f46' },
  { name: 'Burgundy Velvet', hex: '#831843' },
  { name: 'Pearl Ivory', hex: '#f8fafc' }
];

const GARMENT_TYPES = [
  { id: 'tee', label: 'T-Shirt', desc: 'Classic crewneck fitted silhouette' },
  { id: 'shirt', label: 'Dress Shirt', desc: 'Collar placket & structured sleeves' },
  { id: 'dress', label: 'Couture Dress', desc: 'Fitted bodice & flared skirt' },
  { id: 'jeans', label: 'Tailored Jeans', desc: 'Waistband with dual leg shafts' }
];

const POSES = [
  { id: 'A-pose', label: 'A-Pose (Standard)' },
  { id: 'T-pose', label: 'T-Pose (Spread)' },
  { id: 'hands-down', label: 'Hands Down' },
  { id: 'neutral', label: 'Neutral Standing' }
];

export default function VirtualTryOnPage() {
  // Body Parameters
  const [heightCm, setHeightCm] = useState(175);
  const [weightKg, setWeightKg] = useState(70);
  const [gender, setGender] = useState('neutral');
  const [pose, setPose] = useState('A-pose');

  // Garment Parameters
  const [garmentType, setGarmentType] = useState('tee');
  const [garmentColor, setGarmentColor] = useState('#18181b');
  const [customColor, setCustomColor] = useState('#18181b');

  // Garment Dimensions
  const [chestCm, setChestCm] = useState(96);
  const [waistCm, setWaistCm] = useState(82);
  const [hipCm, setHipCm] = useState(98);
  const [lengthCm, setLengthCm] = useState(68);
  const [sleeveCm, setSleeveCm] = useState(22);

  // Advanced Accordion
  const [showAdvancedMeasurements, setShowAdvancedMeasurements] = useState(false);

  // Generation & Model State
  const [isGenerating, setIsGenerating] = useState(false);
  const [modelUrl, setModelUrl] = useState('');
  const [currentJobId, setCurrentJobId] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [healthStatus, setHealthStatus] = useState(null);

  // Check 3D backend readiness on mount
  useEffect(() => {
    fetchTryonHealth()
      .then((data) => setHealthStatus(data))
      .catch((err) => {
        console.warn('3D health check note:', err);
      });
  }, []);

  // Compute live BMI
  const bmi = (weightKg / ((heightCm / 100) ** 2)).toFixed(1);

  // Trigger 3D Virtual Try-On Generation
  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg('');

    const payload = {
      height_cm: Number(heightCm),
      weight_kg: Number(weightKg),
      gender,
      pose,
      garment_type: garmentType,
      garment_color: garmentColor,
      garment_measurements: {
        chest: Number(chestCm),
        waist: Number(waistCm),
        hip: Number(hipCm),
        length: Number(lengthCm),
        sleeve: Number(sleeveCm)
      }
    };

    try {
      const res = await generateVirtualTryon(payload);
      if (res.status === 'completed') {
        setCurrentJobId(res.job_id);
        setModelUrl(res.model_url);
        setMetadata(res.metadata);
      } else {
        setErrorMsg(res.error || '3D generation failed.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error communicating with 3D Virtual Try-On backend.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate initial default model on first load if empty
  useEffect(() => {
    if (!modelUrl && !isGenerating) {
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Module Info */}
      <div className="bg-gray-900/60 p-6 rounded-3xl border border-gray-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-400/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 font-mono text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Experimental 3D Module
              </span>
              {healthStatus && (
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono border flex items-center gap-1 ${
                  healthStatus.enabled
                    ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                    : 'bg-red-950/60 border-red-800 text-red-300'
                }`}>
                  <Activity className="w-3 h-3" />
                  {healthStatus.enabled ? '3D Engine Active' : '3D Engine Disabled'}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-100 m-0">
              3D Virtual Avatar & Garment Fitting Studio
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-2xl">
              Generate a parametric 3D body avatar from your exact measurements, drape customizable garment templates, and inspect fit in 360° WebGL.
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 hover:from-amber-300 hover:to-amber-400 text-gray-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-400/25 cursor-pointer transition-all disabled:opacity-60"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Computing 3D Mesh...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-current stroke-none" />
                Render 3D Try-On
              </>
            )}
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center justify-between font-mono">
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Controls on Left, 3D Canvas on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: PARAMETER CONFIGURATION (5 COLS) */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 space-y-4 text-left">
          
          {/* Section 1: User Body Measurements */}
          <div className="bg-gray-900/60 p-5 rounded-3xl border border-gray-800 space-y-4">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider font-mono flex items-center justify-between m-0">
              <span className="flex items-center gap-2">
                <User className="w-4 h-4 text-amber-400" />
                1. Body Anthropometry
              </span>
              <span className="text-[11px] font-mono text-gray-400">BMI: <strong className="text-amber-400">{bmi}</strong></span>
            </h3>

            {/* Height Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-gray-400">Height:</span>
                <span className="text-amber-400 font-bold">{heightCm} cm</span>
              </div>
              <input
                type="range"
                min="145"
                max="205"
                step="1"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            {/* Weight Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-gray-400">Weight:</span>
                <span className="text-amber-400 font-bold">{weightKg} kg</span>
              </div>
              <input
                type="range"
                min="42"
                max="125"
                step="1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            {/* Gender Morphology */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-gray-400 block">Morphology Profile:</label>
              <div className="grid grid-cols-3 gap-2">
                {['neutral', 'female', 'male'].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`py-1.5 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                      gender === g
                        ? 'bg-amber-400 text-gray-950 font-bold shadow-md shadow-amber-400/20'
                        : 'bg-gray-950 text-gray-400 hover:text-white border border-gray-800'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Standing Pose */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-gray-400 block">Standing Pose:</label>
              <div className="grid grid-cols-2 gap-2">
                {POSES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPose(p.id)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer text-left truncate ${
                      pose === p.id
                        ? 'bg-amber-400 text-gray-950 font-bold shadow-md shadow-amber-400/20'
                        : 'bg-gray-950 text-gray-400 hover:text-white border border-gray-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Garment Specification */}
          <div className="bg-gray-900/60 p-5 rounded-3xl border border-gray-800 space-y-4">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider font-mono flex items-center gap-2 m-0">
              <Scissors className="w-4 h-4 text-amber-400" />
              2. Garment Selection & Color
            </h3>

            {/* Garment Type Grid */}
            <div className="grid grid-cols-2 gap-2">
              {GARMENT_TYPES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGarmentType(g.id)}
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    garmentType === g.id
                      ? 'bg-amber-400/10 border-amber-400 text-white shadow-md'
                      : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <span className={`text-xs font-bold ${garmentType === g.id ? 'text-amber-400' : 'text-gray-200'}`}>
                    {g.label}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono mt-0.5 line-clamp-1">{g.desc}</span>
                </button>
              ))}
            </div>

            {/* Color Palette */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-gray-400">Garment Fabric Color:</span>
                <span className="text-amber-400 font-bold">{garmentColor}</span>
              </div>
              <div className="flex items-center gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => {
                      setGarmentColor(c.hex);
                      setCustomColor(c.hex);
                    }}
                    style={{ backgroundColor: c.hex }}
                    className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                      garmentColor.toLowerCase() === c.hex.toLowerCase()
                        ? 'border-amber-400 scale-110 shadow-lg'
                        : 'border-gray-700 hover:scale-105'
                    }`}
                    title={c.name}
                  />
                ))}
                {/* Custom Hex Input */}
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => {
                    setCustomColor(e.target.value);
                    setGarmentColor(e.target.value);
                  }}
                  className="w-8 h-8 rounded-xl bg-transparent border-0 cursor-pointer"
                  title="Pick custom color"
                />
              </div>
            </div>

            {/* Accordion: Tailored Measurements */}
            <div className="border-t border-gray-800/80 pt-3">
              <button
                type="button"
                onClick={() => setShowAdvancedMeasurements(!showAdvancedMeasurements)}
                className="w-full flex items-center justify-between text-xs font-mono text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  Tailored Garment Sizing (cm)
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showAdvancedMeasurements ? 'rotate-180' : ''}`} />
              </button>

              {showAdvancedMeasurements && (
                <div className="space-y-3 pt-3">
                  {/* Chest */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-gray-400">
                      <span>Chest Circumference:</span>
                      <span className="text-amber-400 font-semibold">{chestCm} cm</span>
                    </div>
                    <input
                      type="range"
                      min="75"
                      max="135"
                      value={chestCm}
                      onChange={(e) => setChestCm(e.target.value)}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  {/* Waist */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-gray-400">
                      <span>Waist Circumference:</span>
                      <span className="text-amber-400 font-semibold">{waistCm} cm</span>
                    </div>
                    <input
                      type="range"
                      min="60"
                      max="125"
                      value={waistCm}
                      onChange={(e) => setWaistCm(e.target.value)}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  {/* Hip */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-gray-400">
                      <span>Hip Circumference:</span>
                      <span className="text-amber-400 font-semibold">{hipCm} cm</span>
                    </div>
                    <input
                      type="range"
                      min="70"
                      max="140"
                      value={hipCm}
                      onChange={(e) => setHipCm(e.target.value)}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  {/* Length */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-gray-400">
                      <span>Garment Length:</span>
                      <span className="text-amber-400 font-semibold">{lengthCm} cm</span>
                    </div>
                    <input
                      type="range"
                      min="40"
                      max="130"
                      value={lengthCm}
                      onChange={(e) => setLengthCm(e.target.value)}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  {/* Sleeve */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-gray-400">
                      <span>Sleeve Length:</span>
                      <span className="text-amber-400 font-semibold">{sleeveCm} cm</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="75"
                      value={sleeveCm}
                      onChange={(e) => setSleeveCm(e.target.value)}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: 3D THREE.JS WEBGL VIEWER (7 COLS) */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 space-y-4">
          {/* Three.js Viewer Canvas */}
          <ThreeModelViewer
            modelUrl={modelUrl}
            isLoading={isGenerating}
            downloadUrl={currentJobId ? getGlbModelDownloadUrl(currentJobId) : null}
            fileName={`dori_${garmentType}_tryon.glb`}
          />

          {/* Technical Specs & Fit Insights */}
          {metadata && (
            <div className="p-4 bg-gray-900/60 rounded-3xl border border-gray-800 text-left space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider font-mono flex items-center gap-1.5 m-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  3D Geometry & Fit Specification
                </h4>
                <span className="text-[10px] font-mono text-gray-400">
                  GLB Size: <strong className="text-amber-400">{Math.round((metadata.glb_info?.file_size_bytes || 0) / 1024)} KB</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                <div className="p-2.5 rounded-xl bg-gray-950 border border-gray-800">
                  <span className="text-gray-500 block text-[9px]">AVATAR MESH</span>
                  <span className="text-gray-200 font-bold">{metadata.avatar?.vertex_count} vertices</span>
                  <span className="text-gray-500 block text-[10px]">{metadata.avatar?.face_count} polys</span>
                </div>
                <div className="p-2.5 rounded-xl bg-gray-950 border border-gray-800">
                  <span className="text-gray-500 block text-[9px]">GARMENT MESH</span>
                  <span className="text-gray-200 font-bold">{metadata.garment?.vertex_count} vertices</span>
                  <span className="text-gray-500 block text-[10px]">{metadata.garment?.face_count} polys</span>
                </div>
                <div className="p-2.5 rounded-xl bg-gray-950 border border-gray-800">
                  <span className="text-gray-500 block text-[9px]">AVATAR CHEST</span>
                  <span className="text-amber-400 font-bold">{metadata.avatar?.estimated_measurements?.chest_circ_cm} cm</span>
                  <span className="text-gray-500 block text-[10px]">Waist: {metadata.avatar?.estimated_measurements?.waist_circ_cm}cm</span>
                </div>
                <div className="p-2.5 rounded-xl bg-gray-950 border border-gray-800">
                  <span className="text-gray-500 block text-[9px]">GARMENT CHEST</span>
                  <span className="text-emerald-400 font-bold">{metadata.garment?.applied_measurements?.chest_cm} cm</span>
                  <span className="text-gray-500 block text-[10px]">Length: {metadata.garment?.applied_measurements?.length_cm}cm</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
