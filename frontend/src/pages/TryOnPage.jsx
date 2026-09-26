import React, { useState, useEffect } from "react";
import { Sparkles, Upload, ArrowRight, RefreshCw, Scissors, Check, Camera, Image as ImageIcon, Box } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// Sample model photo for 1-click test
const SAMPLE_MODEL_PHOTO = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=800&auto=format&fit=crop";

// Curated couture presets so user can try on different styles instantly
const PRESET_GARMENTS = [
  {
    id: "preset-1",
    title: "Sculpted Velvet Blazer",
    designer_name: "Elena Rostova",
    designer_handle: "@elena_couture",
    image_url: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=800&auto=format&fit=crop",
    price_reference: 420,
    base_attributes: { neckline: "open lapel", sleeves: "full", fabric: "cotton velvet", color: "onyx", fit: "tailored" }
  },
  {
    id: "preset-2",
    title: "Silk Organza Fluted Gown",
    designer_name: "Aria Chen",
    designer_handle: "@aria_chen",
    image_url: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?q=80&w=800&auto=format&fit=crop",
    price_reference: 680,
    base_attributes: { neckline: "sweetheart", sleeves: "sleeveless", fabric: "mulberry silk", color: "emerald", fit: "flared" }
  },
  {
    id: "preset-3",
    title: "Raw Linen Safari Coat",
    designer_name: "Kofi Mensah",
    designer_handle: "@kofi_tailoring",
    image_url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=800&auto=format&fit=crop",
    price_reference: 310,
    base_attributes: { neckline: "mandarin", sleeves: "full", fabric: "raw linen", color: "ochre", fit: "relaxed" }
  },
  {
    id: "preset-4",
    title: "Chanderi Silk Evening Kurta",
    designer_name: "Priya Sharma",
    designer_handle: "@priya_crafts",
    image_url: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=800&auto=format&fit=crop",
    price_reference: 350,
    base_attributes: { neckline: "mandarin", sleeves: "full", fabric: "chanderi silk", color: "burgundy", fit: "regular" }
  }
];

