/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AppState, EditTool } from './types';
import { generateAnimationAssets, AnimationAssets } from './services/geminiService';
import { buildCreativeInstruction, promptSuggestions } from './prompts';
import CameraView, { CameraViewHandles } from './components/CameraView';
import AnimationPlayer from './components/AnimationPlayer';
import LoadingOverlay from './components/LoadingOverlay';
import ComingSoonModal from './components/ComingSoonModal';
import { UploadIcon, SwitchCameraIcon, XCircleIcon, CameraIcon, ImageIcon, ScissorsIcon, TypeIcon, MaximizeIcon, CropIcon, RotateCcwIcon, ZapIcon, SparklesIcon, SettingsIcon } from './components/icons';

// --- FEATURE FLAGS ---
// Set to `true` to make uploading or capturing an image mandatory to create an animation.
// Set to `false` to allow creating animations from only a text prompt.
const REQUIRE_IMAGE_FOR_ANIMATION = false;

// Set to `true` to allow selecting multiple emoji suggestions to combine prompts.
// Set to `false` to only allow one emoji suggestion to be active at a time.
const ALLOW_MULTIPLE_EMOJI_SELECTION = false;

const resizeImage = (dataUrl: string, maxWidth: number, maxHeight: number): Promise<string> => {
  // We assume maxWidth and maxHeight are the same and represent the target square size.
  const targetSize = maxWidth; 
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      console.log(`[DEBUG] Original image dimensions: ${img.naturalWidth}x${img.naturalHeight}`);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return reject(new Error('Could not get canvas context for resizing.'));
      }

      canvas.width = targetSize;
      canvas.height = targetSize;

      const { width, height } = img;
      let sx, sy, sWidth, sHeight;

      // This logic finds the largest possible square in the center of the image
      if (width > height) { // Landscape
        sWidth = height;
        sHeight = height;
        sx = (width - height) / 2;
        sy = 0;
      } else { // Portrait or square
        sWidth = width;
        sHeight = width;
        sx = 0;
        sy = (height - width) / 2;
      }
      
      // Draw the cropped square from the source image onto the target canvas, resizing it in the process.
      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetSize, targetSize);
      
      // Force JPEG format for smaller file size, which is better for uploads.
      const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      resolve(resizedDataUrl);
    };
    img.onerror = () => {
      reject(new Error('Failed to load image for resizing.'));
    };
    img.src = dataUrl;
  });
};

const Header: React.FC = () => (
    <header className="bg-slate-900 p-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
             <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-white text-2xl font-bold" aria-hidden="true">M</div>
             <h1 className="font-bold text-2xl text-white">Mememint</h1>
        </div>
    </header>
);

interface NavbarProps {
    appState: AppState;
    activeTool: EditTool | null;
    onToolSelect: (tool: EditTool) => void;
}

