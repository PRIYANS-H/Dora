import { useState, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const STATUS_ICONS = {
  ready: "✅",
  quota_exceeded: "⏱️",
  demo: "🎭",
  error: "⚠️",
  generating: "🔄",
};

export default function PreviewPage3D({ post, onBack }) {
  const [glbUrl, setGlbUrl] = useState(`${API_BASE}/static/models/latest_garment.glb`);
  const [videoUrl, setVideoUrl] = useState(`${API_BASE}/static/models/latest_garment.mp4`);
  const [viewMode, setViewMode] = useState("3d"); // "3d" | "video"
  const [status, setStatus] = useState("ready");
  const [engine, setEngine] = useState("trellis"); // "trellis" | "meshy" | "hunyuan3d"
  const [activeEngine, setActiveEngine] = useState("trellis");
  const [message, setMessage] = useState("Interactive 3D Preview ready. Drag to rotate, scroll to zoom.");
  const [loading, setLoading] = useState(false);
  const [hfToken, setHfToken] = useState(() => localStorage.getItem("hf_token") || "");
  const [showToken, setShowToken] = useState(false);
  const [meshyKey, setMeshyKey] = useState(() => localStorage.getItem("meshy_api_key") || "");
  const [showMeshyDrawer, setShowMeshyDrawer] = useState(false);
  const modelViewerRef = useRef(null);

  const imageUrl = post?.image_url || null;
  const title = post?.title || "Couture Design";

  async function handleGenerate() {
    if (!imageUrl && !post?.image_data) {
      alert("No image available on this post to generate 3D from.");
      return;
    }
    setLoading(true);
    setStatus("generating");
    const engineNames = {
      meshy: "Meshy-4 (Quad Retopology)",
      trellis: "Microsoft TRELLIS (2K PBR)",
      hunyuan3d: "Tencent Hunyuan3D-2",
    };
    setMessage(`Generating 3D model with ${engineNames[engine] || engine}… Please wait.`);
    setGlbUrl(null);

    try {
      const payload = {
        image_url: imageUrl,
        hf_token: hfToken.trim() || null,
        meshy_api_key: meshyKey.trim() || null,
        engine: engine,
      };

      const res = await fetch(`${API_BASE}/3d/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "API error");
      }

      const data = await res.json();
      const absoluteGlb = data.glb_url.startsWith("http")
        ? data.glb_url
        : `${API_BASE}${data.glb_url}`;

      setGlbUrl(absoluteGlb);
      if (data.video_url) {
        const absVideo = data.video_url.startsWith("http")
          ? data.video_url
          : `${API_BASE}${data.video_url}`;
        setVideoUrl(absVideo);
      }
      setStatus(data.status);
      setActiveEngine(data.engine || engine);
      setMessage(data.message);
    } catch (err) {
      setStatus("error");
      setMessage(`Request failed: ${err.message}. Showing previous generated model.`);
      setGlbUrl(`${API_BASE}/static/models/latest_garment.glb`);
    } finally {
      setLoading(false);
    }
  }

  function saveToken() {
    localStorage.setItem("hf_token", hfToken);
    setShowToken(false);
  }

  function saveMeshyKey() {
    localStorage.setItem("meshy_api_key", meshyKey);
    setShowMeshyDrawer(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0c1017", color: "#f5f0e8", fontFamily: "'Inter', sans-serif", padding: "0" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 12px", borderBottom: "1px solid #1e2a38", flexWrap: "wrap", gap: "10px" }}>
        <button
          onClick={onBack}
          style={{ background: "none", border: "1px solid #2a3a4a", color: "#94a3b8", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}
        >
          ← Back
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "11px", letterSpacing: "2px", color: "#f59e0b", textTransform: "uppercase", fontWeight: 700 }}>DORI 3D STUDIO</div>
          <div style={{ fontSize: "15px", fontWeight: 600, marginTop: "2px" }}>{title}</div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => { setShowMeshyDrawer(!showMeshyDrawer); setShowToken(false); }}
            title="Set Meshy API Key for Ultra-Crisp Quad Retopology"
            style={{
              background: meshyKey ? "rgba(168, 85, 247, 0.15)" : "none",
              border: meshyKey ? "1px solid #a855f7" : "1px solid #2a3a4a",
              color: meshyKey ? "#c084fc" : "#94a3b8",
              padding: "8px 12px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            💎 Meshy Key {meshyKey ? "✓" : ""}
          </button>
          <button
            onClick={() => { setShowToken(!showToken); setShowMeshyDrawer(false); }}
            title="Set Hugging Face Token for more quota"
            style={{
              background: hfToken ? "rgba(245, 158, 11, 0.15)" : "none",
              border: hfToken ? "1px solid #f59e0b" : "1px solid #2a3a4a",
              color: hfToken ? "#f59e0b" : "#94a3b8",
              padding: "8px 12px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            🤗 HF Token {hfToken ? "✓" : ""}
          </button>
        </div>
      </div>

      {/* Meshy Key drawer */}
      {showMeshyDrawer && (
        <div style={{ background: "#111827", borderBottom: "1px solid #a855f7", padding: "16px 24px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: "12px", color: "#c084fc", flex: "0 0 100%", marginBottom: "6px" }}>
            💎 <strong>Meshy API Key</strong> — Generates the crispest edges, quad retopology & full PBR fabric maps.<br />
            Free tier: <strong>200 credits/month free</strong> (get your key in 30 seconds at <a href="https://meshy.ai" target="_blank" rel="noopener noreferrer" style={{ color: "#f59e0b", textDecoration: "underline" }}>meshy.ai</a>).
          </div>
          <input
            type="password"
            value={meshyKey}
            onChange={e => setMeshyKey(e.target.value)}
            placeholder="msy_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            style={{ flex: 1, minWidth: "280px", background: "#1e2a38", border: "1px solid #374151", borderRadius: "8px", color: "#f5f0e8", padding: "8px 12px", fontSize: "13px" }}
          />
          <button onClick={saveMeshyKey} style={{ background: "#a855f7", color: "#ffffff", border: "none", borderRadius: "8px", padding: "8px 18px", fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>
            Save Key
          </button>
          <button onClick={() => setShowMeshyDrawer(false)} style={{ background: "none", border: "1px solid #374151", color: "#94a3b8", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontSize: "13px" }}>
            Cancel
          </button>
        </div>
      )}

      {/* HF Token drawer */}
      {showToken && (
        <div style={{ background: "#111827", borderBottom: "1px solid #1e2a38", padding: "16px 24px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: "12px", color: "#94a3b8", flex: "0 0 100%", marginBottom: "6px" }}>
            🤗 <strong>Hugging Face Token</strong> — Free tier: ~30–50 gens/day (shared pool). HF PRO ($9/mo): 5–10× more quota.<br />
            Get yours at <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer" style={{ color: "#f59e0b" }}>huggingface.co/settings/tokens</a>
          </div>
          <input
            type="password"
            value={hfToken}
            onChange={e => setHfToken(e.target.value)}
            placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxx"
            style={{ flex: 1, minWidth: "280px", background: "#1e2a38", border: "1px solid #374151", borderRadius: "8px", color: "#f5f0e8", padding: "8px 12px", fontSize: "13px" }}
          />
          <button onClick={saveToken} style={{ background: "#f59e0b", color: "#0c1017", border: "none", borderRadius: "8px", padding: "8px 18px", fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>
            Save
          </button>
          <button onClick={() => setShowToken(false)} style={{ background: "none", border: "1px solid #374151", color: "#94a3b8", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontSize: "13px" }}>
            Cancel
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px", gap: "24px" }}>

        {/* Source image */}
        {imageUrl && (
          <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "8px", letterSpacing: "1px" }}>SOURCE IMAGE</div>
              <img
                src={imageUrl}
                alt={title}
                style={{ width: "180px", height: "240px", objectFit: "cover", borderRadius: "12px", border: "1px solid #1e2a38" }}
              />
            </div>
            {glbUrl && (
              <div style={{ display: "flex", alignItems: "center", fontSize: "28px", paddingTop: "80px" }}>→</div>
            )}
          </div>
        )}

        {/* 3D Model Selector & Engine Switcher */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", justifyContent: "center", maxWidth: "800px" }}>
          {/* Meshy-4 (Crispest Edges) */}
          <button
            onClick={() => setEngine("meshy")}
            style={{
              padding: "12px 18px",
              borderRadius: "12px",
              fontSize: "12px",
              fontWeight: 800,
              cursor: "pointer",
              transition: "all 0.2s",
              border: engine === "meshy" ? "2px solid #a855f7" : "1px solid #1e2a38",
              background: engine === "meshy" ? "rgba(168, 85, 247, 0.2)" : "#111827",
              color: engine === "meshy" ? "#c084fc" : "#94a3b8",
              boxShadow: engine === "meshy" ? "0 0 20px rgba(168, 85, 247, 0.3)" : "none",
            }}
          >
            💎 Meshy-4 (Crispest Edges & Quad Topology)
          </button>

          {/* TRELLIS */}
          <button
            onClick={() => setEngine("trellis")}
            style={{
              padding: "12px 18px",
              borderRadius: "12px",
              fontSize: "12px",
              fontWeight: 800,
              cursor: "pointer",
              transition: "all 0.2s",
              border: engine === "trellis" ? "2px solid #f59e0b" : "1px solid #1e2a38",
              background: engine === "trellis" ? "rgba(245, 158, 11, 0.2)" : "#111827",
              color: engine === "trellis" ? "#f59e0b" : "#94a3b8",
              boxShadow: engine === "trellis" ? "0 0 20px rgba(245, 158, 11, 0.25)" : "none",
            }}
          >
            🎨 Microsoft TRELLIS (Free 2K PBR)
          </button>

          {/* Hunyuan3D-2 */}
          <button
            onClick={() => setEngine("hunyuan3d")}
            style={{
              padding: "12px 18px",
              borderRadius: "12px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
              border: engine === "hunyuan3d" ? "2px solid #38bdf8" : "1px solid #1e2a38",
              background: engine === "hunyuan3d" ? "rgba(56, 189, 248, 0.15)" : "#111827",
              color: engine === "hunyuan3d" ? "#38bdf8" : "#64748b",
            }}
          >
            🏛️ Tencent Hunyuan3D-2 (Clay Mesh Only)
          </button>
        </div>

        {/* 3D Viewer / Video Runway */}
        {(glbUrl || videoUrl) && (
          <div style={{ width: "100%", maxWidth: "720px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ fontSize: "11px", color: "#64748b", letterSpacing: "1px" }}>
                PREVIEW MODE · <span style={{ color: "#f59e0b", textTransform: "uppercase", fontWeight: 700 }}>{activeEngine}</span>
              </div>

              {/* View Mode Toggle */}
              <div style={{ display: "flex", gap: "6px", background: "#111827", padding: "4px", borderRadius: "10px", border: "1px solid #1e2a38" }}>
                <button
                  onClick={() => setViewMode("3d")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "none",
                    background: viewMode === "3d" ? "#f59e0b" : "transparent",
                    color: viewMode === "3d" ? "#0c1017" : "#94a3b8",
                    transition: "all 0.2s",
                  }}
                >
                  🧊 3D Interactive
                </button>
                {videoUrl && (
                  <button
                    onClick={() => setViewMode("video")}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "none",
                      background: viewMode === "video" ? "#f59e0b" : "transparent",
                      color: viewMode === "video" ? "#0c1017" : "#94a3b8",
                      transition: "all 0.2s",
                    }}
                  >
                    🎬 360° Runway Video
                  </button>
                )}
              </div>
            </div>

            {/* Status badge */}
            <div style={{ textAlign: "center", marginBottom: "12px" }}>
              <span style={{
                display: "inline-block", padding: "4px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
                background: status === "ready" ? "#064e3b" : status === "quota_exceeded" ? "#451a03" : "#1e1b4b",
                color: status === "ready" ? "#34d399" : status === "quota_exceeded" ? "#f59e0b" : "#a5b4fc",
                border: `1px solid ${status === "ready" ? "#065f46" : status === "quota_exceeded" ? "#92400e" : "#312e81"}`
              }}>
                {STATUS_ICONS[status] || "•"} {status?.replace("_", " ").toUpperCase()} · {activeEngine === 'meshy' ? '💎 Smart Quad Retopo' : activeEngine === 'trellis' ? '🎨 Colored 2K PBR' : '🏛️ Clay Sculpt'}
              </span>
            </div>

            {/* View Mode: 3D Model Viewer vs 360 Video Loop */}
            {viewMode === "3d" && glbUrl ? (
              <model-viewer
                ref={modelViewerRef}
                src={glbUrl}
                camera-controls
                auto-rotate
                rotation-per-second="20deg"
                shadow-intensity="1.4"
                shadow-softness="0.6"
                environment-image="neutral"
                exposure="1.25"
                tone-mapping="commerce"
                interaction-prompt="auto"
                style={{
                  width: "100%",
                  height: "520px",
                  background: "radial-gradient(circle at 50% 40%, #1e293b 0%, #0c1017 90%)",
                  borderRadius: "16px",
                  border: "1px solid #2a3a4a",
                  display: "block",
                }}
              >
                <div slot="progress-bar" style={{ height: "4px", background: "#f59e0b", position: "absolute", top: 0, left: 0 }} />
              </model-viewer>
            ) : videoUrl ? (
              <div style={{ width: "100%", height: "520px", background: "#080c12", borderRadius: "16px", border: "1px solid #2a3a4a", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <video
                  src={videoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </div>
            ) : null}

            {message && (
              <div style={{ marginTop: "12px", fontSize: "12px", color: "#94a3b8", textAlign: "center", lineHeight: 1.5 }}>
                {message}
              </div>
            )}

            {/* Download button */}
            {status === "ready" && (
              <div style={{ textAlign: "center", marginTop: "16px" }}>
                <a
                  href={glbUrl}
                  download="dori_3d_couture.glb"
                  style={{ display: "inline-block", background: "#1e2a38", color: "#f5f0e8", padding: "10px 24px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, textDecoration: "none", border: "1px solid #2a3a4a" }}
                >
                  ⬇ Download 3D Model (.GLB)
                </a>
              </div>
            )}
          </div>
        )}

        {/* Generate button */}
        <div style={{ textAlign: "center" }}>
          <button
            onClick={handleGenerate}
            disabled={loading || !imageUrl}
            style={{
              background: loading
                ? "#374151"
                : engine === "meshy"
                ? "linear-gradient(135deg, #a855f7, #7c3aed)"
                : "linear-gradient(135deg, #f59e0b, #d97706)",
              color: loading ? "#9ca3af" : "#ffffff",
              border: "none",
              borderRadius: "14px",
              padding: "16px 42px",
              fontSize: "15px",
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: "0.5px",
              boxShadow: loading
                ? "none"
                : engine === "meshy"
                ? "0 4px 24px rgba(168, 85, 247, 0.35)"
                : "0 4px 24px rgba(245, 158, 11, 0.3)",
              transition: "all 0.2s ease",
            }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⚙️</span>
                Generating with {engine.toUpperCase()}…
              </span>
            ) : glbUrl ? `🔄 Regenerate with ${engine.toUpperCase()}` : `✨ Generate 3D (${engine.toUpperCase()})`}
          </button>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "10px" }}>
            {engine === "meshy"
              ? "💎 Meshy-4: AI Quad Retopology & Sharp Edges · 200 credits/mo free"
              : engine === "trellis"
              ? "🎨 Microsoft TRELLIS: 100% Free on Hugging Face ZeroGPU · 2K PBR"
              : "🏛️ Tencent Hunyuan3D-2: High-Density Clay Mesh"}
          </div>
        </div>

        {/* Engine Specs Comparison */}
        <div style={{ maxWidth: "700px", width: "100%", background: "#111827", borderRadius: "12px", padding: "20px", border: "1px solid #1e2a38" }}>
          <div style={{ fontSize: "12px", color: "#f59e0b", fontWeight: 700, marginBottom: "12px", letterSpacing: "1px" }}>3D ENGINES COMPARISON</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ padding: "12px 14px", borderRadius: "8px", background: "rgba(168, 85, 247, 0.08)", border: "1px solid rgba(168, 85, 247, 0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 700, color: "#c084fc" }}>
                <span>💎 Meshy-4 (Recommended for Crisp Edges)</span>
                <span>Smart Quad Retopology</span>
              </div>
              <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                AI-guided quad edge loops that cleanly separate collars, cuffs, and hemlines. Full PBR Normal & Roughness maps. (200 free credits/mo at meshy.ai).
              </div>
            </div>

            <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 700, color: "#f59e0b" }}>
                <span>🎨 Microsoft TRELLIS (Free Open-Source)</span>
                <span>2K PBR Color & Textures</span>
              </div>
              <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                100% free on Hugging Face ZeroGPU. SLaT 3D latent representation with baked 2K diffuse color texture.
              </div>
            </div>

            <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 700, color: "#38bdf8" }}>
                <span>🏛️ Tencent Hunyuan3D 2.0</span>
                <span>320k+ Faces · 5 Seconds</span>
              </div>
              <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                Raw untextured clay mesh for rapid silhouette inspection and geometry checking.
              </div>
            </div>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
