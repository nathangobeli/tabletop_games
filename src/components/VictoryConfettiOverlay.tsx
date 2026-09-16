import React, { useMemo } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  delay: number;
}

export const VictoryConfettiOverlay: React.FC = () => {
  const particles = useMemo(() => {
    const items: Particle[] = [];
    const colors = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6', '#fbbf24'];

    for (let i = 0; i < 48; i++) {
      const angle = (Math.PI * 2 * i) / 48 + (Math.random() - 0.5) * 0.3;
      const speed = 120 + Math.random() * 260;
      items.push({
        id: i,
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 60,
        size: 5 + Math.random() * 6,
        color: colors[i % colors.length],
        delay: Math.random() * 0.15,
      });
    }
    return items;
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] flex items-center justify-center overflow-hidden">
      <svg className="w-full h-full" viewBox="-300 -400 600 800">
        {particles.map((p) => (
          <g
            key={p.id}
            style={{
              transform: `translate(${p.x}px, ${p.y}px)`,
              transition: `transform 1.1s cubic-bezier(0.25, 1, 0.5, 1) ${p.delay}s, opacity 1.1s ease-out ${p.delay}s`,
            }}
            className="animate-sparkle"
          >
            {p.id % 2 === 0 ? (
              <circle cx="0" cy="0" r={p.size} fill={p.color} className="drop-shadow-md" />
            ) : (
              <polygon
                points={`0,-${p.size * 1.3} ${p.size * 0.4},-${p.size * 0.4} ${p.size * 1.3},0 ${p.size * 0.4},${p.size * 0.4} 0,${p.size * 1.3} -${p.size * 0.4},${p.size * 0.4} -${p.size * 1.3},0 -${p.size * 0.4},-${p.size * 0.4}`}
                fill={p.color}
                className="drop-shadow-md"
              />
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};