export default function TryOnPage({ post, onBack, onProceedToRemix, onProceedToMatch, on3DPreview }) {
  // If post is provided, use it; otherwise default to first preset
  const [activeGarment, setActiveGarment] = useState(post || PRESET_GARMENTS[0]);
  const [personImage, setPersonImage] = useState(null); // base64 or URL
  const [customGarmentImage, setCustomGarmentImage] = useState(null);
  const [tryonResult, setTryonResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("ready"); // "ready" | "generating" | "error"
  const [message, setMessage] = useState("Upload your portrait or standing photo to drape this garment in real-time.");

  useEffect(() => {
    if (post) {
      setActiveGarment(post);
      setCustomGarmentImage(null);
    }
  }, [post]);

  const garmentImageUrl = customGarmentImage || activeGarment?.image_url;
  const garmentTitle = customGarmentImage ? "Custom Uploaded Garment" : (activeGarment?.title || "Couture Garment");
  const designerName = customGarmentImage ? "Custom Closet" : (activeGarment?.designer_name || "DORI Couture");
  const priceReference = activeGarment?.price_reference || 350;

  // Handle user photo upload
  const handlePersonUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPersonImage(reader.result);
      setTryonResult(null);
    };
    reader.readAsDataURL(file);
  };

  // Handle custom garment upload
  const handleGarmentUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCustomGarmentImage(reader.result);
      setTryonResult(null);
    };
    reader.readAsDataURL(file);
  };

  // Run Virtual Try-On
  const handleRunTryOn = async () => {
    if (!personImage) {
      alert("Please upload your photo or click 'Use Sample Model' to see the dress fitted onto you.");
      return;
    }
    if (!garmentImageUrl) {
      alert("Please select or upload a garment to try on.");
      return;
    }

    setLoading(true);
    setStatus("generating");
    setMessage("Analyzing your body silhouette & draping fabric… This takes ~20–35 seconds.");
    setTryonResult(null);

    try {
      const payload = {
        person_image_data: personImage.startsWith("data:") ? personImage : null,
        person_image_url: !personImage.startsWith("data:") ? personImage : null,
        garment_image_url: garmentImageUrl.startsWith("http") || garmentImageUrl.startsWith("/static/") ? garmentImageUrl : null,
        garment_image_data: garmentImageUrl.startsWith("data:") ? garmentImageUrl : null,
        garment_description: garmentTitle,
        denoise_steps: 25,
      };

      const res = await fetch(`${API_BASE}/try-on`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "Try-On API error");
      }

      const data = await res.json();
      const absUrl = data.result_image_url.startsWith("http")
        ? data.result_image_url
        : `${API_BASE}${data.result_image_url}`;

      setTryonResult(absUrl);
      setStatus(data.status);
      setMessage(data.message || "Fitting complete!");
    } catch (err) {
      setStatus("error");
      setMessage(`Fitting issue: ${err.message}. Please ensure your photo clearly captures your torso/shoulders.`);
      setTryonResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0c1017", color: "#f5f0e8", fontFamily: "'Inter', sans-serif", padding: "0 0 60px 0" }}>

      {/* Header Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid #1e2a38" }}>
        <button
          onClick={onBack}
          style={{ background: "none", border: "1px solid #2a3a4a", color: "#94a3b8", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}
        >
          ← Back
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "11px", letterSpacing: "2px", color: "#f59e0b", textTransform: "uppercase", fontWeight: 700 }}>
            DORI VIRTUAL FITTING ROOM
          </div>
          <div style={{ fontSize: "15px", fontWeight: 600, marginTop: "2px" }}>
            AI Virtual Try-On · {garmentTitle}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {on3DPreview && (
            <button
              onClick={() => on3DPreview(activeGarment)}
              style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}
            >
              <span>🧊</span> 3D Studio
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: "1140px", margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* Garment Quick-Switcher Tray */}
        <div style={{ background: "#111827", borderRadius: "14px", padding: "14px 18px", border: "1px solid #1e2a38" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#f59e0b", letterSpacing: "1px", textTransform: "uppercase" }}>
              👗 Select Garment to Try On
            </span>
            <label style={{ fontSize: "11px", color: "#38bdf8", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", textDecoration: "underline" }}>
              <Upload style={{ width: "12px", height: "12px" }} />
              Upload Custom Garment Image
              <input type="file" accept="image/*" onChange={handleGarmentUpload} style={{ display: "none" }} />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
            {PRESET_GARMENTS.map((preset) => {
              const isSelected = !customGarmentImage && activeGarment?.id === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => {
                    setActiveGarment(preset);
                    setCustomGarmentImage(null);
                    setTryonResult(null);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 10px",
                    borderRadius: "10px",
                    background: isSelected ? "rgba(245,158,11,0.15)" : "#0c1017",
                    border: isSelected ? "1.5px solid #f59e0b" : "1px solid #1e2a38",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "#f5f0e8",
                    transition: "all 0.15s ease",
                  }}
                >
                  <img
                    src={preset.image_url}
                    alt={preset.title}
                    style={{ width: "42px", height: "42px", borderRadius: "8px", objectFit: "cover" }}
                  />
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                      {preset.title}
                    </div>
                    <div style={{ fontSize: "10px", color: "#94a3b8" }}>${preset.price_reference}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3-Column Interactive Try-On Studio */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", alignItems: "stretch" }}>

          {/* CARD 1: Chosen Garment */}
          <div style={{ background: "#111827", borderRadius: "16px", padding: "20px", border: "1px solid #1e2a38", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "#f59e0b", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>
                1. Chosen Garment
              </span>
              <span style={{ fontSize: "11px", color: "#64748b" }}>{designerName}</span>
            </div>

            <div style={{ width: "100%", height: "350px", borderRadius: "12px", overflow: "hidden", background: "#0c1017", border: "1px solid #2a3a4a", position: "relative" }}>
              {garmentImageUrl ? (
                <img
                  src={garmentImageUrl}
                  alt={garmentTitle}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                  No Garment Selected
                </div>
              )}
              <div style={{ position: "absolute", bottom: "10px", left: "10px", right: "10px", background: "rgba(12,16,23,0.85)", backdropFilter: "blur(6px)", padding: "8px 12px", borderRadius: "8px", border: "1px solid #1e2a38" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#f5f0e8" }}>{garmentTitle}</div>
                <div style={{ fontSize: "11px", color: "#f59e0b" }}>Reference Price: ${priceReference}</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: onProceedToRemix ? "1fr 1fr" : "1fr", gap: "8px" }}>
              {on3DPreview && (
                <button
                  onClick={() => on3DPreview(activeGarment)}
                  style={{ width: "100%", padding: "10px", borderRadius: "10px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                >
                  <span>🧊</span> 3D Studio
                </button>
              )}
              {onProceedToRemix && (
                <button
                  onClick={() => onProceedToRemix(activeGarment)}
                  style={{ width: "100%", padding: "10px", borderRadius: "10px", background: "#1e2a38", border: "1px solid #2a3a4a", color: "#cbd5e1", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                >
                  <Sparkles style={{ width: "14px", height: "14px" }} /> Remix
                </button>
              )}
            </div>
          </div>

          {/* CARD 2: User's Photo (Upload Zone) */}
          <div style={{ background: "#111827", borderRadius: "16px", padding: "20px", border: "1px solid #1e2a38", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>
                2. Your Photo
              </span>
              <button
                onClick={() => setPersonImage(SAMPLE_MODEL_PHOTO)}
                style={{ background: "none", border: "none", color: "#38bdf8", fontSize: "11px", textDecoration: "underline", cursor: "pointer", padding: 0 }}
              >
                Use Sample Model
              </button>
            </div>

            {personImage ? (
              <div style={{ width: "100%", height: "350px", borderRadius: "12px", overflow: "hidden", background: "#0c1017", border: "1px solid #38bdf8", position: "relative" }}>
                <img
                  src={personImage}
                  alt="Your Photo"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <button
                  onClick={() => setPersonImage(null)}
                  style={{ position: "absolute", top: "10px", right: "10px", background: "rgba(0,0,0,0.75)", border: "1px solid #374151", color: "#f87171", borderRadius: "6px", padding: "5px 10px", fontSize: "11px", cursor: "pointer", fontWeight: 600 }}
                >
                  ✕ Change Photo
                </button>
              </div>
            ) : (
              <label
                style={{
                  width: "100%",
                  height: "350px",
                  borderRadius: "12px",
                  border: "2px dashed #2a3a4a",
                  background: "#0c1017",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  gap: "12px",
                  padding: "20px",
                  textAlign: "center",
                  transition: "border 0.2s",
                }}
              >
                <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "rgba(56,189,248,0.1)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(56,189,248,0.3)" }}>
                  <Upload style={{ width: "22px", height: "22px", color: "#38bdf8" }} />
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#f5f0e8" }}>Upload Your Photo</div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>Standing portrait or selfie (JPEG, PNG)</div>
                </div>
                <div style={{ fontSize: "11px", color: "#38bdf8", background: "rgba(56,189,248,0.1)", padding: "5px 14px", borderRadius: "20px", fontWeight: 600 }}>
                  Tap to Browse from Device
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePersonUpload}
                  style={{ display: "none" }}
                />
              </label>
            )}

            <div style={{ fontSize: "11px", color: "#64748b", textAlign: "center" }}>
              💡 Stand upright with clear lighting for the most accurate fabric drape.
            </div>
          </div>

          {/* CARD 3: Virtual Try-On Result */}
          <div style={{ background: "#111827", borderRadius: "16px", padding: "20px", border: "1px solid #1e2a38", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "#34d399", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>
                3. You in the Dress
              </span>
              {tryonResult && <span style={{ fontSize: "11px", color: "#34d399", fontWeight: 600 }}>✅ Fitted Result</span>}
            </div>

            <div style={{ width: "100%", height: "350px", borderRadius: "12px", overflow: "hidden", background: "#0c1017", border: tryonResult ? "1px solid #059669" : "1px solid #2a3a4a", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {tryonResult ? (
                <img
                  src={tryonResult}
                  alt="Virtual Try On Result"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : loading ? (
                <div style={{ textAlign: "center", padding: "20px" }}>
                  <div style={{ fontSize: "36px", animation: "spin 1.5s linear infinite", display: "inline-block", marginBottom: "12px" }}>🪄</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#f5f0e8" }}>Draping Garment…</div>
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>Matching body curves & seams</div>
                </div>
              ) : status === "error" ? (
                <div style={{ textAlign: "center", color: "#f87171", padding: "20px" }}>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>⚠️</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#fca5a5" }}>Fitting Incomplete</div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px", maxWidth: "260px", lineHeight: "1.4" }}>
                    {message}
                  </div>
                  <button
                    onClick={handleRunTryOn}
                    style={{ marginTop: "12px", background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "#fca5a5", padding: "6px 14px", borderRadius: "8px", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}
                  >
                    🔄 Try Again
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: "center", color: "#64748b", padding: "20px" }}>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>👗</div>
                  <div style={{ fontSize: "13px", fontWeight: 600 }}>Your AI Fitting will appear here</div>
                  <div style={{ fontSize: "11px", marginTop: "4px" }}>Click "✨ Try On Garment" below to generate</div>
                </div>
              )}
            </div>

            {tryonResult && (
              <div style={{ display: "flex", gap: "8px" }}>
                <a
                  href={tryonResult}
                  download="my_dori_tryon.png"
                  style={{ flex: 1, padding: "10px", borderRadius: "10px", background: "#1e2a38", border: "1px solid #2a3a4a", color: "#f5f0e8", fontSize: "12px", fontWeight: 700, textAlign: "center", textDecoration: "none" }}
                >
                  ⬇ Save Photo
                </a>
                {onProceedToMatch && (
                  <button
                    onClick={() => onProceedToMatch(
                      { id: activeGarment.id, post_id: activeGarment.id, attributes: activeGarment.base_attributes || {} },
                      activeGarment.base_attributes || {},
                      tryonResult
                    )}
                    style={{ flex: 1.4, padding: "10px", borderRadius: "10px", background: "linear-gradient(135deg, #10b981, #059669)", border: "none", color: "#ffffff", fontSize: "12px", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                  >
                    <span>🧵</span> Match Tailor
                  </button>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Global Action Bar */}
        <div style={{ textAlign: "center", marginTop: "8px" }}>
          <button
            onClick={handleRunTryOn}
            disabled={loading}
            style={{
              background: loading ? "#374151" : "linear-gradient(135deg, #f59e0b, #d97706)",
              color: loading ? "#9ca3af" : "#0c1017",
              border: "none",
              borderRadius: "14px",
              padding: "16px 48px",
              fontSize: "16px",
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: "0.5px",
              boxShadow: loading ? "none" : "0 4px 28px rgba(245,158,11,0.35)",
              transition: "all 0.2s ease",
            }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⚙️</span>
                Fitting Garment to You… (~25s)
              </span>
            ) : (
              "✨ Try On Garment (AI Virtual Fitting)"
            )}
          </button>

          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "12px" }}>
            {message}
          </div>
        </div>

        {/* How It Works Explainer */}
        <div style={{ background: "#111827", borderRadius: "14px", padding: "20px 24px", border: "1px solid #1e2a38" }}>
          <div style={{ fontSize: "12px", color: "#f59e0b", fontWeight: 700, marginBottom: "12px", letterSpacing: "1px" }}>
            HOW AI VIRTUAL TRY-ON WORKS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            {[
              ["👤 1. Pose & Silhouette Detection", "AI identifies your shoulder slope, waistline, and torso proportions."],
              ["👗 2. Non-Rigid Cloth Deformation", "The dress fabric is mathematically warped to drape naturally over your physique."],
              ["✨ 3. Shading & Photorealism", "Shadows, creases, and textile lighting are matched to your room lighting."],
              ["🧵 4. Custom Tailor Handoff", "Order custom tailoring with exact measurements based on your fitting."],
            ].map(([title, desc]) => (
              <div key={title} style={{ padding: "10px", background: "#0c1017", borderRadius: "10px", border: "1px solid #1e2a38" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#f5f0e8" }}>{title}</div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", lineHeight: 1.4 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
