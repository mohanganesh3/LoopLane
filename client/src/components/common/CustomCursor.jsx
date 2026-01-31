import React from 'react';
import { useCustomCursor } from '../../hooks/useCustomCursor';

/**
 * Global custom cursor component with micro-interactions
 * Features: smooth following, size changes on hover, mix-blend-mode
 */
const CustomCursor = () => {
    const { cursorRef, cursorDotRef, isHovering, isClicking, isVisible, isTouchDevice } = useCustomCursor();

    // Don't render on touch devices or when not visible
    if (isTouchDevice) return null;

    return (
        <>
            {/* Cursor Ring (outer) */}
            <div
                ref={cursorRef}
                className={`
          custom-cursor fixed top-0 left-0 pointer-events-none z-[9999]
          rounded-full border-2 border-[#e07a5f]
          transition-[width,height,opacity,border-color] duration-300 ease-out
          mix-blend-difference
          ${isVisible ? 'opacity-100' : 'opacity-0'}
          ${isHovering ? 'w-16 h-16 border-[#81b29a]' : 'w-8 h-8'}
          ${isClicking ? 'scale-75' : 'scale-100'}
        `}
                style={{
                    willChange: 'transform',
                }}
            />

            {/* Cursor Dot (inner) */}
            <div
                ref={cursorDotRef}
                className={`
          custom-cursor-dot fixed top-0 left-0 pointer-events-none z-[9999]
          rounded-full bg-[#e07a5f]
          transition-[width,height,opacity,background-color] duration-200 ease-out
          mix-blend-difference
          ${isVisible ? 'opacity-100' : 'opacity-0'}
          ${isHovering ? 'w-2 h-2 bg-[#81b29a]' : 'w-1.5 h-1.5'}
          ${isClicking ? 'scale-150' : 'scale-100'}
        `}
                style={{
                    willChange: 'transform',
                }}
            />

            {/* Global CSS for hiding default cursor */}
            <style>{`
        @media (hover: hover) and (pointer: fine) {
          * {
            cursor: none !important;
          }
        }
        
        @media (prefers-reduced-motion: reduce) {
          .custom-cursor,
          .custom-cursor-dot {
            display: none !important;
          }
          * {
            cursor: auto !important;
          }
        }
      `}</style>
        </>
    );
};

export default CustomCursor;
