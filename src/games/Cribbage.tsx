import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader, type GamePlayMode } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import { RemoteDuelModal } from '../components/RemoteDuelModal';
import { GameRulesModal } from '../components/GameRulesModal';
import { TurnTransitionModal } from '../components/TurnTransitionModal';
import { GameContainer } from '../components/GameContainer';
import { multiplayer, type RemoteMessage } from '../utils/multiplayer';
import { useRemoteMultiplayer } from '../hooks/useRemoteMultiplayer';
import type { PlayerNumber } from '../types/game';
import {
  triggerHaptic,
  playWoodClackSound,
  playCardPlaceSound,
  playVictorySound,
  playTapSound,
} from '../utils/feedback';
import { saveMatchState, loadMatchState, clearMatchState } from '../utils/gameStats';
import {
  type CribbageCard,
  SUIT_SYMBOLS,
  createStandardDeck,
  shuffleDeck,
  evaluatePeggingPlay,
  getLegalPeggingCards,
  canPlayerPeg,
  scoreHand,
  checkHisHeels,
  type CribbageHandScore,
} from '../utils/cribbageScoring';
import {
  chooseCribDiscards,
  choosePeggingCard,
} from '../utils/cribbageAi';

export type CribbagePhase =
  | 'dealing'
  | 'discarding'
  | 'cut_reveal'
  | 'pegging'
  | 'show_non_dealer'
  | 'show_dealer'
  | 'show_crib'
  | 'round_complete';

// ============================================================================
// 1. PROCEDURAL PLAYING CARD COMPONENT (Linen finish, crisp pips, royalty art)
// ============================================================================

