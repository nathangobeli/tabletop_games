import React from 'react';
import type { GameId } from '../types/game';

interface GameIconProps {
  id: GameId;
  className?: string;
}

export const GameIcon: React.FC<GameIconProps> = ({ id, className = "w-full h-full" }) => {
  switch (id) {
    case 'mancala':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Wooden board background */}
          <rect x="8" y="18" width="84" height="64" rx="20" fill="#926239" stroke="#684223" strokeWidth="2.5" />
          <rect x="11" y="21" width="78" height="58" rx="17" fill="#a47148" opacity="0.6" />
          {/* Mancala Store Pit Left */}
          <rect x="14" y="28" width="10" height="44" rx="5" fill="#4d2f14" />
          <circle cx="19" cy="42" r="3" fill="#6ee7b7" />
          <circle cx="19" cy="54" r="3.2" fill="#38bdf8" />
          {/* Mancala Store Pit Right */}
          <rect x="76" y="28" width="10" height="44" rx="5" fill="#4d2f14" />
          <circle cx="81" cy="45" r="3" fill="#f43f5e" />
          <circle cx="81" cy="56" r="3.2" fill="#fbbf24" />
          {/* Center Pits Row 1 */}
          <circle cx="34" cy="38" r="6.5" fill="#4d2f14" />
          <circle cx="33" cy="37" r="2.8" fill="#38bdf8" />
          <circle cx="36" cy="39" r="2.3" fill="#6ee7b7" />
          <circle cx="50" cy="38" r="6.5" fill="#4d2f14" />
          <circle cx="50" cy="37" r="2.7" fill="#fbbf24" />
          <circle cx="52" cy="40" r="2.2" fill="#f43f5e" />
          <circle cx="66" cy="38" r="6.5" fill="#4d2f14" />
          <circle cx="65" cy="38" r="2.8" fill="#a855f7" />
          {/* Center Pits Row 2 */}
          <circle cx="34" cy="62" r="6.5" fill="#4d2f14" />
          <circle cx="35" cy="61" r="2.6" fill="#38bdf8" />
          <circle cx="33" cy="63" r="2.4" fill="#fbbf24" />
          <circle cx="50" cy="62" r="6.5" fill="#4d2f14" />
          <circle cx="49" cy="63" r="2.8" fill="#6ee7b7" />
          <circle cx="66" cy="62" r="6.5" fill="#4d2f14" />
          <circle cx="67" cy="61" r="2.5" fill="#f43f5e" />
          <circle cx="65" cy="63" r="2.5" fill="#38bdf8" />
        </svg>
      );

    case 'dots-and-boxes':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Grid Paper Tile */}
          <rect x="10" y="10" width="80" height="80" rx="14" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
          {/* Captured Box 1 (Player 1 Blue) */}
          <rect x="25" y="25" width="25" height="25" fill="#3b82f6" fillOpacity="0.22" rx="2" />
          {/* Captured Box 2 (Player 2 Red) */}
          <rect x="50" y="50" width="25" height="25" fill="#ef4444" fillOpacity="0.22" rx="2" />
          {/* Completed Lines (P1 Blue) */}
          <line x1="25" y1="25" x2="50" y2="25" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
          <line x1="25" y1="25" x2="25" y2="50" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
          <line x1="25" y1="50" x2="50" y2="50" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
          <line x1="50" y1="25" x2="50" y2="50" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
          {/* Lines (P2 Red) */}
          <line x1="50" y1="50" x2="75" y2="50" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
          <line x1="75" y1="50" x2="75" y2="75" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
          <line x1="50" y1="75" x2="75" y2="75" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
          {/* Neutral In-progress Line */}
          <line x1="25" y1="75" x2="50" y2="75" stroke="#94a3b8" strokeWidth="3" strokeDasharray="3 3" strokeLinecap="round" />
          {/* Grid Dots */}
          {[25, 50, 75].map((y) =>
            [25, 50, 75].map((x) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" fill="#1e293b" />
            ))
          )}
        </svg>
      );

    case 'speed':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Left Card: Card Back (Red) angled */}
          <g transform="translate(42, 50) rotate(-14) translate(-22, -32)">
            <rect x="0" y="0" width="38" height="56" rx="5" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
            <rect x="3" y="3" width="32" height="50" rx="3" fill="#ef4444" />
            {/* Diamond pattern */}
            <path d="M19 12 L28 28 L19 44 L10 28 Z" fill="#ffffff" fillOpacity="0.4" />
            <circle cx="19" cy="28" r="4.5" fill="#ffffff" />
          </g>
          {/* Right Card: Face Card Ace of Spades angled opposite */}
          <g transform="translate(56, 50) rotate(12) translate(-19, -28)">
            <rect x="0" y="0" width="38" height="56" rx="5" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
            <text x="5" y="14" fontSize="10" fontWeight="bold" fill="#0f172a" fontFamily="sans-serif">A</text>
            <text x="33" y="52" fontSize="10" fontWeight="bold" fill="#0f172a" fontFamily="sans-serif" textAnchor="end">A</text>
            {/* Center Spade */}
            <path
              d="M19 22 C15 28, 11 31, 14 36 C16 39, 19 38, 19 36 C19 38, 22 39, 24 36 C27 31, 23 28, 19 22 Z"
              fill="#0f172a"
            />
            <path d="M17 35 L19 41 L21 35 Z" fill="#0f172a" />
          </g>
          {/* Motion lines for speed */}
          <path d="M12 25 Q20 20 28 24" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M72 74 Q80 78 88 74" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case 'yacht-dice':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Die 1 (Angle Left) */}
          <g transform="translate(34, 42) rotate(-15) translate(-20, -20)">
            <rect x="0" y="0" width="38" height="38" rx="8" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
            {/* Five dots */}
            <circle cx="10" cy="10" r="3.2" fill="#0f172a" />
            <circle cx="28" cy="10" r="3.2" fill="#0f172a" />
            <circle cx="19" cy="19" r="3.4" fill="#ef4444" />
            <circle cx="10" cy="28" r="3.2" fill="#0f172a" />
            <circle cx="28" cy="28" r="3.2" fill="#0f172a" />
          </g>
          {/* Die 2 (Angle Right, overlapping) */}
          <g transform="translate(64, 60) rotate(16) translate(-19, -19)">
            <rect x="0" y="0" width="38" height="38" rx="8" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
            {/* Four dots */}
            <circle cx="11" cy="11" r="3.2" fill="#0f172a" />
            <circle cx="27" cy="11" r="3.2" fill="#0f172a" />
            <circle cx="11" cy="27" r="3.2" fill="#0f172a" />
            <circle cx="27" cy="27" r="3.2" fill="#0f172a" />
          </g>
          {/* Wooden rolling cup or accent score sheet line */}
          <path d="M16 84 C40 90, 60 90, 84 84" stroke="#d97706" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
        </svg>
      );

    case 'renegade':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Felt green circular board */}
          <rect x="10" y="10" width="80" height="80" rx="16" fill="#15803d" stroke="#166534" strokeWidth="2.5" />
          {/* Subtle grid lines */}
          <line x1="10" y1="50" x2="90" y2="50" stroke="#14532d" strokeWidth="1.5" />
          <line x1="50" y1="10" x2="50" y2="90" stroke="#14532d" strokeWidth="1.5" />
          {/* 4 Reversi Discs in center */}
          {/* Top-Left: Light Marble */}
          <circle cx="36" cy="36" r="11" fill="#fdfcfb" stroke="#cbd5e1" strokeWidth="1.5" />
          <circle cx="36" cy="36" r="8" fill="#f1f5f9" />
          {/* Top-Right: Dark Charcoal */}
          <circle cx="64" cy="36" r="11" fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" />
          <circle cx="64" cy="36" r="8" fill="#334155" />
          {/* Bottom-Left: Dark Charcoal */}
          <circle cx="36" cy="64" r="11" fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" />
          <circle cx="36" cy="64" r="8" fill="#334155" />
          {/* Bottom-Right: Light Marble */}
          <circle cx="64" cy="64" r="11" fill="#fdfcfb" stroke="#cbd5e1" strokeWidth="1.5" />
          <circle cx="64" cy="64" r="8" fill="#f1f5f9" />
          {/* Flipping arrow indicator */}
          <path d="M44 32 C48 26, 52 26, 56 32" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case 'connect-four':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Yellow vertical stand frame */}
          <rect x="12" y="15" width="76" height="66" rx="10" fill="#eab308" stroke="#ca8a04" strokeWidth="2" />
          {/* Stand feet */}
          <path d="M12 78 L8 88 L22 88 L18 78 Z" fill="#ca8a04" />
          <path d="M88 78 L92 88 L78 88 L82 78 Z" fill="#ca8a04" />
          {/* 4x3 Slots with Tokens */}
          {/* Row 1 */}
          <circle cx="28" cy="30" r="7" fill="#1e293b" fillOpacity="0.45" />
          <circle cx="43" cy="30" r="7" fill="#ef4444" />
          <circle cx="58" cy="30" r="7" fill="#1e293b" fillOpacity="0.45" />
          <circle cx="73" cy="30" r="7" fill="#3b82f6" />
          {/* Row 2 */}
          <circle cx="28" cy="48" r="7" fill="#3b82f6" />
          <circle cx="43" cy="48" r="7" fill="#ef4444" />
          <circle cx="58" cy="48" r="7" fill="#3b82f6" />
          <circle cx="73" cy="48" r="7" fill="#ef4444" />
          {/* Row 3 (Bottom) */}
          <circle cx="28" cy="66" r="7" fill="#ef4444" />
          <circle cx="43" cy="66" r="7" fill="#3b82f6" />
          <circle cx="58" cy="66" r="7" fill="#ef4444" />
          <circle cx="73" cy="66" r="7" fill="#3b82f6" />
        </svg>
      );

    case 'air-hockey':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Rink surface */}
          <rect x="15" y="10" width="70" height="80" rx="16" fill="#f8fafc" stroke="#334155" strokeWidth="2.5" />
          {/* Center line & Faceoff circle */}
          <line x1="15" y1="50" x2="85" y2="50" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 2" />
          <circle cx="50" cy="50" r="14" stroke="#ef4444" strokeWidth="2" fill="none" />
          <circle cx="50" cy="50" r="2.5" fill="#ef4444" />
          {/* Top Goal Slot (Red) */}
          <rect x="35" y="8" width="30" height="4" rx="2" fill="#ef4444" />
          {/* Bottom Goal Slot (Blue) */}
          <rect x="35" y="88" width="30" height="4" rx="2" fill="#3b82f6" />
          {/* Top Mallet (P2 Red) */}
          <circle cx="50" cy="30" r="9" fill="#ef4444" stroke="#b91c1c" strokeWidth="2" />
          <circle cx="50" cy="30" r="4" fill="#fca5a5" />
          {/* Bottom Mallet (P1 Blue) */}
          <circle cx="50" cy="70" r="9" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="2" />
          <circle cx="50" cy="70" r="4" fill="#93c5fd" />
          {/* Black Puck with motion speed streak */}
          <circle cx="58" cy="46" r="5" fill="#0f172a" stroke="#ffffff" strokeWidth="1" />
          <line x1="68" y1="42" x2="63" y2="45" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case 'toy-tennis':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Lawn Tennis Court */}
          <rect x="14" y="10" width="72" height="80" rx="8" fill="#16a34a" stroke="#15803d" strokeWidth="2" />
          {/* White Court Lines */}
          <rect x="22" y="16" width="56" height="68" fill="none" stroke="#ffffff" strokeWidth="1.5" />
          <line x1="33" y1="16" x2="33" y2="84" stroke="#ffffff" strokeWidth="1" opacity="0.8" />
          <line x1="67" y1="16" x2="67" y2="84" stroke="#ffffff" strokeWidth="1" opacity="0.8" />
          <line x1="22" y1="34" x2="78" y2="34" stroke="#ffffff" strokeWidth="1" opacity="0.8" />
          <line x1="22" y1="66" x2="78" y2="66" stroke="#ffffff" strokeWidth="1" opacity="0.8" />
          {/* Center Net line */}
          <line x1="14" y1="50" x2="86" y2="50" stroke="#f8fafc" strokeWidth="3" strokeDasharray="2 1" />
          {/* P2 Top Paddle (Red) */}
          <rect x="40" y="13" width="20" height="5" rx="2.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
          {/* P1 Bottom Paddle (Blue) */}
          <rect x="42" y="82" width="20" height="5" rx="2.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1" />
          {/* Tennis Ball with shadow */}
          <ellipse cx="50" cy="46" rx="5" ry="2" fill="#000000" fillOpacity="0.25" />
          <circle cx="50" cy="42" r="4.5" fill="#ccff00" stroke="#84cc16" strokeWidth="1" />
          <path d="M47.5 40 C49 42, 49 44, 47.5 45" stroke="#ffffff" strokeWidth="0.8" fill="none" />
        </svg>
      );

    case 'carrom':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Square Wooden Frame */}
          <rect x="10" y="10" width="80" height="80" rx="8" fill="#c29b68" stroke="#784d1e" strokeWidth="3" />
          {/* Playing Surface */}
          <rect x="16" y="16" width="68" height="68" rx="4" fill="#f5ede0" stroke="#d5b991" strokeWidth="1" />
          {/* 4 Corner Pockets */}
          <circle cx="21" cy="21" r="4.5" fill="#1e293b" />
          <circle cx="79" cy="21" r="4.5" fill="#1e293b" />
          <circle cx="21" cy="79" r="4.5" fill="#1e293b" />
          <circle cx="79" cy="79" r="4.5" fill="#1e293b" />
          {/* Center concentric circles */}
          <circle cx="50" cy="50" r="14" stroke="#e11d48" strokeWidth="1.2" fill="none" strokeDasharray="3 2" />
          <circle cx="50" cy="50" r="5" stroke="#0f172a" strokeWidth="1" fill="none" />
          {/* Queen (Red) */}
          <circle cx="50" cy="50" r="3" fill="#e11d48" />
          {/* Carrom Men (White & Black) */}
          <circle cx="45" cy="47" r="2.8" fill="#ffffff" stroke="#94a3b8" strokeWidth="0.8" />
          <circle cx="55" cy="47" r="2.8" fill="#1e293b" stroke="#0f172a" strokeWidth="0.8" />
          <circle cx="50" cy="56" r="2.8" fill="#ffffff" stroke="#94a3b8" strokeWidth="0.8" />
          {/* Baseline shooting line */}
          <line x1="28" y1="74" x2="72" y2="74" stroke="#94a3b8" strokeWidth="1" />
          <circle cx="28" cy="74" r="2" fill="#ef4444" />
          <circle cx="72" cy="74" r="2" fill="#ef4444" />
          {/* Striker */}
          <circle cx="46" cy="74" r="4.5" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
        </svg>
      );

    case 'gomoku':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Bamboo wood board */}
          <rect x="12" y="12" width="76" height="76" rx="10" fill="#eab308" stroke="#ca8a04" strokeWidth="2.5" />
          <rect x="15" y="15" width="70" height="70" rx="7" fill="#fef08a" opacity="0.6" />
          {/* Grid lines */}
          <line x1="24" y1="24" x2="76" y2="24" stroke="#713f12" strokeWidth="1.2" />
          <line x1="24" y1="37" x2="76" y2="37" stroke="#713f12" strokeWidth="1.2" />
          <line x1="24" y1="50" x2="76" y2="50" stroke="#713f12" strokeWidth="1.2" />
          <line x1="24" y1="63" x2="76" y2="63" stroke="#713f12" strokeWidth="1.2" />
          <line x1="24" y1="76" x2="76" y2="76" stroke="#713f12" strokeWidth="1.2" />
          <line x1="24" y1="24" x2="24" y2="76" stroke="#713f12" strokeWidth="1.2" />
          <line x1="37" y1="24" x2="37" y2="76" stroke="#713f12" strokeWidth="1.2" />
          <line x1="50" y1="24" x2="50" y2="76" stroke="#713f12" strokeWidth="1.2" />
          <line x1="63" y1="24" x2="63" y2="76" stroke="#713f12" strokeWidth="1.2" />
          <line x1="76" y1="24" x2="76" y2="76" stroke="#713f12" strokeWidth="1.2" />
          {/* 5-in-a-row diagonal stones (Black) */}
          <circle cx="24" cy="24" r="5" fill="#0f172a" stroke="#ffffff" strokeWidth="0.8" />
          <circle cx="37" cy="37" r="5" fill="#0f172a" stroke="#ffffff" strokeWidth="0.8" />
          <circle cx="50" cy="50" r="5" fill="#0f172a" stroke="#ffffff" strokeWidth="0.8" />
          <circle cx="63" cy="63" r="5" fill="#0f172a" stroke="#ffffff" strokeWidth="0.8" />
          <circle cx="76" cy="76" r="5" fill="#0f172a" stroke="#ffffff" strokeWidth="0.8" />
          {/* White Opponent stones */}
          <circle cx="37" cy="50" r="5" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
          <circle cx="50" cy="37" r="5" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
          {/* Winning connector beam */}
          <line x1="24" y1="24" x2="76" y2="76" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 2" />
        </svg>
      );

    case 'checkers':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Dark wooden border */}
          <rect x="10" y="10" width="80" height="80" rx="10" fill="#451a03" stroke="#290e02" strokeWidth="2.5" />
          {/* 4x4 mini-checkered board (symbolizing 8x8) */}
          <rect x="16" y="16" width="68" height="68" fill="#fef2f2" />
          {/* Dark squares */}
          <rect x="16" y="16" width="17" height="17" fill="#991b1b" />
          <rect x="50" y="16" width="17" height="17" fill="#991b1b" />
          <rect x="33" y="33" width="17" height="17" fill="#991b1b" />
          <rect x="67" y="33" width="17" height="17" fill="#991b1b" />
          <rect x="16" y="50" width="17" height="17" fill="#991b1b" />
          <rect x="50" y="50" width="17" height="17" fill="#991b1b" />
          <rect x="33" y="67" width="17" height="17" fill="#991b1b" />
          <rect x="67" y="67" width="17" height="17" fill="#991b1b" />
          {/* Checker Pieces */}
          {/* Red King (Crown) */}
          <circle cx="24.5" cy="58.5" r="7" fill="#ef4444" stroke="#ffffff" strokeWidth="1.2" />
          <path d="M21 60 L22.5 56 L24.5 58 L26.5 56 L28 60 Z" fill="#fef08a" />
          {/* Black Checker */}
          <circle cx="41.5" cy="41.5" r="7" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.2" />
          {/* Red Checker */}
          <circle cx="58.5" cy="58.5" r="7" fill="#ef4444" stroke="#ffffff" strokeWidth="1.2" />
          {/* Black King */}
          <circle cx="75.5" cy="41.5" r="7" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.2" />
          <path d="M72 43 L73.5 39 L75.5 41 L77.5 39 L79 43 Z" fill="#fef08a" />
        </svg>
      );

    case 'backgammon':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Wooden Folding Board Frame */}
          <rect x="12" y="12" width="76" height="76" rx="8" fill="#543618" stroke="#38210b" strokeWidth="2.5" />
          <rect x="16" y="16" width="68" height="68" rx="4" fill="#f6ece0" />
          {/* Center Bar divider */}
          <rect x="47" y="16" width="6" height="68" fill="#543618" />
          {/* Top Triangles (Points) */}
          <polygon points="18,16 23,38 28,16" fill="#991b1b" />
          <polygon points="28,16 33,38 38,16" fill="#334155" />
          <polygon points="38,16 43,38 48,16" fill="#991b1b" />
          <polygon points="52,16 57,38 62,16" fill="#334155" />
          <polygon points="62,16 67,38 72,16" fill="#991b1b" />
          <polygon points="72,16 77,38 82,16" fill="#334155" />
          {/* Bottom Triangles (Points) */}
          <polygon points="18,84 23,62 28,84" fill="#334155" />
          <polygon points="28,84 33,62 38,84" fill="#991b1b" />
          <polygon points="38,84 43,62 48,84" fill="#334155" />
          <polygon points="52,84 57,62 62,84" fill="#991b1b" />
          <polygon points="62,84 67,62 72,84" fill="#334155" />
          <polygon points="72,84 77,62 82,84" fill="#991b1b" />
          {/* Checkers Stack (Top Point 1) */}
          <circle cx="23" cy="21" r="3.6" fill="#ffffff" stroke="#94a3b8" strokeWidth="0.8" />
          <circle cx="23" cy="27" r="3.6" fill="#ffffff" stroke="#94a3b8" strokeWidth="0.8" />
          {/* Checkers Stack (Bottom Point 1) */}
          <circle cx="23" cy="79" r="3.6" fill="#0f172a" stroke="#cbd5e1" strokeWidth="0.8" />
          <circle cx="23" cy="73" r="3.6" fill="#0f172a" stroke="#cbd5e1" strokeWidth="0.8" />
          <circle cx="23" cy="67" r="3.6" fill="#0f172a" stroke="#cbd5e1" strokeWidth="0.8" />
          {/* Two dice in center */}
          <rect x="58" y="45" width="10" height="10" rx="2" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.8" />
          <circle cx="63" cy="50" r="1" fill="#ef4444" />
          <rect x="71" y="45" width="10" height="10" rx="2" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.8" />
          <circle cx="73.5" cy="47.5" r="0.8" fill="#0f172a" />
          <circle cx="78.5" cy="52.5" r="0.8" fill="#0f172a" />
        </svg>
      );

    case 'billiards':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Mahogany Rail Frame */}
          <rect x="10" y="14" width="80" height="72" rx="12" fill="#3e1f0c" stroke="#241105" strokeWidth="3" />
          {/* Baize Green Felt Bed */}
          <rect x="18" y="22" width="64" height="56" rx="6" fill="#0b6623" stroke="#064e3b" strokeWidth="1.5" />
          {/* 6 Drop Pockets */}
          <circle cx="19" cy="23" r="4.5" fill="#18181b" stroke="#27272a" strokeWidth="1" />
          <circle cx="81" cy="23" r="4.5" fill="#18181b" stroke="#27272a" strokeWidth="1" />
          <circle cx="50" cy="22" r="3.8" fill="#18181b" stroke="#27272a" strokeWidth="1" />
          <circle cx="19" cy="77" r="4.5" fill="#18181b" stroke="#27272a" strokeWidth="1" />
          <circle cx="81" cy="77" r="4.5" fill="#18181b" stroke="#27272a" strokeWidth="1" />
          <circle cx="50" cy="78" r="3.8" fill="#18181b" stroke="#27272a" strokeWidth="1" />
          {/* Corner Metal Castings */}
          <circle cx="13" cy="17" r="2" fill="#e2e8f0" />
          <circle cx="87" cy="17" r="2" fill="#e2e8f0" />
          <circle cx="13" cy="83" r="2" fill="#e2e8f0" />
          <circle cx="87" cy="83" r="2" fill="#e2e8f0" />
          {/* 8-Ball */}
          <circle cx="56" cy="46" r="6" fill="#09090b" />
          <circle cx="56" cy="46" r="2.8" fill="#ffffff" />
          <text x="56" y="48" fontSize="3.5" fontWeight="bold" fill="#09090b" textAnchor="middle" fontFamily="sans-serif">8</text>
          <circle cx="54" cy="44" r="1.2" fill="#ffffff" fillOpacity="0.8" />
          {/* Solid 1-Ball (Yellow) */}
          <circle cx="68" cy="42" r="5.5" fill="#eab308" />
          <circle cx="66" cy="40.5" r="1" fill="#ffffff" fillOpacity="0.8" />
          {/* Striped 11-Ball (Red) */}
          <circle cx="66" cy="54" r="5.5" fill="#ffffff" />
          <path d="M 61 54 A 5.5 5.5 0 0 0 71 54 Z" fill="#dc2626" />
          {/* White Cue Ball */}
          <circle cx="34" cy="52" r="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.8" />
          <circle cx="32" cy="50" r="1.3" fill="#ffffff" />
          {/* Wooden Cue Stick with chalk tip */}
          <line x1="12" y1="68" x2="28" y2="56" stroke="#92400e" strokeWidth="3" strokeLinecap="round" />
          <line x1="26" y1="57.5" x2="29" y2="55.25" stroke="#fef3c7" strokeWidth="2.5" />
          <circle cx="29" cy="55.25" r="1" fill="#38bdf8" />
        </svg>
      );

    case 'darts':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Rustic Wood Cabinet Backplate */}
          <rect x="8" y="8" width="84" height="84" rx="12" fill="#292524" stroke="#1c1917" strokeWidth="2.5" />
          {/* Outer Dartboard Ring */}
          <circle cx="50" cy="50" r="38" fill="#18181b" stroke="#3f3f46" strokeWidth="2" />
          {/* Outer Single / Double Ring Layer */}
          <circle cx="50" cy="50" r="34" fill="#f5f5f4" stroke="#16a34a" strokeWidth="3" />
          {/* Triple Ring Layer */}
          <circle cx="50" cy="50" r="22" fill="none" stroke="#dc2626" strokeWidth="3" />
          <circle cx="50" cy="50" r="20" fill="#1c1917" />
          {/* Spider Wire Radians */}
          {[0, 18, 36, 54, 72, 90, 108, 126, 144, 162, 180, 198, 216, 234, 252, 270, 288, 306, 324, 342].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const x2 = 50 + Math.cos(rad) * 34;
            const y2 = 50 + Math.sin(rad) * 34;
            return <line key={angle} x1="50" y1="50" x2={x2} y2={y2} stroke="#71717a" strokeWidth="0.8" />;
          })}
          {/* Outer Bull (Green 25) */}
          <circle cx="50" cy="50" r="6" fill="#16a34a" stroke="#22c55e" strokeWidth="0.8" />
          {/* Double Bull (Red 50) */}
          <circle cx="50" cy="50" r="2.8" fill="#dc2626" stroke="#ef4444" strokeWidth="0.8" />
          {/* Dart Stuck in Board (Angles into Triple 20) */}
          <g transform="translate(50, 28) rotate(-22)">
            {/* Dart Shadow */}
            <ellipse cx="2" cy="4" rx="3" ry="1.5" fill="#000000" fillOpacity="0.4" />
            {/* Steel Needle Tip */}
            <line x1="0" y1="0" x2="0" y2="-4" stroke="#cbd5e1" strokeWidth="1.2" />
            {/* Brass Barrel */}
            <rect x="-1.8" y="-14" width="3.6" height="10" rx="1" fill="#eab308" stroke="#ca8a04" strokeWidth="0.6" />
            {/* Shaft */}
            <line x1="0" y1="-14" x2="0" y2="-22" stroke="#475569" strokeWidth="1.2" />
            {/* Red Flight */}
            <polygon points="0,-22 -5,-30 0,-28 5,-30" fill="#dc2626" stroke="#991b1b" strokeWidth="0.6" />
          </g>
        </svg>
      );

    case 'bowling':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Lacquered Maple Alley Planks with perspective */}
          <polygon points="26,12 74,12 88,88 12,88" fill="#d4a373" stroke="#8c5932" strokeWidth="2" />
          {/* Gutters */}
          <polygon points="6,88 12,88 26,12 21,12" fill="#1e293b" />
          <polygon points="74,12 79,12 94,88 88,88" fill="#1e293b" />
          {/* Plank Seams */}
          <line x1="38" y1="12" x2="31" y2="88" stroke="#a27b5c" strokeWidth="1" strokeDasharray="6 3" />
          <line x1="50" y1="12" x2="50" y2="88" stroke="#a27b5c" strokeWidth="1" strokeDasharray="6 3" />
          <line x1="62" y1="12" x2="69" y2="88" stroke="#a27b5c" strokeWidth="1" strokeDasharray="6 3" />
          {/* Target Guide Chevron Arrows */}
          <polygon points="50,48 48,51 52,51" fill="#8c5932" />
          <polygon points="43,53 41,56 45,56" fill="#8c5932" />
          <polygon points="57,53 55,56 59,56" fill="#8c5932" />
          {/* 10 Bowling Pins in Triangle Formation at Top */}
          {/* Row 4 (Back): 4 pins */}
          {[38, 46, 54, 62].map((x) => (
            <g key={x} transform={`translate(${x}, 16)`}>
              <ellipse cx="0" cy="0" rx="2.5" ry="3.8" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.6" />
              <line x1="-2" y1="-0.5" x2="2" y2="-0.5" stroke="#dc2626" strokeWidth="0.8" />
            </g>
          ))}
          {/* Row 3: 3 pins */}
          {[42, 50, 58].map((x) => (
            <g key={x} transform={`translate(${x}, 21)`}>
              <ellipse cx="0" cy="0" rx="2.7" ry="4.2" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.6" />
              <line x1="-2.2" y1="-0.5" x2="2.2" y2="-0.5" stroke="#dc2626" strokeWidth="0.8" />
            </g>
          ))}
          {/* Row 2: 2 pins */}
          {[46, 54].map((x) => (
            <g key={x} transform={`translate(${x}, 26)`}>
              <ellipse cx="0" cy="0" rx="3" ry="4.6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.6" />
              <line x1="-2.4" y1="-0.5" x2="2.4" y2="-0.5" stroke="#dc2626" strokeWidth="0.9" />
            </g>
          ))}
          {/* Row 1 (Headpin): 1 pin */}
          <g transform="translate(50, 31)">
            <ellipse cx="0" cy="0" rx="3.3" ry="5" fill="#ffffff" stroke="#94a3b8" strokeWidth="0.8" />
            <line x1="-2.6" y1="-0.6" x2="2.6" y2="-0.6" stroke="#dc2626" strokeWidth="1" />
          </g>
          {/* Swirling Metallic Blue Bowling Ball approaching pins */}
          <circle cx="50" cy="70" r="11" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="1.2" />
          <path d="M 43 66 Q 50 63 56 68" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" fillOpacity="0.5" />
          {/* 3 Finger Holes */}
          <circle cx="48" cy="67" r="1.4" fill="#0f172a" />
          <circle cx="53" cy="67" r="1.4" fill="#0f172a" />
          <circle cx="50.5" cy="73" r="1.6" fill="#0f172a" />
        </svg>
      );

    case 'mini-shogi':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Paulownia Wood Board Surface */}
          <rect x="10" y="10" width="80" height="80" rx="8" fill="#e8c89b" stroke="#a37844" strokeWidth="2.5" />
          {/* 5x5 Grid Lines */}
          {[26, 42, 58, 74].map((pos) => (
            <React.Fragment key={pos}>
              <line x1={pos} y1="12" x2={pos} y2="88" stroke="#785327" strokeWidth="1" strokeOpacity="0.6" />
              <line x1="12" y1={pos} x2="88" y2={pos} stroke="#785327" strokeWidth="1" strokeOpacity="0.6" />
            </React.Fragment>
          ))}
          {/* Central Pentagonal Boxwood Koma Tile (King / Ou) */}
          <polygon
            points="50,22 68,36 64,74 36,74 32,36"
            fill="#fef3c7"
            stroke="#92400e"
            strokeWidth="2"
          />
          {/* Beveled Edge Highlight */}
          <polygon
            points="50,26 65,37 61,70 39,70 35,37"
            fill="#fffbeb"
          />
          {/* Kanji: 王 (King) */}
          <text
            x="50"
            y="54"
            fontSize="18"
            fontWeight="bold"
            fill="#1c1917"
            textAnchor="middle"
            fontFamily="serif"
          >
            王
          </text>
          {/* English Subtitle */}
          <text
            x="50"
            y="65"
            fontSize="7"
            fontWeight="900"
            fill="#78350f"
            textAnchor="middle"
            fontFamily="sans-serif"
          >
            KING
          </text>
        </svg>
      );

    case 'toy-curling':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Frosted Pebble Ice Sheet Background */}
          <rect x="10" y="10" width="80" height="80" rx="12" fill="#e0f2fe" stroke="#93c5fd" strokeWidth="2.5" />
          {/* Ice Sheet Center Line & Tee Line */}
          <line x1="50" y1="10" x2="50" y2="90" stroke="#bfdbfe" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="10" y1="50" x2="90" y2="50" stroke="#bfdbfe" strokeWidth="1.5" />
          {/* The House (Concentric Target Rings) */}
          {/* 12-foot ring (Blue) */}
          <circle cx="50" cy="50" r="32" fill="#3b82f6" fillOpacity="0.35" stroke="#2563eb" strokeWidth="1.5" />
          {/* 8-foot ring (White) */}
          <circle cx="50" cy="50" r="22" fill="#f8fafc" stroke="#93c5fd" strokeWidth="1.2" />
          {/* 4-foot ring (Red) */}
          <circle cx="50" cy="50" r="12" fill="#ef4444" fillOpacity="0.45" stroke="#dc2626" strokeWidth="1.2" />
          {/* The Button (White/Gold) */}
          <circle cx="50" cy="50" r="4.5" fill="#fef08a" stroke="#ca8a04" strokeWidth="1" />
          {/* P1 Cobalt Blue Granite Stone */}
          <g transform="translate(43, 44)">
            <circle cx="0" cy="0" r="9" fill="#334155" stroke="#1e293b" strokeWidth="1" />
            <circle cx="0" cy="0" r="7.5" fill="#475569" />
            <circle cx="0" cy="0" r="5" fill="#1d4ed8" />
            <path d="M-3 -1 L3 -1 L3 2 L-3 2 Z" fill="#fbbf24" rx="0.5" />
          </g>
          {/* P2 Crimson Red Granite Stone */}
          <g transform="translate(62, 60)">
            <circle cx="0" cy="0" r="9" fill="#334155" stroke="#1e293b" strokeWidth="1" />
            <circle cx="0" cy="0" r="7.5" fill="#475569" />
            <circle cx="0" cy="0" r="5" fill="#dc2626" />
            <path d="M-3 -1 L3 -1 L3 2 L-3 2 Z" fill="#fbbf24" rx="0.5" />
          </g>
        </svg>
      );

    case 'hex':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Mahogany Rhombic Diamond Board Frame */}
          <polygon points="50,10 88,48 50,86 12,48" fill="#3e2312" stroke="#251408" strokeWidth="2.5" />
          {/* Inner Surface with Rhombic Hex Grid */}
          <polygon points="50,14 84,48 50,82 16,48" fill="#58351d" />
          {/* Color Coded Borders: Blue edges (Top-Left & Bottom-Right) */}
          <line x1="14" y1="48" x2="50" y2="12" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
          <line x1="50" y1="84" x2="86" y2="48" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
          {/* Red edges (Top-Right & Bottom-Left) */}
          <line x1="50" y1="12" x2="86" y2="48" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
          <line x1="14" y1="48" x2="50" y2="84" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
          {/* Hex Recesses */}
          {[
            [50, 30], [42, 38], [58, 38], [34, 46], [50, 46], [66, 46],
            [42, 54], [58, 54], [50, 62],
          ].map(([x, y], idx) => (
            <polygon
              key={idx}
              points={`${x},${y - 6} ${x + 5.2},${y - 3} ${x + 5.2},${y + 3} ${x},${y + 6} ${x - 5.2},${y + 3} ${x - 5.2},${y - 3}`}
              fill="#2b180d"
              stroke="#6b4423"
              strokeWidth="0.8"
            />
          ))}
          {/* Translucent Sapphire Gem (P1 Blue) */}
          <circle cx="42" cy="38" r="5.2" fill="#2563eb" stroke="#93c5fd" strokeWidth="1" />
          <circle cx="40.5" cy="36.5" r="1.3" fill="#ffffff" />
          <circle cx="50" cy="46" r="5.2" fill="#2563eb" stroke="#93c5fd" strokeWidth="1" />
          <circle cx="48.5" cy="44.5" r="1.3" fill="#ffffff" />
          {/* Translucent Ruby Gem (P2 Red) */}
          <circle cx="58" cy="38" r="5.2" fill="#dc2626" stroke="#fca5a5" strokeWidth="1" />
          <circle cx="56.5" cy="36.5" r="1.3" fill="#ffffff" />
          <circle cx="42" cy="54" r="5.2" fill="#dc2626" stroke="#fca5a5" strokeWidth="1" />
          <circle cx="40.5" cy="52.5" r="1.3" fill="#ffffff" />
        </svg>
      );

    case 'matching':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Green Baize Table Mat */}
          <rect x="10" y="10" width="80" height="80" rx="14" fill="#065f46" stroke="#044e39" strokeWidth="2.5" />
          {/* Left Card: Face Down Linen Card with Gold Filigree */}
          <g transform="translate(34, 50) rotate(-10) translate(-18, -26)">
            <rect x="0" y="0" width="36" height="52" rx="5" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
            <rect x="2" y="2" width="32" height="48" rx="3.5" fill="#1e3a8a" />
            <rect x="4" y="4" width="28" height="44" rx="2.5" fill="none" stroke="#fbbf24" strokeWidth="1" />
            {/* Gold Filigree Diamond */}
            <polygon points="18,12 28,26 18,40 8,26" fill="none" stroke="#fbbf24" strokeWidth="1" />
            <circle cx="18" cy="26" r="4" fill="#fbbf24" />
          </g>
          {/* Right Card: Face Up Matching Card with Meeple / Artifact Icon */}
          <g transform="translate(62, 50) rotate(12) translate(-18, -26)">
            <rect x="0" y="0" width="36" height="52" rx="5" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
            <rect x="2" y="2" width="32" height="48" rx="3.5" fill="#fffbeb" />
            {/* Tabletop Meeple Symbol */}
            <path
              d="M18,14 A4,4 0 0,1 18,22 A4,4 0 0,1 18,14 M12,25 C14,24 16,23 18,23 C20,23 22,24 24,25 C26,26 27,29 27,31 L24,32 L24,40 L20,40 L18,34 L16,40 L12,40 L12,32 L9,31 C9,29 10,26 12,25 Z"
              fill="#d97706"
              stroke="#b45309"
              strokeWidth="0.8"
            />
            {/* Gold Star Pair Badge */}
            <circle cx="28" cy="10" r="3" fill="#eab308" />
          </g>
        </svg>
      );

    case 'nine-mens-morris':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Blonde Oak Board */}
          <rect x="10" y="10" width="80" height="80" rx="8" fill="#d4a373" stroke="#8c5932" strokeWidth="2.5" />
          {/* Outer Square */}
          <rect x="20" y="20" width="60" height="60" fill="none" stroke="#5c3818" strokeWidth="2" />
          {/* Middle Square */}
          <rect x="30" y="30" width="40" height="40" fill="none" stroke="#5c3818" strokeWidth="2" />
          {/* Inner Square */}
          <rect x="40" y="40" width="20" height="20" fill="none" stroke="#5c3818" strokeWidth="2" />
          {/* Crossbars joining the squares */}
          <line x1="50" y1="20" x2="50" y2="40" stroke="#5c3818" strokeWidth="2" />
          <line x1="50" y1="60" x2="50" y2="80" stroke="#5c3818" strokeWidth="2" />
          <line x1="20" y1="50" x2="40" y2="50" stroke="#5c3818" strokeWidth="2" />
          <line x1="60" y1="50" x2="80" y2="50" stroke="#5c3818" strokeWidth="2" />
          {/* Turned Wood Dark Walnut Pieces (P1) forming a mill */}
          <circle cx="20" cy="20" r="4.5" fill="#271506" stroke="#4a2a11" strokeWidth="1" />
          <circle cx="50" cy="20" r="4.5" fill="#271506" stroke="#4a2a11" strokeWidth="1" />
          <circle cx="80" cy="20" r="4.5" fill="#271506" stroke="#4a2a11" strokeWidth="1" />
          {/* Mill Golden Connector Highlight */}
          <line x1="20" y1="20" x2="80" y2="20" stroke="#eab308" strokeWidth="1.2" strokeDasharray="3 2" />
          {/* Light Maple Pieces (P2) */}
          <circle cx="30" cy="30" r="4.5" fill="#faedcd" stroke="#d4a373" strokeWidth="1" />
          <circle cx="50" cy="30" r="4.5" fill="#faedcd" stroke="#d4a373" strokeWidth="1" />
          <circle cx="40" cy="50" r="4.5" fill="#faedcd" stroke="#d4a373" strokeWidth="1" />
        </svg>
      );

    case 'hare-and-hounds':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Weathered Stone Slab */}
          <rect x="10" y="12" width="80" height="76" rx="10" fill="#475569" stroke="#1e293b" strokeWidth="2.5" />
          {/* Track Nodes and Connecting Paths */}
          {/* Horizontal and Diagonal Runic Paths */}
          <line x1="20" y1="50" x2="38" y2="26" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="20" y1="50" x2="38" y2="50" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="20" y1="50" x2="38" y2="74" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="38" y1="26" x2="38" y2="74" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="38" y1="26" x2="62" y2="26" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="38" y1="50" x2="62" y2="50" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="38" y1="74" x2="62" y2="74" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="62" y1="26" x2="62" y2="74" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="62" y1="26" x2="80" y2="50" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="62" y1="50" x2="80" y2="50" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="62" y1="74" x2="80" y2="50" stroke="#94a3b8" strokeWidth="1.5" />
          {/* Bronze Hounds (P1) */}
          <circle cx="20" cy="50" r="5.5" fill="#78350f" stroke="#b45309" strokeWidth="1.2" />
          <circle cx="20" cy="50" r="2.5" fill="#d97706" />
          <circle cx="38" cy="26" r="5.5" fill="#78350f" stroke="#b45309" strokeWidth="1.2" />
          <circle cx="38" cy="26" r="2.5" fill="#d97706" />
          <circle cx="38" cy="74" r="5.5" fill="#78350f" stroke="#b45309" strokeWidth="1.2" />
          <circle cx="38" cy="74" r="2.5" fill="#d97706" />
          {/* Gleaming Copper Hare (P2) */}
          <circle cx="80" cy="50" r="6" fill="#ea580c" stroke="#fed7aa" strokeWidth="1.5" />
          <circle cx="80" cy="50" r="3" fill="#ffedd5" />
        </svg>
      );

    case 'hit-and-blow':
      return (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          {/* Wooden Console Box */}
          <rect x="12" y="10" width="76" height="80" rx="10" fill="#78350f" stroke="#451a03" strokeWidth="2.5" />
          {/* Metal Faceplate */}
          <rect x="18" y="16" width="64" height="68" rx="6" fill="#1e293b" />
          {/* Top Secret Shield Vault */}
          <rect x="22" y="20" width="56" height="14" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="1" />
          <circle cx="30" cy="27" r="3" fill="#ef4444" />
          <circle cx="43" cy="27" r="3" fill="#3b82f6" />
          <circle cx="56" cy="27" r="3" fill="#22c55e" />
          <circle cx="69" cy="27" r="3" fill="#eab308" />
          {/* Row 1 Guesses */}
          <circle cx="28" cy="46" r="4.2" fill="#ef4444" stroke="#dc2626" strokeWidth="0.8" />
          <circle cx="40" cy="46" r="4.2" fill="#3b82f6" stroke="#2563eb" strokeWidth="0.8" />
          <circle cx="52" cy="46" r="4.2" fill="#a855f7" stroke="#9333ea" strokeWidth="0.8" />
          <circle cx="64" cy="46" r="4.2" fill="#f97316" stroke="#ea580c" strokeWidth="0.8" />
          {/* Clue Pegs for Row 1 (Hits & Blows) */}
          <circle cx="74" cy="43" r="2" fill="#09090b" stroke="#ffffff" strokeWidth="0.5" />
          <circle cx="78" cy="43" r="2" fill="#09090b" stroke="#ffffff" strokeWidth="0.5" />
          <circle cx="74" cy="49" r="2" fill="#f8fafc" stroke="#94a3b8" strokeWidth="0.5" />
          <circle cx="78" cy="49" r="2" fill="#334155" />
          {/* Row 2 Guesses */}
          <circle cx="28" cy="62" r="4.2" fill="#eab308" stroke="#ca8a04" strokeWidth="0.8" />
          <circle cx="40" cy="62" r="4.2" fill="#3b82f6" stroke="#2563eb" strokeWidth="0.8" />
          <circle cx="52" cy="62" r="4.2" fill="#22c55e" stroke="#16a34a" strokeWidth="0.8" />
          <circle cx="64" cy="62" r="4.2" fill="#ef4444" stroke="#dc2626" strokeWidth="0.8" />
          {/* Clue Pegs for Row 2 */}
          <circle cx="74" cy="59" r="2" fill="#09090b" stroke="#ffffff" strokeWidth="0.5" />
          <circle cx="78" cy="59" r="2" fill="#09090b" stroke="#ffffff" strokeWidth="0.5" />
          <circle cx="74" cy="65" r="2" fill="#09090b" stroke="#ffffff" strokeWidth="0.5" />
          <circle cx="78" cy="65" r="2" fill="#f8fafc" stroke="#94a3b8" strokeWidth="0.5" />
          {/* Peg Tray Bottom Line */}
          <rect x="22" y="74" width="56" height="6" rx="2" fill="#334155" />
        </svg>
      );

    default:
      return null;
  }
};
