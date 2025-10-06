/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useCallback } from 'react';

interface FrameRangeSliderProps {
    min: number;
    max: number;
    value: { min: number; max: number };
    onChange: (value: { min: number; max: number }) => void;
}

const FrameRangeSlider: React.FC<FrameRangeSliderProps> = ({ min, max, value, onChange }) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const minThumbRef = useRef<HTMLDivElement>(null);
    const maxThumbRef = useRef<HTMLDivElement>(null);
    const activeThumb = useRef<'min' | 'max' | null>(null);

    const getPercentage = useCallback((val: number) => ((val - min) / (max - min)) * 100, [min, max]);

    const handlePointerMove = useCallback((event: PointerEvent) => {
        if (!trackRef.current || !activeThumb.current) return;

        const trackRect = trackRef.current.getBoundingClientRect();
        const clientX = event.clientX;
        const percent = Math.max(0, Math.min(100, ((clientX - trackRect.left) / trackRect.width) * 100));
        const newValue = Math.round((percent / 100) * (max - min) + min);

        if (activeThumb.current === 'min') {
            onChange({ min: Math.min(newValue, value.max), max: value.max });
        } else {
            onChange({ min: value.min, max: Math.max(newValue, value.min) });
        }
    }, [min, max, onChange, value]);

    const handlePointerUp = useCallback(() => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
        activeThumb.current = null;
    }, [handlePointerMove]);

    const handlePointerDown = (thumb: 'min' | 'max') => {
        activeThumb.current = thumb;
        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
    };

    const minPercent = getPercentage(value.min);
    const maxPercent = getPercentage(value.max);

    return (
        <div ref={trackRef} className="relative w-full h-5 flex items-center touch-none">
            {/* Track background */}
            <div className="absolute w-full h-1 bg-slate-700 rounded-full"></div>
            {/* Selected range track */}
            <div
                className="absolute h-1 bg-blue-500 rounded-full"
                style={{
                    left: `${minPercent}%`,
                    width: `${maxPercent - minPercent}%`,
                }}
            ></div>
            {/* Min thumb */}
            <div
                ref={minThumbRef}
                onPointerDown={() => handlePointerDown('min')}
                className="absolute w-4 h-4 bg-white rounded-full border-2 border-blue-500 cursor-pointer -translate-x-1/2"
                style={{ left: `${minPercent}%` }}
                role="slider"
                aria-valuemin={min}
                aria-valuemax={value.max}
                aria-valuenow={value.min}
                aria-label="Start Frame"
                tabIndex={0}
            ></div>
            {/* Max thumb */}
            <div
                ref={maxThumbRef}
                onPointerDown={() => handlePointerDown('max')}
                className="absolute w-4 h-4 bg-white rounded-full border-2 border-blue-500 cursor-pointer -translate-x-1/2"
                style={{ left: `${maxPercent}%` }}
                role="slider"
                aria-valuemin={value.min}
                aria-valuemax={max}
                aria-valuenow={value.max}
                aria-label="End Frame"
                tabIndex={0}
            ></div>
        </div>
    );
};

export default FrameRangeSlider;