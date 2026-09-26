import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RotateCw, Eye, Grid, Sparkles, RefreshCw, ZoomIn, Download, Box } from 'lucide-react';

export default function ThreeModelViewer({
  modelUrl,
  isLoading = false,
  downloadUrl = null,
  fileName = 'dori_avatar_garment.glb'
}) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const modelGroupRef = useRef(null);

  const [autoRotate, setAutoRotate] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modelLoaded, setModelLoaded] = useState(false);

  // Initialize Three.js Scene, Camera, Lights, and Renderer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 500;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c10);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.1, 2.6);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0.9, 0);
    controls.minDistance = 0.8;
    controls.maxDistance = 5.0;
    controls.maxPolarAngle = Math.PI / 2 + 0.1; // Don't look too far from below ground
    controlsRef.current = controls;

    // 5. Studio Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    // Key Light (warm studio)
    const keyLight = new THREE.DirectionalLight(0xffeedd, 1.8);
    keyLight.position.set(2.5, 4.0, 3.0);
    scene.add(keyLight);

    // Fill Light (cool soft tone)
    const fillLight = new THREE.DirectionalLight(0xddeeff, 1.0);
    fillLight.position.set(-3.0, 2.0, 2.0);
    scene.add(fillLight);

    // Rim Light (amber edge accent)
    const rimLight = new THREE.DirectionalLight(0xfbbf24, 1.2);
    rimLight.position.set(0, 3.0, -3.0);
    scene.add(rimLight);

    // 6. Floor Grid Helper
    const grid = new THREE.GridHelper(3.0, 20, 0xfbbf24, 0x1f2937);
    grid.position.y = 0;
    grid.name = 'floorGrid';
    scene.add(grid);

    // 7. Model container group
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    // 8. Animation Render Loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (controlsRef.current) {
        controlsRef.current.autoRotate = autoRotate;
        controlsRef.current.autoRotateSpeed = 2.0;
        controlsRef.current.update();
      }
      renderer.render(scene, camera);
    };
    animate();

    // 9. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update Auto-Rotate
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Update Grid Visibility
  useEffect(() => {
    if (sceneRef.current) {
      const grid = sceneRef.current.getObjectByName('floorGrid');
      if (grid) grid.visible = showGrid;
    }
  }, [showGrid]);

  // Update Wireframe
  useEffect(() => {
    if (modelGroupRef.current) {
      modelGroupRef.current.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.wireframe = wireframe;
        }
      });
    }
  }, [wireframe]);

  // Load Model whenever modelUrl changes
  useEffect(() => {
    if (!modelUrl || !modelGroupRef.current) return;

    setLoadError('');
    setModelLoaded(false);

    // Clear previous model
    while (modelGroupRef.current.children.length > 0) {
      const obj = modelGroupRef.current.children[0];
      modelGroupRef.current.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    }

    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        const loadedScene = gltf.scene;

        // Apply wireframe if active
        loadedScene.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.wireframe = wireframe;
            }
          }
        });

        // Center model and place feet on ground
        const box = new THREE.Box3().setFromObject(loadedScene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Shift so bottom touches y=0 and centered in XZ
        loadedScene.position.x = -center.x;
        loadedScene.position.y = -box.min.y;
        loadedScene.position.z = -center.z;

        modelGroupRef.current.add(loadedScene);

        // Adjust camera target to torso center
        if (controlsRef.current) {
          controlsRef.current.target.set(0, size.y * 0.55, 0);
          controlsRef.current.update();
        }

        setModelLoaded(true);
      },
      undefined,
      (err) => {
        console.error('Error loading GLB:', err);
        setLoadError('Failed to load 3D GLB model. Please try regenerating.');
      }
    );
  }, [modelUrl]);

  // Reset Camera View
  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 1.1, 2.6);
      controlsRef.current.target.set(0, 0.9, 0);
      controlsRef.current.update();
    }
  };

  return (
    <div className="relative w-full h-[520px] rounded-3xl overflow-hidden border border-gray-800 bg-[#07090e] shadow-2xl flex items-center justify-center select-none">
      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 bg-gray-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
          <div className="relative">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
            <Sparkles className="w-4 h-4 text-purple-400 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-100">Generating 3D Avatar & Garment...</p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">Computing geometry, body proportions & GLB packaging</p>
          </div>
        </div>
      )}

      {/* Empty State Prompt */}
      {!modelUrl && !isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
          <div className="w-16 h-16 rounded-3xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mb-4 shadow-xl shadow-amber-400/5">
            <Box className="w-8 h-8 text-amber-400 animate-pulse" />
          </div>
          <h3 className="text-base font-bold text-gray-100 font-mono">3D Studio Stage Ready</h3>
          <p className="text-xs text-gray-400 font-mono max-w-sm mt-1 leading-relaxed">
            Adjust body parameters and garment sizing on the left panel, then click <strong className="text-amber-400">"Generate 3D Avatar & Try-On"</strong> to visualize your look in real-time 3D.
          </p>
        </div>
      )}

      {/* Load Error Notice */}
      {loadError && (
        <div className="absolute top-4 inset-x-4 z-20 p-3 bg-red-950/80 border border-red-800 rounded-2xl text-xs text-red-300 text-center font-mono">
          {loadError}
        </div>
      )}

      {/* Watermark / Brand Badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-950/80 backdrop-blur-md border border-gray-800 text-[11px] font-mono text-gray-300 pointer-events-none">
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        <span>DORI 3D WebGL Studio</span>
      </div>

      {/* Viewport Control Bar */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-gray-950/85 backdrop-blur-md p-1.5 rounded-2xl border border-gray-800 text-xs shadow-lg">
        {/* Auto Rotate Toggle */}
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`p-2 rounded-xl transition-all cursor-pointer ${
            autoRotate ? 'bg-amber-400 text-gray-950 font-bold' : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
          title="Toggle Auto-Rotation"
        >
          <RotateCw className="w-4 h-4" />
        </button>

        {/* Wireframe Toggle */}
        <button
          onClick={() => setWireframe(!wireframe)}
          className={`p-2 rounded-xl transition-all cursor-pointer ${
            wireframe ? 'bg-amber-400 text-gray-950 font-bold' : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
          title="Toggle Mesh Wireframe"
        >
          <Grid className="w-4 h-4" />
        </button>

        {/* Floor Grid Toggle */}
        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`p-2 rounded-xl transition-all cursor-pointer ${
            showGrid ? 'bg-amber-400 text-gray-950 font-bold' : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
          title="Toggle Floor Grid"
        >
          <Eye className="w-4 h-4" />
        </button>

        {/* Reset Camera */}
        <button
          onClick={handleResetCamera}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-all cursor-pointer"
          title="Reset Camera View"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      {/* Interaction Hint & Download GLB */}
      <div className="absolute bottom-4 inset-x-4 z-10 flex items-center justify-between pointer-events-none">
        <div className="px-3 py-1.5 rounded-full bg-gray-950/85 backdrop-blur-md border border-gray-800 text-[10px] font-mono text-gray-400 pointer-events-auto">
          Left Click + Drag: <span className="text-gray-200">Rotate</span> • Scroll: <span className="text-gray-200">Zoom</span> • Right Click: <span className="text-gray-200">Pan</span>
        </div>

        {downloadUrl && modelLoaded && (
          <a
            href={downloadUrl}
            download={fileName}
            className="px-3.5 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-gray-950 font-extrabold text-[11px] font-mono flex items-center gap-1.5 shadow-lg shadow-amber-400/20 pointer-events-auto cursor-pointer transition-all"
            title="Download full 3D GLB file"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            Download .GLB
          </a>
        )}
      </div>
    </div>
  );
}
