import { useRef, useCallback } from 'react';
import gsap from 'gsap';

/**
 * Magnetic effect hook for buttons and interactive elements
 * Elements are "pulled" toward cursor when hovering nearby
 */
export function useMagneticEffect(options = {}) {
    const {
        strength = 0.5,
        ease = 'power2.out',
        duration = 0.3,
        returnDuration = 0.5,
        returnEase = 'elastic.out(1, 0.3)',
    } = options;

    const elementRef = useRef(null);
    const isHovering = useRef(false);

    const handleMouseMove = useCallback((e) => {
        if (!elementRef.current || !isHovering.current) return;

        const element = elementRef.current;
        const rect = element.getBoundingClientRect();

        // Calculate distance from center
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distanceX = e.clientX - centerX;
        const distanceY = e.clientY - centerY;

        // Apply magnetic effect
        gsap.to(element, {
            x: distanceX * strength,
            y: distanceY * strength,
            duration,
            ease,
        });
    }, [strength, duration, ease]);

    const handleMouseEnter = useCallback(() => {
        isHovering.current = true;
        window.addEventListener('mousemove', handleMouseMove);
    }, [handleMouseMove]);

    const handleMouseLeave = useCallback(() => {
        isHovering.current = false;
        window.removeEventListener('mousemove', handleMouseMove);

        // Return to center with elastic effect
        if (elementRef.current) {
            gsap.to(elementRef.current, {
                x: 0,
                y: 0,
                duration: returnDuration,
                ease: returnEase,
            });
        }
    }, [handleMouseMove, returnDuration, returnEase]);

    const bindMagnetic = useCallback(() => ({
        ref: elementRef,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
    }), [handleMouseEnter, handleMouseLeave]);

    return {
        elementRef,
        bindMagnetic,
        handleMouseEnter,
        handleMouseLeave,
    };
}

export default useMagneticEffect;
