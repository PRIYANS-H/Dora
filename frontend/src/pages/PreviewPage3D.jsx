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
  const [glbUrl, setGlbUrl] = useState(null);
  const [status, setStatus] = useState(null);   // "ready" | "quota_exceeded" | "demo" | "error" | "generating"
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hfToken, setHfToken] = useState(() => localStorage.getItem("hf_token") || "");
  const [showToken, setShowToken] = useState(false);
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
    setMessage("Sending to Microsoft TRELLIS… this takes 30–60 seconds.");
    setGlbUrl(null);

    try {
      const payload = {
        image_url: imageUrl,
        hf_token: hfToken.trim() || null,
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
      // glb_url from backend is relative like /static/models/xxx.glb — make it absolute
      const absoluteGlb = data.glb_url.startsWith("http")
        ? data.glb_url
        : `${API_BASE}${data.glb_url}`;

      setGlbUrl(absoluteGlb);
      setStatus(data.status);
      setMessage(data.message);
    } catch (err) {
      setStatus("error");
      setMessage(`Request failed: ${err.message}`);
      setGlbUrl(`${API_BASE}/static/models/couture_garment_demo.glb`);
    } finally {
      setLoading(false);
    }
  }

  function saveToken() {
    localStorage.setItem("hf_token", hfToken);
    setShowToken(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0c1017", color: "#f5f0e8", fontFamily: "'Inter', sans-serif", padding: "0" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 12px", borderBottom: "1px solid #1e2a38" }}>
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
        <button
          onClick={() => setShowToken(!showToken)}
          title="Set Hugging Face Token for more quota"
          style={{ background: "none", border: "1px solid #2a3a4a", color: "#94a3b8", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}
        >
          🤗 HF Token
        </button>
      </div>

      {/* HF Token drawer */}
      {showToken && (
        <div style={{ background: "#111827", borderBottom: "1px solid #1e2a38", padding: "16px 24px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: "12px", color: "#94a3b8", flex: "0 0 100%", marginBottom: "6px" }}>
            🤗 <strong>Hugging Face Token</strong> — Free tier: ~30–50 gens/day (shared pool). HF PRO (\$9/mo): 5–10× more quota.<br />
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
                style={{ width: "200px", height: "260px", objectFit: "cover", borderRadius: "12px", border: "1px solid #1e2a38" }}
              />
            </div>
            {glbUrl && (
              <div style={{ display: "flex", alignItems: "center", fontSize: "28px", paddingTop: "80px" }}>→</div>
            )}
          </div>
        )}

        {/* 3D Viewer */}
        {glbUrl && (
          <div style={{ width: "100%", maxWidth: "700px" }}>
            <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "8px", letterSpacing: "1px", textAlign: "center" }}>3D MODEL PREVIEW</div>
            {/* Status badge */}
            <div style={{ textAlign: "center", marginBottom: "12px" }}>
              <span style={{
                display: "inline-block", padding: "4px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
                background: status === "ready" ? "#064e3b" : status === "quota_exceeded" ? "#451a03" : "#1e1b4b",
                color: status === "ready" ? "#34d399" : status === "quota_exceeded" ? "#f59e0b" : "#a5b4fc",
                border: `1px solid ${status === "ready" ? "#065f46" : status === "quota_exceeded" ? "#92400e" : "#312e81"}`
              }}>
                {STATUS_ICONS[status] || "•"} {status?.replace("_", " ").toUpperCase()}
              </span>
            </div>

            {/* model-viewer web component */}
            <model-viewer
              ref={modelViewerRef}
              src={glbUrl}
              camera-controls
              auto-rotate
              shadow-intensity="1.5"
              environment-image="neutral"
              exposure="0.8"
              style={{
                width: "100%",
                height: "480px",
                background: "linear-gradient(180deg, #0c1017 0%, #111827 100%)",
                borderRadius: "16px",
                border: "1px solid #1e2a38",
                display: "block",
              }}
            >
              <div slot="progress-bar" style={{ height: "4px", background: "#f59e0b", position: "absolute", top: 0, left: 0 }} />
            </model-viewer>

            {message && (
              <div style={{ marginTop: "12px", fontSize: "12px", color: "#64748b", textAlign: "center", lineHeight: 1.5 }}>
                {message}
              </div>
            )}

            {/* Download button */}
            {status === "ready" && (
              <div style={{ textAlign: "center", marginTop: "16px" }}>
                <a
                  href={glbUrl}
                  download="dori_3d_model.glb"
                  style={{ display: "inline-block", background: "#1e2a38", color: "#f5f0e8", padding: "10px 24px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, textDecoration: "none", border: "1px solid #2a3a4a" }}
                >
                  ⬇ Download GLB
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
              background: loading ? "#374151" : "linear-gradient(135deg, #f59e0b, #d97706)",
              color: loading ? "#9ca3af" : "#0c1017",
              border: "none",
              borderRadius: "14px",
              padding: "16px 42px",
              fontSize: "15px",
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: "0.5px",
              boxShadow: loading ? "none" : "0 4px 24px rgba(245,158,11,0.3)",
              transition: "all 0.2s ease",
            }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⚙️</span>
                Generating 3D… (30–60s)
              </span>
            ) : glbUrl ? "🔄 Regenerate 3D" : "✨ Generate 3D Preview"}
          </button>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "10px" }}>
            Powered by <strong style={{ color: "#f59e0b" }}>Microsoft TRELLIS</strong> via Hugging Face ZeroGPU · Free tier
          </div>
        </div>

        {/* How it works */}
        {!glbUrl && !loading && (
          <div style={{ maxWidth: "480px", background: "#111827", borderRadius: "12px", padding: "20px", border: "1px solid #1e2a38" }}>
            <div style={{ fontSize: "12px", color: "#f59e0b", fontWeight: 700, marginBottom: "12px", letterSpacing: "1px" }}>HOW IT WORKS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                ["🖼️", "Background Removed", "TRELLIS extracts your garment from the background"],
                ["🧊", "3D Mesh Generated", "Microsoft's TRELLIS model builds a detailed 3D mesh"],
                ["🎨", "Texture Applied", "High-res texture is baked onto the 3D model"],
                ["🔄", "Interactive Preview", "Rotate, zoom, inspect from any angle"],
              ].map(([icon, title, desc]) => (
                <div key={title} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "18px" }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#f5f0e8" }}>{title}</div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
