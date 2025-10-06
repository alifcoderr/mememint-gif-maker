/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimationAssets, addTextToSpriteSheet } from '../services/geminiService';
import { Frame, EditTool } from '../types';
import BananaLoader from './BananaLoader';
import { InfoIcon, XCircleIcon, SettingsIcon, ScissorsIcon, TypeIcon, LoaderIcon, RotateCcwIcon, SaveIcon } from './icons';
import FrameRangeSlider from './FrameRangeSlider';

declare var gifshot: any;

const DISABLE_SHARE_BUTTON = false;

interface AnimationPlayerProps {
  assets: AnimationAssets;
  onRegenerate: () => void;
  onBack: () => void;
  activeTool: EditTool | null;
  setActiveTool: (tool: EditTool | null) => void;
}

interface AnimationConfig {
  speed: number;
}

interface SavedEditState {
  imageData: { data: string; mimeType: string };
  startFrame: number;
  endFrame: number;
  speed: number;
  loopBehavior: 'infinite' | 'once';
}

const DEFAULT_CONFIG: AnimationConfig = {
  speed: 120, // ms per frame
};

const dataURLtoBlob = (dataurl: string): Blob => {
    const arr = dataurl.split(',');
    if (arr.length < 2) throw new Error('Invalid data URL');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) throw new Error('Could not parse MIME type from data URL');
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

