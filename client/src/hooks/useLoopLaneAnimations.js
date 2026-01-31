/**
 * LoopLane Animation Library
 * Premium, organic animations that feel handcrafted
 * Uses GSAP for complex animations, CSS for simple ones
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useInView } from 'react-intersection-observer';

// ============================================
// EASING FUNCTIONS (Organic, not mechanical)
// ============================================

export const easings = {
  // Smooth and natural
  smooth: [0.4, 0, 0.2, 1],
  smoothOut: [0, 0, 0.2, 1],
  smoothIn: [0.4, 0, 1, 1],
  
  // Bouncy and playful
  bounce: [0.34, 1.56, 0.64, 1],
  bounceHard: [0.68, -0.55, 0.27, 1.55],
  
  // Spring-like
  spring: [0.43, 0.195, 0.02, 1.1],
  springGentle: [0.25, 0.46, 0.45, 0.94],
  
  // Expo (dramatic)
  expoOut: [0.19, 1, 0.22, 1],
  expoIn: [0.95, 0.05, 0.795, 0.035],
  expoInOut: [0.87, 0, 0.13, 1],
  
  // Circ (circular)
  circOut: [0, 0.55, 0.45, 1],
  circIn: [0.55, 0, 1, 0.45],
  circInOut: [0.85, 0, 0.15, 1],
  
  // Quint (subtle power)
  quintOut: [0.22, 1, 0.36, 1],
  quintIn: [0.64, 0, 0.78, 0],
};

// Convert array to CSS cubic-bezier string
export const toCubicBezier = (arr) => `cubic-bezier(${arr.join(', ')})`;

// ============================================
// SCROLL REVEAL HOOK
// ============================================

export const useScrollReveal = (options = {}) => {
  const {
    threshold = 0.2,
    triggerOnce = true,
    delay = 0,
    duration = 800,
    distance = 30,
    direction = 'up', // 'up', 'down', 'left', 'right'
  } = options;
  
  const { ref, inView } = useInView({
    threshold,
    triggerOnce,
  });
  
  const getTransform = () => {
    switch (direction) {
      case 'up': return `translateY(${distance}px)`;
      case 'down': return `translateY(-${distance}px)`;
      case 'left': return `translateX(${distance}px)`;
      case 'right': return `translateX(-${distance}px)`;
      default: return `translateY(${distance}px)`;
    }
  };
  
  const style = {
    opacity: inView ? 1 : 0,
    transform: inView ? 'translate(0)' : getTransform(),
    transition: `opacity ${duration}ms ${toCubicBezier(easings.expoOut)} ${delay}ms, 
                 transform ${duration}ms ${toCubicBezier(easings.expoOut)} ${delay}ms`,
  };
  
  return { ref, style, inView };
};

// ============================================
// STAGGERED REVEAL HOOK (for lists)
// ============================================

export const useStaggerReveal = (itemCount, options = {}) => {
  const {
    threshold = 0.1,
    triggerOnce = true,
    baseDelay = 0,
    staggerDelay = 100,
    duration = 600,
    distance = 20,
  } = options;
  
  const { ref, inView } = useInView({
    threshold,
    triggerOnce,
  });
  
  const getItemStyle = (index) => ({
    opacity: inView ? 1 : 0,
    transform: inView ? 'translateY(0)' : `translateY(${distance}px)`,
    transition: `opacity ${duration}ms ${toCubicBezier(easings.expoOut)} ${baseDelay + (index * staggerDelay)}ms, 
                 transform ${duration}ms ${toCubicBezier(easings.expoOut)} ${baseDelay + (index * staggerDelay)}ms`,
  });
  
  return { ref, inView, getItemStyle };
};

// ============================================
// MAGNETIC BUTTON EFFECT
// ============================================

export const useMagnetic = (strength = 0.3) => {
  const ref = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  
  const handleMouseMove = useCallback((e) => {
    if (!ref.current) return;
    
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = (e.clientX - centerX) * strength;
    const deltaY = (e.clientY - centerY) * strength;
    
    setPosition({ x: deltaX, y: deltaY });
  }, [strength]);
  
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);
  
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setPosition({ x: 0, y: 0 });
  }, []);
  
  const style = {
    transform: `translate(${position.x}px, ${position.y}px)`,
    transition: isHovered 
      ? 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)' 
      : 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
  };
  
  return {
    ref,
    style,
    handlers: {
      onMouseMove: handleMouseMove,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
  };
};

// ============================================
// PARALLAX EFFECT
// ============================================

export const useParallax = (speed = 0.5) => {
  const ref = useRef(null);
  const [offset, setOffset] = useState(0);
  
  useEffect(() => {
    const handleScroll = () => {
      if (!ref.current) return;
      
      const rect = ref.current.getBoundingClientRect();
      const scrollY = window.scrollY;
      const elementTop = rect.top + scrollY;
      const windowHeight = window.innerHeight;
      
      // Only animate when element is in view
      if (rect.top < windowHeight && rect.bottom > 0) {
        const relativeScroll = scrollY - elementTop + windowHeight;
        const parallaxOffset = relativeScroll * speed * -0.1;
        setOffset(parallaxOffset);
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed]);
  
  return {
    ref,
    style: {
      transform: `translateY(${offset}px)`,
    },
  };
};

// ============================================
// TILT EFFECT (3D card hover)
// ============================================

export const useTilt = (maxTilt = 10, perspective = 1000) => {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  
  const handleMouseMove = useCallback((e) => {
    if (!ref.current) return;
    
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const percentX = (e.clientX - centerX) / (rect.width / 2);
    const percentY = (e.clientY - centerY) / (rect.height / 2);
    
    setTilt({
      x: percentY * maxTilt * -1, // Invert for natural feel
      y: percentX * maxTilt,
    });
  }, [maxTilt]);
  
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);
  
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
  }, []);
  
  const style = {
    transform: isHovered 
      ? `perspective(${perspective}px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(1.02, 1.02, 1.02)`
      : 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
    transition: isHovered
      ? 'transform 0.1s ease-out'
      : 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
    transformStyle: 'preserve-3d',
  };
  
  return {
    ref,
    style,
    handlers: {
      onMouseMove: handleMouseMove,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
  };
};

// ============================================
// HOVER GLOW EFFECT
// ============================================

export const useHoverGlow = () => {
  const ref = useRef(null);
  const [glowPosition, setGlowPosition] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  
  const handleMouseMove = useCallback((e) => {
    if (!ref.current) return;
    
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setGlowPosition({ x, y });
  }, []);
  
  const glowStyle = {
    '--glow-x': `${glowPosition.x}%`,
    '--glow-y': `${glowPosition.y}%`,
    '--glow-opacity': isHovered ? 1 : 0,
  };
  
  return {
    ref,
    glowStyle,
    handlers: {
      onMouseMove: handleMouseMove,
      onMouseEnter: () => setIsHovered(true),
      onMouseLeave: () => setIsHovered(false),
    },
  };
};

// ============================================
// TEXT SCRAMBLE EFFECT
// ============================================

export const useTextScramble = (text, options = {}) => {
  const { 
    chars = '!<>-_\\/[]{}—=+*^?#________',
    speed = 30,
    triggerOnView = true,
  } = options;
  
  const [displayText, setDisplayText] = useState(text);
  const [isScrambling, setIsScrambling] = useState(false);
  const frameRef = useRef(null);
  const { ref, inView } = useInView({ triggerOnce: true });
  
  const scramble = useCallback(() => {
    if (isScrambling) return;
    
    setIsScrambling(true);
    let iteration = 0;
    
    const animate = () => {
      setDisplayText(
        text
          .split('')
          .map((char, index) => {
            if (index < iteration) return text[index];
            if (char === ' ') return ' ';
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join('')
      );
      
      if (iteration < text.length) {
        iteration += 0.5;
        frameRef.current = setTimeout(animate, speed);
      } else {
        setIsScrambling(false);
      }
    };
    
    animate();
  }, [text, chars, speed, isScrambling]);
  
  useEffect(() => {
    if (triggerOnView && inView && !isScrambling) {
      scramble();
    }
    
    return () => {
      if (frameRef.current) clearTimeout(frameRef.current);
    };
  }, [inView, triggerOnView, scramble, isScrambling]);
  
  return { ref, displayText, scramble };
};

// ============================================
// COUNTER ANIMATION
// ============================================

export const useCountUp = (end, options = {}) => {
  const { 
    start = 0, 
    duration = 2000, 
    decimals = 0,
    triggerOnView = true,
  } = options;
  
  const [count, setCount] = useState(start);
  const { ref, inView } = useInView({ triggerOnce: true });
  const frameRef = useRef(null);
  const startTimeRef = useRef(null);
  
  useEffect(() => {
    if (!triggerOnView || !inView) return;
    
    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4); // Ease out quart
      
      const currentValue = start + (end - start) * eased;
      setCount(currentValue);
      
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };
    
    frameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [inView, start, end, duration, triggerOnView]);
  
  const formattedCount = count.toFixed(decimals);
  
  return { ref, count: formattedCount };
};

// ============================================
// TYPEWRITER EFFECT
// ============================================

export const useTypewriter = (text, options = {}) => {
  const { 
    speed = 50, 
    startDelay = 0,
    triggerOnView = true,
  } = options;
  
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const { ref, inView } = useInView({ triggerOnce: true });
  const indexRef = useRef(0);
  const timeoutRef = useRef(null);
  
  useEffect(() => {
    if (!triggerOnView || !inView || isTyping || isComplete) return;
    
    const startTyping = () => {
      setIsTyping(true);
      
      const type = () => {
        if (indexRef.current < text.length) {
          setDisplayText(text.substring(0, indexRef.current + 1));
          indexRef.current++;
          timeoutRef.current = setTimeout(type, speed);
        } else {
          setIsTyping(false);
          setIsComplete(true);
        }
      };
      
      type();
    };
    
    timeoutRef.current = setTimeout(startTyping, startDelay);
    
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [inView, text, speed, startDelay, triggerOnView, isTyping, isComplete]);
  
  return { ref, displayText, isTyping, isComplete };
};

// ============================================
// SCROLL PROGRESS
// ============================================

export const useScrollProgress = () => {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const updateProgress = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPosition = window.scrollY;
      const currentProgress = scrollHeight > 0 ? (scrollPosition / scrollHeight) * 100 : 0;
      setProgress(currentProgress);
    };
    
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
    
    return () => window.removeEventListener('scroll', updateProgress);
  }, []);
  
  return progress;
};

// ============================================
// MOUSE FOLLOWER EFFECT
// ============================================

export const useMouseFollower = (options = {}) => {
  const { smoothness = 0.15 } = options;
  
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const targetRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef(null);
  
  useEffect(() => {
    const handleMouseMove = (e) => {
      targetRef.current = { x: e.clientX, y: e.clientY };
      setIsVisible(true);
    };
    
    const handleMouseLeave = () => {
      setIsVisible(false);
    };
    
    const animate = () => {
      setPosition(prev => ({
        x: prev.x + (targetRef.current.x - prev.x) * smoothness,
        y: prev.y + (targetRef.current.y - prev.y) * smoothness,
      }));
      animationRef.current = requestAnimationFrame(animate);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [smoothness]);
  
  return { position, isVisible };
};

export default {
  easings,
  toCubicBezier,
  useScrollReveal,
  useStaggerReveal,
  useMagnetic,
  useParallax,
  useTilt,
  useHoverGlow,
  useTextScramble,
  useCountUp,
  useTypewriter,
  useScrollProgress,
  useMouseFollower,
};
