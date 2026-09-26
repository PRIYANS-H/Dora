import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Crop, RotateCw, Check, X, Sliders, Move } from 'lucide-react';

const ASPECT_RATIOS = [
  { id: 'freeform', label: 'Freeform (Corner Drag)', ratio: null },
  { id: '1:1', label: '1:1 Square', ratio: 1 / 1 },
  { id: '4:5', label: '4:5 Portrait', ratio: 4 / 5 },
  { id: '3:4', label: '3:4 Editorial', ratio: 3 / 4 },
  { id: '16:9', label: '16:9 Wide', ratio: 16 / 9 },
  { id: 'original', label: 'Original Ratio', ratio: 'original' }
];

const CONTAINER_MAX_W = 480;
const CONTAINER_MAX_H = 370;
const MIN_CROP_SIZE = 36;

export default function ImageCropperModal({ imageSrc, fileName = 'cropped_image.jpg', onCropComplete, onClose }) {
  const [aspectRatioId, setAspectRatioId] = useState('freeform');
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [imageLoaded, setImageLoaded] = useState(false);
  const [rawDimensions, setRawDimensions] = useState({ width: 0, height: 0 });

  // Display dimensions of the oriented image inside preview container
  const [dispSize, setDispSize] = useState({ width: 0, height: 0 });

  // Crop rectangle inside display coordinates { x, y, width, height }
  const [cropRect, setCropRect] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const previewCanvasRef = useRef(null);
  const imageRef = useRef(null);
  const dragStateRef = useRef(null);

  // Load image object and store native dimensions in state
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      imageRef.current = img;
      setRawDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      setImageLoaded(true);
      setRotation(0);
    };
  }, [imageSrc]);

  // Calculate initial crop box for a given aspect ratio
  const initCropRect = useCallback((aspectId, dW, dH, rawW, rawH) => {
    let targetRatio = null;
    if (aspectId === 'original') {
      targetRatio = (rawW && rawH) ? rawW / rawH : dW / dH;
    } else if (aspectId !== 'freeform') {
      const match = ASPECT_RATIOS.find((r) => r.id === aspectId);
      if (match?.ratio && typeof match.ratio === 'number') {
        targetRatio = match.ratio;
      }
    }

    const padding = 0.88;
    let boxW, boxH;

    if (targetRatio) {
      if (dW / dH > targetRatio) {
        boxH = Math.round(dH * padding);
        boxW = Math.round(boxH * targetRatio);
      } else {
        boxW = Math.round(dW * padding);
        boxH = Math.round(boxW / targetRatio);
      }
    } else {
      boxW = Math.round(dW * padding);
      boxH = Math.round(dH * padding);
    }

    boxW = Math.max(MIN_CROP_SIZE, Math.min(dW, boxW));
    boxH = Math.max(MIN_CROP_SIZE, Math.min(dH, boxH));
    const boxX = Math.round((dW - boxW) / 2);
    const boxY = Math.round((dH - boxH) / 2);

    setCropRect({ x: boxX, y: boxY, width: boxW, height: boxH });
  }, []);

  // Compute display size and reinitialize cropRect whenever image or rotation changes
  const computeDisplayDimensions = useCallback(() => {
    if (!rawDimensions.width || !rawDimensions.height) return;

    const rotW = rotation % 180 === 0 ? rawDimensions.width : rawDimensions.height;
    const rotH = rotation % 180 === 0 ? rawDimensions.height : rawDimensions.width;

    const scale = Math.min(CONTAINER_MAX_W / rotW, CONTAINER_MAX_H / rotH);
    const width = Math.max(60, Math.round(rotW * scale));
    const height = Math.max(60, Math.round(rotH * scale));

    setDispSize({ width, height });

    // Initialize crop rectangle matching selected aspect ratio
    initCropRect(aspectRatioId, width, height, rotW, rotH);
  }, [rotation, aspectRatioId, rawDimensions, initCropRect]);

  useEffect(() => {
    if (imageLoaded) {
      computeDisplayDimensions();
    }
  }, [imageLoaded, computeDisplayDimensions]);

  // Draw rotated image onto preview canvas
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !dispSize.width || !dispSize.height) return;

    canvas.width = dispSize.width;
    canvas.height = dispSize.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, dispSize.width, dispSize.height);

    ctx.save();
    ctx.translate(dispSize.width / 2, dispSize.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    if (rotation % 180 === 0) {
      ctx.drawImage(img, -dispSize.width / 2, -dispSize.height / 2, dispSize.width, dispSize.height);
    } else {
      ctx.drawImage(img, -dispSize.height / 2, -dispSize.width / 2, dispSize.height, dispSize.width);
    }
    ctx.restore();
  }, [dispSize, rotation]);

  // Switch aspect ratio preset
  const handleSelectAspectRatio = (presetId) => {
    setAspectRatioId(presetId);
    const rotW = rawDimensions.width ? (rotation % 180 === 0 ? rawDimensions.width : rawDimensions.height) : dispSize.width;
    const rotH = rawDimensions.height ? (rotation % 180 === 0 ? rawDimensions.height : rawDimensions.width) : dispSize.height;
    initCropRect(presetId, dispSize.width, dispSize.height, rotW, rotH);
  };

  // Get active ratio if locked
  const getActiveRatio = () => {
    if (aspectRatioId === 'freeform') return null;
    if (aspectRatioId === 'original') {
      if (!rawDimensions.width) return dispSize.width / dispSize.height;
      const rotW = rotation % 180 === 0 ? rawDimensions.width : rawDimensions.height;
      const rotH = rotation % 180 === 0 ? rawDimensions.height : rawDimensions.width;
      return rotW / rotH;
    }
    const found = ASPECT_RATIOS.find((r) => r.id === aspectRatioId);
    return (found && typeof found.ratio === 'number') ? found.ratio : null;
  };

  // Pointer Down on handle or move area
  const handlePointerDown = (e, handleType) => {
    e.preventDefault();
    e.stopPropagation();

    dragStateRef.current = {
      handleType,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...cropRect }
    };

    const handlePointerMove = (moveEvt) => {
      if (!dragStateRef.current) return;
      const { handleType: type, startX, startY, startRect: r } = dragStateRef.current;
      const dx = moveEvt.clientX - startX;
      const dy = moveEvt.clientY - startY;
      const { width: dW, height: dH } = dispSize;
      const targetRatio = getActiveRatio();

      // MOVE CROP BOX
      if (type === 'move') {
        let nx = r.x + dx;
        let ny = r.y + dy;
        nx = Math.max(0, Math.min(dW - r.width, nx));
        ny = Math.max(0, Math.min(dH - r.height, ny));
        setCropRect({ x: Math.round(nx), y: Math.round(ny), width: r.width, height: r.height });
        return;
      }

      // CORNER: BOTTOM-RIGHT ('se')
      if (type === 'se') {
        if (!targetRatio) {
          const nw = Math.max(MIN_CROP_SIZE, Math.min(dW - r.x, r.width + dx));
          const nh = Math.max(MIN_CROP_SIZE, Math.min(dH - r.y, r.height + dy));
          setCropRect({ x: r.x, y: r.y, width: Math.round(nw), height: Math.round(nh) });
        } else {
          const maxW = Math.min(dW - r.x, (dH - r.y) * targetRatio);
          const nw = Math.max(MIN_CROP_SIZE, Math.min(maxW, r.width + dx));
          const nh = nw / targetRatio;
          setCropRect({ x: r.x, y: r.y, width: Math.round(nw), height: Math.round(nh) });
        }
        return;
      }

      // CORNER: BOTTOM-LEFT ('sw')
      if (type === 'sw') {
        const anchorR = r.x + r.width;
        if (!targetRatio) {
          const nLeft = Math.max(0, Math.min(anchorR - MIN_CROP_SIZE, r.x + dx));
          const nw = anchorR - nLeft;
          const nh = Math.max(MIN_CROP_SIZE, Math.min(dH - r.y, r.height + dy));
          setCropRect({ x: Math.round(nLeft), y: r.y, width: Math.round(nw), height: Math.round(nh) });
        } else {
          const maxW = Math.min(anchorR, (dH - r.y) * targetRatio);
          const nw = Math.max(MIN_CROP_SIZE, Math.min(maxW, r.width - dx));
          const nh = nw / targetRatio;
          const nLeft = anchorR - nw;
          setCropRect({ x: Math.round(nLeft), y: r.y, width: Math.round(nw), height: Math.round(nh) });
        }
        return;
      }

      // CORNER: TOP-RIGHT ('ne')
      if (type === 'ne') {
        const anchorB = r.y + r.height;
        if (!targetRatio) {
          const nTop = Math.max(0, Math.min(anchorB - MIN_CROP_SIZE, r.y + dy));
          const nh = anchorB - nTop;
          const nw = Math.max(MIN_CROP_SIZE, Math.min(dW - r.x, r.width + dx));
          setCropRect({ x: r.x, y: Math.round(nTop), width: Math.round(nw), height: Math.round(nh) });
        } else {
          const maxW = Math.min(dW - r.x, anchorB * targetRatio);
          const nw = Math.max(MIN_CROP_SIZE, Math.min(maxW, r.width + dx));
          const nh = nw / targetRatio;
          const nTop = anchorB - nh;
          setCropRect({ x: r.x, y: Math.round(nTop), width: Math.round(nw), height: Math.round(nh) });
        }
        return;
      }

      // CORNER: TOP-LEFT ('nw')
      if (type === 'nw') {
        const anchorR = r.x + r.width;
        const anchorB = r.y + r.height;
        if (!targetRatio) {
          const nLeft = Math.max(0, Math.min(anchorR - MIN_CROP_SIZE, r.x + dx));
          const nTop = Math.max(0, Math.min(anchorB - MIN_CROP_SIZE, r.y + dy));
          setCropRect({
            x: Math.round(nLeft),
            y: Math.round(nTop),
            width: Math.round(anchorR - nLeft),
            height: Math.round(anchorB - nTop)
          });
        } else {
          const maxW = Math.min(anchorR, anchorB * targetRatio);
          const delta = Math.max(-dx, -dy * targetRatio);
          const nw = Math.max(MIN_CROP_SIZE, Math.min(maxW, r.width + delta));
          const nh = nw / targetRatio;
          const nLeft = anchorR - nw;
          const nTop = anchorB - nh;
          setCropRect({
            x: Math.round(nLeft),
            y: Math.round(nTop),
            width: Math.round(nw),
            height: Math.round(nh)
          });
        }
        return;
      }

      // EDGES (Freeform or edge pull)
      if (type === 'n') {
        const anchorB = r.y + r.height;
        const nTop = Math.max(0, Math.min(anchorB - MIN_CROP_SIZE, r.y + dy));
        setCropRect((prev) => ({ ...prev, y: Math.round(nTop), height: Math.round(anchorB - nTop) }));
      } else if (type === 's') {
        const nh = Math.max(MIN_CROP_SIZE, Math.min(dH - r.y, r.height + dy));
        setCropRect((prev) => ({ ...prev, height: Math.round(nh) }));
      } else if (type === 'w') {
        const anchorR = r.x + r.width;
        const nLeft = Math.max(0, Math.min(anchorR - MIN_CROP_SIZE, r.x + dx));
        setCropRect((prev) => ({ ...prev, x: Math.round(nLeft), width: Math.round(anchorR - nLeft) }));
      } else if (type === 'e') {
        const nw = Math.max(MIN_CROP_SIZE, Math.min(dW - r.x, r.width + dx));
        setCropRect((prev) => ({ ...prev, width: Math.round(nw) }));
      }
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Perform Final Crop on Native Resolution Canvas
  const handleApplyCrop = () => {
    const img = imageRef.current;
    if (!img || !dispSize.width || !dispSize.height || !cropRect.width || !cropRect.height) return;

    const rotW = rotation % 180 === 0 ? img.naturalWidth : img.naturalHeight;
    const rotH = rotation % 180 === 0 ? img.naturalHeight : img.naturalWidth;

    // 1. Create native-resolution oriented canvas
    const rotatedCanvas = document.createElement('canvas');
    rotatedCanvas.width = rotW;
    rotatedCanvas.height = rotH;
    const rotCtx = rotatedCanvas.getContext('2d');
    rotCtx.translate(rotW / 2, rotH / 2);
    rotCtx.rotate((rotation * Math.PI) / 180);

    if (rotation % 180 === 0) {
      rotCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    } else {
      rotCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    }

    // 2. Map preview cropRect to native scale
    const scaleX = rotW / dispSize.width;
    const scaleY = rotH / dispSize.height;

    const srcX = Math.max(0, Math.round(cropRect.x * scaleX));
    const srcY = Math.max(0, Math.round(cropRect.y * scaleY));
    const srcW = Math.min(rotW - srcX, Math.round(cropRect.width * scaleX));
    const srcH = Math.min(rotH - srcY, Math.round(cropRect.height * scaleY));

    // 3. Export cropped rectangle
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = srcW;
    exportCanvas.height = srcH;
    const exportCtx = exportCanvas.getContext('2d');
    exportCtx.imageSmoothingEnabled = true;
    exportCtx.imageSmoothingQuality = 'high';
    exportCtx.drawImage(rotatedCanvas, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

    // 4. Output JPEG Blob & File
    exportCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const croppedFile = new File([blob], fileName.replace(/\.[^/.]+$/, '') + '_cropped.jpg', {
          type: 'image/jpeg'
        });
        onCropComplete(blob, croppedFile);
      },
      'image/jpeg',
      0.95
    );
  };

  // Estimated pixel resolution in export
  const rotW = rawDimensions.width ? (rotation % 180 === 0 ? rawDimensions.width : rawDimensions.height) : 1000;
  const estExportW = dispSize.width > 0 ? Math.round(cropRect.width * (rotW / dispSize.width)) : 0;
  const estExportH = dispSize.height > 0 ? Math.round(cropRect.height * (rotW / dispSize.width)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 text-left relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-400/10 text-amber-400">
              <Crop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-100 m-0">Interactive Crop & Corner Adjustment</h3>
              <p className="text-xs text-gray-400 font-mono mt-0.5">Drag corners or edges to frame your garment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-gray-950 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Aspect Ratio Presets */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-400 font-mono flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              Framing Ratio:
            </label>
            <span className="text-[11px] font-mono text-amber-400/90 font-semibold">
              {estExportW > 0 ? `${estExportW} × ${estExportH} px` : ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ASPECT_RATIOS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectAspectRatio(item.id)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  aspectRatioId === item.id
                    ? 'bg-amber-400 text-gray-950 font-bold shadow-md shadow-amber-400/20'
                    : 'bg-gray-950 text-gray-400 hover:border-gray-700 border border-gray-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Crop Viewport with Corner-Adjustable Frame */}
        <div className="flex items-center justify-center p-3 bg-gray-950 rounded-2xl border border-gray-800/80 min-h-[380px] overflow-hidden select-none">
          {imageLoaded && dispSize.width > 0 ? (
            <div
              style={{
                width: `${dispSize.width}px`,
                height: `${dispSize.height}px`
              }}
              className="relative shadow-2xl bg-[#050608] touch-none select-none"
            >
              {/* Preview Canvas */}
              <canvas
                ref={previewCanvasRef}
                className="w-full h-full block pointer-events-none"
              />

              {/* Dimmed backdrop outside the crop box */}
              {/* Top overlay */}
              <div
                style={{ top: 0, left: 0, right: 0, height: `${cropRect.y}px` }}
                className="absolute bg-black/60 pointer-events-none"
              />
              {/* Bottom overlay */}
              <div
                style={{
                  top: `${cropRect.y + cropRect.height}px`,
                  left: 0,
                  right: 0,
                  bottom: 0
                }}
                className="absolute bg-black/60 pointer-events-none"
              />
              {/* Left overlay */}
              <div
                style={{
                  top: `${cropRect.y}px`,
                  left: 0,
                  width: `${cropRect.x}px`,
                  height: `${cropRect.height}px`
                }}
                className="absolute bg-black/60 pointer-events-none"
              />
              {/* Right overlay */}
              <div
                style={{
                  top: `${cropRect.y}px`,
                  left: `${cropRect.x + cropRect.width}px`,
                  right: 0,
                  height: `${cropRect.height}px`
                }}
                className="absolute bg-black/60 pointer-events-none"
              />

              {/* Adjustable Crop Box Frame */}
              <div
                style={{
                  left: `${cropRect.x}px`,
                  top: `${cropRect.y}px`,
                  width: `${cropRect.width}px`,
                  height: `${cropRect.height}px`
                }}
                className="absolute border-2 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)] z-10"
              >
                {/* Draggable Inner Move Area */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'move')}
                  className="absolute inset-0 cursor-move flex items-center justify-center group"
                >
                  {/* Subtle move icon visible on hover */}
                  <div className="opacity-0 group-hover:opacity-60 transition-opacity p-1.5 rounded-full bg-black/50 text-amber-300 pointer-events-none">
                    <Move className="w-4 h-4" />
                  </div>
                </div>

                {/* Rule of Thirds Grid */}
                <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/20">
                  <div className="border-r border-b border-white/20"></div>
                  <div className="border-r border-b border-white/20"></div>
                  <div className="border-b border-white/20"></div>
                  <div className="border-r border-b border-white/20"></div>
                  <div className="border-r border-b border-white/20"></div>
                  <div className="border-b border-white/20"></div>
                  <div className="border-r border-b border-white/20"></div>
                  <div className="border-r border-b border-white/20"></div>
                  <div></div>
                </div>

                {/* CORNER HANDLES */}
                {/* Top-Left Corner */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'nw')}
                  className="absolute -top-2.5 -left-2.5 w-6 h-6 flex items-start justify-start cursor-nwse-resize z-30 group"
                  title="Drag corner to adjust crop"
                >
                  <div className="w-4 h-4 border-t-3 border-l-3 border-amber-400 bg-amber-400/20 group-hover:bg-amber-400 group-hover:scale-110 rounded-tl-sm transition-transform shadow-md" />
                </div>

                {/* Top-Right Corner */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'ne')}
                  className="absolute -top-2.5 -right-2.5 w-6 h-6 flex items-start justify-end cursor-nesw-resize z-30 group"
                  title="Drag corner to adjust crop"
                >
                  <div className="w-4 h-4 border-t-3 border-r-3 border-amber-400 bg-amber-400/20 group-hover:bg-amber-400 group-hover:scale-110 rounded-tr-sm transition-transform shadow-md" />
                </div>

                {/* Bottom-Left Corner */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'sw')}
                  className="absolute -bottom-2.5 -left-2.5 w-6 h-6 flex items-end justify-start cursor-nesw-resize z-30 group"
                  title="Drag corner to adjust crop"
                >
                  <div className="w-4 h-4 border-b-3 border-l-3 border-amber-400 bg-amber-400/20 group-hover:bg-amber-400 group-hover:scale-110 rounded-bl-sm transition-transform shadow-md" />
                </div>

                {/* Bottom-Right Corner */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'se')}
                  className="absolute -bottom-2.5 -right-2.5 w-6 h-6 flex items-end justify-end cursor-nwse-resize z-30 group"
                  title="Drag corner to adjust crop"
                >
                  <div className="w-4 h-4 border-b-3 border-r-3 border-amber-400 bg-amber-400/20 group-hover:bg-amber-400 group-hover:scale-110 rounded-br-sm transition-transform shadow-md" />
                </div>

                {/* EDGE HANDLES (Middle bars) */}
                {/* Top Edge */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'n')}
                  className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-4 flex items-center justify-center cursor-ns-resize z-20"
                >
                  <div className="w-5 h-1.5 bg-amber-400/90 rounded-full shadow-sm" />
                </div>

                {/* Bottom Edge */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, 's')}
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-4 flex items-center justify-center cursor-ns-resize z-20"
                >
                  <div className="w-5 h-1.5 bg-amber-400/90 rounded-full shadow-sm" />
                </div>

                {/* Left Edge */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'w')}
                  className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-8 flex items-center justify-center cursor-ew-resize z-20"
                >
                  <div className="w-1.5 h-5 bg-amber-400/90 rounded-full shadow-sm" />
                </div>

                {/* Right Edge */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'e')}
                  className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-8 flex items-center justify-center cursor-ew-resize z-20"
                >
                  <div className="w-1.5 h-5 bg-amber-400/90 rounded-full shadow-sm" />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-500 font-mono">Loading image...</div>
          )}
        </div>

        {/* Orientation & Quick Reset Bar */}
        <div className="flex items-center justify-between p-2.5 bg-gray-950/70 rounded-2xl border border-gray-800 text-xs">
          <div className="flex items-center gap-2 text-gray-400 text-[11px] font-mono">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400"></span>
            Drag any corner handle to resize frame
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setRotation((prev) => (prev + 90) % 360)}
              className="px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-700 font-mono text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Rotate 90°
            </button>
            <button
              onClick={() => {
                setRotation(0);
                const rawW = rawDimensions.width || dispSize.width;
                const rawH = rawDimensions.height || dispSize.height;
                initCropRect(aspectRatioId, dispSize.width, dispSize.height, rawW, rawH);
              }}
              className="px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-400 font-mono text-[11px] cursor-pointer transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 text-xs font-semibold border border-gray-800 cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyCrop}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-gray-950 text-xs font-extrabold flex items-center gap-1.5 shadow-lg shadow-amber-400/20 cursor-pointer transition-all"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            Apply & Upload
          </button>
        </div>
      </div>
    </div>
  );
}
