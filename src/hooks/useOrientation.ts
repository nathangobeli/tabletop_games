import { useState, useEffect } from 'react';

export type ViewportOrientation = 'portrait' | 'landscape';

export interface OrientationState {
  orientation: ViewportOrientation;
  isLandscape: boolean;
  width: number;
  height: number;
}

/**
 * Universal Orientation & Viewport Resize Hook
 * Listens to resize, orientationchange, and CSS matchMedia queries.
 */
export const useOrientation = (): OrientationState => {
  const getOrientationState = (): OrientationState => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const height = typeof window !== 'undefined' ? window.innerHeight : 768;
    const isLandscape = width > height;

    return {
      orientation: isLandscape ? 'landscape' : 'portrait',
      isLandscape,
      width,
      height,
    };
  };

  const [state, setState] = useState<OrientationState>(getOrientationState);

  useEffect(() => {
    const handleResize = () => {
      setState(getOrientationState());
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    const mql = window.matchMedia('(orientation: landscape)');
    const handleMqlChange = () => handleResize();
    if (mql.addEventListener) {
      mql.addEventListener('change', handleMqlChange);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (mql.removeEventListener) {
        mql.removeEventListener('change', handleMqlChange);
      }
    };
  }, []);

  return state;
};
