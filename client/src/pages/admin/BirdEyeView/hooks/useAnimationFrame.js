import { useState, useCallback, useEffect, useRef } from 'react';

const useAnimationFrame = (active = false) => {
  const [currentTime, setCurrentTime] = useState(0);
  const rafRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  const animate = useCallback(() => {
    setCurrentTime(Date.now() - startTimeRef.current);
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (active) {
      startTimeRef.current = Date.now();
      rafRef.current = requestAnimationFrame(animate);
    } else if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, animate]);

  return currentTime;
};

export default useAnimationFrame;
