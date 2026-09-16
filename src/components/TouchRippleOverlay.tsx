import React, { useState, useEffect } from 'react';
import { triggerHaptic } from '../utils/feedback';

interface Ripple {
  id: number;
  x: number;
  y: number;
  color: string;
}

export const TouchRippleOverlay: React.FC = () => {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      // Light haptic pulse
      triggerHaptic('light');

      const id = Date.now() + Math.random();
      const x = e.clientX;
      const y = e.clientY;

      // Subtle warm amber-gold or blue sheen depending on touch
      const newRipple: Ripple = {
        id,
        x,
        y,
        color: 'rgba(251, 191, 36, 0.45)', // warm gold sparkle
      };

      setRipples((prev) => [...prev.slice(-6), newRipple]);

      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 450);
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  if (ripples.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      <svg className="w-full h-full">
        {ripples.map((r) => (
          <g key={r.id} className="animate-ripple">
            <circle
              cx={r.x}
              cy={r.y}
              r="24"
              fill="none"
              stroke={r.color}
              strokeWidth="3.5"
              className="opacity-80"
            />
            <circle
              cx={r.x}
              cy={r.y}
              r="6"
              fill={r.color}
              className="opacity-90 blur-[1px]"
            />
          </g>
        ))}
      </svg>
    </div>
  );
};
