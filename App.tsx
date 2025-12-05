import React, { useEffect, useRef, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing';
import { OrbitControls } from '@react-three/drei';
import { SaturnParticles } from './components/SaturnParticles';
import { StarField } from './components/StarField';
import { initializeVision, detectHand } from './services/visionService';
import { AppState } from './types';
import { Camera, Hand, Expand, Activity, AlertCircle } from 'lucide-react';

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [openness, setOpenness] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number>();
  
  // Initialize MediaPipe and Camera
  const startCamera = async () => {
    setAppState(AppState.LOADING);
    try {
      await initializeVision();
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, frameRate: 30 } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => {
          videoRef.current?.play();
          setAppState(AppState.RUNNING);
          loop();
        };
      }
    } catch (err) {
      console.error("Failed to init camera:", err);
      setAppState(AppState.ERROR);
    }
  };

  const loop = () => {
    if (videoRef.current && videoRef.current.readyState === 4) {
      const { openness: detectedOpenness, isDetected } = detectHand(videoRef.current);
      
      // If hand detected, update. If not, slowly decay to 0 (closed)
      setOpenness(prev => isDetected ? detectedOpenness : prev * 0.95);
    }
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-black">
      {/* Hidden Video for processing */}
      <video 
        ref={videoRef} 
        className="absolute top-0 left-0 opacity-0 pointer-events-none" 
        playsInline 
        muted 
      />

      {/* 3D Scene */}
      <Canvas 
        camera={{ position: [0, 10, 20], fov: 45 }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        dpr={[1, 2]} // Quality scaling
      >
        <color attach="background" args={['#050505']} />
        
        <Suspense fallback={null}>
          <group rotation={[Math.PI / 6, 0, Math.PI / 12]}> {/* Tilt Saturn */}
             <SaturnParticles openness={openness} />
          </group>
          <StarField />
        </Suspense>

        <EffectComposer disableNormalPass>
          <Bloom luminanceThreshold={0.5} mipmapBlur intensity={1.5} radius={0.4} />
          <Noise opacity={openness > 0.8 ? 0.2 : 0.05} /> {/* Dynamic Noise based on Chaos */}
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
        
        <OrbitControls 
          enableZoom={false} 
          enablePan={false} 
          rotateSpeed={0.5}
          autoRotate={appState === AppState.RUNNING && openness < 0.2} 
          autoRotateSpeed={0.5}
        />
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8">
        
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-lg text-white">
            <h1 className="text-2xl font-light tracking-widest uppercase mb-1">Kepler's Chaos</h1>
            <p className="text-xs text-white/50 font-mono">PARTICLE SYSTEM // v1.0.0</p>
          </div>
          
          {/* Status Indicator */}
          <div className="flex gap-2 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full items-center">
             <div className={`w-2 h-2 rounded-full ${openness > 0.8 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
             <span className="text-xs text-white/70 font-mono">
               {openness > 0.8 ? 'CRITICAL MASS' : 'ORBIT STABLE'}
             </span>
             <span className="text-xs text-white/30 font-mono ml-2">
               {Math.round(openness * 100)}%
             </span>
          </div>
        </div>

        {/* Center Start Button */}
        {appState === AppState.IDLE && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/60 backdrop-blur-sm z-50">
            <div className="text-center max-w-md">
              <div className="mb-6 flex justify-center">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center animate-pulse">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              </div>
              <h2 className="text-3xl text-white font-light mb-4">Initialize System</h2>
              <p className="text-gray-400 mb-8 leading-relaxed">
                This experiment requires camera access to track hand gestures. 
                <br/><span className="text-white">Open your hand</span> to expand the universe and induce chaos.
                <br/><span className="text-white">Close your hand</span> to restore orbital order.
              </p>
              <button 
                onClick={startCamera}
                className="group relative px-8 py-3 bg-white text-black font-semibold rounded-full hover:bg-gray-200 transition-all overflow-hidden"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                START SIMULATION
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {appState === AppState.LOADING && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/80 z-50">
             <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
                <p className="text-white/60 font-mono text-sm tracking-widest">LOADING VISION MODELS...</p>
             </div>
          </div>
        )}
        
         {/* Error State */}
         {appState === AppState.ERROR && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/90 z-50">
             <div className="text-center text-red-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-4" />
                <p>Camera initialization failed.</p>
                <button onClick={() => window.location.reload()} className="mt-4 underline text-sm text-white/50">Retry</button>
             </div>
          </div>
        )}

        {/* Footer / Instructions */}
        {appState === AppState.RUNNING && (
          <div className="flex justify-center w-full">
            <div className="flex gap-8 bg-black/40 backdrop-blur-md border border-white/10 px-8 py-4 rounded-full text-white/80">
               <div className="flex flex-col items-center gap-1">
                 <Hand className="w-5 h-5 opacity-70" />
                 <span className="text-[10px] uppercase tracking-wider font-bold">Closed</span>
                 <span className="text-[9px] text-white/40">Dim / Order</span>
               </div>
               <div className="w-px bg-white/10"></div>
               <div className="flex flex-col items-center gap-1">
                 <Expand className="w-5 h-5 opacity-70" />
                 <span className="text-[10px] uppercase tracking-wider font-bold">Open</span>
                 <span className="text-[9px] text-white/40">Bright / Expand</span>
               </div>
               <div className="w-px bg-white/10"></div>
               <div className="flex flex-col items-center gap-1">
                 <Activity className={`w-5 h-5 ${openness > 0.8 ? 'text-red-400 animate-bounce' : 'opacity-70'}`} />
                 <span className={`text-[10px] uppercase tracking-wider font-bold ${openness > 0.8 ? 'text-red-400' : ''}`}>Max</span>
                 <span className="text-[9px] text-white/40">Chaos</span>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}