/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useEffect } from 'react';

interface BanamimatorButtonProps {
  onClick: () => void;
  'aria-label': string;
  disabled?: boolean;
}

const BanamimatorButton: React.FC<BanamimatorButtonProps> = ({ onClick, 'aria-label': ariaLabel, disabled = false }) => {
  const logoSrc = 'https://www.gstatic.com/aistudio/starter-apps/bananimate/bananimator.jpeg';
  const [processedLogoSrc, setProcessedLogoSrc] = useState<string | null>(null);

  useEffect(() => {
    const processImage = async () => {
      try {
        // Since the image is from a different origin, fetching it like this avoids CORS issues
        // that can occur when trying to load an external image directly onto a canvas.
        const response = await fetch(logoSrc);
        if (!response.ok) throw new Error('Network response was not ok');
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const size = img.width; // The source image is square
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          
          if (!ctx) {
            setProcessedLogoSrc(logoSrc); // Fallback to original if context fails
            return;
          }

          // Draw the original image onto the canvas
          ctx.drawImage(img, 0, 0);
          
          const imageData = ctx.getImageData(0, 0, size, size);
          const data = imageData.data;
          const radius = size / 2;
          const center = size / 2;
          const blackThreshold = 35; // How dark a pixel must be to be considered "black"

          // Iterate over every pixel
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            const x = (i / 4) % size;
            const y = Math.floor((i / 4) / size);
            const distance = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2));

            // Make pixel transparent if it's outside the circular area OR if it's black
            if (distance > radius || (r < blackThreshold && g < blackThreshold && b < blackThreshold)) {
              data[i + 3] = 0; // Set alpha to 0
            }
          }

          // Put the modified pixel data back onto the canvas
          ctx.putImageData(imageData, 0, 0);
          
          // Set the processed image as a data URL
          setProcessedLogoSrc(canvas.toDataURL('image/png'));
          URL.revokeObjectURL(objectUrl); // Clean up the created blob URL
        };
        img.onerror = () => {
          console.error("Failed to load image for processing.");
          setProcessedLogoSrc(logoSrc); // Fallback on error
          URL.revokeObjectURL(objectUrl);
        };
        img.src = objectUrl;

      } catch (error) {
        console.error("Error fetching or processing button image:", error);
        setProcessedLogoSrc(logoSrc); // Fallback if the whole process fails
      }
    };

    processImage();
  }, [logoSrc]);

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`transition-transform transform focus:outline-none rounded-full ${disabled ? 'filter grayscale opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95 duration-200'}`}
      aria-label={ariaLabel}
      aria-disabled={disabled}
    >
      {processedLogoSrc ? (
        <img src={processedLogoSrc} className="w-36 h-36" alt="Capture or Animate" />
      ) : (
        // Provide a placeholder while the image is processing to prevent layout shift
        <div className="w-36 h-36 rounded-full bg-gray-800/50" />
      )}
    </button>
  );
};

export default BanamimatorButton;