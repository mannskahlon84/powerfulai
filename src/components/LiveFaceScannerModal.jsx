import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Check, Sparkles, RefreshCw, User, Smartphone, Laptop, Zap } from 'lucide-react';

export default function LiveFaceScannerModal({ isOpen, onClose, onCapture, avatarHandle = '@abc' }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStepText, setScanStepText] = useState('Initializing Biometric Camera...');
  const [capturedImage, setCapturedImage] = useState(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Handle simulated biometric scan animation progression
  useEffect(() => {
    let timer;
    if (isOpen && isScanning && !capturedImage) {
      timer = setInterval(() => {
        setScanProgress((prev) => {
          if (prev >= 100) {
            clearInterval(timer);
            setScanStepText('✓ Biometric Likeness Synthesized! Click Capture to save.');
            return 100;
          }
          const next = prev + 10;
          if (next < 35) {
            setScanStepText('Step 1/3: Analyzing front facial structure & skin lighting...');
          } else if (next < 70) {
            setScanStepText('Step 2/3: Turn head slightly left & right for 3D depth profile...');
          } else {
            setScanStepText('Step 3/3: Mapping facial expression & neural likeness...');
          }
          return next;
        });
      }, 400);
    }
    return () => clearInterval(timer);
  }, [isOpen, isScanning, capturedImage]);

  const startCamera = async () => {
    setError('');
    setCapturedImage(null);
    setScanProgress(0);
    setIsScanning(false);
    try {
      // Prioritize mobile selfie camera ('user') or laptop webcam
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsScanning(true);
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Camera permission denied or camera not found. Please allow camera access in your browser settings or use the Upload Photo option.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const handleCapture = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      // Mirror the image horizontally so it looks like a natural selfie
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(dataUrl);
      stopCamera();
    } catch (e) {
      console.error('Capture failed:', e);
    }
  };

  const handleConfirm = () => {
    if (capturedImage && onCapture) {
      onCapture(capturedImage);
      onClose();
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-slate-900 border border-cyan-500/30 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative text-white">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Camera size={18} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                Live AI Face Scanner ({avatarHandle})
                <span className="text-[10px] bg-cyan-500 text-slate-900 font-extrabold px-2 py-0.5 rounded-full">BIOMETRIC</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Laptop webcam or mobile phone front camera supported
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Video / Capture Display Area */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-6 text-center max-w-sm space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                <X size={24} />
              </div>
              <p className="text-xs text-red-300 font-semibold">{error}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors"
              >
                Retry Camera
              </button>
            </div>
          ) : capturedImage ? (
            <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
              <img src={capturedImage} alt="Captured Face Scan" className="max-h-full object-contain shadow-lg" />
              <div className="absolute bottom-3 right-3 bg-emerald-500/90 text-white text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 shadow-lg backdrop-blur-sm">
                <Check size={14} />
                Likeness Synthesized
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />

              {/* Futuristic Biometric HUD Overlay */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                
                {/* Oval Viewfinder HUD */}
                <div className="relative w-52 h-64 border-2 border-cyan-400/60 rounded-[50%] shadow-[0_0_25px_rgba(6,182,212,0.3)] flex items-center justify-center overflow-hidden">
                  {/* Laser Scanline */}
                  <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#06b6d4] animate-pulse" 
                       style={{ top: `${scanProgress}%`, transition: 'top 0.4s ease' }} />
                  
                  {/* Corner Crosshairs */}
                  <div className="absolute top-4 left-6 w-4 h-4 border-t-2 border-l-2 border-cyan-300"></div>
                  <div className="absolute top-4 right-6 w-4 h-4 border-t-2 border-r-2 border-cyan-300"></div>
                  <div className="absolute bottom-4 left-6 w-4 h-4 border-b-2 border-l-2 border-cyan-300"></div>
                  <div className="absolute bottom-4 right-6 w-4 h-4 border-b-2 border-r-2 border-cyan-300"></div>
                </div>

                {/* Live Scan Step Text Badge */}
                <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 border border-cyan-500/30 rounded-xl p-2.5 backdrop-blur-md">
                  <div className="flex items-center justify-between text-[11px] font-bold text-cyan-400 mb-1">
                    <span>{scanStepText}</span>
                    <span>{scanProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Controls */}
        <div className="p-5 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Smartphone size={14} className="text-cyan-400" />
            <span>Works on mobile & laptop camera</span>
          </div>

          <div className="flex items-center gap-2">
            {capturedImage ? (
              <>
                <button
                  onClick={handleRetake}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                >
                  <RefreshCw size={14} />
                  Retake Scan
                </button>
                <button
                  onClick={handleConfirm}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-extrabold rounded-xl shadow-lg transition-all flex items-center gap-1.5"
                >
                  <Check size={14} />
                  Save Face Clone ({avatarHandle})
                </button>
              </>
            ) : (
              <button
                onClick={handleCapture}
                disabled={!!error}
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all flex items-center gap-2"
              >
                <Zap size={14} className="text-yellow-300" />
                Capture Face Scan ({scanProgress}%)
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
