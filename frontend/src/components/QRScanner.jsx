import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, X } from 'lucide-react';

export default function QRScanner({ onScanSuccess, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraError, setCameraError] = useState('');
  const animationFrameId = useRef(null);
  const isScanningRef = useRef(true);

  useEffect(() => {
    let stream = null;
    isScanningRef.current = true;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });

        if (videoRef.current && isScanningRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');

          // FIX 1: Safely handle play() Promise to prevent AbortError
          try {
            await videoRef.current.play();
            if (isScanningRef.current) {
              animationFrameId.current = requestAnimationFrame(scanFrame);
            }
          } catch (playError) {
            if (playError.name !== 'AbortError') {
              console.error('Video playback error:', playError);
            }
          }
        }
      } catch (err) {
        console.error('Camera access error:', err);
        setCameraError('Unable to access webcam. Please check browser permissions.');
      }
    };

    startCamera();

    // Cleanup tracks and animation frames safely on unmount
    return () => {
      isScanningRef.current = false;
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const scanFrame = () => {
    if (!isScanningRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      // FIX 2: Stop scanning loop immediately upon successful code capture
      if (code && code.data) {
        isScanningRef.current = false;
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
        }
        onScanSuccess(code.data);
        return;
      }
    }

    if (isScanningRef.current) {
      animationFrameId.current = requestAnimationFrame(scanFrame);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 w-full max-w-sm flex flex-col items-center relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white bg-neutral-800 p-2 rounded-full transition cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-4 text-taxi-blue-primary">
          <Camera size={22} />
          <h3 className="text-lg font-black text-white">Scan Taxi QR</h3>
        </div>

        {cameraError ? (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-4 rounded-2xl text-center my-6">
            {cameraError}
          </div>
        ) : (
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden border-2 border-taxi-blue-primary/50 bg-black mb-4">
            <video ref={videoRef} className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />

            <div className="absolute inset-0 border-2 border-taxi-blue-primary/80 rounded-2xl pointer-events-none flex items-center justify-center">
              <div className="w-48 h-48 border-2 border-dashed border-white/60 rounded-xl animate-pulse" />
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center">
          Point your camera at the vehicle's Taxi Pay QR code to start payment.
        </p>
      </div>
    </div>
  );
}