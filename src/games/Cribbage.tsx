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
 * Calculates continuous (x, y) coordinates for any hole -1..121.
 * Hole -1 & 0 are the two starting holes before the Start line.
 * Track 1: Outer (Brass Pegs / Player 1)
 * Track 2: Inner (Steel Pegs / Player 2)
 */
export const getBoardHoleCoords = (hole: number, track: 1 | 2): { x: number; y: number } => {
  const laneOffset = track === 1 ? -4.5 : 4.5;

  // Rear Start Hole (Hole -1)
  if (hole < 0) {
    return { x: 20, y: 30 + laneOffset };
  }

  // Front Start Hole (Hole 0)
  if (hole === 0) {
    return { x: 31, y: 30 + laneOffset };
  }

  // Finish Hole (Hole 121 - "Game")
  if (hole >= 121) {
    return { x: 636, y: 106 + (track === 1 ? -4 : 4) };
  }

  // Street 1: Holes 1 to 40 (Moving Right across top street)
  if (hole <= 40) {
    const t = (hole - 1) / 39;
    const x = 50 + t * 560;
    const y = 30 + laneOffset;
    return { x, y };
  }

  // Street 2: Holes 41 to 80 (Moving Left across middle street)
  if (hole <= 80) {
    const t = (hole - 41) / 39;
    const x = 610 - t * 560;
    const y = 68 + laneOffset;
    return { x, y };
  }

  // Street 3: Holes 81 to 120 (Moving Right across bottom street)
  const t = (hole - 81) / 39;
  const x = 50 + t * 560;
  const y = 106 + laneOffset;
  return { x, y };
};