export const ProceduralCribbageCard: React.FC<{
  card: CribbageCard;
  isSelected?: boolean;
  isPlayable?: boolean;
  isDimmed?: boolean;
  onClick?: () => void;
  small?: boolean;
  tiny?: boolean;
  faceDown?: boolean;
}> = ({
  card,
  isSelected,
  isPlayable,
  isDimmed,
  onClick,
  small = false,
  tiny = false,
  faceDown = false,
}) => {
  const isRed = card.isRed;
  const textColor = isRed ? 'text-rose-600' : 'text-slate-900';

  const w = tiny
    ? 'w-8 sm:w-9 h-11 sm:h-13'
    : small
    ? 'w-11 sm:w-13 h-16 sm:h-18'
    : 'w-14 sm:w-18 md:w-20 h-20 sm:h-26 md:h-28';

  if (faceDown) {
    return (
      <div
        className={`relative ${w} rounded-xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 border-2 border-indigo-400/40 shadow-md flex items-center justify-center p-1 select-none shrink-0 transition-transform`}
      >
        <div className="w-full h-full rounded-lg border border-indigo-500/20 bg-indigo-950/60 flex items-center justify-center">
          <span className="text-amber-400 text-[10px] sm:text-xs font-black opacity-60">✦</span>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick || isDimmed}
      className={`relative ${w} rounded-xl bg-[#fffefc] border-2 select-none transition-all duration-150 transform flex flex-col justify-between p-1 sm:p-1.5 shrink-0 ${
        onClick && !isDimmed ? 'cursor-pointer' : 'cursor-default'
      } ${
        isSelected
          ? 'ring-3 ring-amber-400 -translate-y-3 scale-105 z-30 shadow-2xl border-amber-400'
          : isPlayable
          ? 'border-emerald-400 ring-2 ring-emerald-400/50 shadow-md hover:-translate-y-1 hover:shadow-xl'
          : isDimmed
          ? 'border-stone-300 opacity-45 shadow-xs cursor-not-allowed'
          : 'border-stone-300 shadow-sm'
      }`}
      style={{
        backgroundImage: 'radial-gradient(rgba(0,0,0,0.02) 1px, transparent 0)',
        backgroundSize: '4px 4px',
      }}
    >
      {/* Top Corner Pip */}
      <div className="flex items-center justify-between leading-none z-10 w-full px-0.5">
        <span className={`${tiny ? 'text-[9px]' : 'text-xs sm:text-sm'} font-black ${textColor}`}>
          {card.rankLabel}
        </span>
        <span className={`${tiny ? 'text-[9px]' : 'text-xs sm:text-sm'} font-black ${textColor}`}>
          {SUIT_SYMBOLS[card.suit]}
        </span>
      </div>

      {/* Center Graphic */}
      {!tiny && (
        <div className="flex-1 flex flex-col items-center justify-center pointer-events-none">
          {card.rank === 11 ? (
            <div className="flex flex-col items-center">
              <span className="text-base sm:text-xl font-bold leading-none">⚔️</span>
              <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-tighter ${textColor}`}>JACK</span>
            </div>
          ) : card.rank === 12 ? (
            <div className="flex flex-col items-center">
              <span className="text-base sm:text-xl font-bold leading-none">👑</span>
              <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-tighter ${textColor}`}>QUEEN</span>
            </div>
          ) : card.rank === 13 ? (
            <div className="flex flex-col items-center">
              <span className="text-base sm:text-xl font-bold leading-none">⚜️</span>
              <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-tighter ${textColor}`}>KING</span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className={`text-lg sm:text-2xl leading-none opacity-85 ${textColor}`}>
                {SUIT_SYMBOLS[card.suit]}
              </span>
              <span className="text-[8px] sm:text-[9px] font-bold text-stone-500 leading-none">
                ({card.value}p)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Bottom Inverted Pip */}
      <div className="flex items-center justify-between leading-none z-10 w-full px-0.5 rotate-180">
        <span className={`${tiny ? 'text-[9px]' : 'text-xs sm:text-sm'} font-black ${textColor}`}>
          {card.rankLabel}
        </span>
        <span className={`${tiny ? 'text-[9px]' : 'text-xs sm:text-sm'} font-black ${textColor}`}>
          {SUIT_SYMBOLS[card.suit]}
        </span>
      </div>
    </button>
  );
};

// ============================================================================
// 2. CONTINUOUS 121-POINT WOODEN CRIBBAGE BOARD (Walnut/Cherry, Skunk Markers)
// ============================================================================

/**
 * Calculates continuous (x, y) coordinates for any hole -1..121
 * across 3 streets of 40 holes grouped into 8 blocks of 5 holes per street.
 * Hole -1 & 0 are the two starting holes before the Start line.
 * Track 1: Outer/Top Lane (Polished Brass Pegs / Player 1)
 * Track 2: Inner/Bottom Lane (Brushed Steel Pegs / Player 2)
 */
export const getBoardHoleCoords = (hole: number, track: 1 | 2): { x: number; y: number } => {
  const laneOffset = track === 1 ? -6.2 : 6.2;

  // Helper to compute X position along a 40-hole street with 5-hole block grouping
  const getStreetX = (idxZeroTo39: number, direction: 'right' | 'left'): number => {
    const block = Math.floor(idxZeroTo39 / 5); // 0..7
    const posInBlock = idxZeroTo39 % 5; // 0..4
    // 11.2px between holes in a 5-hole group, plus an extra 10px gap between each 5-hole group
    const offset = block * (4 * 11.2 + 21.2) + posInBlock * 11.2;
    return direction === 'right' ? 54 + offset : 560.8 - offset;
  };

  // Rear Start Hole (Hole -1)
  if (hole < 0) {
    return { x: 20, y: 36 + laneOffset };
  }

  // Front Start Hole (Hole 0)
  if (hole === 0) {
    return { x: 32, y: 36 + laneOffset };
  }

  // Finish Hole (Hole 121 - "Game")
  if (hole >= 121) {
    return { x: 592, y: 148 + (track === 1 ? -4.8 : 4.8) };
  }

  // Street 1: Holes 1 to 40 (Moving Right across top street)
  if (hole <= 40) {
    return {
      x: getStreetX(hole - 1, 'right'),
      y: 36 + laneOffset,
    };
  }

  // Street 2: Holes 41 to 80 (Moving Left across middle street)
  if (hole <= 80) {
    return {
      x: getStreetX(hole - 41, 'left'),
      y: 92 + laneOffset,
    };
  }

  // Street 3: Holes 81 to 120 (Moving Right across bottom street)
  return {
    x: getStreetX(hole - 81, 'right'),
    y: 148 + laneOffset,
  };
};

export const WoodenCribbageBoard: React.FC<{
  scoreP1: number;
  prevScoreP1: number;
  scoreP2: number;
  prevScoreP2: number;
  isExpanded?: boolean;
}> = ({ scoreP1, prevScoreP1, scoreP2, prevScoreP2, isExpanded = false }) => {
  const [isLeapingP1, setIsLeapingP1] = useState(false);
  const [isLeapingP2, setIsLeapingP2] = useState(false);

  useEffect(() => {
    if (scoreP1 > prevScoreP1 && scoreP1 > 0) {
      setIsLeapingP1(true);
      const timer = setTimeout(() => {
        setIsLeapingP1(false);
        playWoodClackSound();
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [scoreP1, prevScoreP1]);

  useEffect(() => {
    if (scoreP2 > prevScoreP2 && scoreP2 > 0) {
      setIsLeapingP2(true);
      const timer = setTimeout(() => {
        setIsLeapingP2(false);
        playWoodClackSound();
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [scoreP2, prevScoreP2]);

  // Generate all 120 static hole points for both lanes + 5-hole block dividers
  const holeMarkers = useMemo(() => {
    const markers: {
      hole: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      dividerX?: number;
      streetY: number;
    }[] = [];
    for (let h = 1; h <= 120; h++) {
      const p1 = getBoardHoleCoords(h, 1);
      const p2 = getBoardHoleCoords(h, 2);
      const streetY = h <= 40 ? 36 : h <= 80 ? 92 : 148;
      // Add a 5-hole block divider after every 5th hole (except the 40th hole at the end of a street)
      let dividerX: number | undefined;
      if (h % 5 === 0 && h % 40 !== 0) {
        const nextP1 = getBoardHoleCoords(h + 1, 1);
        dividerX = (p1.x + nextP1.x) / 2;
      }
      markers.push({ hole: h, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, dividerX, streetY });
    }
    return markers;
  }, []);

  // Compute peg positions (when score is 0, front peg is in hole 0 and rear peg is in hole -1)
  const p1FrontHole = scoreP1 <= 0 ? 0 : Math.min(121, scoreP1);
  const p1BackHole = scoreP1 <= 0 ? -1 : Math.min(121, prevScoreP1);
  const p2FrontHole = scoreP2 <= 0 ? 0 : Math.min(121, scoreP2);
  const p2BackHole = scoreP2 <= 0 ? -1 : Math.min(121, prevScoreP2);

  const p1Front = getBoardHoleCoords(p1FrontHole, 1);
  const p1Back = getBoardHoleCoords(p1BackHole, 1);
  const p2Front = getBoardHoleCoords(p2FrontHole, 2);
  const p2Back = getBoardHoleCoords(p2BackHole, 2);

  // Skunk (90) and Double Skunk (60) exact divider positions
  const dblSkunkX = (getBoardHoleCoords(60, 1).x + getBoardHoleCoords(61, 1).x) / 2;
  const skunkX = (getBoardHoleCoords(90, 1).x + getBoardHoleCoords(91, 1).x) / 2;

  return (
    <div
      className={`w-full ${
        isExpanded ? 'max-w-5xl' : 'max-w-4xl'
      } mx-auto rounded-2xl sm:rounded-3xl p-1 sm:p-1.5 bg-gradient-to-b from-[#33190b] to-[#1e0e05] border-2 sm:border-3 border-[#6b3719] shadow-2xl overflow-hidden select-none relative transition-all duration-200`}
    >
      <svg
        viewBox="0 0 620 184"
        className="w-full h-auto drop-shadow-md block"
        style={{
          touchAction: 'none',
          minHeight: isExpanded ? '138px' : '96px',
        }}
      >
        <defs>
          <style>{`
            @keyframes pegLeapfrogArc {
              0% { transform: translateY(0) scale(1); }
              40% { transform: translateY(-13px) scale(1.38); }
              100% { transform: translateY(0) scale(1); }
            }
            @keyframes pegLeapfrogShadow {
              0% { rx: 5.5px; ry: 5.5px; opacity: 0.6; transform: translateY(0); }
              40% { rx: 8.5px; ry: 8.5px; opacity: 0.22; transform: translateY(7px); }
              100% { rx: 5.5px; ry: 5.5px; opacity: 0.6; transform: translateY(0); }
            }
          `}</style>

          {/* Rich Carved Walnut & Cherry Wood Finish Gradient */}
          <linearGradient id="walnutWood" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5a2d15" />
            <stop offset="30%" stopColor="#43200e" />
            <stop offset="65%" stopColor="#633218" />
            <stop offset="100%" stopColor="#381a0b" />
          </linearGradient>

          {/* Recessed Track Channel Gradient */}
          <linearGradient id="trackChannel" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1b0b04" />
            <stop offset="50%" stopColor="#2a1308" />
            <stop offset="100%" stopColor="#160903" />
          </linearGradient>

          {/* Sunken Drilled Hole Bevel */}
          <radialGradient id="holeDepth" cx="38%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#050201" />
            <stop offset="75%" stopColor="#180a04" />
            <stop offset="100%" stopColor="#4c2512" />
          </radialGradient>

          {/* Polished Brass Peg (Player 1) */}
          <radialGradient id="brassPeg" cx="32%" cy="28%" r="68%">
            <stop offset="0%" stopColor="#fef9c3" />
            <stop offset="35%" stopColor="#facc15" />
            <stop offset="75%" stopColor="#ca8a04" />
            <stop offset="100%" stopColor="#713f12" />
          </radialGradient>

          {/* Brushed Stainless Steel Peg (Player 2 / CPU) */}
          <radialGradient id="steelPeg" cx="32%" cy="28%" r="68%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="38%" stopColor="#e2e8f0" />
            <stop offset="78%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#1e293b" />
          </radialGradient>

          {/* Gold Inlaid Finish Ring */}
          <radialGradient id="finishRing" cx="38%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="55%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#78350f" />
          </radialGradient>
        </defs>

        {/* Board Surface Base Plate */}
        <rect
          x="3"
          y="3"
          width="614"
          height="178"
          rx="20"
          fill="url(#walnutWood)"
          stroke="#854d27"
          strokeWidth="2.5"
        />

        {/* Subtle Inner Brass Pinstripe Frame */}
        <rect
          x="8"
          y="7"
          width="604"
          height="170"
          rx="16"
          fill="none"
          stroke="#d97706"
          strokeWidth="0.9"
          opacity="0.35"
        />

        {/* Carved Serpentine Track Channels (3 Streets) */}
        <path
          d="M 16 36 H 563 Q 596 64 563 92 H 52 Q 19 120 52 148 H 566"
          fill="none"
          stroke="url(#trackChannel)"
          strokeWidth="23"
          strokeLinecap="round"
          opacity="0.88"
        />
        <path
          d="M 16 36 H 563 Q 596 64 563 92 H 52 Q 19 120 52 148 H 566"
          fill="none"
          stroke="#7c421e"
          strokeWidth="24.2"
          strokeLinecap="round"
          opacity="0.28"
        />

        {/* Center Brass Pinstripe Separating Track 1 (Outer/Top) and Track 2 (Inner/Bottom) */}
        <line x1="16" y1="36" x2="564" y2="36" stroke="#f59e0b" strokeWidth="0.8" opacity="0.35" />
        <line x1="51" y1="92" x2="564" y2="92" stroke="#f59e0b" strokeWidth="0.8" opacity="0.35" />
        <line x1="51" y1="148" x2="566" y2="148" stroke="#f59e0b" strokeWidth="0.8" opacity="0.35" />

        {/* Turnaround Curve Arrows */}
        <text x="582" y="68" fill="#fbbf24" fontSize="10" fontWeight="900" textAnchor="middle" opacity="0.65">
          ⤵
        </text>
        <text x="31" y="124" fill="#fbbf24" fontSize="10" fontWeight="900" textAnchor="middle" opacity="0.65">
          ↪
        </text>

        {/* Start Line Marker */}
        <line x1="43" y1="21" x2="43" y2="51" stroke="#fbbf24" strokeWidth="2" strokeDasharray="2.5 2" />
        <text x="41" y="17" fill="#fde047" fontSize="8.5" fontWeight="900" textAnchor="end" letterSpacing="0.5">
          START
        </text>

        {/* Double Skunk Line at 60 */}
        <line
          x1={dblSkunkX}
          y1="76"
          x2={dblSkunkX}
          y2="108"
          stroke="#f87171"
          strokeWidth="2.2"
          strokeDasharray="2.5 2"
        />
        <rect x={dblSkunkX - 28} y="60" width="56" height="12" rx="4" fill="#450a0a" stroke="#ef4444" strokeWidth="0.8" />
        <text x={dblSkunkX} y="68.5" fill="#fca5a5" fontSize="7.5" fontWeight="900" textAnchor="middle">
          2× SKUNK 60
        </text>

        {/* Skunk Line at 90 */}
        <line
          x1={skunkX}
          y1="132"
          x2={skunkX}
          y2="164"
          stroke="#fbbf24"
          strokeWidth="2.2"
          strokeDasharray="2.5 2"
        />
        <rect x={skunkX - 24} y="116" width="48" height="12" rx="4" fill="#451a03" stroke="#f59e0b" strokeWidth="0.8" />
        <text x={skunkX} y="124.5" fill="#fde047" fontSize="7.5" fontWeight="900" textAnchor="middle">
          SKUNK 90
        </text>

        {/* Finish Hole Medallion at 121 */}
        <circle cx="592" cy="148" r="11.5" fill="url(#finishRing)" stroke="#fef08a" strokeWidth="1.5" />
        <circle cx="592" cy="143.2" r="3" fill="url(#holeDepth)" stroke="#451a03" strokeWidth="0.7" />
        <circle cx="592" cy="152.8" r="3" fill="url(#holeDepth)" stroke="#451a03" strokeWidth="0.7" />
        <text x="592" y="131" fill="#fde047" fontSize="8.5" fontWeight="900" textAnchor="middle">
          121 WIN
        </text>

        {/* Two Starting Holes per Track (Holes -1 and 0) */}
        <circle cx="20" cy="29.8" r="2.9" fill="url(#holeDepth)" stroke="#92400e" strokeWidth="0.8" />
        <circle cx="32" cy="29.8" r="2.9" fill="url(#holeDepth)" stroke="#92400e" strokeWidth="0.8" />
        <circle cx="20" cy="42.2" r="2.9" fill="url(#holeDepth)" stroke="#64748b" strokeWidth="0.8" />
        <circle cx="32" cy="42.2" r="2.9" fill="url(#holeDepth)" stroke="#64748b" strokeWidth="0.8" />

        {/* Drilled Track Holes 1..120 & 5-Hole Block Dividers */}
        {holeMarkers.map(({ hole, x1, y1, x2, y2, dividerX, streetY }) => {
          const isMilestone = hole % 5 === 0;
          const isTenth = hole % 10 === 0;
          return (
            <g key={hole}>
              {/* 5-Hole Group Divider Tick */}
              {dividerX !== undefined && hole !== 60 && hole !== 90 && (
                <line
                  x1={dividerX}
                  y1={streetY - 10.5}
                  x2={dividerX}
                  y2={streetY + 10.5}
                  stroke="#d97706"
                  strokeWidth="1.1"
                  opacity="0.55"
                />
              )}

              {/* Outer Track Hole (P1 Brass Lane) */}
              <circle
                cx={x1}
                cy={y1}
                r={isMilestone ? 3.1 : 2.7}
                fill="url(#holeDepth)"
                stroke={isMilestone ? '#b45309' : '#3b1c0b'}
                strokeWidth={isMilestone ? '0.9' : '0.65'}
              />

              {/* Inner Track Hole (P2 Steel Lane) */}
              <circle
                cx={x2}
                cy={y2}
                r={isMilestone ? 3.1 : 2.7}
                fill="url(#holeDepth)"
                stroke={isMilestone ? '#64748b' : '#3b1c0b'}
                strokeWidth={isMilestone ? '0.9' : '0.65'}
              />

              {/* Crisp Milestone Labels Every 5 Holes */}
              {isMilestone && hole !== 60 && hole !== 90 && (
                <text
                  x={x1}
                  y={hole <= 40 ? 18 : hole <= 80 ? 73 : 172}
                  fill={isTenth ? '#fde68a' : '#d6a87c'}
                  fontSize={isTenth ? '9' : '8'}
                  fontWeight="900"
                  textAnchor="middle"
                >
                  {hole}
                </text>
              )}
            </g>
          );
        })}

        {/* PLAYER 1: 3D TAPERED BRASS PEGS (Top/Outer Track) */}
        {/* P1 Back Peg */}
        <g className="transition-all duration-300" style={{ transformOrigin: `${p1Back.x}px ${p1Back.y}px` }}>
          <ellipse cx={p1Back.x + 1.2} cy={p1Back.y + 1.4} rx="4.6" ry="4.6" fill="#000" opacity="0.5" />
          <circle cx={p1Back.x} cy={p1Back.y} r="4.1" fill="url(#brassPeg)" stroke="#78350f" strokeWidth="1" />
          <circle cx={p1Back.x - 1.2} cy={p1Back.y - 1.2} r="1.4" fill="#fff" opacity="0.8" />
        </g>

        {/* P1 Front Peg (Larger 3D Dome with Glow Ring & Live Score Readout) */}
        <g
          className="transition-all duration-300"
          style={{
            transformOrigin: `${p1Front.x}px ${p1Front.y}px`,
            animation: isLeapingP1 ? 'pegLeapfrogArc 450ms cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined,
          }}
        >
          <circle cx={p1Front.x} cy={p1Front.y} r="7.8" fill="#facc15" opacity="0.18" />
          <circle cx={p1Front.x} cy={p1Front.y} r="7.4" fill="none" stroke="#facc15" strokeWidth="1.3" opacity="0.65" />
          <ellipse
            cx={p1Front.x + 1.5}
            cy={p1Front.y + 1.8}
            rx="5.6"
            ry="5.6"
            fill="#000"
            opacity="0.6"
            style={{
              animation: isLeapingP1 ? 'pegLeapfrogShadow 450ms ease-in-out' : undefined,
            }}
          />
          <circle cx={p1Front.x} cy={p1Front.y - 1} r="5.6" fill="url(#brassPeg)" stroke="#713f12" strokeWidth="1.1" />
          <circle cx={p1Front.x - 1.8} cy={p1Front.y - 2.6} r="1.6" fill="#fff" opacity="0.9" />
          {scoreP1 > 0 && (
            <text
              x={p1Front.x}
              y={p1Front.y + 1.2}
              fill="#271203"
              fontSize="6.4"
              fontWeight="900"
              textAnchor="middle"
            >
              {scoreP1}
            </text>
          )}
        </g>

        {/* PLAYER 2: 3D TAPERED STAINLESS STEEL PEGS (Bottom/Inner Track) */}
        {/* P2 Back Peg */}
        <g className="transition-all duration-300" style={{ transformOrigin: `${p2Back.x}px ${p2Back.y}px` }}>
          <ellipse cx={p2Back.x + 1.2} cy={p2Back.y + 1.4} rx="4.6" ry="4.6" fill="#000" opacity="0.5" />
          <circle cx={p2Back.x} cy={p2Back.y} r="4.1" fill="url(#steelPeg)" stroke="#1e293b" strokeWidth="1" />
          <circle cx={p2Back.x - 1.2} cy={p2Back.y - 1.2} r="1.4" fill="#fff" opacity="0.8" />
        </g>

        {/* P2 Front Peg (Larger 3D Dome with Glow Ring & Live Score Readout) */}
        <g
          className="transition-all duration-300"
          style={{
            transformOrigin: `${p2Front.x}px ${p2Front.y}px`,
            animation: isLeapingP2 ? 'pegLeapfrogArc 450ms cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined,
          }}
        >
          <circle cx={p2Front.x} cy={p2Front.y} r="7.8" fill="#e2e8f0" opacity="0.18" />
          <circle cx={p2Front.x} cy={p2Front.y} r="7.4" fill="none" stroke="#e2e8f0" strokeWidth="1.3" opacity="0.65" />
          <ellipse
            cx={p2Front.x + 1.5}
            cy={p2Front.y + 1.8}
            rx="5.6"
            ry="5.6"
            fill="#000"
            opacity="0.6"
            style={{
              animation: isLeapingP2 ? 'pegLeapfrogShadow 450ms ease-in-out' : undefined,
            }}
          />
          <circle cx={p2Front.x} cy={p2Front.y - 1} r="5.6" fill="url(#steelPeg)" stroke="#0f172a" strokeWidth="1.1" />
          <circle cx={p2Front.x - 1.8} cy={p2Front.y - 2.6} r="1.6" fill="#fff" opacity="0.9" />
          {scoreP2 > 0 && (
            <text
              x={p2Front.x}
              y={p2Front.y + 1.2}
              fill="#0f172a"
              fontSize="6.4"
              fontWeight="900"
              textAnchor="middle"
            >
              {scoreP2}
            </text>
          )}
        </g>
      </svg>
    </div>
  );
};

// ============================================================================
// 3. MAIN CRIBBAGE MODULE COMPONENT
// ============================================================================

export const Cribbage: React.FC = () => {
  const { setGameStatus, resetToMenu, gameMode: ctxGameMode, setGameMode: setCtxGameMode } = useGame();

  // Mode Selection & Modals
  const [gamePlayMode, setGamePlayMode] = useState<GamePlayMode>(
    ctxGameMode === 'pvp' ? 'pass-and-play' : 'vs-cpu'
  );
  const [showRemoteModal, setShowRemoteModal] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [passPhonePlayer, setPassPhonePlayer] = useState<PlayerNumber | null>(null);

  // Scores (Target: 121 pts)
  const [scoreP1, setScoreP1] = useState<number>(0);
  const [prevScoreP1, setPrevScoreP1] = useState<number>(0);
  const [scoreP2, setScoreP2] = useState<number>(0);
  const [prevScoreP2, setPrevScoreP2] = useState<number>(0);

  // Match State Machine
  const [dealer, setDealer] = useState<PlayerNumber>(1); // Dealer owns the Crib
  const [turn, setTurn] = useState<PlayerNumber>(2); // Non-dealer acts/leads first
  const [phase, setPhase] = useState<CribbagePhase>('dealing');

  // Dealt Hands (6 cards -> 4 kept cards) & Crib (4 discarded cards)
  const [handP1, setHandP1] = useState<CribbageCard[]>([]);
  const [handP2, setHandP2] = useState<CribbageCard[]>([]);
  const [crib, setCrib] = useState<CribbageCard[]>([]);
  const [starterCut, setStarterCut] = useState<CribbageCard | null>(null);

  // Discard Selection (Exactly 2 cards into Crib)
  const [selectedDiscards, setSelectedDiscards] = useState<string[]>([]);
  const [p1DiscardReady, setP1DiscardReady] = useState<boolean>(false);
  const [p2DiscardReady, setP2DiscardReady] = useState<boolean>(false);

  // Remote Opponent Card Count (Masking private cards from opponent client)
  const [remoteOpponentCardCount, setRemoteOpponentCardCount] = useState<number>(6);

  // Pegging Phase State (The Play to 31)
  const [peggingHandP1, setPeggingHandP1] = useState<CribbageCard[]>([]);
  const [peggingHandP2, setPeggingHandP2] = useState<CribbageCard[]>([]);
  const [currentRunningCount, setCurrentRunningCount] = useState<number>(0);
  const [activeCycleSequence, setActiveCycleSequence] = useState<CribbageCard[]>([]);
  const [peggingHistory, setPeggingHistory] = useState<{ card: CribbageCard; player: PlayerNumber; count: number }[]>([]);
  const [lastPlayerToPeg, setLastPlayerToPeg] = useState<PlayerNumber | null>(null);
  const [p1SaidGo, setP1SaidGo] = useState<boolean>(false);
  const [p2SaidGo, setP2SaidGo] = useState<boolean>(false);
  const [isCycleResetting, setIsCycleResetting] = useState<boolean>(false);

  // The Show Breakdown & Interactive Player Scoring State
  const [activeShowScore, setActiveShowScore] = useState<{
    player: PlayerNumber;
    title: string;
    hand: CribbageCard[];
    score: CribbageHandScore;
    isCrib: boolean;
  } | null>(null);
  const [isShowStepScored, setIsShowStepScored] = useState<boolean>(false);
  const [claimedShowPoints, setClaimedShowPoints] = useState<number>(0);
  const [showSelectedCardIds, setShowSelectedCardIds] = useState<string[]>([]);
  const [claimedComboIndices, setClaimedComboIndices] = useState<number[]>([]);
  const [showCountFeedback, setShowCountFeedback] = useState<{
    type: 'exact' | 'mismatch' | 'revealed';
    message: string;
  } | null>(null);
  const [isBoardExpanded, setIsBoardExpanded] = useState<boolean>(false);
  const [targetScore, setTargetScore] = useState<61 | 121>(121);
  const [mugginsEnabled, setMugginsEnabled] = useState<boolean>(false);

  // Status & Alerts
  const [statusMessage, setStatusMessage] = useState<string>('Select 2 cards to toss into the Crib.');
  const [peggingCallout, setPeggingCallout] = useState<string | null>(null);
  const [winner, setWinner] = useState<PlayerNumber | null>(null);

  // Ref to hold latest state for async callbacks & network handlers without triggering re-renders
  const stateRef = useRef({
    scoreP1,
    scoreP2,
    prevScoreP1,
    prevScoreP2,
    dealer,
    turn,
    phase,
    starterCut,
    handP1,
    handP2,
    crib,
    p1DiscardReady,
    p2DiscardReady,
    peggingHandP1,
    peggingHandP2,
    currentRunningCount,
    activeCycleSequence,
    lastPlayerToPeg,
    p1SaidGo,
    p2SaidGo,
    isCycleResetting,
    winner,
    gamePlayMode,
    targetScore,
    mugginsEnabled,
  });

  useEffect(() => {
    stateRef.current = {
      scoreP1,
      scoreP2,
      prevScoreP1,
      prevScoreP2,
      dealer,
      turn,
      phase,
      starterCut,
      handP1,
      handP2,
      crib,
      p1DiscardReady,
      p2DiscardReady,
      peggingHandP1,
      peggingHandP2,
      currentRunningCount,
      activeCycleSequence,
      lastPlayerToPeg,
      p1SaidGo,
      p2SaidGo,
      isCycleResetting,
      winner,
      gamePlayMode,
      targetScore,
      mugginsEnabled,
    };
  });

  // Track active timeouts so we can cancel them cleanly on reset/unmount
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  // -------------------------------------------------------------------------
  // Unified Remote Multiplayer Hook
  // -------------------------------------------------------------------------
  const {
    localPlayer,
    isMyTurn,
    latency,
    peerPresence,
    turnTimeRemaining,
    isAwaitingServer,
    setIsAwaitingServer,
  } = useRemoteMultiplayer({
    gameId: 'cribbage',
    turn: typeof turn === 'number' ? turn : 0,
    gameMode: gamePlayMode,
    onTurnTimeout: () => {
      if (isMyTurn && stateRef.current.winner === null) {
        if (stateRef.current.phase === 'discarding') {
          const myH = localPlayer === 1 ? stateRef.current.handP1 : stateRef.current.handP2;
          if (myH.length >= 2) {
            handleConfirmDiscards([myH[0], myH[1]]);
          }
        } else if (stateRef.current.phase === 'pegging' && !stateRef.current.isCycleResetting) {
          const myH = localPlayer === 1 ? stateRef.current.peggingHandP1 : stateRef.current.peggingHandP2;
          const legals = getLegalPeggingCards(myH, stateRef.current.currentRunningCount);
          if (legals.length > 0) {
            handlePlayPeggingCard(legals[0]);
          } else {
            handleDeclareGo();
          }
        }
      }
    },
    onPeerForfeit: () => {
      setWinner(localPlayer);
      setStatusMessage('Opponent disconnected past grace period. VICTORY!');
      playVictorySound();
      triggerHaptic('success');
    },
  });

  const getPlayerLabel = useCallback(
    (p: PlayerNumber): string => {
      if (gamePlayMode === 'vs-cpu') return p === 1 ? 'Player 1' : '🤖 CPU';
      if (gamePlayMode === 'remote') return p === localPlayer ? `You (P${p})` : `Opponent (P${p})`;
      return `Player ${p}`;
    },
    [gamePlayMode, localPlayer]
  );

  // -------------------------------------------------------------------------
  // Award Points & Check Immediate Target-Score Walk-Off Win (121 or 61 pts)
  // -------------------------------------------------------------------------
  const addPoints = useCallback(
    (player: PlayerNumber, pts: number, reason = ''): boolean => {
      if (pts <= 0 || stateRef.current.winner !== null) return stateRef.current.winner !== null;

      playWoodClackSound();
      triggerHaptic('medium');

      if (reason) {
        setPeggingCallout(reason);
        scheduleTimeout(() => setPeggingCallout(null), 2400);
      }

      const goal = stateRef.current.targetScore;

      if (player === 1) {
        const prev = stateRef.current.scoreP1;
        const next = prev + pts;
        stateRef.current.prevScoreP1 = prev;
        stateRef.current.scoreP1 = next;
        setPrevScoreP1(prev);
        setScoreP1(next);
        if (next >= goal) {
          stateRef.current.winner = 1;
          setWinner(1);
          playVictorySound();
          return true;
        }
      } else {
        const prev = stateRef.current.scoreP2;
        const next = prev + pts;
        stateRef.current.prevScoreP2 = prev;
        stateRef.current.scoreP2 = next;
        setPrevScoreP2(prev);
        setScoreP2(next);
        if (next >= goal) {
          stateRef.current.winner = 2;
          setWinner(2);
          playVictorySound();
          return true;
        }
      }
      return false;
    },
    [scheduleTimeout]
  );

  // -------------------------------------------------------------------------
  // Start New Round / Deal (Stable callback — does NOT re-trigger on score changes!)
  // -------------------------------------------------------------------------
  const startNewRound = useCallback(
    (explicitDealer?: PlayerNumber, explicitMode?: GamePlayMode, resetScores = false) => {
      clearAllTimers();
      const activeMode = explicitMode ?? stateRef.current.gamePlayMode;
      const nextDealer: PlayerNumber =
        explicitDealer !== undefined ? explicitDealer : stateRef.current.dealer === 1 ? 2 : 1;
      const nonDealer: PlayerNumber = nextDealer === 1 ? 2 : 1;

      const deck = shuffleDeck(createStandardDeck());
      const p1Dealt = deck.slice(0, 6).sort((a, b) => a.rank - b.rank);
      const p2Dealt = deck.slice(6, 12).sort((a, b) => a.rank - b.rank);
      const starter = deck[12];

      setDealer(nextDealer);
      setTurn(activeMode === 'pass-and-play' ? 1 : nonDealer);
      setHandP1(p1Dealt);
      setHandP2(p2Dealt);
      setCrib([]);
      setStarterCut(starter);
      setSelectedDiscards([]);
      setP1DiscardReady(false);
      setP2DiscardReady(false);
      setRemoteOpponentCardCount(6);
      setPhase('discarding');
      setPassPhonePlayer(null);

      // Pegging & Show resets
      setPeggingHandP1([]);
      setPeggingHandP2([]);
      setCurrentRunningCount(0);
      setActiveCycleSequence([]);
      setPeggingHistory([]);
      setLastPlayerToPeg(null);
      setP1SaidGo(false);
      setP2SaidGo(false);
      setIsCycleResetting(false);
      setActiveShowScore(null);
      setIsShowStepScored(false);
      setClaimedShowPoints(0);
      setShowSelectedCardIds([]);
      setClaimedComboIndices([]);
      setShowCountFeedback(null);
      setPeggingCallout(null);

      const dealerName = nextDealer === 1 ? 'Player 1' : activeMode === 'vs-cpu' ? '🤖 CPU' : 'Player 2';
      if (activeMode === 'pass-and-play') {
        setStatusMessage(`New Deal! ${dealerName} owns the Crib. Player 1: select 2 cards to toss to the Crib.`);
      } else {
        setStatusMessage(`New Deal! ${dealerName} owns the Crib. Select 2 cards to toss into the Crib.`);
      }

      if (activeMode === 'remote' && localPlayer === 1) {
        multiplayer.send({
          type: 'CRIBBAGE_ACTION',
          gameId: 'cribbage',
          payload: {
            action: 'DEAL',
            guestHand: p2Dealt,
            dealer: nextDealer,
            scoreP1: resetScores ? 0 : stateRef.current.scoreP1,
            scoreP2: resetScores ? 0 : stateRef.current.scoreP2,
            prevScoreP1: resetScores ? 0 : stateRef.current.prevScoreP1,
            prevScoreP2: resetScores ? 0 : stateRef.current.prevScoreP2,
            opponentCardCount: 6,
          },
        });
      }
    },
    [clearAllTimers, localPlayer]
  );

  // Full Match Reset (0 - 0)
  const resetGame = useCallback(
    (explicitMode?: GamePlayMode) => {
      clearAllTimers();
      clearMatchState('cribbage');
      stateRef.current.scoreP1 = 0;
      stateRef.current.prevScoreP1 = 0;
      stateRef.current.scoreP2 = 0;
      stateRef.current.prevScoreP2 = 0;
      stateRef.current.winner = null;
      setScoreP1(0);
      setPrevScoreP1(0);
      setScoreP2(0);
      setPrevScoreP2(0);
      setWinner(null);
      setGameStatus('active');
      startNewRound(1, explicitMode, true);
    },
    [clearAllTimers, setGameStatus, startNewRound]
  );

  // Run initial deal or restore saved match ONLY once on mount
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      const saved = loadMatchState<{
        scoreP1: number;
        scoreP2: number;
        prevScoreP1: number;
        prevScoreP2: number;
        dealer: PlayerNumber;
        turn: PlayerNumber;
        phase: CribbagePhase;
        handP1: CribbageCard[];
        handP2: CribbageCard[];
        crib: CribbageCard[];
        starterCut: CribbageCard | null;
        p1DiscardReady: boolean;
        p2DiscardReady: boolean;
        peggingHandP1: CribbageCard[];
        peggingHandP2: CribbageCard[];
        currentRunningCount: number;
        activeCycleSequence: CribbageCard[];
        peggingHistory: { card: CribbageCard; player: PlayerNumber; count: number }[];
        targetScore?: 61 | 121;
        mugginsEnabled?: boolean;
      }>('cribbage');

      if (saved && saved.handP1 && saved.handP1.length > 0 && saved.phase !== 'round_complete') {
        stateRef.current.scoreP1 = saved.scoreP1;
        stateRef.current.scoreP2 = saved.scoreP2;
        stateRef.current.prevScoreP1 = saved.prevScoreP1;
        stateRef.current.prevScoreP2 = saved.prevScoreP2;
        setScoreP1(saved.scoreP1);
        setScoreP2(saved.scoreP2);
        setPrevScoreP1(saved.prevScoreP1);
        setPrevScoreP2(saved.prevScoreP2);
        setDealer(saved.dealer);
        setTurn(saved.turn);
        setPhase(saved.phase === 'cut_reveal' ? 'pegging' : saved.phase);
        setHandP1(saved.handP1);
        setHandP2(saved.handP2);
        setCrib(saved.crib);
        setStarterCut(saved.starterCut);
        setP1DiscardReady(saved.p1DiscardReady);
        setP2DiscardReady(saved.p2DiscardReady);
        setPeggingHandP1(saved.peggingHandP1);
        setPeggingHandP2(saved.peggingHandP2);
        setCurrentRunningCount(saved.currentRunningCount);
        setActiveCycleSequence(saved.activeCycleSequence);
        setPeggingHistory(saved.peggingHistory || []);
        if (saved.targetScore) setTargetScore(saved.targetScore);
        if (saved.mugginsEnabled !== undefined) setMugginsEnabled(saved.mugginsEnabled);
        setStatusMessage('Resumed saved Cribbage match!');
      } else {
        resetGame();
      }
    }
  }, [resetGame]);

  // Auto-save active match state on changes
  useEffect(() => {
    if (!didMountRef.current || gamePlayMode === 'remote' || winner !== null) return;
    if (scoreP1 === 0 && scoreP2 === 0 && phase === 'discarding' && !p1DiscardReady) return;
    saveMatchState('cribbage', {
      scoreP1,
      scoreP2,
      prevScoreP1,
      prevScoreP2,
      dealer,
      turn,
      phase,
      handP1,
      handP2,
      crib,
      starterCut,
      p1DiscardReady,
      p2DiscardReady,
      peggingHandP1,
      peggingHandP2,
      currentRunningCount,
      activeCycleSequence,
      peggingHistory,
      targetScore,
      mugginsEnabled,
    });
  }, [
    scoreP1,
    scoreP2,
    prevScoreP1,
    prevScoreP2,
    dealer,
    turn,
    phase,
    handP1,
    handP2,
    crib,
    starterCut,
    p1DiscardReady,
    p2DiscardReady,
    peggingHandP1,
    peggingHandP2,
    currentRunningCount,
    activeCycleSequence,
    peggingHistory,
    targetScore,
    mugginsEnabled,
    gamePlayMode,
    winner,
  ]);

  // -------------------------------------------------------------------------
  // Starter Cut Reveal & His Heels Check
  // -------------------------------------------------------------------------
  const proceedToStarterCut = useCallback(
    (p1Cards: CribbageCard[], p2Cards: CribbageCard[]) => {
      setPhase('cut_reveal');
      playCardPlaceSound();

      const starter = stateRef.current.starterCut;
      const curDealer = stateRef.current.dealer;
      const activeMode = stateRef.current.gamePlayMode;
      if (!starter) return;

      const isHeels = checkHisHeels(starter);
      const dealerName = getPlayerLabel(curDealer);

      if (isHeels) {
        setStatusMessage(`Starter Cut is ${starter.rankLabel}${SUIT_SYMBOLS[starter.suit]}! Two for His Heels (+2 to ${dealerName})!`);
        scheduleTimeout(() => {
          addPoints(curDealer, 2, `Two for His Heels! (+2 ${dealerName === '🤖 CPU' ? 'CPU' : `P${curDealer}`})`);
        }, 450);
      } else {
        setStatusMessage(`Starter Cut revealed: ${starter.rankLabel}${SUIT_SYMBOLS[starter.suit]}!`);
      }

      // If Remote Mode & Host: Broadcast Cut Card to Guest
      if (activeMode === 'remote' && localPlayer === 1) {
        const s1 = isHeels && curDealer === 1 ? stateRef.current.scoreP1 + 2 : stateRef.current.scoreP1;
        const s2 = isHeels && curDealer === 2 ? stateRef.current.scoreP2 + 2 : stateRef.current.scoreP2;
        multiplayer.send({
          type: 'CRIBBAGE_ACTION',
          gameId: 'cribbage',
          payload: {
            action: 'REVEAL_CUT',
            starterCut: starter,
            hisHeels: isHeels,
            dealer: curDealer,
            scoreP1: s1,
            scoreP2: s2,
            opponentCardCount: 4,
          },
        });
      }

      // Advance to Pegging Phase after Cut Card reveal pause (unless His Heels won the game!)
      scheduleTimeout(() => {
        if (stateRef.current.winner !== null) return;
        setPeggingHandP1(p1Cards);
        setPeggingHandP2(p2Cards);
        setPhase('pegging');
        const nonDealer: PlayerNumber = curDealer === 1 ? 2 : 1;
        setTurn(nonDealer);
        if (activeMode === 'pass-and-play') {
          setPassPhonePlayer(nonDealer);
        }
        const leadName = getPlayerLabel(nonDealer);
        setStatusMessage(`The Play to 31! ${leadName} leads the first card.`);
      }, 1300);
    },
    [addPoints, getPlayerLabel, localPlayer, scheduleTimeout]
  );

  // -------------------------------------------------------------------------
  // CPU Discard Selection (Cleanly cancelled if re-rendered in StrictMode)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (gamePlayMode === 'vs-cpu' && phase === 'discarding' && !p2DiscardReady && handP2.length === 6) {
      const cpuDiscards = chooseCribDiscards(handP2, dealer === 2);
      const remainingHandP2 = handP2.filter((c) => !cpuDiscards.some((d) => d.id === c.id));

      const timer = setTimeout(() => {
        setHandP2(remainingHandP2);
        setCrib((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const uniqueNew = cpuDiscards.filter((c) => !existingIds.has(c.id));
          return [...prev, ...uniqueNew];
        });
        setP2DiscardReady(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [gamePlayMode, phase, p2DiscardReady, handP2, dealer]);

  // Trigger Starter Cut automatically once BOTH players have discarded 2 cards
  useEffect(() => {
    if (phase === 'discarding' && p1DiscardReady && p2DiscardReady) {
      if (gamePlayMode !== 'remote' || localPlayer === 1) {
        if (handP1.length === 4 && (gamePlayMode === 'remote' || handP2.length === 4)) {
          proceedToStarterCut(handP1, handP2);
        }
      }
    }
  }, [phase, p1DiscardReady, p2DiscardReady, gamePlayMode, localPlayer, handP1, handP2, proceedToStarterCut]);

  // -------------------------------------------------------------------------
  // Discard Handling (Local Human)
  // -------------------------------------------------------------------------
  const handleToggleDiscardSelection = (cardId: string) => {
    if (phase !== 'discarding') return;
    triggerHaptic('light');

    setSelectedDiscards((prev) => {
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId);
      }
      if (prev.length < 2) {
        return [...prev, cardId];
      }
      return [prev[1], cardId];
    });
  };

  const handleConfirmDiscards = (cardsToDiscard?: CribbageCard[]) => {
    if (phase !== 'discarding') return;

    const actingPlayer: PlayerNumber =
      gamePlayMode === 'remote'
        ? localPlayer
        : gamePlayMode === 'pass-and-play' && p1DiscardReady
        ? 2
        : 1;

    let discarded: CribbageCard[] = [];
    if (cardsToDiscard) {
      discarded = cardsToDiscard;
    } else {
      if (selectedDiscards.length !== 2) return;
      const actingHand = actingPlayer === 1 ? handP1 : handP2;
      discarded = actingHand.filter((c) => selectedDiscards.includes(c.id));
    }

    if (discarded.length !== 2) return;

    playCardPlaceSound();
    triggerHaptic('medium');

    if (actingPlayer === 1) {
      const nextHandP1 = handP1.filter((c) => !discarded.some((d) => d.id === c.id));
      setHandP1(nextHandP1);
      setCrib((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        return [...prev, ...discarded.filter((c) => !existingIds.has(c.id))];
      });
      setSelectedDiscards([]);
      setP1DiscardReady(true);

      if (gamePlayMode === 'vs-cpu') {
        if (!p2DiscardReady) {
          setStatusMessage('Cards tossed to Crib! Waiting for 🤖 CPU to discard...');
        }
      } else if (gamePlayMode === 'pass-and-play') {
        if (!p2DiscardReady) {
          setTurn(2);
          setPassPhonePlayer(2);
          setStatusMessage('Player 1 discarded. Pass to Player 2 to select 2 Crib cards.');
        }
      } else if (gamePlayMode === 'remote') {
        multiplayer.send({
          type: 'CRIBBAGE_ACTION',
          gameId: 'cribbage',
          payload: {
            action: 'HOST_DISCARD_READY',
          },
        });
        if (!p2DiscardReady) {
          setStatusMessage('Your 2 cards tossed to Crib. Awaiting opponent discards...');
        }
      }
    } else {
      // Player 2 discarding
      const nextHandP2 = handP2.filter((c) => !discarded.some((d) => d.id === c.id));
      setHandP2(nextHandP2);
      setCrib((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        return [...prev, ...discarded.filter((c) => !existingIds.has(c.id))];
      });
      setSelectedDiscards([]);
      setP2DiscardReady(true);

      if (gamePlayMode === 'remote') {
        multiplayer.send({
          type: 'CRIBBAGE_ACTION',
          gameId: 'cribbage',
          payload: {
            action: 'GUEST_DISCARD',
            discardedCards: discarded,
          },
        });
        setStatusMessage('Your 2 cards tossed to Crib. Awaiting Cut Card reveal...');
      }
    }
  };

  // -------------------------------------------------------------------------
  // The Show: Hand & Crib Counting in Strict Tournament Order
  // (Non-Dealer Hand -> Dealer Hand -> Dealer's Crib)
  // Human players count & peg their own hands; CPU counts automatically!
  // -------------------------------------------------------------------------
  const configureShowStep = useCallback(
    (
      nextPhase: 'show_non_dealer' | 'show_dealer' | 'show_crib',
      stepOwner: PlayerNumber,
      title: string,
      cardsToScore: CribbageCard[],
      starter: CribbageCard,
      isCrib: boolean
    ) => {
      const computedScore = scoreHand(cardsToScore, starter, isCrib);
      const ownerLabel = getPlayerLabel(stepOwner);
      const activeMode = stateRef.current.gamePlayMode;
      const isCpuOwner = activeMode === 'vs-cpu' && stepOwner === 2;

      setPhase(nextPhase);
      setTurn(stepOwner);
      setActiveShowScore({
        player: stepOwner,
        title,
        hand: cardsToScore,
        score: computedScore,
        isCrib,
      });
      setClaimedShowPoints(0);
      setShowSelectedCardIds([]);
      setClaimedComboIndices([]);

      if (isCpuOwner) {
        // CPU automatically scores and pegs its own Hand / Crib
        setIsShowStepScored(true);
        setShowCountFeedback({
          type: 'exact',
          message: `🤖 CPU counted +${computedScore.total} pts automatically.`,
        });
        setStatusMessage(`The Show: ${ownerLabel} counts ${isCrib ? 'Crib' : 'Hand'} (+${computedScore.total} pts).`);
        addPoints(stepOwner, computedScore.total, `${ownerLabel} ${isCrib ? 'Crib' : 'Hand'}: +${computedScore.total} pts`);
      } else {
        // Human player counts & pegs their own Hand / Crib!
        setIsShowStepScored(false);
        setShowCountFeedback(null);
        setStatusMessage(`The Show: ${ownerLabel}, count your ${isCrib ? 'Crib' : 'Hand'} and peg your points!`);
      }
    },
    [addPoints, getPlayerLabel]
  );

  const startTheShow = useCallback(() => {
    const starter = stateRef.current.starterCut;
    if (!starter || stateRef.current.winner !== null) return;

    const curDealer = stateRef.current.dealer;
    const nonDealer: PlayerNumber = curDealer === 1 ? 2 : 1;
    const nonDealerHand = nonDealer === 1 ? stateRef.current.handP1 : stateRef.current.handP2;
    const nonDealerLabel = getPlayerLabel(nonDealer);

    configureShowStep(
      'show_non_dealer',
      nonDealer,
      `${nonDealerLabel}'s Hand (Non-Dealer Counts First)`,
      nonDealerHand,
      starter,
      false
    );

    if (stateRef.current.gamePlayMode === 'remote' && localPlayer === 1) {
      multiplayer.send({
        type: 'CRIBBAGE_ACTION',
        gameId: 'cribbage',
        payload: {
          action: 'START_SHOW',
          hostHand: stateRef.current.handP1,
          guestHand: stateRef.current.handP2,
          crib: stateRef.current.crib,
          starterCut: starter,
        },
      });
    }
  }, [configureShowStep, getPlayerLabel, localPlayer]);

  // Tap-to-Claim Selected Card Combination Checklist Handler
  const handleClaimSelectedCombo = () => {
    if (!activeShowScore || isShowStepScored || showSelectedCardIds.length === 0) return;

    const matchIdx = activeShowScore.score.items.findIndex((item, idx) => {
      if (claimedComboIndices.includes(idx)) return false;
      if (item.cards.length !== showSelectedCardIds.length) return false;
      return item.cards.every((c) => showSelectedCardIds.includes(c.id));
    });

    if (matchIdx !== -1) {
      const matched = activeShowScore.score.items[matchIdx];
      playTapSound();
      triggerHaptic('medium');
      setClaimedComboIndices((prev) => [...prev, matchIdx]);
      setClaimedShowPoints((prev) => prev + matched.points);
      setShowSelectedCardIds([]);
      setShowCountFeedback({
        type: 'exact',
        message: `✅ Claimed ${matched.description} (+${matched.points} pts)!`,
      });
    } else {
      triggerHaptic('heavy');
      setShowCountFeedback({
        type: 'mismatch',
        message: 'Selected cards do not form a new unclaimed 15, Pair, Run, Flush, or His Nobs.',
      });
    }
  };

  // Human Player Submits Their Claimed Hand/Crib Score
  const handleSubmitHumanShowScore = () => {
    if (!activeShowScore || isShowStepScored) return;

    const actualTotal = activeShowScore.score.total;
    const ownerLabel = getPlayerLabel(activeShowScore.player);
    const kindLabel = activeShowScore.isCrib ? 'Crib' : 'Hand';

    if (claimedShowPoints === actualTotal) {
      playTapSound();
      setIsShowStepScored(true);
      setShowCountFeedback({
        type: 'exact',
        message:
          actualTotal === 0
            ? '✅ Spot on! Nineteen (0 points)!'
            : `🎯 Spot on! You counted all +${actualTotal} pts!`,
      });
      setStatusMessage(`${ownerLabel} pegged +${actualTotal} pts for ${kindLabel}!`);
      addPoints(activeShowScore.player, actualTotal, `${ownerLabel} ${kindLabel}: +${actualTotal} pts`);

      if (gamePlayMode === 'remote') {
        multiplayer.send({
          type: 'CRIBBAGE_ACTION',
          gameId: 'cribbage',
          payload: {
            action: 'SHOW_SCORE_PEGGED',
            player: activeShowScore.player,
            points: actualTotal,
          },
        });
      }
    } else if (mugginsEnabled && claimedShowPoints < actualTotal) {
      // MUGGINS RULE ACTIVE: Opponent steals the missed points!
      const missed = actualTotal - claimedShowPoints;
      const opp: PlayerNumber = activeShowScore.player === 1 ? 2 : 1;
      const oppLabel = getPlayerLabel(opp);
      triggerHaptic('heavy');
      setIsShowStepScored(true);
      setShowCountFeedback({
        type: 'mismatch',
        message: `🚨 MUGGINS! You pegged +${claimedShowPoints} pts, and ${oppLabel} stole the ${missed} missed ${
          missed === 1 ? 'point' : 'points'
        }!`,
      });
      setStatusMessage(`🚨 Muggins! ${ownerLabel} pegged +${claimedShowPoints}, ${oppLabel} stole +${missed}!`);
      const won = addPoints(
        activeShowScore.player,
        claimedShowPoints,
        `${ownerLabel}: +${claimedShowPoints} pts`
      );
      if (!won) {
        addPoints(opp, missed, `🚨 Muggins! +${missed} to ${oppLabel}`);
      }
    } else {
      triggerHaptic('heavy');
      const diffMsg =
        claimedShowPoints < actualTotal
          ? `You counted ${claimedShowPoints} pts — you missed some points! Recount your cards or tap "Reveal & Peg ${actualTotal} pts".`
          : `Overcount! You claimed ${claimedShowPoints} pts, which is more than this ${kindLabel.toLowerCase()} holds. Recount or tap "Reveal & Peg ${actualTotal} pts".`;
      setShowCountFeedback({
        type: 'mismatch',
        message: diffMsg,
      });
    }
  };

  // Reveal Breakdown & Peg Official Score (Helper for learning or after a miscount)
  const handleRevealAndPegShowScore = () => {
    if (!activeShowScore || isShowStepScored) return;

    const actualTotal = activeShowScore.score.total;
    const ownerLabel = getPlayerLabel(activeShowScore.player);
    const kindLabel = activeShowScore.isCrib ? 'Crib' : 'Hand';

    playTapSound();
    setClaimedShowPoints(actualTotal);
    setIsShowStepScored(true);
    setShowCountFeedback({
      type: 'revealed',
      message: `✨ Breakdown revealed: +${actualTotal} pts pegged for ${ownerLabel}'s ${kindLabel}.`,
    });
    setStatusMessage(`${ownerLabel} pegged +${actualTotal} pts for ${kindLabel}.`);
    addPoints(activeShowScore.player, actualTotal, `${ownerLabel} ${kindLabel}: +${actualTotal} pts`);

    if (gamePlayMode === 'remote') {
      multiplayer.send({
        type: 'CRIBBAGE_ACTION',
        gameId: 'cribbage',
        payload: {
          action: 'SHOW_SCORE_PEGGED',
          player: activeShowScore.player,
          points: actualTotal,
        },
      });
    }
  };

  const proceedNextShowStep = () => {
    // If walk-off win occurred on the current hand count, close Show card to reveal GameOverModal!
    if (winner !== null) {
      setActiveShowScore(null);
      return;
    }

    const starter = stateRef.current.starterCut;
    if (!starter) return;
    const curDealer = stateRef.current.dealer;
    const dealerLabel = getPlayerLabel(curDealer);

    if (phase === 'show_non_dealer') {
      // Step 2: Show Dealer Hand
      const dealerHand = curDealer === 1 ? handP1 : handP2;
      configureShowStep(
        'show_dealer',
        curDealer,
        `${dealerLabel}'s Hand (Dealer Counts Second)`,
        dealerHand,
        starter,
        false
      );

      if (gamePlayMode === 'remote') {
        multiplayer.send({
          type: 'CRIBBAGE_ACTION',
          gameId: 'cribbage',
          payload: { action: 'SHOW_STEP', step: 'show_dealer' },
        });
      }
    } else if (phase === 'show_dealer') {
      // Step 3: Show Dealer Crib
      configureShowStep(
        'show_crib',
        curDealer,
        `${dealerLabel}'s Crib (4 Discards + Starter Cut)`,
        crib,
        starter,
        true
      );

      if (gamePlayMode === 'remote') {
        multiplayer.send({
          type: 'CRIBBAGE_ACTION',
          gameId: 'cribbage',
          payload: { action: 'SHOW_STEP', step: 'show_crib' },
        });
      }
    } else if (phase === 'show_crib') {
      // Round Complete
      setPhase('round_complete');
      setActiveShowScore(null);
      setIsShowStepScored(false);
      const nextD: PlayerNumber = curDealer === 1 ? 2 : 1;
      setStatusMessage(`Round complete! Next round ${getPlayerLabel(nextD)} will be Dealer.`);

      if (gamePlayMode === 'remote') {
        multiplayer.send({
          type: 'CRIBBAGE_ACTION',
          gameId: 'cribbage',
          payload: { action: 'SHOW_STEP', step: 'round_complete' },
        });
      }
    }
  };

  // -------------------------------------------------------------------------
  // Pegging Cycle Reset Helper (After 31 or Go/Last Card)
  // -------------------------------------------------------------------------
  const finishPeggingSeries = useCallback(
    (
      lastPegger: PlayerNumber,
      awardGoPoint: boolean,
      reasonText: string,
      nextP1Hand: CribbageCard[],
      nextP2Hand: CribbageCard[]
    ) => {
      setIsCycleResetting(true);

      if (awardGoPoint) {
        const won = addPoints(lastPegger, 1, reasonText);
        if (won) return;
      }

      scheduleTimeout(() => {
        if (stateRef.current.winner !== null) return;

        setActiveCycleSequence([]);
        setCurrentRunningCount(0);
        setP1SaidGo(false);
        setP2SaidGo(false);
        setLastPlayerToPeg(null);
        setIsCycleResetting(false);

        const p1Has = nextP1Hand.length > 0;
        const p2Has = nextP2Hand.length > 0;

        if (!p1Has && !p2Has) {
          startTheShow();
        } else {
          // Official rule: opponent of the player who played the last card leads the new series from 0
          const preferredLeader: PlayerNumber = lastPegger === 1 ? 2 : 1;
          const actualLeader: PlayerNumber =
            preferredLeader === 1
              ? p1Has
                ? 1
                : 2
              : p2Has
              ? 2
              : 1;

          setTurn(actualLeader);
          if (stateRef.current.gamePlayMode === 'pass-and-play' && actualLeader !== lastPegger) {
            setPassPhonePlayer(actualLeader);
          }
          setStatusMessage(`Count reset to 0! ${getPlayerLabel(actualLeader)} leads the next card.`);
        }
      }, 1050);
    },
    [addPoints, getPlayerLabel, scheduleTimeout, startTheShow]
  );

  // -------------------------------------------------------------------------
  // Pegging Phase: Play Card
  // -------------------------------------------------------------------------
  const handlePlayPeggingCard = useCallback(
    (card: CribbageCard) => {
      if (
        stateRef.current.phase !== 'pegging' ||
        stateRef.current.winner !== null ||
        stateRef.current.isCycleResetting
      ) {
        return;
      }
      if (stateRef.current.gamePlayMode === 'remote' && (!isMyTurn || isAwaitingServer)) return;

      const activePlayer = stateRef.current.turn;
      const curCount = stateRef.current.currentRunningCount;
      if (curCount + card.value > 31) return;

      playCardPlaceSound();
      triggerHaptic('medium');

      const result = evaluatePeggingPlay(stateRef.current.activeCycleSequence, card);
      const newCount = result.newRunningTotal;

      const nextSeq = [...stateRef.current.activeCycleSequence, card];
      const nextP1Hand =
        activePlayer === 1
          ? stateRef.current.peggingHandP1.filter((c) => c.id !== card.id)
          : stateRef.current.peggingHandP1;
      const nextP2Hand =
        activePlayer === 2
          ? stateRef.current.peggingHandP2.filter((c) => c.id !== card.id)
          : stateRef.current.peggingHandP2;

      setActiveCycleSequence(nextSeq);
      setPeggingHistory((prev) => [...prev, { card, player: activePlayer, count: newCount }]);
      setCurrentRunningCount(newCount);
      setLastPlayerToPeg(activePlayer);
      setPeggingHandP1(nextP1Hand);
      setPeggingHandP2(nextP2Hand);

      // Award immediate combination points (15, 31, Pair, Run)
      if (result.totalPoints > 0) {
        const descriptions = result.details.map((d) => d.description).join(' • ');
        const won = addPoints(activePlayer, result.totalPoints, descriptions);
        if (won) return;
      }

      const opp: PlayerNumber = activePlayer === 1 ? 2 : 1;
      const oppHand = opp === 1 ? nextP1Hand : nextP2Hand;
      const curHand = activePlayer === 1 ? nextP1Hand : nextP2Hand;
      const oppSaidGo = opp === 1 ? stateRef.current.p1SaidGo : stateRef.current.p2SaidGo;

      const oppCanPlay = !oppSaidGo && canPlayerPeg(oppHand, newCount);
      const curCanPlay = canPlayerPeg(curHand, newCount);
      const allCardsExhausted = nextP1Hand.length === 0 && nextP2Hand.length === 0;

      // Determine next turn for remote broadcast
      let nextTurnToPlay: PlayerNumber = activePlayer;
      if (!result.isThirtyOne && !allCardsExhausted) {
        if (oppCanPlay) {
          nextTurnToPlay = opp;
        } else if (oppHand.length > 0 && !oppSaidGo) {
          // Opponent has cards in hand and hasn't declared Go yet -> must declare Go
          nextTurnToPlay = opp;
        } else if (curCanPlay) {
          nextTurnToPlay = activePlayer;
        }
      }

      if (stateRef.current.gamePlayMode === 'remote') {
        multiplayer.send({
          type: 'CRIBBAGE_ACTION',
          gameId: 'cribbage',
          payload: {
            action: 'PEG_PLAY',
            card,
            playedBy: localPlayer,
            newRunningTotal: newCount,
            pointsScored: result.totalPoints,
            reason: result.details.map((d) => d.description).join(' • '),
            isThirtyOne: result.isThirtyOne,
            allCardsExhausted,
            nextTurn: nextTurnToPlay,
          },
        });
      }

      // 1. Hit Exactly 31 -> +2 already awarded; reset count to 0
      if (result.isThirtyOne) {
        finishPeggingSeries(activePlayer, false, '', nextP1Hand, nextP2Hand);
        return;
      }

      // 2. All 8 cards played (and < 31) -> +1 for Last Card, then start The Show
      if (allCardsExhausted) {
        finishPeggingSeries(
          activePlayer,
          true,
          `One for Last Card (+1 ${activePlayer === 1 ? 'P1' : 'P2'})`,
          nextP1Hand,
          nextP2Hand
        );
        return;
      }

      // 3. Opponent has a legal card <= 31 (and hasn't said Go in this series)
      if (oppCanPlay) {
        setTurn(opp);
        if (stateRef.current.gamePlayMode === 'pass-and-play') {
          setPassPhonePlayer(opp);
        }
        setStatusMessage(`Count is ${newCount}. ${getPlayerLabel(opp)}'s turn to play.`);
        return;
      }

      // 4. Opponent cannot play a card <= 31:
      // If opponent still holds cards and hasn't declared "Go" yet in this series, they must say "Go!"
      if (oppHand.length > 0 && !oppSaidGo) {
        setTurn(opp);
        if (stateRef.current.gamePlayMode === 'pass-and-play') {
          setPassPhonePlayer(opp);
        }
        if (opp === 1 || stateRef.current.gamePlayMode !== 'vs-cpu') {
          setStatusMessage(
            `Count is ${newCount}. ${getPlayerLabel(opp)} has no card ≤ ${31 - newCount} — must declare "GO"!`
          );
        } else {
          setStatusMessage(`Count is ${newCount}. 🤖 CPU has no legal play...`);
        }
        return;
      }

      // 5. Opponent has 0 cards left OR already declared "Go" earlier in this series:
      if (curCanPlay) {
        setTurn(activePlayer);
        setStatusMessage(
          `Count is ${newCount}. ${getPlayerLabel(opp)} cannot play — ${getPlayerLabel(activePlayer)} plays again!`
        );
      } else {
        // Neither player can play any further in this series -> +1 for Go to activePlayer!
        finishPeggingSeries(
          activePlayer,
          true,
          `One for Go (+1 ${activePlayer === 1 ? 'P1' : 'P2'})`,
          nextP1Hand,
          nextP2Hand
        );
      }
    },
    [addPoints, finishPeggingSeries, getPlayerLabel, isAwaitingServer, isMyTurn, localPlayer]
  );

  // -------------------------------------------------------------------------
  // Declare "Go"
  // -------------------------------------------------------------------------
  const handleDeclareGo = useCallback(() => {
    if (
      stateRef.current.phase !== 'pegging' ||
      stateRef.current.winner !== null ||
      stateRef.current.isCycleResetting
    ) {
      return;
    }

    const goPlayer = stateRef.current.turn;
    const opp: PlayerNumber = goPlayer === 1 ? 2 : 1;
    const curCount = stateRef.current.currentRunningCount;
    const oppHand = opp === 1 ? stateRef.current.peggingHandP1 : stateRef.current.peggingHandP2;

    playTapSound();
    triggerHaptic('light');

    if (goPlayer === 1) setP1SaidGo(true);
    else setP2SaidGo(true);

    const oppCanPlay = canPlayerPeg(oppHand, curCount);
    const pointEarner: PlayerNumber = stateRef.current.lastPlayerToPeg || opp;

    if (stateRef.current.gamePlayMode === 'remote') {
      multiplayer.send({
        type: 'CRIBBAGE_ACTION',
        gameId: 'cribbage',
        payload: {
          action: 'PEG_GO',
          player: localPlayer,
          isCycleEnd: !oppCanPlay,
          pointEarner,
        },
      });
    }

    if (oppCanPlay) {
      setPeggingCallout(`📢 ${getPlayerLabel(goPlayer)} says "GO!"`);
      scheduleTimeout(() => setPeggingCallout(null), 1800);
      setTurn(opp);
      if (stateRef.current.gamePlayMode === 'pass-and-play') {
        setPassPhonePlayer(opp);
      }
      setStatusMessage(
        `${getPlayerLabel(goPlayer)} declared GO! ${getPlayerLabel(opp)} must play any legal cards ≤ 31.`
      );
    } else {
      // Neither player can play -> lastPlayerToPeg earns +1 for Go and count resets to 0!
      finishPeggingSeries(
        pointEarner,
        true,
        `📢 ${getPlayerLabel(goPlayer)} says GO! +1 to ${getPlayerLabel(pointEarner)}`,
        stateRef.current.peggingHandP1,
        stateRef.current.peggingHandP2
      );
    }
  }, [finishPeggingSeries, getPlayerLabel, localPlayer, scheduleTimeout]);

  // -------------------------------------------------------------------------
  // CPU Pegging Turn Simulation (Strictly guarded against transition re-entry)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (
      gamePlayMode !== 'vs-cpu' ||
      phase !== 'pegging' ||
      turn !== 2 ||
      winner !== null ||
      isCycleResetting
    ) {
      return;
    }

    const cpuTimer = setTimeout(() => {
      if (
        stateRef.current.phase !== 'pegging' ||
        stateRef.current.turn !== 2 ||
        stateRef.current.winner !== null ||
        stateRef.current.isCycleResetting
      ) {
        return;
      }

      const bestCard = choosePeggingCard(
        stateRef.current.peggingHandP2,
        stateRef.current.currentRunningCount,
        stateRef.current.activeCycleSequence
      );
      if (bestCard) {
        handlePlayPeggingCard(bestCard);
      } else {
        handleDeclareGo();
      }
    }, 750);

    return () => clearTimeout(cpuTimer);
  }, [
    gamePlayMode,
    phase,
    turn,
    winner,
    isCycleResetting,
    peggingHandP2,
    currentRunningCount,
    activeCycleSequence,
    handlePlayPeggingCard,
    handleDeclareGo,
  ]);

  // -------------------------------------------------------------------------
  // WebRTC Remote Duel Message Listeners & Strict State Sanitization
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (gamePlayMode !== 'remote') return;

    const unbind = multiplayer.onMessage((msg: RemoteMessage) => {
      if (msg.gameId !== 'cribbage') return;

      if (msg.type === 'CRIBBAGE_ACTION') {
        const { action } = msg.payload;

        if (action === 'DEAL') {
          setIsAwaitingServer(false);
          setHandP2(msg.payload.guestHand);
          setHandP1([]);
          setDealer(msg.payload.dealer);
          setTurn(msg.payload.dealer === 1 ? 2 : 1);
          setCrib([]);
          setStarterCut(null);
          setSelectedDiscards([]);
          setP1DiscardReady(false);
          setP2DiscardReady(false);
          setRemoteOpponentCardCount(6);
          setPhase('discarding');
          setScoreP1(msg.payload.scoreP1 ?? 0);
          setScoreP2(msg.payload.scoreP2 ?? 0);
          setPrevScoreP1(msg.payload.prevScoreP1 ?? 0);
          setPrevScoreP2(msg.payload.prevScoreP2 ?? 0);
          setWinner(null);
          setPeggingHistory([]);
          setActiveCycleSequence([]);
          setCurrentRunningCount(0);
          setStatusMessage('Round started! Select 2 cards to toss into the Crib.');
        } else if (action === 'HOST_DISCARD_READY') {
          setP1DiscardReady(true);
          setRemoteOpponentCardCount(4);
          setStatusMessage('Opponent has discarded 2 cards to the Crib.');
        } else if (action === 'GUEST_DISCARD') {
          const { discardedCards } = msg.payload;
          setCrib((prev) => {
            const existingIds = new Set(prev.map((c) => c.id));
            return [...prev, ...discardedCards.filter((c: CribbageCard) => !existingIds.has(c.id))];
          });
          setP2DiscardReady(true);
          setRemoteOpponentCardCount(4);
          if (!stateRef.current.p1DiscardReady) {
            setStatusMessage('Opponent tossed cards to Crib. Please select your 2 discards.');
          }
        } else if (action === 'REVEAL_CUT') {
          setStarterCut(msg.payload.starterCut);
          setPhase('cut_reveal');
          playCardPlaceSound();

          if (msg.payload.hisHeels) {
            scheduleTimeout(() => {
              addPoints(msg.payload.dealer, 2, 'Two for His Heels! (+2)');
            }, 450);
          }

          scheduleTimeout(() => {
            if (stateRef.current.winner !== null) return;
            setPeggingHandP2(stateRef.current.handP2);
            setPhase('pegging');
            const nonDealer: PlayerNumber = msg.payload.dealer === 1 ? 2 : 1;
            setTurn(nonDealer);
            setStatusMessage(`Cut card revealed! The Play to 31: Player ${nonDealer} leads.`);
          }, 1300);
        } else if (action === 'PEG_PLAY') {
          setIsAwaitingServer(false);
          const {
            card,
            playedBy,
            newRunningTotal,
            pointsScored,
            reason,
            isThirtyOne,
            allCardsExhausted,
            nextTurn,
          } = msg.payload;

          playCardPlaceSound();
          triggerHaptic('medium');

          setActiveCycleSequence((prev) => [...prev, card]);
          setPeggingHistory((prev) => [...prev, { card, player: playedBy, count: newRunningTotal }]);
          setCurrentRunningCount(newRunningTotal);
          setLastPlayerToPeg(playedBy);
          setRemoteOpponentCardCount((prev) => Math.max(0, prev - 1));

          if (pointsScored > 0) {
            const won = addPoints(playedBy, pointsScored, reason);
            if (won) return;
          }

          if (isThirtyOne) {
            setIsCycleResetting(true);
            scheduleTimeout(() => {
              setActiveCycleSequence([]);
              setCurrentRunningCount(0);
              setP1SaidGo(false);
              setP2SaidGo(false);
              setLastPlayerToPeg(null);
              setIsCycleResetting(false);
              setTurn(nextTurn);
            }, 1050);
          } else if (allCardsExhausted) {
            setIsCycleResetting(true);
            addPoints(playedBy, 1, 'One for Last Card (+1)');
          } else {
            setTurn(nextTurn);
            setStatusMessage(`Count is ${newRunningTotal}. Player ${nextTurn}'s turn.`);
          }
        } else if (action === 'PEG_GO') {
          const { player, isCycleEnd, pointEarner } = msg.payload;
          playTapSound();
          triggerHaptic('light');

          if (player === 1) setP1SaidGo(true);
          else setP2SaidGo(true);

          if (isCycleEnd) {
            setIsCycleResetting(true);
            addPoints(pointEarner, 1, 'One for Go (+1)');
            scheduleTimeout(() => {
              setActiveCycleSequence([]);
              setCurrentRunningCount(0);
              setP1SaidGo(false);
              setP2SaidGo(false);
              setLastPlayerToPeg(null);
              setIsCycleResetting(false);
              setTurn(pointEarner === 1 ? 2 : 1);
            }, 1050);
          } else {
            const opp: PlayerNumber = player === 1 ? 2 : 1;
            setTurn(opp);
            setStatusMessage(`Opponent declared GO! Player ${opp} must play if possible.`);
          }
        } else if (action === 'START_SHOW') {
          setIsCycleResetting(false);
          setHandP1(msg.payload.hostHand);
          setCrib(msg.payload.crib);
          setStarterCut(msg.payload.starterCut);

          const starter = msg.payload.starterCut;
          const curDealer = stateRef.current.dealer;
          const nonDealer: PlayerNumber = curDealer === 1 ? 2 : 1;
          const nonDealerHand = nonDealer === 1 ? msg.payload.hostHand : stateRef.current.handP2;
          configureShowStep(
            'show_non_dealer',
            nonDealer,
            `${nonDealer === 1 ? 'Player 1' : 'Player 2'} Hand (Non-Dealer)`,
            nonDealerHand,
            starter,
            false
          );
        } else if (action === 'SHOW_SCORE_PEGGED') {
          setIsShowStepScored(true);
          setShowCountFeedback({
            type: 'exact',
            message: `Player ${msg.payload.player} pegged +${msg.payload.points} pts!`,
          });
          addPoints(
            msg.payload.player,
            msg.payload.points,
            `P${msg.payload.player}: +${msg.payload.points} pts`
          );
        } else if (action === 'SHOW_STEP') {
          const nextP = msg.payload.step as CribbagePhase;
          const starter = stateRef.current.starterCut;
          const curDealer = stateRef.current.dealer;
          if (!starter) return;

          if (nextP === 'show_dealer') {
            const dealerHand = curDealer === 1 ? stateRef.current.handP1 : stateRef.current.handP2;
            configureShowStep(
              'show_dealer',
              curDealer,
              `${curDealer === 1 ? 'Player 1' : 'Player 2'} Hand (Dealer)`,
              dealerHand,
              starter,
              false
            );
          } else if (nextP === 'show_crib') {
            configureShowStep(
              'show_crib',
              curDealer,
              `${curDealer === 1 ? 'Player 1' : 'Player 2'} Crib (The Crib)`,
              stateRef.current.crib,
              starter,
              true
            );
          } else if (nextP === 'round_complete') {
            setPhase('round_complete');
            setActiveShowScore(null);
            setIsShowStepScored(false);
            setStatusMessage('Round complete! Ready for next deal.');
          }
        } else if (action === 'REQUEST_NEXT_ROUND') {
          if (localPlayer === 1) {
            startNewRound();
          }
        }
      }
    });

    return () => {
      unbind();
    };
  }, [gamePlayMode, localPlayer, addPoints, configureShowStep, startNewRound, setIsAwaitingServer, scheduleTimeout]);

  // -------------------------------------------------------------------------
  // Perspective Normalization: Local / Active Player Hand at Bottom
  // -------------------------------------------------------------------------
  const activeHumanPlayer: PlayerNumber = useMemo(() => {
    if (gamePlayMode === 'remote') return localPlayer;
    if (gamePlayMode === 'pass-and-play') {
      if (phase === 'discarding') return p1DiscardReady ? 2 : 1;
      return turn;
    }
    return 1;
  }, [gamePlayMode, localPlayer, phase, p1DiscardReady, turn]);

  const myCurrentHand = useMemo(() => {
    return activeHumanPlayer === 1 ? handP1 : handP2;
  }, [activeHumanPlayer, handP1, handP2]);

  const myPeggingHand = useMemo(() => {
    return activeHumanPlayer === 1 ? peggingHandP1 : peggingHandP2;
  }, [activeHumanPlayer, peggingHandP1, peggingHandP2]);

  const opponentUnplayedCount = useMemo(() => {
    if (gamePlayMode === 'remote') return remoteOpponentCardCount;
    const opp: PlayerNumber = activeHumanPlayer === 1 ? 2 : 1;
    if (phase === 'pegging') {
      return opp === 1 ? peggingHandP1.length : peggingHandP2.length;
    }
    return opp === 1 ? handP1.length : handP2.length;
  }, [gamePlayMode, remoteOpponentCardCount, activeHumanPlayer, phase, peggingHandP1.length, peggingHandP2.length, handP1.length, handP2.length]);

  const isMyPeggingTurn = useMemo(() => {
    if (isCycleResetting) return false;
    if (gamePlayMode === 'remote') return localPlayer === turn;
    if (gamePlayMode === 'vs-cpu') return turn === 1;
    return true;
  }, [isCycleResetting, gamePlayMode, localPlayer, turn]);

  const canISayGo = useMemo(() => {
    if (phase !== 'pegging' || !isMyPeggingTurn || isCycleResetting) return false;
    return myPeggingHand.length > 0 && !canPlayerPeg(myPeggingHand, currentRunningCount);
  }, [phase, isMyPeggingTurn, isCycleResetting, myPeggingHand, currentRunningCount]);

  // Sum of selected cards in The Show helper
  const showSelectedSum = useMemo(() => {
    if (!activeShowScore || showSelectedCardIds.length === 0) return 0;
    const allFive = starterCut ? [...activeShowScore.hand, starterCut] : activeShowScore.hand;
    return allFive
      .filter((c) => showSelectedCardIds.includes(c.id))
      .reduce((acc, c) => acc + c.value, 0);
  }, [activeShowScore, showSelectedCardIds, starterCut]);

  const toggleShowCardSelect = (cardId: string) => {
    triggerHaptic('light');
    setShowSelectedCardIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  };

  return (
    <GameContainer className="flex flex-col h-full w-full justify-between overflow-hidden select-none">
      <GameHeader
        gameId="cribbage"
        gameName={`Cribbage (${targetScore}-Point Match)`}
        turn={turn}
        scoreP1={scoreP1}
        scoreP2={scoreP2}
        onRestart={() => resetGame()}
        statusMessage={statusMessage}
        gameMode={gamePlayMode}
        onToggleGameMode={(m) => {
          setGamePlayMode(m);
          if (m !== 'remote') {
            setCtxGameMode(m === 'pass-and-play' ? 'pvp' : 'pve');
          }
          stateRef.current.gamePlayMode = m;
          resetGame(m);
        }}
        supportedModes={['vs-cpu', 'pass-and-play', 'remote']}
        localPlayer={localPlayer}
        isAwaitingServer={isAwaitingServer}
        latency={latency}
        turnTimeRemaining={turnTimeRemaining}
        peerPresence={peerPresence}
        onOpenRemoteModal={() => setShowRemoteModal(true)}
      />

      {/* Main Tabletop Arena */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-between p-1 sm:p-2 overflow-hidden w-full max-w-5xl mx-auto">
        {/* Top Section: Carved Wooden Cribbage Board (Always Uncovered!) */}
        <div className="w-full shrink-0 flex flex-col items-center z-20">
          <WoodenCribbageBoard
            scoreP1={scoreP1}
            prevScoreP1={prevScoreP1}
            scoreP2={scoreP2}
            prevScoreP2={prevScoreP2}
            isExpanded={isBoardExpanded}
          />

          {/* Real-time Peg Score & Controls Bar */}
          <div className="w-full flex flex-wrap items-center justify-between px-2.5 py-1 bg-black/70 border border-[#3e444c] rounded-xl sm:rounded-2xl shadow-md text-xs font-black mt-1 gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-3 h-3 rounded-full bg-amber-400 border border-amber-600 shadow-sm shrink-0" />
              <span className="text-amber-400 truncate">
                {gamePlayMode === 'remote' && localPlayer === 1 ? 'You (Brass)' : 'P1 (Brass)'}: {scoreP1}/{targetScore}
              </span>
              {dealer === 1 && (
                <span className="text-[9px] bg-amber-500 text-stone-950 px-1.5 py-0.5 rounded font-black uppercase shadow-xs shrink-0">
                  DEALER • CRIB
                </span>
              )}
            </div>

            {/* Central Callout Banner + Board Size, Target Score, Muggins & Rules Controls */}
            <div className="flex items-center gap-1 flex-wrap justify-center shrink-0">
              {peggingCallout ? (
                <div className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-stone-950 text-[10px] sm:text-[11px] font-black uppercase tracking-wider animate-bounce shadow-lg truncate max-w-[200px] sm:max-w-xs">
                  ✨ {peggingCallout}
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const nextGoal: 61 | 121 = targetScore === 121 ? 61 : 121;
                      setTargetScore(nextGoal);
                      stateRef.current.targetScore = nextGoal;
                      triggerHaptic('light');
                    }}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer shrink-0 ${
                      targetScore === 61
                        ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/50'
                        : 'bg-white/10 hover:bg-amber-500/20 text-stone-200 border-white/15'
                    }`}
                    title="Switch between Full 121-Point Match and Express 61-Point Half-Board Match"
                  >
                    <span>{targetScore === 61 ? '⚡ 61 Pts' : '🏁 121 Pts'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMugginsEnabled((prev) => {
                        const next = !prev;
                        stateRef.current.mugginsEnabled = next;
                        return next;
                      });
                      triggerHaptic('light');
                    }}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer shrink-0 ${
                      mugginsEnabled
                        ? 'bg-rose-500/25 text-rose-300 border-rose-400/50'
                        : 'bg-white/10 hover:bg-rose-500/20 text-stone-300 border-white/15'
                    }`}
                    title="Muggins Rule: When ON, opponent steals any points you miss when counting your hand!"
                  >
                    <span>{mugginsEnabled ? '⚡ Muggins: ON' : '🛡️ Muggins: OFF'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBoardExpanded((prev) => !prev)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer shrink-0 ${
                      isBoardExpanded
                        ? 'bg-amber-500/25 text-amber-300 border-amber-400/50'
                        : 'bg-white/10 hover:bg-amber-500/20 text-stone-200 border-white/15'
                    }`}
                    title="Toggle Board Zoom Size"
                  >
                    <span>🔍</span>
                    <span className="hidden sm:inline">{isBoardExpanded ? 'Standard' : 'Zoom Board'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRulesModal(true)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 hover:bg-amber-500/20 active:scale-95 text-stone-200 hover:text-amber-300 text-[10px] font-bold border border-white/15 transition-all cursor-pointer shrink-0"
                    title="View Full Rules & Scoring Guide"
                  >
                    <span>📜</span>
                    <span>Rules</span>
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 min-w-0">
              {dealer === 2 && (
                <span className="text-[9px] bg-slate-300 text-stone-950 px-1.5 py-0.5 rounded font-black uppercase shadow-xs shrink-0">
                  DEALER • CRIB
                </span>
              )}
              <span className="text-slate-300 truncate">
                {gamePlayMode === 'vs-cpu'
                  ? '🤖 CPU (Steel)'
                  : gamePlayMode === 'remote' && localPlayer === 2
                  ? 'You (Steel)'
                  : 'P2 (Steel)'}
                : {scoreP2}/{targetScore}
              </span>
              <span className="w-3 h-3 rounded-full bg-slate-300 border border-slate-500 shadow-sm shrink-0" />
            </div>
          </div>
        </div>

        {/* Lower Tabletop Wrapper (Holds Card Play Area, Player Hand, and Unobstructed Show Scorer) */}
        <div className="flex-1 min-h-0 w-full flex flex-col justify-between relative mt-1">
          {/* Central Card Table Area */}
          <div className="flex-1 min-h-0 w-full flex items-center justify-between gap-2 p-1 relative">
            {/* Left Wing: Dealer's Crib Box */}
            <div className="flex flex-col items-center p-2 rounded-2xl bg-black/45 border border-white/15 shrink-0 shadow-lg">
              <span className="text-[10px] font-black text-amber-300 uppercase mb-1">
                {dealer === 1 ? 'P1 Crib' : gamePlayMode === 'vs-cpu' ? 'CPU Crib' : 'P2 Crib'} ({crib.length}/4)
              </span>
              <div className="flex items-center justify-center gap-1">
                {crib.length === 0 ? (
                  <div className="w-12 h-16 rounded-xl border-2 border-dashed border-amber-400/30 flex items-center justify-center text-[9px] text-amber-200/50 font-bold text-center px-1">
                    Toss 2 Each
                  </div>
                ) : phase === 'show_crib' || phase === 'round_complete' ? (
                  <div className="flex -space-x-2">
                    {crib.map((c) => (
                      <ProceduralCribbageCard key={c.id} card={c} small />
                    ))}
                  </div>
                ) : (
                  <div className="flex -space-x-5">
                    {crib.map((c) => (
                      <ProceduralCribbageCard key={c.id} card={c} faceDown small />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Center Play Area: Opponent Rack, Pegging Sequence & Running Count */}
            <div className="flex-1 flex flex-col items-center justify-between h-full py-1 px-2 min-w-0">
              {/* Top Opponent Hand Indicator (All Modes) */}
              <div className="flex items-center gap-1.5 bg-black/35 px-3 py-1 rounded-full border border-white/10">
                <span className="text-[10px] font-bold text-stone-300 uppercase">
                  {activeHumanPlayer === 1 ? getPlayerLabel(2) : getPlayerLabel(1)}:
                </span>
                {opponentUnplayedCount > 0 ? (
                  <div className="flex -space-x-2">
                    {Array.from({ length: opponentUnplayedCount }).map((_, i) => (
                      <ProceduralCribbageCard
                        key={`opp-card-${i}`}
                        card={{ id: `opp-${i}`, suit: 'spades', rank: 1, value: 1, rankLabel: 'A', isRed: false }}
                        faceDown
                        tiny
                      />
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] font-bold text-stone-400 italic">0 cards left</span>
                )}
                {phase === 'pegging' && (p1SaidGo || p2SaidGo) && (
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-300 text-[9px] font-black uppercase">
                    {p1SaidGo ? 'P1 Said GO' : `${getPlayerLabel(2)} Said GO`}
                  </span>
                )}
              </div>

              {/* Active Phase Centerpiece */}
              {phase === 'pegging' && (
                <div className="flex flex-col items-center gap-1.5 my-auto w-full">
                  {/* 31 Count Dial Badge */}
                  <div className="flex items-center gap-2 px-4 py-1 rounded-full bg-black/80 border-2 border-amber-500/60 text-white shadow-xl">
                    <span className="text-[11px] text-amber-400 font-extrabold uppercase tracking-wider">
                      RUNNING COUNT:
                    </span>
                    <span className="text-lg sm:text-xl font-black text-amber-300 tabular-nums">
                      {currentRunningCount}
                    </span>
                    <span className="text-xs text-stone-400 font-bold">/ 31</span>
                  </div>

                  {/* Beginner Pegging Points Quick Reference */}
                  <div className="text-[9px] sm:text-[10px] font-bold text-amber-100/80 bg-black/35 px-2.5 py-0.5 rounded-full tracking-tight text-center">
                    15 = +2 • 31 = +2 • Pair = +2 • 3-Kind = +6 • Run (3+) = 1/card • Go/Last = +1
                  </div>

                  {/* Cards played in this 31 cycle */}
                  <div className="flex items-center justify-center gap-1.5 flex-wrap min-h-18 py-1 px-2 rounded-2xl bg-black/25 border border-white/10 w-full max-w-md">
                    {activeCycleSequence.length === 0 ? (
                      <span className="text-xs font-bold text-stone-400/80 italic">
                        {isCycleResetting
                          ? 'Resetting count to 0...'
                          : `${getPlayerLabel(turn)}: play a card to start the count`}
                      </span>
                    ) : (
                      activeCycleSequence.map((c, idx) => (
                        <div key={`${c.id}-${idx}`} className="flex flex-col items-center">
                          <ProceduralCribbageCard card={c} small />
                        </div>
                      ))
                    )}
                  </div>

                  {/* Previously Pegged Cards in Earlier Series (Dimmed Reference) */}
                  {peggingHistory.length > activeCycleSequence.length && (
                    <div className="flex items-center gap-1 text-[9px] font-bold text-stone-300/75">
                      <span>Earlier in round:</span>
                      <span>
                        {peggingHistory
                          .slice(0, peggingHistory.length - activeCycleSequence.length)
                          .map((h) => `${h.card.rankLabel}${SUIT_SYMBOLS[h.card.suit]}`)
                          .join(', ')}
                      </span>
                    </div>
                  )}

                  {/* "Say GO" Action Button when player has no legal card <= 31 */}
                  {canISayGo && (
                    <button
                      type="button"
                      onClick={handleDeclareGo}
                      className="mt-0.5 px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-xl active:scale-95 animate-pulse transition-all cursor-pointer border border-rose-300/40"
                    >
                      📢 Say &ldquo;GO&rdquo; (No Card Fits ≤ {31 - currentRunningCount})
                    </button>
                  )}
                </div>
              )}

              {/* Cut Reveal Banner */}
              {phase === 'cut_reveal' && starterCut && (
                <div className="flex flex-col items-center gap-2 my-auto bg-black/65 px-5 py-3 rounded-2xl border border-amber-400/40 shadow-xl animate-fade-in">
                  <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
                    Deck Cut Starter Card
                  </span>
                  <ProceduralCribbageCard card={starterCut} />
                  {checkHisHeels(starterCut) && (
                    <span className="text-xs font-black text-emerald-400 animate-bounce">
                      🎉 Two for His Heels! (+2 pts to {getPlayerLabel(dealer)})
                    </span>
                  )}
                </div>
              )}

              {/* Discard Phase Action Box */}
              {phase === 'discarding' && (
                <div className="flex flex-col items-center gap-1.5 my-auto bg-black/55 px-4 py-2.5 rounded-2xl border border-white/15 text-center shadow-xl max-w-sm">
                  <span className="text-xs sm:text-sm font-black text-amber-200">
                    {getPlayerLabel(activeHumanPlayer)}: Toss 2 Cards to{' '}
                    {dealer === activeHumanPlayer ? 'YOUR Crib' : `${getPlayerLabel(dealer)}'s Crib`}
                  </span>
                  <span className="text-[10px] text-stone-300 font-medium leading-snug">
                    {dealer === activeHumanPlayer
                      ? '💡 You are Dealer! Toss 5s, pairs, or consecutive cards to boost your own Crib.'
                      : "💡 Opponent is Dealer! Toss wide-gapped cards (like K + 2 or Q + 3) to balk their Crib."}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleConfirmDiscards()}
                    disabled={selectedDiscards.length !== 2 || (activeHumanPlayer === 1 ? p1DiscardReady : p2DiscardReady)}
                    className="mt-1 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-stone-950 font-black text-xs uppercase tracking-wider shadow-xl active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  >
                    Toss Selected to Crib ({selectedDiscards.length}/2)
                  </button>
                </div>
              )}

              {/* Round Complete Center Action */}
              {phase === 'round_complete' && (
                <div className="flex flex-col items-center gap-2 my-auto bg-black/65 px-6 py-4 rounded-3xl border border-emerald-500/40 shadow-2xl">
                  <span className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                    Hand &amp; Crib Counting Complete
                  </span>
                  <span className="text-xs text-stone-300">
                    Score: P1 {scoreP1} pts — {getPlayerLabel(2)} {scoreP2} pts (Goal: {targetScore})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (gamePlayMode === 'remote' && localPlayer !== 1) {
                        multiplayer.send({
                          type: 'CRIBBAGE_ACTION',
                          gameId: 'cribbage',
                          payload: { action: 'REQUEST_NEXT_ROUND' },
                        });
                      } else {
                        startNewRound();
                      }
                    }}
                    className="mt-1 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl active:scale-95 transition-all cursor-pointer"
                  >
                    🔀 Deal Next Round ({getPlayerLabel(dealer === 1 ? 2 : 1)} Deals)
                  </button>
                </div>
              )}
            </div>

            {/* Right Wing: Starter Cut Card Riser */}
            <div className="flex flex-col items-center p-2 rounded-2xl bg-black/45 border border-white/15 shrink-0 shadow-lg">
              <span className="text-[10px] font-black text-amber-300 uppercase mb-1">
                Starter Cut
              </span>
              {starterCut && phase !== 'dealing' && phase !== 'discarding' ? (
                <div className="relative transform hover:scale-105 transition-transform">
                  <div className="absolute -bottom-1 -right-1 w-full h-full rounded-xl bg-slate-900 border border-indigo-500/20 shadow-lg -z-10" />
                  <ProceduralCribbageCard card={starterCut} small />
                </div>
              ) : (
                <div className="w-12 h-16 rounded-xl border-2 border-dashed border-amber-400/30 flex items-center justify-center text-[9px] text-amber-200/50 font-bold text-center px-1">
                  Cut After Crib
                </div>
              )}
            </div>
          </div>

          {/* Bottom Section: Active Player Hand & Controls */}
          <div className="w-full flex flex-col items-center shrink-0 px-3 py-1.5 bg-black/50 border border-white/15 rounded-2xl shadow-lg">
            <div className="w-full flex items-center justify-between text-xs font-bold text-stone-200 mb-1 px-1">
              <span>
                {getPlayerLabel(activeHumanPlayer)}&apos;s Hand (
                {phase === 'pegging' ? `${myPeggingHand.length} unplayed` : `${myCurrentHand.length} cards`})
              </span>
              {phase === 'discarding' && (
                <span className="text-amber-300 font-black">
                  Tap 2 cards to select ({selectedDiscards.length}/2)
                </span>
              )}
              {phase === 'pegging' && isMyPeggingTurn && !canISayGo && (
                <span className="text-emerald-400 font-black animate-pulse">
                  Tap a green-bordered card to play (≤ {31 - currentRunningCount} pts)
                </span>
              )}
              {phase === 'pegging' && !isMyPeggingTurn && (
                <span className="text-amber-300 font-bold">
                  Waiting for {getPlayerLabel(turn)}...
                </span>
              )}
            </div>

            {/* Card Carousel Rack */}
            <div className="w-full flex items-center justify-center gap-2 sm:gap-3 overflow-x-auto py-1.5 min-h-22">
              {phase === 'pegging' ? (
                myPeggingHand.length > 0 ? (
                  myPeggingHand.map((c) => {
                    const canPeg = currentRunningCount + c.value <= 31;
                    return (
                      <ProceduralCribbageCard
                        key={c.id}
                        card={c}
                        isPlayable={isMyPeggingTurn && canPeg}
                        isDimmed={!isMyPeggingTurn || !canPeg}
                        onClick={isMyPeggingTurn && canPeg ? () => handlePlayPeggingCard(c) : undefined}
                      />
                    );
                  })
                ) : (
                  <div className="flex items-center gap-2 py-2 text-xs font-bold text-stone-300">
                    <span>All 4 hand cards played in pegging — kept for The Show:</span>
                    <div className="flex gap-1 opacity-75">
                      {myCurrentHand.map((c) => (
                        <ProceduralCribbageCard key={c.id} card={c} tiny />
                      ))}
                    </div>
                  </div>
                )
              ) : (
                myCurrentHand.map((c) => (
                  <ProceduralCribbageCard
                    key={c.id}
                    card={c}
                    isSelected={selectedDiscards.includes(c.id)}
                    onClick={phase === 'discarding' ? () => handleToggleDiscardSelection(c.id) : undefined}
                  />
                ))
              )}
            </div>
          </div>

          {/* The Show Interactive Hand & Crib Scoring Overlay (Strictly inside lower tabletop so Board above is 100% visible!) */}
          {activeShowScore && (
            <div className="absolute inset-0 z-30 flex items-center justify-center p-1.5 sm:p-2.5 bg-black/80 backdrop-blur-sm rounded-2xl animate-fade-in select-none">
              <div className="w-full max-w-md bg-stone-900 border-2 border-amber-500/70 rounded-3xl p-3 sm:p-4 shadow-2xl flex flex-col items-center max-h-full overflow-y-auto">
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400/90">
                    {phase === 'show_non_dealer'
                      ? 'Step 1 of 3 • Non-Dealer First'
                      : phase === 'show_dealer'
                      ? 'Step 2 of 3 • Dealer Hand'
                      : 'Step 3 of 3 • Dealer Crib'}
                  </span>
                  <span className="text-xs font-black text-amber-300">
                    {isShowStepScored
                      ? `Pegged: +${activeShowScore.score.total} pts`
                      : `Count Your ${activeShowScore.isCrib ? 'Crib' : 'Hand'}`}
                  </span>
                </div>

                <h2 className="text-xs sm:text-sm font-black text-white uppercase tracking-wide mb-1.5 text-center">
                  🏆 {activeShowScore.title}
                </h2>

                {/* 4 Hand Cards + 1 Starter Cut Card (Tappable to inspect sums & claim combos!) */}
                <div className="flex items-center justify-center gap-1.5 my-1 bg-black/45 px-2.5 py-2 rounded-2xl border border-white/10">
                  {activeShowScore.hand.map((c) => (
                    <ProceduralCribbageCard
                      key={c.id}
                      card={c}
                      small
                      isSelected={showSelectedCardIds.includes(c.id)}
                      onClick={!isShowStepScored ? () => toggleShowCardSelect(c.id) : undefined}
                    />
                  ))}
                  {starterCut && (
                    <div className="pl-2 ml-1 border-l-2 border-amber-400/40 flex flex-col items-center">
                      <ProceduralCribbageCard
                        card={starterCut}
                        small
                        isSelected={showSelectedCardIds.includes(starterCut.id)}
                        onClick={!isShowStepScored ? () => toggleShowCardSelect(starterCut.id) : undefined}
                      />
                      <span className="text-[8px] font-black text-amber-300 uppercase mt-0.5">CUT</span>
                    </div>
                  )}
                </div>

                {/* Live Sum Helper & Tap-to-Claim Combo Button when selecting cards */}
                {!isShowStepScored && showSelectedCardIds.length > 0 && (
                  <div className="flex items-center justify-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] font-bold text-amber-300">
                      Selected Sum:{' '}
                      <span className={showSelectedSum === 15 ? 'text-emerald-400 font-black' : 'text-white'}>
                        {showSelectedSum} {showSelectedSum === 15 ? '✨ (15!)' : ''}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={handleClaimSelectedCombo}
                      className="px-2.5 py-0.5 rounded-full bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400/60 text-emerald-200 text-[10px] font-black uppercase tracking-wide active:scale-95 transition-all cursor-pointer shadow-sm"
                    >
                      ➕ Claim Selected Combo
                    </button>
                  </div>
                )}

                {/* Claimed Combos Checklist */}
                {!isShowStepScored && claimedComboIndices.length > 0 && (
                  <div className="w-full bg-emerald-950/35 border border-emerald-500/30 rounded-xl px-2.5 py-1 mb-1 max-h-16 overflow-y-auto flex flex-col gap-0.5 text-[10px]">
                    {claimedComboIndices.map((idx) => {
                      const item = activeShowScore.score.items[idx];
                      if (!item) return null;
                      return (
                        <div key={idx} className="flex items-center justify-between text-emerald-200">
                          <span className="truncate">✓ {item.description}</span>
                          <span className="font-black text-emerald-400 shrink-0">+{item.points}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Feedback Banner */}
                {showCountFeedback && (
                  <div
                    className={`w-full text-center px-3 py-1.5 rounded-xl text-[11px] font-bold my-1 border ${
                      showCountFeedback.type === 'exact'
                        ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                        : showCountFeedback.type === 'revealed'
                        ? 'bg-amber-950/70 border-amber-500/50 text-amber-200'
                        : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                    }`}
                  >
                    {showCountFeedback.message}
                  </div>
                )}

                {!isShowStepScored ? (
                  /* HUMAN PLAYER INTERACTIVE SCORING PAD */
                  <div className="w-full flex flex-col gap-2 my-1">
                    {/* Quick Combo Add Buttons */}
                    <div className="grid grid-cols-3 gap-1.5 w-full">
                      <button
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setClaimedShowPoints((p) => p + 2);
                        }}
                        className="py-1.5 px-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 font-black text-[11px] active:scale-95 transition-all cursor-pointer"
                      >
                        +2 (Fifteen)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setClaimedShowPoints((p) => p + 2);
                        }}
                        className="py-1.5 px-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 font-black text-[11px] active:scale-95 transition-all cursor-pointer"
                      >
                        +2 (Pair)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setClaimedShowPoints((p) => p + 3);
                        }}
                        className="py-1.5 px-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 font-black text-[11px] active:scale-95 transition-all cursor-pointer"
                      >
                        +3 (Run of 3)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setClaimedShowPoints((p) => p + 4);
                        }}
                        className="py-1.5 px-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 font-black text-[11px] active:scale-95 transition-all cursor-pointer"
                      >
                        +4 (Run/Flush)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setClaimedShowPoints((p) => p + 5);
                        }}
                        className="py-1.5 px-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 font-black text-[11px] active:scale-95 transition-all cursor-pointer"
                      >
                        +5 (Run/Flush)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setClaimedShowPoints((p) => p + 1);
                        }}
                        className="py-1.5 px-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 font-black text-[11px] active:scale-95 transition-all cursor-pointer"
                      >
                        +1 (His Nobs)
                      </button>
                    </div>

                    {/* Fine-Tune Tally Stepper Row */}
                    <div className="flex items-center justify-between bg-black/55 px-3 py-1.5 rounded-2xl border border-white/10">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setClaimedShowPoints((p) => Math.max(0, p - 2))}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-stone-200 font-black text-xs active:scale-95 cursor-pointer"
                        >
                          -2
                        </button>
                        <button
                          type="button"
                          onClick={() => setClaimedShowPoints((p) => Math.max(0, p - 1))}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-stone-200 font-black text-xs active:scale-95 cursor-pointer"
                        >
                          -1
                        </button>
                      </div>

                      <div className="flex flex-col items-center">
                        <span className="text-[9px] uppercase font-bold text-stone-400">Your Count</span>
                        <span className="text-base sm:text-lg font-black text-amber-300 tabular-nums">
                          {claimedShowPoints} pts
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setClaimedShowPoints((p) => p + 1)}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-stone-200 font-black text-xs active:scale-95 cursor-pointer"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setClaimedShowPoints(0);
                            setClaimedComboIndices([]);
                            setShowSelectedCardIds([]);
                          }}
                          className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-[10px] uppercase active:scale-95 cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    {/* Submit Claimed Points or Auto-Reveal */}
                    <div className="flex items-center gap-2 w-full">
                      <button
                        type="button"
                        onClick={handleSubmitHumanShowScore}
                        className="flex-1 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-stone-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl active:scale-95 transition-all cursor-pointer"
                      >
                        📌 Peg {claimedShowPoints} {claimedShowPoints === 1 ? 'Point' : 'Points'}
                        {claimedShowPoints === 0 ? ' (19!)' : ''}
                      </button>
                      <button
                        type="button"
                        onClick={handleRevealAndPegShowScore}
                        className="py-2.5 px-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-stone-200 font-bold text-[11px] active:scale-95 transition-all cursor-pointer shrink-0"
                        title="Show official breakdown and peg points"
                      >
                        {showCountFeedback?.type === 'mismatch'
                          ? `✨ Peg ${activeShowScore.score.total} pts`
                          : '💡 Auto-Count'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* VERIFIED ITEMIZED POINTS BREAKDOWN & NEXT STEP */
                  <>
                    <div className="w-full bg-black/55 rounded-2xl p-2.5 my-1.5 border border-white/10 max-h-32 overflow-y-auto flex flex-col gap-1 text-xs">
                      {activeShowScore.score.items.length === 0 ? (
                        <div className="text-center text-stone-400 py-2 font-bold">
                          Nineteen / zero combinations found (0 points).
                        </div>
                      ) : (
                        activeShowScore.score.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-stone-200 py-0.5 border-b border-white/5 last:border-b-0"
                          >
                            <span className="truncate pr-2">{item.description}</span>
                            <span className="font-black text-amber-400 shrink-0">+{item.points} pts</span>
                          </div>
                        ))
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={proceedNextShowStep}
                      className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-stone-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl active:scale-95 transition-all cursor-pointer mt-1"
                    >
                      {winner !== null
                        ? `🏆 ${targetScore}+ Reached! View Match Victory ➜`
                        : phase === 'show_non_dealer'
                        ? `Count Dealer's Hand (${getPlayerLabel(dealer)}) ➜`
                        : phase === 'show_dealer'
                        ? `Count ${getPlayerLabel(dealer)}'s Crib ➜`
                        : 'Finish Round ➜'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Pass-and-Play Privacy Shield Modal */}
      {gamePlayMode === 'pass-and-play' && passPhonePlayer !== null && winner === null && (
        <TurnTransitionModal
          incomingPlayer={passPhonePlayer}
          gameName="Cribbage"
          gameMode={gamePlayMode}
          onReady={() => setPassPhonePlayer(null)}
        />
      )}

      {/* Game Over Modal (121 Points Terminal Win - shown once Show modal is closed) */}
      {winner !== null && activeShowScore === null && (
        <GameOverModal
          winner={winner}
          gameName="Cribbage"
          stats={[
            {
              label: 'Final Score',
              p1Value: `${scoreP1} pts`,
              p2Value: `${scoreP2} pts`,
            },
            {
              label: 'Skunk Status',
              p1Value:
                winner === 1 && scoreP2 <= 60
                  ? 'Double Skunked!'
                  : winner === 1 && scoreP2 <= 90
                  ? 'Skunked!'
                  : '-',
              p2Value:
                winner === 2 && scoreP1 <= 60
                  ? 'Double Skunked!'
                  : winner === 2 && scoreP1 <= 90
                  ? 'Skunked!'
                  : '-',
            },
          ]}
          onRestart={() => resetGame()}
          onMenu={resetToMenu}
        />
      )}

      {/* Remote Duel Modal */}
      <RemoteDuelModal
        isOpen={showRemoteModal}
        onClose={() => setShowRemoteModal(false)}
      />

      {/* Full Rules & Beginner's Guide Modal */}
      {showRulesModal && (
        <GameRulesModal
          gameId="cribbage"
          onClose={() => setShowRulesModal(false)}
        />
      )}
    </GameContainer>
  );
};

export default Cribbage;
