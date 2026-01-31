import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Custom cursor hook with lerp-based smooth following and micro-interactions
 * Features: size changes on hover, mix-blend-mode, disabled on touch devices
 */
export function useCustomCursor() {
    const cursorRef = useRef(null);
    const cursorDotRef = useRef(null);
    const [isHovering, setIsHovering] = useState(false);
    const [isClicking, setIsClicking] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [isTouchDevice, setIsTouchDevice] = useState(false);

    // Mouse position with lerp smoothing
    const mouse = useRef({ x: 0, y: 0 });
    const cursorPos = useRef({ x: 0, y: 0 });
    const dotPos = useRef({ x: 0, y: 0 });

    // Lerp function for smooth interpolation
    const lerp = useCallback((a, b, n) => (1 - n) * a + n * b, []);

    useEffect(() => {
        // Check if touch device
        const checkTouch = () => {
            setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
        };
        checkTouch();

        // Check reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion || isTouchDevice) {
            return;
        }

        // Mouse move handler
        const handleMouseMove = (e) => {
            mouse.current = { x: e.clientX, y: e.clientY };
            if (!isVisible) setIsVisible(true);
        };

        // Mouse enter/leave viewport
        const handleMouseEnter = () => setIsVisible(true);
        const handleMouseLeave = () => setIsVisible(false);

        // Click handlers
        const handleMouseDown = () => setIsClicking(true);
        const handleMouseUp = () => setIsClicking(false);

        // Hover detection for interactive elements
        const handleElementHover = (e) => {
            const target = e.target;
            const isInteractive =
                target.tagName === 'BUTTON' ||
                target.tagName === 'A' ||
                target.closest('button') ||
                target.closest('a') ||
                target.closest('[data-cursor="hover"]') ||
                target.classList.contains('cursor-hover');

            setIsHovering(isInteractive);
        };

        // Animation loop
        let animationId;
        const animate = () => {
            // Cursor ring (slower follow)
            cursorPos.current.x = lerp(cursorPos.current.x, mouse.current.x, 0.15);
            cursorPos.current.y = lerp(cursorPos.current.y, mouse.current.y, 0.15);

            // Cursor dot (faster follow)
            dotPos.current.x = lerp(dotPos.current.x, mouse.current.x, 0.35);
            dotPos.current.y = lerp(dotPos.current.y, mouse.current.y, 0.35);

            if (cursorRef.current) {
                cursorRef.current.style.transform = `translate3d(${cursorPos.current.x}px, ${cursorPos.current.y}px, 0) translate(-50%, -50%)`;
            }
            if (cursorDotRef.current) {
                cursorDotRef.current.style.transform = `translate3d(${dotPos.current.x}px, ${dotPos.current.y}px, 0) translate(-50%, -50%)`;
            }

            animationId = requestAnimationFrame(animate);
        };

        // Add event listeners
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousemove', handleElementHover);
        document.addEventListener('mouseenter', handleMouseEnter);
        document.addEventListener('mouseleave', handleMouseLeave);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);

        // Start animation
        animate();

        // Cleanup
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousemove', handleElementHover);
            document.removeEventListener('mouseenter', handleMouseEnter);
            document.removeEventListener('mouseleave', handleMouseLeave);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            cancelAnimationFrame(animationId);
        };
    }, [lerp, isVisible, isTouchDevice]);

    return {
        cursorRef,
        cursorDotRef,
        isHovering,
        isClicking,
        isVisible,
        isTouchDevice,
    };
}

export default useCustomCursor;