const AnimationPlayer: React.FC<AnimationPlayerProps> = ({ assets, onRegenerate, onBack, activeTool, setActiveTool }) => {
  const [editingAssets, setEditingAssets] = useState<AnimationAssets>(assets);
  const [allFrames, setAllFrames] = useState<HTMLImageElement[]>([]);
  const [visibleFrames, setVisibleFrames] = useState<HTMLImageElement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isApplyingText, setIsApplyingText] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showControls, setShowControls] = useState(false);
  const [config, setConfig] = useState<AnimationConfig>({
    ...DEFAULT_CONFIG,
    speed: assets.frameDuration || DEFAULT_CONFIG.speed,
  });
  const [viewMode, setViewMode] = useState<'animation' | 'spritesheet'>('animation');
  const animationFrameId = useRef<number | null>(null);
  const animationStartTimeRef = useRef<number>(0);
  const [spriteSheetImage, setSpriteSheetImage] = useState<HTMLImageElement | null>(null);
  
  // Editing state
  const [startFrame, setStartFrame] = useState(1);
  const [endFrame, setEndFrame] = useState(9);
  const [topText, setTopText] = useState('');
  const [bottomText, setBottomText] = useState('');
  const [font, setFont] = useState('Impact');
  const [loopBehavior, setLoopBehavior] = useState<'infinite' | 'once'>('infinite');
  const [editError, setEditError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const isShareAvailable = typeof navigator !== 'undefined' && navigator.share && !DISABLE_SHARE_BUTTON;
  
  const storageKey = `mememint-edit-state-${assets.imageData.data}`;

  // This effect runs on mount (and when asset changes) to load saved state
  useEffect(() => {
    const savedStateJSON = localStorage.getItem(storageKey);
    if (savedStateJSON) {
      try {
        const savedState: SavedEditState = JSON.parse(savedStateJSON);
        setEditingAssets(prev => ({ ...prev, imageData: savedState.imageData }));
        setStartFrame(savedState.startFrame);
        setEndFrame(savedState.endFrame);
        setConfig(c => ({ ...c, speed: savedState.speed }));
        setLoopBehavior(savedState.loopBehavior);
      } catch (e) {
        console.error("Failed to parse saved state from localStorage", e);
        localStorage.removeItem(storageKey);
      }
    }
  }, [storageKey]);

  const handleSaveChanges = useCallback(() => {
    setSaveStatus('saving');
    const stateToSave: SavedEditState = {
        imageData: editingAssets.imageData,
        startFrame,
        endFrame,
        speed: config.speed,
        loopBehavior,
    };
    localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    setTimeout(() => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  }, [editingAssets.imageData, startFrame, endFrame, config.speed, loopBehavior, storageKey]);


  const handleResetEdits = useCallback(() => {
    localStorage.removeItem(storageKey);
    setEditingAssets(assets);
    setStartFrame(1);
    setEndFrame(allFrames.length || 9);
    setConfig({ speed: assets.frameDuration || DEFAULT_CONFIG.speed });
    setLoopBehavior('infinite');
    setTopText('');
    setBottomText('');
    setFont('Impact');
    setEditError(null);
  }, [storageKey, assets, allFrames.length]);

  const processSpriteSheet = useCallback((img: HTMLImageElement) => {
    const framePromises: Promise<HTMLImageElement>[] = [];
    const frameWidth = Math.floor(img.naturalWidth / 3);
    const frameHeight = Math.floor(img.naturalHeight / 3);
    const cropAmount = 10;

    for (let i = 0; i < 9; i++) {
      framePromises.push(new Promise((resolve, reject) => {
        const frameCanvas = document.createElement('canvas');
        const x = (i % 3) * frameWidth;
        const y = Math.floor(i / 3) * frameHeight;
        frameCanvas.width = frameWidth - (cropAmount * 2);
        frameCanvas.height = frameHeight - (cropAmount * 2);

        const frameCtx = frameCanvas.getContext('2d');
        if (frameCtx) {
          frameCtx.drawImage(img, x + cropAmount, y + cropAmount, frameCanvas.width, frameCanvas.height, 0, 0, frameCanvas.width, frameCanvas.height);
        }
        const frameImage = new Image();
        frameImage.onload = () => resolve(frameImage);
        frameImage.onerror = () => reject(new Error('Failed to load sliced frame image'));
        frameImage.src = frameCanvas.toDataURL();
      }));
    }

    Promise.all(framePromises).then(loadedFrames => {
      setAllFrames(loadedFrames);
      setEndFrame(loadedFrames.length);
      setIsLoading(false);
    }).catch(error => {
      console.error("Error loading frame images:", error);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!editingAssets.imageData || !editingAssets.imageData.data) {
        setIsLoading(false);
        return;
    }
    
    setIsLoading(true);
    setAllFrames([]);

    const img = new Image();
    img.onload = () => {
        setSpriteSheetImage(img);
        processSpriteSheet(img);
    }
    img.onerror = () => {
        console.error("Failed to load generated image.");
        setIsLoading(false);
    }
    img.src = `data:${editingAssets.imageData.mimeType};base64,${editingAssets.imageData.data}`;
  }, [editingAssets.imageData, processSpriteSheet]);
  
  useEffect(() => {
    if (allFrames.length > 0) {
      const start = Math.max(0, startFrame - 1);
      const end = Math.min(allFrames.length, endFrame);
      setVisibleFrames(allFrames.slice(start, end));
    }
  }, [allFrames, startFrame, endFrame]);

  useEffect(() => {
    if (visibleFrames.length === 0 || !canvasRef.current || isLoading || viewMode !== 'animation') {
      if(animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = 512;
    canvas.height = 512;
    
    let animationStopped = false;
        
    const animate = (timestamp: number) => {
      if(animationStartTimeRef.current === 0) animationStartTimeRef.current = timestamp;
      
      const totalDuration = visibleFrames.length * config.speed;
      const elapsedTime = timestamp - animationStartTimeRef.current;
      let currentFrameIndex;

      if (loopBehavior === 'once' && elapsedTime >= totalDuration) {
          currentFrameIndex = visibleFrames.length - 1;
          animationStopped = true;
      } else {
          const loopedElapsedTime = elapsedTime % totalDuration;
          currentFrameIndex = Math.floor(loopedElapsedTime / config.speed);
      }
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (visibleFrames[currentFrameIndex]) {
        ctx.drawImage(visibleFrames[currentFrameIndex], 0, 0, canvas.width, canvas.height);
      }
      
      if (!animationStopped) {
        animationFrameId.current = requestAnimationFrame(animate);
      }
    };

    animationFrameId.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      animationStartTimeRef.current = 0;
    };
  }, [visibleFrames, config, isLoading, viewMode, loopBehavior]);

  const handleApplyText = async () => {
    if (!topText && !bottomText) return;
    setIsApplyingText(true);
    setEditError(null);
    try {
        const { data, mimeType } = editingAssets.imageData;
        const newImageData = await addTextToSpriteSheet(data, mimeType, topText, bottomText, font);
        setEditingAssets(prev => ({...prev, imageData: newImageData}));
        setTopText('');
        setBottomText('');
        setActiveTool(null);
    } catch (error) {
        console.error("Failed to apply text:", error);
        setEditError(error instanceof Error ? error.message : "An unknown error occurred.");
    } finally {
        setIsApplyingText(false);
    }
  };

  const createGif = (callback: (obj: { error: boolean; image: string; errorMsg: string }) => void) => {
    if (visibleFrames.length === 0 || !canvasRef.current) return;
    
    const imageUrls = visibleFrames.map(frame => frame.src);
    const intervalInSeconds = config.speed / 1000;

    gifshot.createGIF({
        images: imageUrls,
        gifWidth: canvasRef.current.width,
        gifHeight: canvasRef.current.height,
        interval: intervalInSeconds,
        numWorkers: 2,
    }, callback);
  };

  const performExport = () => {
    setIsExporting(true);
    createGif((obj) => {
        setIsExporting(false);
        if (!obj.error) {
            const a = document.createElement('a');
            a.href = obj.image;
            a.download = 'animation.gif';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            console.error('GIF export failed:', obj.errorMsg);
            setEditError(`GIF export failed: ${obj.errorMsg}`);
        }
    });
  };

  const performShare = async () => {
    if (!isShareAvailable) return;
    setIsSharing(true);
    createGif(async (obj) => {
        setIsSharing(false);
        if (!obj.error) {
            try {
                const blob = dataURLtoBlob(obj.image);
                const file = new File([blob], "animation.gif", { type: "image/gif" });
                await navigator.share({
                    files: [file],
                    title: 'My Animation',
                    text: 'Check out this animation I created!',
                });
            } catch (error) {
                if (error instanceof Error && error.name !== 'AbortError') {
                  setEditError(`Sharing failed: ${error.message}`);
                }
            }
        } else {
            setEditError(`Could not create GIF for sharing: ${obj.errorMsg}`);
        }
    });
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl">
      <div className="relative w-full max-w-lg aspect-square bg-black rounded-lg overflow-hidden shadow-2xl mb-4 flex items-center justify-center">
        {isLoading ? (
           <BananaLoader className="w-60 h-60" />
        ) : (
            <>
              <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                <button onClick={() => setViewMode(v => v === 'animation' ? 'spritesheet' : 'animation')}
                  className="bg-black/50 p-2 rounded-full text-white hover:bg-black/75 transition-colors"
                  aria-label={viewMode === 'animation' ? 'Show sprite sheet' : 'Show animation'}>
                  {viewMode === 'animation' ? <InfoIcon className="w-6 h-6" /> : <XCircleIcon className="w-6 h-6 text-yellow-400" />}
                </button>
              </div>
              <canvas ref={canvasRef} className={`${viewMode === 'animation' ? 'block' : 'hidden'} w-full h-full object-contain`} />
              {viewMode === 'spritesheet' && spriteSheetImage && (
                  <img src={spriteSheetImage.src} alt="Generated Sprite Sheet" className="max-w-full max-h-full object-contain bg-gray-800" />
              )}
            </>
        )}
      </div>

    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-lg mb-4">
        <button onClick={onBack} className="bg-slate-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors">Back</button>
        <button onClick={onRegenerate} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-500 transition-colors">Regenerate</button>
        <button onClick={performExport} disabled={isExporting} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-500 disabled:bg-blue-800 transition-colors">
            {isExporting ? 'Exporting...' : 'Export GIF'}
        </button>
        {isShareAvailable && (
            <button onClick={performShare} disabled={isSharing} className="bg-slate-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors disabled:bg-slate-800">
                {isSharing ? 'Sharing...' : 'Share'}
            </button>
        )}
    </div>

    {/* --- Editing Tools --- */}
    <div className="w-full max-w-lg bg-slate-800 rounded-lg p-4 mt-4">
        <h3 className="text-lg font-bold text-white mb-3">Editing Tools</h3>
        <div className="flex border-b border-slate-700 mb-4">
            <button onClick={() => setActiveTool('cut')} className={`px-4 py-2 text-sm font-semibold flex items-center gap-2 ${activeTool === 'cut' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}><ScissorsIcon className="w-4 h-4" /> Cut</button>
            <button onClick={() => setActiveTool('text')} className={`px-4 py-2 text-sm font-semibold flex items-center gap-2 ${activeTool === 'text' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}><TypeIcon className="w-4 h-4" /> Add Text</button>
            <button onClick={() => setActiveTool('settings')} className={`px-4 py-2 text-sm font-semibold flex items-center gap-2 ${activeTool === 'settings' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}><SettingsIcon className="w-4 h-4" /> Settings</button>
        </div>
        
        {editError && (
             <div className="bg-red-500/10 text-red-300 px-4 py-2 rounded-md mb-4 text-sm flex justify-between items-center" role="alert">
                <span>{editError}</span>
                <button onClick={() => setEditError(null)}><XCircleIcon className="w-5 h-5"/></button>
            </div>
        )}

        {activeTool === 'cut' && (
            <div className="space-y-4">
                 <div>
                    <div className="flex justify-between text-xs font-medium text-slate-400 mb-2">
                        <span>Start: Frame {startFrame}</span>
                        <span>End: Frame {endFrame}</span>
                    </div>
                    <FrameRangeSlider
                        min={1}
                        max={allFrames.length || 9}
                        value={{ min: startFrame, max: endFrame }}
                        onChange={({ min, max }) => {
                            setStartFrame(min);
                            setEndFrame(max);
                        }}
                    />
                </div>
                <div className="bg-slate-900/50 p-2 rounded-md overflow-x-auto flex gap-1">
                    {allFrames.map((frame, index) => (
                        <img key={index} src={frame.src} className={`w-16 h-16 object-cover rounded-sm border-2 ${index + 1 >= startFrame && index + 1 <= endFrame ? 'border-blue-500' : 'border-transparent opacity-40'}`} alt={`Frame ${index + 1}`} />
                    ))}
                </div>
            </div>
        )}

        {activeTool === 'text' && (
            <div className="space-y-4">
                <div>
                    <label htmlFor="topText" className="block text-xs font-medium text-slate-400 mb-1">Top Text</label>
                    <input type="text" id="topText" value={topText} onChange={e => setTopText(e.target.value)} placeholder="Meme top text" className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white" />
                </div>
                 <div>
                    <label htmlFor="bottomText" className="block text-xs font-medium text-slate-400 mb-1">Bottom Text</label>
                    <input type="text" id="bottomText" value={bottomText} onChange={e => setBottomText(e.target.value)} placeholder="Meme bottom text" className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white" />
                </div>
                <div>
                    <label htmlFor="font" className="block text-xs font-medium text-slate-400 mb-1">Font</label>
                    <select id="font" value={font} onChange={e => setFont(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white appearance-none" style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}>
                        <option>Impact</option>
                        <option>Arial Black</option>
                        <option>Comic Sans MS</option>
                        <option>Courier New</option>
                        <option>Verdana</option>
                    </select>
                </div>
                <div className="flex justify-end">
                    <button onClick={handleApplyText} disabled={isApplyingText || (!topText && !bottomText)} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed flex items-center gap-2">
                        {isApplyingText && <LoaderIcon className="w-5 h-5 animate-spin" />}
                        {isApplyingText ? 'Applying...' : 'Apply Text'}
                    </button>
                </div>
            </div>
        )}

        {activeTool === 'settings' && (
            <div className="space-y-6">
                <div>
                    <label htmlFor="speed" className="block text-xs font-medium text-slate-400 mb-1 flex justify-between">
                        <span>Animation Speed (ms per frame)</span>
                        <span className="font-bold text-slate-200">{config.speed}ms</span>
                    </label>
                    <input 
                        type="range" 
                        id="speed" 
                        min="80" 
                        max="2000" 
                        value={config.speed} 
                        onChange={e => setConfig(c => ({...c, speed: parseInt(e.target.value)}))} 
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" 
                    />
                     <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>Fast</span>
                        <span>Slow</span>
                    </div>
                </div>
                <div>
                    <label htmlFor="loopBehavior" className="block text-xs font-medium text-slate-400 mb-1">
                        Preview Looping
                    </label>
                    <select 
                        id="loopBehavior" 
                        value={loopBehavior} 
                        onChange={e => setLoopBehavior(e.target.value as 'infinite' | 'once')} 
                        className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white appearance-none" 
                        style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}>
                        <option value="infinite">Loop Forever</option>
                        <option value="once">Play Once</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-2">Note: Exported GIFs will always loop forever.</p>
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">
                        Editing Actions
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                         <button
                            onClick={handleSaveChanges}
                            disabled={saveStatus !== 'idle'}
                            className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 disabled:bg-blue-800 disabled:cursor-not-allowed"
                            aria-label="Save current edits"
                        >
                            <SaveIcon className="w-4 h-4" />
                            {saveStatus === 'idle' && 'Save Edits'}
                            {saveStatus === 'saving' && 'Saving...'}
                            {saveStatus === 'saved' && 'Saved!'}
                        </button>
                        <button
                            onClick={handleResetEdits}
                            className="w-full bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                            aria-label="Reset all edits"
                        >
                            <RotateCcwIcon className="w-4 h-4" />
                            Reset Edits
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Save your changes to resume editing later, or reset to the original animation.</p>
                </div>
            </div>
        )}
    </div>

    </div>
  );
};

export default AnimationPlayer;