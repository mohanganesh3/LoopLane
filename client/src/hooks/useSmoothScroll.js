import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Pages where Lenis smooth scroll should be disabled
// These pages have nested scroll containers (dropdowns, panels, maps)
const EXCLUDED_PATHS = [
    '/tracking',
    '/post-ride',
    '/find-ride',
    '/search',
    '/edit-ride',
    '/driver-tracking',
    '/chat',
];

/**
 * Custom hook for Lenis smooth scroll with GSAP integration
 * Provides buttery smooth scrolling at 120fps
 * Automatically disables on pages with nested scroll containers
 */
export function useSmoothScroll(options = {}) {
    const lenisRef = useRef(null);
    const location = useLocation();

    useEffect(() => {
        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion) {
            return; // Skip smooth scroll for users who prefer reduced motion
        }

        // Check if current path should be excluded from smooth scroll
        const currentPath = location.pathname;
        const shouldExclude = EXCLUDED_PATHS.some(path => currentPath.startsWith(path));

        if (shouldExclude) {
            // Ensure native scrolling works on excluded pages
            document.documentElement.classList.remove('lenis', 'lenis-smooth');
            return;
        }

        // Initialize Lenis
        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            direction: 'vertical',
            gestureDirection: 'vertical',
            smooth: true,
            mouseMultiplier: 1,
            smoothTouch: false,
            touchMultiplier: 2,
            infinite: false,
            ...options,
        });

        lenisRef.current = lenis;

        // Sync Lenis with GSAP ScrollTrigger
        lenis.on('scroll', ScrollTrigger.update);

        // Add Lenis to GSAP ticker
        gsap.ticker.add((time) => {
            lenis.raf(time * 1000);
        });

        // Disable GSAP lag smoothing for perfect sync
        gsap.ticker.lagSmoothing(0);

        // Cleanup
        return () => {
            lenis.destroy();
            gsap.ticker.remove(lenis.raf);
            document.documentElement.classList.remove('lenis', 'lenis-smooth');
        };
    }, [location.pathname]);

    return lenisRef;
}

export default useSmoothScroll;