export const WoodenCribbageBoard: React.FC<{
  scoreP1: number;
  prevScoreP1: number;
  scoreP2: number;
  prevScoreP2: number;
}> = ({ scoreP1, prevScoreP1, scoreP2, prevScoreP2 }) => {
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

  // Generate all 120 static hole points for both lanes
  const holeMarkers = useMemo(() => {
    const markers: { hole: number; x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let h = 1; h <= 120; h++) {
      const p1 = getBoardHoleCoords(h, 1);
      const p2 = getBoardHoleCoords(h, 2);
      markers.push({ hole: h, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
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

  return (
    <div className="w-full max-w-4xl mx-auto rounded-3xl p-2 sm:p-2.5 bg-[#241309] border-4 border-[#3e1f0d] shadow-2xl overflow-hidden select-none relative clubhouse-board-depth">
      <svg
        viewBox="0 0 660 140"
        className="w-full h-auto drop-shadow-lg"
        style={{ touchAction: 'none' }}
      >
        <defs>
          <style>{`
            @keyframes pegLeapfrogArc {
              0% { transform: translateY(0) scale(1); }
              40% { transform: translateY(-11px) scale(1.35); }
              100% { transform: translateY(0) scale(1); }
            }
            @keyframes pegLeapfrogShadow {
              0% { rx: 4.5px; ry: 4.5px; opacity: 0.55; transform: translateY(0); }
              40% { rx: 7.5px; ry: 7.5px; opacity: 0.22; transform: translateY(6px); }
              100% { rx: 4.5px; ry: 4.5px; opacity: 0.55; transform: translateY(0); }
            }
          `}</style>

          {/* Rich Carved Walnut Finish Gradient */}
          <linearGradient id="walnutWood" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4a2511" />
            <stop offset="35%" stopColor="#3c1d0c" />
            <stop offset="70%" stopColor="#572b14" />
            <stop offset="100%" stopColor="#32170a" />
          </linearGradient>

          {/* Sunken Drilled Hole Bevel */}
          <radialGradient id="holeDepth" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#0a0502" />
            <stop offset="85%" stopColor="#1a0b04" />
            <stop offset="100%" stopColor="#3b1d0e" />
          </radialGradient>

          {/* Polished Brass Peg (Player 1) */}
          <radialGradient id="brassPeg" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="45%" stopColor="#eab308" />
            <stop offset="85%" stopColor="#a16207" />
            <stop offset="100%" stopColor="#713f12" />
          </radialGradient>

          {/* Brushed Stainless Steel Peg (Player 2 / CPU) */}
          <radialGradient id="steelPeg" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor="#cbd5e1" />
            <stop offset="80%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </radialGradient>

          {/* Gold Inlaid Finish Ring */}
          <radialGradient id="finishRing" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#854d0e" />
          </radialGradient>
        </defs>

        {/* Board Surface Base Plate */}
        <rect
          x="4"
          y="4"
          width="652"
          height="132"
          rx="22"
          fill="url(#walnutWood)"
          stroke="#5c2e17"
          strokeWidth="2.5"
        />

        {/* Track Grooves / Guides */}
        <path
          d="M 18 30 H 610 Q 640 49 610 68 H 50 Q 20 87 50 106 H 610"
          fill="none"
          stroke="#1c0c05"
          strokeWidth="19"
          strokeLinecap="round"
          opacity="0.5"
        />

        {/* Start Line Marker */}
        <line x1="41" y1="16" x2="41" y2="44" stroke="#d97706" strokeWidth="1.5" strokeDasharray="2 2" opacity="0.85" />
        <text x="38" y="14" fill="#fbbf24" fontSize="7.5" fontWeight="900" textAnchor="end">START</text>

        {/* Double Skunk Line at 60 */}
        <line x1="337" y1="56" x2="337" y2="80" stroke="#ef4444" strokeWidth="2" strokeDasharray="2 2" />
        <text x="337" y="53" fill="#f87171" fontSize="7" fontWeight="900" textAnchor="middle">DBL SKUNK (60)</text>

        {/* Skunk Line at 90 */}
        <line x1="179.2" y1="94" x2="179.2" y2="118" stroke="#f59e0b" strokeWidth="2" strokeDasharray="2 2" />
        <text x="179.2" y="127" fill="#fbbf24" fontSize="7" fontWeight="900" textAnchor="middle">SKUNK (90)</text>

        {/* Finish Hole Marker at 121 */}
        <circle cx="636" cy="106" r="8" fill="url(#finishRing)" stroke="#fde047" strokeWidth="1.2" />
        <circle cx="636" cy="102" r="2.6" fill="url(#holeDepth)" />
        <circle cx="636" cy="110" r="2.6" fill="url(#holeDepth)" />
        <text x="636" y="93" fill="#fde047" fontSize="7.5" fontWeight="900" textAnchor="middle">121 GAME</text>

        {/* Two Starting Holes per Track (Holes -1 and 0) */}
        <circle cx="20" cy="25.5" r="2.5" fill="url(#holeDepth)" stroke="#271207" strokeWidth="0.8" />
        <circle cx="31" cy="25.5" r="2.5" fill="url(#holeDepth)" stroke="#271207" strokeWidth="0.8" />
        <circle cx="20" cy="34.5" r="2.5" fill="url(#holeDepth)" stroke="#271207" strokeWidth="0.8" />
        <circle cx="31" cy="34.5" r="2.5" fill="url(#holeDepth)" stroke="#271207" strokeWidth="0.8" />

        {/* Drilled Track Holes 1..120 */}
        {holeMarkers.map(({ hole, x1, y1, x2, y2 }) => {
          const isMilestone = hole % 5 === 0;
          return (
            <g key={hole}>
              <circle cx={x1} cy={y1} r={isMilestone ? 2.6 : 2.2} fill="url(#holeDepth)" stroke="#241106" strokeWidth="0.6" />
              <circle cx={x2} cy={y2} r={isMilestone ? 2.6 : 2.2} fill="url(#holeDepth)" stroke="#241106" strokeWidth="0.6" />
              {isMilestone && (
                <text
                  x={(x1 + x2) / 2}
                  y={hole <= 40 ? 19 : hole <= 80 ? 84 : 123}
                  fill="#d4a373"
                  fontSize="6.5"
                  fontWeight="800"
                  textAnchor="middle"
                  opacity="0.85"
                >
                  {hole}
                </text>
              )}
            </g>
          );
        })}

        {/* PLAYER 1: BRASS PEGS (Outer Track) */}
        <g className="transition-all duration-300" style={{ transformOrigin: `${p1Back.x}px ${p1Back.y}px` }}>
          <ellipse cx={p1Back.x + 1} cy={p1Back.y + 1} rx="4" ry="4" fill="#000" opacity="0.45" />
          <circle cx={p1Back.x} cy={p1Back.y} r="3.6" fill="url(#brassPeg)" stroke="#78350f" strokeWidth="0.8" />
          <circle cx={p1Back.x - 1} cy={p1Back.y - 1} r="1.1" fill="#fff" opacity="0.75" />
        </g>

        <g
          className="transition-all duration-300"
          style={{
            transformOrigin: `${p1Front.x}px ${p1Front.y}px`,
            animation: isLeapingP1 ? 'pegLeapfrogArc 450ms cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined,
          }}
        >
          <ellipse
            cx={p1Front.x + 1.2}
            cy={p1Front.y + 1.2}
            rx="4.5"
            ry="4.5"
            fill="#000"
            opacity="0.55"
            style={{
              animation: isLeapingP1 ? 'pegLeapfrogShadow 450ms ease-in-out' : undefined,
            }}
          />
          <circle cx={p1Front.x} cy={p1Front.y} r="4.2" fill="url(#brassPeg)" stroke="#78350f" strokeWidth="0.9" />
          <circle cx={p1Front.x - 1.2} cy={p1Front.y - 1.2} r="1.4" fill="#fff" opacity="0.85" />
        </g>

        {/* PLAYER 2: STAINLESS STEEL PEGS (Inner Track) */}
        <g className="transition-all duration-300" style={{ transformOrigin: `${p2Back.x}px ${p2Back.y}px` }}>
          <ellipse cx={p2Back.x + 1} cy={p2Back.y + 1} rx="4" ry="4" fill="#000" opacity="0.45" />
          <circle cx={p2Back.x} cy={p2Back.y} r="3.6" fill="url(#steelPeg)" stroke="#1e293b" strokeWidth="0.8" />
          <circle cx={p2Back.x - 1} cy={p2Back.y - 1} r="1.1" fill="#fff" opacity="0.75" />
        </g>

        <g
          className="transition-all duration-300"
          style={{
            transformOrigin: `${p2Front.x}px ${p2Front.y}px`,
            animation: isLeapingP2 ? 'pegLeapfrogArc 450ms cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined,
          }}
        >
          <ellipse
            cx={p2Front.x + 1.2}
            cy={p2Front.y + 1.2}
            rx="4.5"
            ry="4.5"
            fill="#000"
            opacity="0.55"
            style={{
              animation: isLeapingP2 ? 'pegLeapfrogShadow 450ms ease-in-out' : undefined,
            }}
          />
          <circle cx={p2Front.x} cy={p2Front.y} r="4.2" fill="url(#steelPeg)" stroke="#1e293b" strokeWidth="0.9" />
          <circle cx={p2Front.x - 1.2} cy={p2Front.y - 1.2} r="1.4" fill="#fff" opacity="0.85" />
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

  // The Show Breakdown State
  const [activeShowScore, setActiveShowScore] = useState<{
    player: PlayerNumber;
    title: string;
    hand: CribbageCard[];
    score: CribbageHandScore;
  } | null>(null);

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
  // Award Points & Check Immediate 121-Point Walk-Off Win
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

      if (player === 1) {
        const prev = stateRef.current.scoreP1;
        const next = prev + pts;
        stateRef.current.prevScoreP1 = prev;
        stateRef.current.scoreP1 = next;
        setPrevScoreP1(prev);
        setScoreP1(next);
        if (next >= 121) {
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
        if (next >= 121) {
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
      setTurn( activeMode === 'pass-and-play' ? 1 : nonDealer );
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

      // Pegging resets
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

  // Run initial deal ONLY once on mount
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      resetGame();
    }
  }, [resetGame]);

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
  // -------------------------------------------------------------------------
  const startTheShow = useCallback(() => {
    const starter = stateRef.current.starterCut;
    if (!starter || stateRef.current.winner !== null) return;

    const curDealer = stateRef.current.dealer;
    const nonDealer: PlayerNumber = curDealer === 1 ? 2 : 1;
    const nonDealerHand = nonDealer === 1 ? stateRef.current.handP1 : stateRef.current.handP2;
    const nonDealerLabel = getPlayerLabel(nonDealer);

    setPhase('show_non_dealer');
    const nonDealerScore = scoreHand(nonDealerHand, starter, false);
    setActiveShowScore({
      player: nonDealer,
      title: `${nonDealerLabel}'s Hand (Non-Dealer Counts First)`,
      hand: nonDealerHand,
      score: nonDealerScore,
    });
    setStatusMessage(`The Show: ${nonDealerLabel} counts hand first (+${nonDealerScore.total} pts).`);
    addPoints(nonDealer, nonDealerScore.total, `${nonDealerLabel} Hand: +${nonDealerScore.total} pts`);

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
  }, [addPoints, getPlayerLabel, localPlayer]);

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
      setPhase('show_dealer');
      const dealerHand = curDealer === 1 ? handP1 : handP2;
      const dealerScore = scoreHand(dealerHand, starter, false);

      setActiveShowScore({
        player: curDealer,
        title: `${dealerLabel}'s Hand (Dealer Counts Second)`,
        hand: dealerHand,
        score: dealerScore,
      });
      setStatusMessage(`The Show: ${dealerLabel} counts hand (+${dealerScore.total} pts).`);
      addPoints(curDealer, dealerScore.total, `${dealerLabel} Hand: +${dealerScore.total} pts`);

      if (gamePlayMode === 'remote') {
        multiplayer.send({
          type: 'CRIBBAGE_ACTION',
          gameId: 'cribbage',
          payload: { action: 'SHOW_STEP', step: 'show_dealer' },
        });
      }
    } else if (phase === 'show_dealer') {
      // Step 3: Show Dealer Crib
      setPhase('show_crib');
      const cribScore = scoreHand(crib, starter, true);

      setActiveShowScore({
        player: curDealer,
        title: `${dealerLabel}'s Crib (4 Discards + Starter Cut)`,
        hand: crib,
        score: cribScore,
      });
      setStatusMessage(`The Show: ${dealerLabel} counts the Crib (+${cribScore.total} pts).`);
      addPoints(curDealer, cribScore.total, `${dealerLabel} Crib: +${cribScore.total} pts`);

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
          setPhase('show_non_dealer');

          const starter = msg.payload.starterCut;
          const curDealer = stateRef.current.dealer;
          const nonDealer: PlayerNumber = curDealer === 1 ? 2 : 1;
          const nonDealerHand = nonDealer === 1 ? msg.payload.hostHand : stateRef.current.handP2;
          const nonDealerScore = scoreHand(nonDealerHand, starter, false);

          setActiveShowScore({
            player: nonDealer,
            title: `${nonDealer === 1 ? 'Player 1' : 'Player 2'} Hand (Non-Dealer)`,
            hand: nonDealerHand,
            score: nonDealerScore,
          });
          addPoints(nonDealer, nonDealerScore.total, `${nonDealer === 1 ? 'P1' : 'P2'} Hand: +${nonDealerScore.total} pts`);
        } else if (action === 'SHOW_STEP') {
          const nextP = msg.payload.step as CribbagePhase;
          const starter = stateRef.current.starterCut;
          const curDealer = stateRef.current.dealer;
          if (!starter) return;

          if (nextP === 'show_dealer') {
            setPhase('show_dealer');
            const dealerHand = curDealer === 1 ? stateRef.current.handP1 : stateRef.current.handP2;
            const dealerScore = scoreHand(dealerHand, starter, false);
            setActiveShowScore({
              player: curDealer,
              title: `${curDealer === 1 ? 'Player 1' : 'Player 2'} Hand (Dealer)`,
              hand: dealerHand,
              score: dealerScore,
            });
            addPoints(curDealer, dealerScore.total, `${curDealer === 1 ? 'P1' : 'P2'} Hand: +${dealerScore.total} pts`);
          } else if (nextP === 'show_crib') {
            setPhase('show_crib');
            const cribScore = scoreHand(stateRef.current.crib, starter, true);
            setActiveShowScore({
              player: curDealer,
              title: `${curDealer === 1 ? 'Player 1' : 'Player 2'} Crib (The Crib)`,
              hand: stateRef.current.crib,
              score: cribScore,
            });
            addPoints(curDealer, cribScore.total, `Crib: +${cribScore.total} pts`);
          } else if (nextP === 'round_complete') {
            setPhase('round_complete');
            setActiveShowScore(null);
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
  }, [gamePlayMode, localPlayer, addPoints, startNewRound, setIsAwaitingServer, scheduleTimeout]);

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

  return (
    <GameContainer className="flex flex-col h-full w-full justify-between overflow-hidden select-none">
      <GameHeader
        gameId="cribbage"
        gameName="Cribbage (121-Point Match)"
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
      <main className="flex-1 min-h-0 flex flex-col items-center justify-between p-1.5 sm:p-2.5 overflow-hidden w-full max-w-5xl mx-auto">
        {/* Top Section: Carved Wooden Cribbage Board */}
        <div className="w-full shrink-0 flex flex-col items-center">
          <WoodenCribbageBoard
            scoreP1={scoreP1}
            prevScoreP1={prevScoreP1}
            scoreP2={scoreP2}
            prevScoreP2={prevScoreP2}
          />

          {/* Real-time Peg Score Bar */}
          <div className="w-full flex items-center justify-between px-3 py-1 bg-black/65 border border-[#3e444c] rounded-2xl shadow-md text-xs font-black mt-1 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-3 h-3 rounded-full bg-amber-400 border border-amber-600 shadow-sm shrink-0" />
              <span className="text-amber-400 truncate">
                {gamePlayMode === 'remote' && localPlayer === 1 ? 'You (Brass)' : 'P1 (Brass)'}: {scoreP1}/121
              </span>
              {dealer === 1 && (
                <span className="text-[9px] bg-amber-500 text-stone-950 px-1.5 py-0.5 rounded font-black uppercase shadow-xs shrink-0">
                  DEALER • CRIB
                </span>
              )}
            </div>

            {/* Central Callout Banner or Quick Rules Guide Button */}
            {peggingCallout ? (
              <div className="px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-stone-950 text-[10px] sm:text-[11px] font-black uppercase tracking-wider animate-bounce shadow-lg truncate">
                ✨ {peggingCallout}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowRulesModal(true)}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-amber-500/20 active:scale-95 text-stone-200 hover:text-amber-300 text-[10px] font-bold border border-white/15 transition-all cursor-pointer shrink-0"
                title="View Full Rules & Scoring Guide"
              >
                <span>📜</span>
                <span>Rules &amp; Guide</span>
              </button>
            )}

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
                : {scoreP2}/121
              </span>
              <span className="w-3 h-3 rounded-full bg-slate-300 border border-slate-500 shadow-sm shrink-0" />
            </div>
          </div>
        </div>

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
                  Score: P1 {scoreP1} pts — {getPlayerLabel(2)} {scoreP2} pts
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

      {/* The Show Itemized Scorecard Overlay (Positioned to keep top Cribbage Board visible!) */}
      {activeShowScore && (
        <div className="fixed inset-x-0 bottom-0 top-36 sm:top-44 z-40 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm animate-fade-in select-none">
          <div className="w-full max-w-md bg-stone-900 border-2 border-amber-500/70 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col items-center max-h-full overflow-hidden">
            <div className="flex items-center justify-between w-full mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400/80">
                {phase === 'show_non_dealer'
                  ? 'Step 1 of 3 • Non-Dealer First'
                  : phase === 'show_dealer'
                  ? 'Step 2 of 3 • Dealer Hand'
                  : 'Step 3 of 3 • Dealer Crib'}
              </span>
              <span className="text-xs font-black text-amber-300">
                +{activeShowScore.score.total} pts
              </span>
            </div>

            <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wide mb-2 text-center">
              🏆 {activeShowScore.title}
            </h2>

            {/* 4 Hand Cards + 1 Starter Cut Card */}
            <div className="flex items-center justify-center gap-1.5 my-1.5 bg-black/40 px-3 py-2 rounded-2xl border border-white/10">
              {activeShowScore.hand.map((c) => (
                <ProceduralCribbageCard key={c.id} card={c} small />
              ))}
              {starterCut && (
                <div className="pl-2 ml-1 border-l-2 border-amber-400/40 flex flex-col items-center">
                  <ProceduralCribbageCard card={starterCut} small />
                  <span className="text-[8px] font-black text-amber-300 uppercase mt-0.5">CUT</span>
                </div>
              )}
            </div>

            {/* Itemized Points Breakdown */}
            <div className="w-full bg-black/55 rounded-2xl p-2.5 my-2 border border-white/10 max-h-36 overflow-y-auto flex flex-col gap-1 text-xs">
              {activeShowScore.score.items.length === 0 ? (
                <div className="text-center text-stone-400 py-2 font-bold">
                  nineteen / zero combinations found (0 points).
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

            {/* Continue / Walk-off Victory Button */}
            <button
              type="button"
              onClick={proceedNextShowStep}
              className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-stone-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl active:scale-95 transition-all cursor-pointer mt-1"
            >
              {winner !== null
                ? `🏆 121+ Reached! View Match Victory ➜`
                : phase === 'show_non_dealer'
                ? `Count Dealer's Hand (${getPlayerLabel(dealer)}) ➜`
                : phase === 'show_dealer'
                ? `Count ${getPlayerLabel(dealer)}'s Crib ➜`
                : 'Finish Round ➜'}
            </button>
          </div>
        </div>
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
