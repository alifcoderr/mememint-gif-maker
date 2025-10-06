/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useState } from 'react';

export interface CameraViewHandles {
  capture: () => void;
  flipCamera: () => void;
}

interface CameraViewProps {
  onCapture: (imageDataUrl: string) => void;
  onError: (message: string) => void;
}

const CameraView = forwardRef<CameraViewHandles, CameraViewProps>(({ onCapture, onError }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const flipCamera = useCallback(() => {
    setFacingMode(current => (current === 'user' ? 'environment' : 'user'));
  }, []);

  useEffect(() => {
    // Clean up previous stream
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
    }

    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: facingMode, 
                width: { ideal: 720 }, 
                height: { ideal: 720 },
                aspectRatio: { ideal: 1 }
            } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        streamRef.current = mediaStream;
      } catch (err) {
        console.error("Error accessing camera:", err);
        onError(`Could not access ${facingMode} camera. Please check permissions or try again.`);
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [onError, facingMode]);

  const handleCapture = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const size = Math.min(videoWidth, videoHeight);
      
      canvas.width = size;
      canvas.height = size;
      
      const sx = (videoWidth - size) / 2;
      const sy = (videoHeight - size) / 2;

      const context = canvas.getContext('2d');
      if (context) {
        // Reset transform from any previous operations
        context.setTransform(1, 0, 0, 1, 0, 0);

        // When using the front-facing camera, mirror the canvas horizontally
        // to match the mirrored video preview.
        if (facingMode === 'user') {
          context.translate(size, 0);
          context.scale(-1, 1);
        }

        // Crop the video to a center square
        context.drawImage(video, sx, sy, size, size, 0, 0, size, size);
        const imageDataUrl = canvas.toDataURL('image/jpeg');
        onCapture(imageDataUrl);

        // It's good practice to reset the transform after we're done.
        context.setTransform(1, 0, 0, 1, 0, 0);
      }
    }
  }, [onCapture, facingMode]);
  
  useImperativeHandle(ref, () => ({
    capture: handleCapture,
    flipCamera: flipCamera,
  }), [handleCapture, flipCamera]);


  return (
    <div className="w-full">
      <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden shadow-2xl">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          // Mirror the video feed when using the front-facing camera for a more intuitive "mirror" effect.
          className={`w-full h-full object-cover ${facingMode === 'user' ? 'transform -scale-x-100' : ''}`} 
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
});

export default CameraView;