const Navbar: React.FC<NavbarProps> = ({ appState, activeTool, onToolSelect }) => {
    const isEditing = appState === AppState.Animating;
    
    const getButtonClass = (tool: EditTool, isGifMakerButton = false) => {
        const baseClass = `flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-sm transition-colors flex-shrink-0`;
        const isGifMakerActive = isGifMakerButton && appState === AppState.Capturing;
        
        if (!isEditing && !isGifMakerActive && !isGifMakerButton) {
            return `${baseClass} text-slate-500 cursor-not-allowed`;
        }
        if (activeTool === tool || isGifMakerActive) {
            return `${baseClass} text-white bg-blue-600`;
        }
        return `${baseClass} text-slate-300 hover:text-white`;
    };

    return (
        <nav className="bg-slate-800 shadow-lg">
            <div className="max-w-7xl mx-auto flex items-center gap-2 p-2 overflow-x-auto no-scrollbar">
                <button className={getButtonClass('gif-maker', true)}>
                    <ImageIcon className="w-5 h-5" />
                    <span>GIF Maker</span>
                </button>
                 <button onClick={() => onToolSelect('resize')} disabled={!isEditing} className={getButtonClass('resize')}>
                    <MaximizeIcon className="w-5 h-5" />
                    <span>Resize</span>
                </button>
                <button onClick={() => onToolSelect('crop')} disabled={!isEditing} className={getButtonClass('crop')}>
                    <CropIcon className="w-5 h-5" />
                    <span>Crop</span>
                </button>
                 <button onClick={() => onToolSelect('rotate')} disabled={!isEditing} className={getButtonClass('rotate')}>
                    <RotateCcwIcon className="w-5 h-5" />
                    <span>Rotate</span>
                </button>
                 <button onClick={() => onToolSelect('optimize')} disabled={!isEditing} className={getButtonClass('optimize')}>
                    <ZapIcon className="w-5 h-5" />
                    <span>Optimize</span>
                </button>
                <button onClick={() => onToolSelect('effects')} disabled={!isEditing} className={getButtonClass('effects')}>
                    <SparklesIcon className="w-5 h-5" />
                    <span>Effects</span>
                </button>
                 <button onClick={() => onToolSelect('cut')} disabled={!isEditing} className={getButtonClass('cut')}>
                    <ScissorsIcon className="w-5 h-5" />
                    <span>Cut</span>
                </button>
                 <button onClick={() => onToolSelect('text')} disabled={!isEditing} className={getButtonClass('text')}>
                    <TypeIcon className="w-5 h-5" />
                    <span>Add Text</span>
                </button>
                <button onClick={() => onToolSelect('settings')} disabled={!isEditing} className={getButtonClass('settings')}>
                    <SettingsIcon className="w-5 h-5" />
                    <span>Settings</span>
                </button>
            </div>
        </nav>
    );
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.Capturing);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [animationAssets, setAnimationAssets] = useState<AnimationAssets | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [storyPrompt, setStoryPrompt] = useState<string>('');
  const [activeTool, setActiveTool] = useState<EditTool | null>(null);
  const [showComingSoonModalFor, setShowComingSoonModalFor] = useState<EditTool | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraViewRef = useRef<CameraViewHandles>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const promptWasInitiallyEmpty = useRef<boolean>(false);

  useEffect(() => {
    const checkForMultipleCameras = async () => {
      if (navigator.mediaDevices?.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputCount = devices.filter(d => d.kind === 'videoinput').length;
          setHasMultipleCameras(videoInputCount > 1);
        } catch (err) {
          console.error("Failed to enumerate media devices:", err);
        }
      }
    };
    checkForMultipleCameras();
  }, []);
  

  const FRAME_COUNT = 9;
  const SPRITE_SHEET_WIDTH = 1024;
  const SPRITE_SHEET_HEIGHT = 1024;

  const handleCreateAnimation = useCallback(async (isRegeneration: boolean = false) => {
    const currentPrompt = storyPrompt.trim();
    let finalPrompt = currentPrompt;

    if (!isRegeneration) {
        promptWasInitiallyEmpty.current = !currentPrompt;
    }

    const shouldPickRandomPrompt = !currentPrompt || (isRegeneration && promptWasInitiallyEmpty.current);

    if (shouldPickRandomPrompt) {
        const baseSuggestions = promptSuggestions.filter(p => p.prompt !== currentPrompt);
        if (baseSuggestions.length > 0) {
            const randomSuggestion = baseSuggestions[Math.floor(Math.random() * baseSuggestions.length)];
            finalPrompt = randomSuggestion.prompt;
            setStoryPrompt(finalPrompt);
        }
    }

    if (!originalImage && !finalPrompt) {
        return;
    }

    const finalCreativeInstruction = buildCreativeInstruction(finalPrompt, originalImage, FRAME_COUNT);

    setAppState(AppState.Processing);
    setError(null);
    
    let base64Image: string | null = null;
    let mimeType: string | null = null;

    try {
      if (originalImage) {
        setLoadingMessage('Optimizing image...');
        const resizedImage = await resizeImage(originalImage, 1024, 1024);
        const imageParts = resizedImage.match(/^data:(image\/(?:jpeg|png|webp));base64,(.*)$/);
        if (!imageParts || imageParts.length !== 3) {
          throw new Error("Could not process the resized image data.");
        }
        mimeType = imageParts[1];
        base64Image = imageParts[2];
      }
      
      setLoadingMessage('Generating sprite sheet...');

      const imageGenerationPrompt = `
PRIMARY GOAL: Generate a single animated sprite sheet image.

You are an expert animator. Your task is to create a ${FRAME_COUNT}-frame animated sprite sheet.
${finalCreativeInstruction}

IMAGE OUTPUT REQUIREMENTS:
- The output MUST be a single, square image file.
- The image MUST be precisely ${SPRITE_SHEET_WIDTH}x${SPRITE_SHEET_HEIGHT} pixels.
- The image must contain ${FRAME_COUNT} animation frames arranged in a 3x3 grid (3 rows, 3 columns).
- Do not add numbers to the frames.
- DO NOT return any text or JSON. Only the image is required.`;
      
      const generatedAsset = await generateAnimationAssets(
          base64Image,
          mimeType,
          imageGenerationPrompt,
          (message: string) => setLoadingMessage(message)
      );

      if (!generatedAsset || !generatedAsset.imageData.data) {
        throw new Error(`Sprite sheet generation failed. Did not receive a valid image.`);
      }

      setAnimationAssets(generatedAsset);
      setAppState(AppState.Animating);

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setAppState(AppState.Capturing);
    }
  }, [storyPrompt, originalImage]);
  
  const handleCapture = useCallback((imageDataUrl: string) => {
    setOriginalImage(imageDataUrl);
    setIsCameraOpen(false);
  }, []);

  const handleFlipCamera = () => {
    cameraViewRef.current?.flipCamera();
  };

  const handleCameraError = useCallback((message: string) => {
    setError(message);
    setAppState(AppState.Error);
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setOriginalImage(reader.result as string);
      };
      reader.onerror = () => {
        console.error("Failed to read file");
        setError("Failed to read the selected image file.");
        setAppState(AppState.Error);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setOriginalImage(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleClearImage = () => {
    setOriginalImage(null);
    setIsCameraOpen(false);
    if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };
  
  const handleBack = () => {
    setAppState(AppState.Capturing);
    setAnimationAssets(null);
    setActiveTool(null);
  };
  
  const handleSuggestionClick = (prompt: string) => {
    setStoryPrompt(currentPrompt => {
      if (ALLOW_MULTIPLE_EMOJI_SELECTION) {
        const hasPrompt = currentPrompt.includes(prompt);
        if (hasPrompt) {
          return currentPrompt.replace(prompt, '').replace(/\s\s+/g, ' ').trim();
        } else {
          return (currentPrompt ? `${currentPrompt} ${prompt}` : prompt).trim();
        }
      } else {
        return currentPrompt === prompt ? '' : prompt;
      }
    });
  };

  const handleToolSelect = (tool: EditTool) => {
    const implementedTools: EditTool[] = ['cut', 'text', 'settings'];
    if (tool === 'gif-maker') {
        handleBack();
        return;
    }
    if (implementedTools.includes(tool)) {
        setActiveTool(currentTool => currentTool === tool ? null : tool);
        setShowComingSoonModalFor(null);
    } else {
        setShowComingSoonModalFor(tool);
    }
  };
  
  const isGenerationDisabled = !originalImage && !storyPrompt.trim();

  const renderContent = () => {
    switch (appState) {
      case AppState.Capturing:
        return (
          <div className="space-y-6">
            <div>
              <label htmlFor="storyPrompt" className="block text-sm font-medium text-gray-400 mb-2">
                Prompt (optional if image is provided)
              </label>
              <textarea
                id="storyPrompt"
                rows={2}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-4 py-3 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 resize-none"
                value={storyPrompt}
                onChange={e => setStoryPrompt(e.target.value)}
                aria-label="Animation prompt"
                placeholder="e.g., 'stop-motion animation of...'"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {promptSuggestions.map(({ emoji, prompt }) => (
                  <button
                    key={prompt}
                    onClick={() => handleSuggestionClick(prompt)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${storyPrompt.includes(prompt) ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                  >
                    {emoji} {prompt.substring(0, 20)}...
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="w-full bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-lg relative flex items-center justify-between animate-shake" role="alert">
                <div className="pr-4">
                  <strong className="font-bold block">Error generating animation.</strong>
                  <span className="text-sm">{error}</span>
                </div>
                <button onClick={() => setError(null)} className="p-1 -mr-2 flex-shrink-0" aria-label="Close error message">
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>
            )}
          
            <div>
                <div 
                    className="relative w-full aspect-video bg-slate-800 rounded-lg overflow-hidden shadow-inner flex items-center justify-center"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                >
                {originalImage ? (
                    <>
                        <img src={originalImage} alt="Preview" className="w-full h-full object-cover" />
                        <button
                            onClick={handleClearImage}
                            className="absolute top-3 right-3 bg-black/50 p-2 rounded-full text-white hover:bg-black/75 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-blue-500"
                            aria-label="Remove image"
                        >
                            <XCircleIcon className="w-5 h-5" />
                        </button>
                    </>
                ) : isCameraOpen ? (
                    <>
                        <CameraView ref={cameraViewRef} onCapture={handleCapture} onError={handleCameraError} />
                        <button onClick={() => setIsCameraOpen(false)} className="absolute top-3 left-3 bg-black/50 p-2 rounded-full text-white hover:bg-black/75 transition-colors" aria-label="Close camera">
                            <XCircleIcon className="w-5 h-5" />
                        </button>
                        {hasMultipleCameras && (
                            <button onClick={handleFlipCamera} className="absolute top-3 right-3 bg-black/50 p-2 rounded-full text-white hover:bg-black/75 transition-colors" aria-label="Flip camera">
                                <SwitchCameraIcon className="w-5 h-5" />
                            </button>
                        )}
                         <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                            <button onClick={() => cameraViewRef.current?.capture()} className="w-16 h-16 rounded-full bg-white/90 hover:bg-white ring-4 ring-white/20 transition flex items-center justify-center" aria-label="Capture photo">
                            <div className="w-14 h-14 rounded-full bg-white ring-2 ring-inset ring-black/50"></div>
                            </button>
                        </div>
                    </>
                ) : (
                    <div onClick={handleUploadClick} className="w-full h-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-700 hover:border-slate-600 rounded-lg transition-colors cursor-pointer">
                        <UploadIcon className="w-12 h-12 text-slate-500" />
                        <p className="mt-3 text-center text-slate-400">
                            Choose, paste, or <span className="font-semibold text-white">drag and drop</span> a file here
                        </p>
                    </div>
                )}
                </div>
                 {!originalImage && !isCameraOpen && (
                    <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button onClick={() => setIsCameraOpen(true)} className="w-full sm:w-56 bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition-colors duration-300 flex items-center justify-center">
                            <CameraIcon className="w-5 h-5 mr-2" />
                            Open Camera
                        </button>
                        <button onClick={handleUploadClick} className="w-full sm:w-56 bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition-colors duration-300 flex items-center justify-center">
                            <UploadIcon className="w-5 h-5 mr-2" />
                            Upload from computer
                        </button>
                    </div>
                 )}
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    onClick={() => handleCreateAnimation(false)}
                    disabled={isGenerationDisabled}
                    aria-label={'Create Animation'}
                    className="bg-slate-700 text-white font-bold py-3 px-8 rounded-lg hover:bg-slate-600 transition-colors duration-300 disabled:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-blue-500"
                >
                    Generate
                </button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*"
            />
          </div>
        );
      case AppState.Processing:
        return <LoadingOverlay />;
      case AppState.Animating:
        return animationAssets ? <AnimationPlayer assets={animationAssets} onRegenerate={() => handleCreateAnimation(true)} onBack={handleBack} activeTool={activeTool} setActiveTool={setActiveTool} /> : null;
      case AppState.Error:
        return (
          <div className="text-center bg-red-500/10 p-8 rounded-lg max-w-md w-full border border-red-500/20">
            <p className="text-gray-200 mb-6 font-medium text-lg">{error}</p>
            <button onClick={handleBack} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-500">
              Try Again
            </button>
          </div>
        );
    }
  };

  return (
    <div className="h-dvh bg-slate-900 text-gray-300 flex flex-col font-sans">
      <Header />
      <Navbar appState={appState} onToolSelect={handleToolSelect} activeTool={activeTool} />
      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-4 sm:p-8 flex-grow flex items-center justify-center">
            <div className="w-full max-w-3xl">
                {renderContent()}
            </div>
        </div>
        <footer className="w-full shrink-0 p-4 text-center text-gray-500 text-xs">
            Created by alifcoder
        </footer>
      </main>
      <ComingSoonModal tool={showComingSoonModalFor} onClose={() => setShowComingSoonModalFor(null)} />
    </div>
  );
};

export default App;