import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader, type GamePlayMode } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import { RemoteDuelModal } from '../components/RemoteDuelModal';
import { GameRulesModal } from '../components/GameRulesModal';
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
  faceDown?: boolean;
}> = ({ card, isSelected, isPlayable, isDimmed, onClick, small = false, faceDown = false }) => {
  const isRed = card.isRed;
  const textColor = isRed ? 'text-rose-600' : 'text-slate-900';

  const w = small ? 'w-11 sm:w-13 h-16 sm:h-18' : 'w-14 sm:w-18 md:w-20 h-20 sm:h-26 md:h-28';

  if (faceDown) {
    return (
      <div
        className={`relative ${w} rounded-xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 border-2 border-indigo-400/40 shadow-md flex items-center justify-center p-1 select-none shrink-0 transition-transform`}
      >
        <div className="w-full h-full rounded-lg border border-indigo-500/20 bg-indigo-950/60 flex items-center justify-center">
          <span className="text-amber-400 text-xs sm:text-sm font-black opacity-60">✦</span>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick || isDimmed}
      className={`relative ${w} rounded-xl bg-[#fffefc] border-2 select-none transition-all duration-150 transform cursor-pointer flex flex-col justify-between p-1 sm:p-1.5 shrink-0 ${
        isSelected
          ? 'ring-3 ring-amber-400 -translate-y-3.5 scale-105 z-30 shadow-2xl border-amber-400'
          : isPlayable
          ? 'border-emerald-400 ring-2 ring-emerald-400/50 shadow-md hover:-translate-y-1 hover:shadow-xl'
          : isDimmed
          ? 'border-stone-300 opacity-40 shadow-xs cursor-not-allowed'
          : 'border-stone-300 shadow-sm hover:-translate-y-0.5'
      }`}
      style={{
        backgroundImage: 'radial-gradient(rgba(0,0,0,0.02) 1px, transparent 0)',
        backgroundSize: '4px 4px',
      }}
    >
      {/* Top Corner Pip */}
      <div className="flex items-center justify-between leading-none z-10 w-full px-0.5">
        <span className={`text-xs sm:text-sm font-black ${textColor}`}>
          {card.rankLabel}
        </span>
        <span className={`text-xs sm:text-sm font-black ${textColor}`}>
          {SUIT_SYMBOLS[card.suit]}
        </span>
      </div>

      {/* Center Graphic */}
      <div className="flex-1 flex flex-col items-center justify-center pointer-events-none">
        {card.rank === 11 ? (
          // Jack Royal Helm
          <div className="flex flex-col items-center">
            <span className="text-base sm:text-xl font-bold leading-none">⚔️</span>
            <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-tighter ${textColor}`}>JACK</span>
          </div>
        ) : card.rank === 12 ? (
          // Queen Diadem
          <div className="flex flex-col items-center">
            <span className="text-base sm:text-xl font-bold leading-none">👑</span>
            <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-tighter ${textColor}`}>QUEEN</span>
          </div>
        ) : card.rank === 13 ? (
          // King Crown
          <div className="flex flex-col items-center">
            <span className="text-base sm:text-xl font-bold leading-none">⚜️</span>
            <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-tighter ${textColor}`}>KING</span>
          </div>
        ) : (
          // Number Card Suit Center
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

      {/* Bottom Inverted Pip */}
      <div className="flex items-center justify-between leading-none z-10 w-full px-0.5 rotate-180">
        <span className={`text-xs sm:text-sm font-black ${textColor}`}>
          {card.rankLabel}
        </span>
        <span className={`text-xs sm:text-sm font-black ${textColor}`}>
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
 * Calculates continuous (x, y) coordinates for any hole 0..121.
 * Track 1: Outer (Brass Pegs / Player 1)
 * Track 2: Inner (Steel Pegs / Player 2)
 */
export const getBoardHoleCoords = (hole: number, track: 1 | 2): { x: number; y: number } => {
  const laneOffset = track === 1 ? -4.5 : 4.5;

  // Start Hole (Hole 0)
  if (hole <= 0) {
    return { x: 26, y: 34 + laneOffset };
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

  // Trigger Leapfrog Arc Animation and Wooden Tap on score increase
  useEffect(() => {
    if (scoreP1 > prevScoreP1) {
      setIsLeapingP1(true);
      const timer = setTimeout(() => {
        setIsLeapingP1(false);
        playWoodClackSound();
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [scoreP1, prevScoreP1]);

  useEffect(() => {
    if (scoreP2 > prevScoreP2) {
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

  // Compute peg positions
  const p1Front = getBoardHoleCoords(Math.min(121, scoreP1), 1);
  const p1Back = getBoardHoleCoords(Math.min(121, prevScoreP1), 1);
  const p2Front = getBoardHoleCoords(Math.min(121, scoreP2), 2);
  const p2Back = getBoardHoleCoords(Math.min(121, prevScoreP2), 2);

  return (
    <div className="w-full max-w-4xl mx-auto rounded-3xl p-2 sm:p-3 bg-[#241309] border-4 border-[#3e1f0d] shadow-2xl overflow-hidden select-none relative clubhouse-board-depth">
      <svg
        viewBox="0 0 660 146"
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
          height="138"
          rx="22"
          fill="url(#walnutWood)"
          stroke="#5c2e17"
          strokeWidth="2.5"
        />

        {/* Track Grooves / Guides */}
        <path
          d="M 50 30 H 610 Q 640 49 610 68 H 50 Q 20 87 50 106 H 610"
          fill="none"
          stroke="#1c0c05"
          strokeWidth="19"
          strokeLinecap="round"
          opacity="0.5"
        />

        {/* Start Line Marker */}
        <line x1="42" y1="16" x2="42" y2="44" stroke="#d97706" strokeWidth="1.5" strokeDasharray="2 2" opacity="0.8" />
        <text x="36" y="14" fill="#fbbf24" fontSize="7.5" fontWeight="900" textAnchor="end">START</text>

        {/* Double Skunk Line at 60 */}
        <line x1="337" y1="56" x2="337" y2="80" stroke="#ef4444" strokeWidth="2" strokeDasharray="2 2" />
        <text x="337" y="53" fill="#f87171" fontSize="7" fontWeight="900" textAnchor="middle">DBL SKUNK (60)</text>

        {/* Skunk Line at 90 */}
        <line x1="179.2" y1="94" x2="179.2" y2="118" stroke="#f59e0b" strokeWidth="2" strokeDasharray="2 2" />
        <text x="179.2" y="127" fill="#fbbf24" fontSize="7" fontWeight="900" textAnchor="middle">SKUNK (90)</text>

        {/* Finish Hole Marker at 121 */}
        <circle cx="636" cy="106" r="8" fill="url(#finishRing)" stroke="#fde047" strokeWidth="1.2" />
        <circle cx="636" cy="106" r="3.6" fill="url(#holeDepth)" />
        <text x="636" y="93" fill="#fde047" fontSize="7.5" fontWeight="900" textAnchor="middle">121 GAME</text>

        {/* Starting Holes (Hole 0) */}
        <circle cx="26" cy="29.5" r="2.6" fill="url(#holeDepth)" stroke="#271207" strokeWidth="0.8" />
        <circle cx="26" cy="38.5" r="2.6" fill="url(#holeDepth)" stroke="#271207" strokeWidth="0.8" />

        {/* Drilled Track Holes 1..120 */}
        {holeMarkers.map(({ hole, x1, y1, x2, y2 }) => {
          const isMilestone = hole % 5 === 0;
          return (
            <g key={hole}>
              {/* Lane 1 Drilled Hole (P1) */}
              <circle cx={x1} cy={y1} r={isMilestone ? 2.6 : 2.2} fill="url(#holeDepth)" stroke="#241106" strokeWidth="0.6" />
              {/* Lane 2 Drilled Hole (P2) */}
              <circle cx={x2} cy={y2} r={isMilestone ? 2.6 : 2.2} fill="url(#holeDepth)" stroke="#241106" strokeWidth="0.6" />

              {/* 5-Hole Block Divider Notch & Number Labels */}
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

        {/* ========================================================= */}
        {/* PHYSICAL PEGS WITH DROP SHADOWS & SPECULAR HIGHLIGHTS */}
        {/* ========================================================= */}

        {/* PLAYER 1: BRASS PEGS (Outer Track) */}
        {/* Rear Peg (P1) */}
        <g className="transition-all duration-300" style={{ transformOrigin: `${p1Back.x}px ${p1Back.y}px` }}>
          <ellipse cx={p1Back.x + 1} cy={p1Back.y + 1} rx="4" ry="4" fill="#000" opacity="0.45" />
          <circle cx={p1Back.x} cy={p1Back.y} r="3.6" fill="url(#brassPeg)" stroke="#78350f" strokeWidth="0.8" />
          <circle cx={p1Back.x - 1} cy={p1Back.y - 1} r="1.1" fill="#fff" opacity="0.75" />
        </g>

        {/* Front Lead Peg (P1) - Leaps forward on score */}
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
        {/* Rear Peg (P2) */}
        <g className="transition-all duration-300" style={{ transformOrigin: `${p2Back.x}px ${p2Back.y}px` }}>
          <ellipse cx={p2Back.x + 1} cy={p2Back.y + 1} rx="4" ry="4" fill="#000" opacity="0.45" />
          <circle cx={p2Back.x} cy={p2Back.y} r="3.6" fill="url(#steelPeg)" stroke="#1e293b" strokeWidth="0.8" />
          <circle cx={p2Back.x - 1} cy={p2Back.y - 1} r="1.1" fill="#fff" opacity="0.75" />
        </g>

        {/* Front Lead Peg (P2) - Leaps forward on score */}
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
  const { setGameStatus, resetToMenu } = useGame();

  // Mode Selection & Remote Modal
  const [gamePlayMode, setGamePlayMode] = useState<GamePlayMode>('vs-cpu');
  const [showRemoteModal, setShowRemoteModal] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);

  // Scores (Target: 121 pts)
  const [scoreP1, setScoreP1] = useState<number>(0);
  const [prevScoreP1, setPrevScoreP1] = useState<number>(0);
  const [scoreP2, setScoreP2] = useState<number>(0);
  const [prevScoreP2, setPrevScoreP2] = useState<number>(0);

  // Match State Machine
  const [dealer, setDealer] = useState<PlayerNumber>(1); // Dealer holds Crib
  const [turn, setTurn] = useState<PlayerNumber>(2); // Non-dealer plays first in pegging
  const [phase, setPhase] = useState<CribbagePhase>('dealing');

  // Dealt Hands & Crib
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

  // Pegging Phase State (Play to 31)
  const [peggingHandP1, setPeggingHandP1] = useState<CribbageCard[]>([]);
  const [peggingHandP2, setPeggingHandP2] = useState<CribbageCard[]>([]);
  const [currentRunningCount, setCurrentRunningCount] = useState<number>(0);
  const [activeCycleSequence, setActiveCycleSequence] = useState<CribbageCard[]>([]);
  const [, setPeggingHistory] = useState<{ card: CribbageCard; player: PlayerNumber; count: number }[]>([]);
  const [lastPlayerToPeg, setLastPlayerToPeg] = useState<PlayerNumber | null>(null);
  const [, setP1SaidGo] = useState<boolean>(false);
  const [, setP2SaidGo] = useState<boolean>(false);

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

  // Ref to hold latest state for async callbacks & network handlers
  const stateRef = useRef({
    scoreP1,
    scoreP2,
    dealer,
    turn,
    phase,
    starterCut,
    handP1,
    handP2,
    crib,
    peggingHandP1,
    peggingHandP2,
    currentRunningCount,
    activeCycleSequence,
    lastPlayerToPeg,
    winner,
  });

  useEffect(() => {
    stateRef.current = {
      scoreP1,
      scoreP2,
      dealer,
      turn,
      phase,
      starterCut,
      handP1,
      handP2,
      crib,
      peggingHandP1,
      peggingHandP2,
      currentRunningCount,
      activeCycleSequence,
      lastPlayerToPeg,
      winner,
    };
  });

  const handlersRef = useRef<{
    proceedToStarterCut: (p1Cards: CribbageCard[], p2Cards: CribbageCard[]) => void;
    handleEndOfCycle: (pointEarner: PlayerNumber) => void;
    checkPeggingRoundOver: () => void;
    startTheShow: () => void;
  }>({
    proceedToStarterCut: () => {},
    handleEndOfCycle: () => {},
    checkPeggingRoundOver: () => {},
    startTheShow: () => {},
  });

  // -------------------------------------------------------------------------
  // Unified Remote Multiplayer Hook
  // -------------------------------------------------------------------------
  const {
    localPlayer,
    opponentPlayer: _opponentPlayer,
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
      // 45s turn timer fallback
      if (isMyTurn && winner === null) {
        if (phase === 'discarding') {
          // Auto select first 2 cards
          const myH = localPlayer === 1 ? handP1 : handP2;
          if (myH.length >= 2) {
            handleConfirmDiscards([myH[0], myH[1]]);
          }
        } else if (phase === 'pegging') {
          // Auto peg legal card or Go
          const myH = localPlayer === 1 ? peggingHandP1 : peggingHandP2;
          const legals = getLegalPeggingCards(myH, currentRunningCount);
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

  // Check Game Winner (121 Points)
  const addPoints = useCallback((player: PlayerNumber, pts: number, reason = '') => {
    if (pts <= 0 || stateRef.current.winner !== null) return;

    playWoodClackSound();
    triggerHaptic('medium');

    if (reason) {
      setPeggingCallout(reason);
      setTimeout(() => setPeggingCallout(null), 2400);
    }

    if (player === 1) {
      setScoreP1((prev) => {
        setPrevScoreP1(prev);
        const next = prev + pts;
        if (next >= 121) {
          setWinner(1);
          playVictorySound();
        }
        return next;
      });
    } else {
      setScoreP2((prev) => {
        setPrevScoreP2(prev);
        const next = prev + pts;
        if (next >= 121) {
          setWinner(2);
          playVictorySound();
        }
        return next;
      });
    }
  }, []);

  // -------------------------------------------------------------------------
  // Start New Round / Deal
  // -------------------------------------------------------------------------
  const startNewRound = useCallback((newDealer?: PlayerNumber) => {
    const nextDealer = newDealer !== undefined ? newDealer : (dealer === 1 ? 2 : 1);
    const deck = shuffleDeck(createStandardDeck());

    // Deal 6 cards to each player, 1 starter cut
    const p1Dealt = deck.slice(0, 6);
    const p2Dealt = deck.slice(6, 12);
    const starter = deck[12];

    setDealer(nextDealer);
    setTurn(nextDealer === 1 ? 2 : 1); // Non-dealer plays first
    setHandP1(p1Dealt);
    setHandP2(p2Dealt);
    setCrib([]);
    setStarterCut(starter);
    setSelectedDiscards([]);
    setP1DiscardReady(false);
    setP2DiscardReady(false);
    setRemoteOpponentCardCount(6);
    setPhase('discarding');

    // Pegging resets
    setPeggingHandP1([]);
    setPeggingHandP2([]);
    setCurrentRunningCount(0);
    setActiveCycleSequence([]);
    setPeggingHistory([]);
    setLastPlayerToPeg(null);
    setP1SaidGo(false);
    setP2SaidGo(false);
    setActiveShowScore(null);
    setPeggingCallout(null);

    const dealerName = nextDealer === 1 ? 'Player 1' : gamePlayMode === 'vs-cpu' ? '🤖 CPU' : 'Player 2';
    setStatusMessage(`Round started! ${dealerName} is Dealer. Select 2 cards to toss into the Crib.`);

    // If Remote Mode & Host: Broadcast sanitized deal to Guest (Host cards stripped!)
    if (gamePlayMode === 'remote' && localPlayer === 1) {
      multiplayer.send({
        type: 'CRIBBAGE_ACTION',
        gameId: 'cribbage',
        payload: {
          action: 'DEAL',
          guestHand: p2Dealt,
          dealer: nextDealer,
          scoreP1,
          scoreP2,
          prevScoreP1,
          prevScoreP2,
          opponentCardCount: 6,
        },
      });
    }
  }, [dealer, gamePlayMode, localPlayer, scoreP1, scoreP2, prevScoreP1, prevScoreP2]);

  // Initial Game Reset
  const resetGame = useCallback(() => {
    setScoreP1(0);
    setPrevScoreP1(0);
    setScoreP2(0);
    setPrevScoreP2(0);
    setWinner(null);
    setGameStatus('active');
    startNewRound(1);
  }, [setGameStatus, startNewRound]);

  useEffect(() => {
    resetGame();
  }, [resetGame]);

  // -------------------------------------------------------------------------
  // CPU Discard Selection
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (gamePlayMode === 'vs-cpu' && phase === 'discarding' && !p2DiscardReady && handP2.length === 6) {
      const cpuDiscards = chooseCribDiscards(handP2, dealer === 2);
      const remainingHandP2 = handP2.filter((c) => !cpuDiscards.some((d) => d.id === c.id));

      setTimeout(() => {
        setHandP2(remainingHandP2);
        setCrib((prev) => [...prev, ...cpuDiscards]);
        setP2DiscardReady(true);
      }, 700);
    }
  }, [gamePlayMode, phase, p2DiscardReady, handP2, dealer]);

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
      return [prev[1], cardId]; // Replace oldest selection
    });
  };

  const handleConfirmDiscards = (cardsToDiscard?: CribbageCard[]) => {
    if (phase !== 'discarding') return;

    // Determine which player is acting based on mode
    const actingPlayer: PlayerNumber = gamePlayMode === 'remote'
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
      setCrib((prev) => [...prev, ...discarded]);
      setSelectedDiscards([]);
      setP1DiscardReady(true);

      if (gamePlayMode === 'vs-cpu') {
        proceedToStarterCut(nextHandP1, handP2);
      } else if (gamePlayMode === 'pass-and-play') {
        if (!p2DiscardReady) {
          setStatusMessage('Player 1 discarded. Player 2: select 2 cards for the Crib.');
        } else {
          proceedToStarterCut(nextHandP1, handP2);
        }
      } else if (gamePlayMode === 'remote') {
        // Host (P1) informs Guest of discard
        multiplayer.send({
          type: 'CRIBBAGE_ACTION',
          gameId: 'cribbage',
          payload: {
            action: 'HOST_DISCARD_READY',
          },
        });
        if (p2DiscardReady) {
          proceedToStarterCut(nextHandP1, handP2);
        } else {
          setStatusMessage('Your 2 cards tossed to Crib. Awaiting opponent discards...');
        }
      }
    } else {
      // Player 2 discarding
      const nextHandP2 = handP2.filter((c) => !discarded.some((d) => d.id === c.id));
      setHandP2(nextHandP2);
      setCrib((prev) => [...prev, ...discarded]);
      setSelectedDiscards([]);
      setP2DiscardReady(true);

      if (gamePlayMode === 'pass-and-play') {
        proceedToStarterCut(handP1, nextHandP2);
      } else if (gamePlayMode === 'remote') {
        // Guest (P2) transmits 2 discards to Host
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
  // Starter Cut Reveal & His Heels Check
  // -------------------------------------------------------------------------
  const proceedToStarterCut = (p1Cards: CribbageCard[], p2Cards: CribbageCard[]) => {
    setPhase('cut_reveal');
    playCardPlaceSound();

    if (!starterCut) return;

    // Check "His Heels" (Jack as Cut Card) -> Dealer immediately pegs 2 pts!
    const isHeels = checkHisHeels(starterCut);
    if (isHeels) {
      setTimeout(() => {
        addPoints(dealer, 2, 'Two for His Heels! (+2)');
      }, 600);
    }

    // If Remote Mode & Host: Broadcast Cut Card to Guest
    if (gamePlayMode === 'remote' && localPlayer === 1) {
      multiplayer.send({
        type: 'CRIBBAGE_ACTION',
        gameId: 'cribbage',
        payload: {
          action: 'REVEAL_CUT',
          starterCut,
          hisHeels: isHeels,
          dealer,
          scoreP1: isHeels && dealer === 1 ? scoreP1 + 2 : scoreP1,
          scoreP2: isHeels && dealer === 2 ? scoreP2 + 2 : scoreP2,
          opponentCardCount: 4,
        },
      });
    }

    // Initialize Pegging Phase
    setTimeout(() => {
      setPeggingHandP1(p1Cards);
      setPeggingHandP2(p2Cards);
      setPhase('pegging');
      const nonDealer: PlayerNumber = dealer === 1 ? 2 : 1;
      setTurn(nonDealer);
      const leadName = nonDealer === 1 ? 'Player 1' : gamePlayMode === 'vs-cpu' ? '🤖 CPU' : 'Player 2';
      setStatusMessage(`The Play to 31! ${leadName} leads the first card.`);
    }, 1400);
  };

  // -------------------------------------------------------------------------
  // Pegging Phase: Play Card
  // -------------------------------------------------------------------------
  const handlePlayPeggingCard = (card: CribbageCard) => {
    if (phase !== 'pegging' || winner !== null) return;
    if (gamePlayMode === 'remote' && (!isMyTurn || isAwaitingServer)) return;

    playCardPlaceSound();
    triggerHaptic('medium');

    const result = evaluatePeggingPlay(activeCycleSequence, card);
    const newCount = result.newRunningTotal;

    // Add card to sequence and history
    const nextSeq = [...activeCycleSequence, card];
    setActiveCycleSequence(nextSeq);
    setPeggingHistory((prev) => [...prev, { card, player: turn, count: newCount }]);
    setCurrentRunningCount(newCount);
    setLastPlayerToPeg(turn);

    // Remove from player's pegging hand
    if (turn === 1) {
      setPeggingHandP1((prev) => prev.filter((c) => c.id !== card.id));
    } else {
      setPeggingHandP2((prev) => prev.filter((c) => c.id !== card.id));
    }

    // Award Points
    if (result.totalPoints > 0) {
      const descriptions = result.details.map((d) => d.description).join(' • ');
      addPoints(turn, result.totalPoints, descriptions);
    }

    // Reset Go flags on any successful play
    setP1SaidGo(false);
    setP2SaidGo(false);

    // Check next turn player
    const opp: PlayerNumber = turn === 1 ? 2 : 1;
    const oppHand = opp === 1 ? peggingHandP1 : peggingHandP2;
    const currentHand = turn === 1
      ? peggingHandP1.filter((c) => c.id !== card.id)
      : peggingHandP2.filter((c) => c.id !== card.id);

    const oppCanPeg = canPlayerPeg(oppHand, newCount);
    const curCanPeg = canPlayerPeg(currentHand, newCount);
    const nextTurnToPlay = oppCanPeg ? opp : (curCanPeg ? turn : opp);

    // If Remote Mode: Broadcast Pegging Play to Opponent
    if (gamePlayMode === 'remote') {
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
          nextTurn: nextTurnToPlay,
        },
      });
    }

    // If Hit Exactly 31: Count resets to 0 immediately!
    if (result.isThirtyOne) {
      setTimeout(() => {
        setActiveCycleSequence([]);
        setCurrentRunningCount(0);
        checkPeggingRoundOver();
      }, 900);
      return;
    }

    // Advance turn to other player if they can peg
    if (oppCanPeg) {
      setTurn(opp);
      setStatusMessage(`Count is ${newCount}. Player ${opp}'s turn.`);
    } else {
      // Opponent cannot peg -> Prompt them for "Go" or switch back to current player if they can continue
      if (curCanPeg) {
        setStatusMessage(`Count is ${newCount}. Opponent cannot play. Player ${turn} continues!`);
      } else {
        // Neither can play! Last card pegger earns 1 pt for "Go / Last Card"
        setTimeout(() => {
          handleEndOfCycle(turn);
        }, 800);
      }
    }
  };

  // -------------------------------------------------------------------------
  // Declare "Go"
  // -------------------------------------------------------------------------
  const handleDeclareGo = () => {
    if (phase !== 'pegging' || winner !== null) return;

    playTapSound();
    triggerHaptic('light');

    const opp: PlayerNumber = turn === 1 ? 2 : 1;
    const oppHand = opp === 1 ? peggingHandP1 : peggingHandP2;

    if (turn === 1) setP1SaidGo(true);
    else setP2SaidGo(true);

    const oppCanPeg = canPlayerPeg(oppHand, currentRunningCount);

    if (gamePlayMode === 'remote') {
      multiplayer.send({
        type: 'CRIBBAGE_ACTION',
        gameId: 'cribbage',
        payload: {
          action: 'PEG_GO',
          player: localPlayer,
          isCycleEnd: !oppCanPeg,
          pointEarner: lastPlayerToPeg || opp,
        },
      });
    }

    if (oppCanPeg) {
      setTurn(opp);
      setStatusMessage(`Player ${turn} declared GO! Player ${opp} must play as many cards as possible.`);
    } else {
      // Neither player can play -> Cycle complete!
      const lastPlayer = lastPlayerToPeg || opp;
      handleEndOfCycle(lastPlayer);
    }
  };

  const handleEndOfCycle = (pointEarner: PlayerNumber) => {
    addPoints(pointEarner, 1, 'One for Go / Last Card (+1)');

    setTimeout(() => {
      setActiveCycleSequence([]);
      setCurrentRunningCount(0);
      setP1SaidGo(false);
      setP2SaidGo(false);
      setLastPlayerToPeg(null);

      checkPeggingRoundOver();
    }, 900);
  };

  const checkPeggingRoundOver = () => {
    // If all cards from both hands are exhausted, move to The Show!
    if (stateRef.current.peggingHandP1.length === 0 && stateRef.current.peggingHandP2.length === 0) {
      setPhase('show_non_dealer');
      startTheShow();
    } else {
      // Next play starts with whoever has cards remaining
      const p1Can = stateRef.current.peggingHandP1.length > 0;
      const p2Can = stateRef.current.peggingHandP2.length > 0;
      if (p1Can && !p2Can) setTurn(1);
      else if (!p1Can && p2Can) setTurn(2);
      else setTurn(turn === 1 ? 2 : 1);
    }
  };

  // -------------------------------------------------------------------------
  // CPU Pegging Turn Simulation
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (gamePlayMode !== 'vs-cpu' || phase !== 'pegging' || turn !== 2 || winner !== null) {
      return;
    }

    const cpuTimer = setTimeout(() => {
      const bestCard = choosePeggingCard(peggingHandP2, currentRunningCount, activeCycleSequence);
      if (bestCard) {
        handlePlayPeggingCard(bestCard);
      } else {
        handleDeclareGo();
      }
    }, 850);

    return () => clearTimeout(cpuTimer);
  }, [gamePlayMode, phase, turn, winner, peggingHandP2, currentRunningCount, activeCycleSequence]);

  // -------------------------------------------------------------------------
  // The Show: Hand & Crib Counting in Strict Tournament Order
  // -------------------------------------------------------------------------
  const startTheShow = () => {
    const starter = stateRef.current.starterCut;
    if (!starter) return;
    const curDealer = stateRef.current.dealer;
    const nonDealer: PlayerNumber = curDealer === 1 ? 2 : 1;
    const nonDealerHand = nonDealer === 1 ? stateRef.current.handP1 : stateRef.current.handP2;

    const nonDealerScore = scoreHand(nonDealerHand, starter, false);
    setActiveShowScore({
      player: nonDealer,
      title: `${nonDealer === 1 ? 'Player 1' : 'Player 2'} Hand (Non-Dealer)`,
      hand: nonDealerHand,
      score: nonDealerScore,
    });
    addPoints(nonDealer, nonDealerScore.total, `${nonDealer === 1 ? 'P1' : 'P2'} scored ${nonDealerScore.total} points!`);

    // Broadcast in remote mode
    if (gamePlayMode === 'remote' && localPlayer === 1) {
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
  };

  const proceedNextShowStep = () => {
    const starter = stateRef.current.starterCut;
    if (!starter) return;
    const curDealer = stateRef.current.dealer;

    if (phase === 'show_non_dealer') {
      // Step 2: Show Dealer Hand
      setPhase('show_dealer');
      const dealerHand = curDealer === 1 ? handP1 : handP2;
      const dealerScore = scoreHand(dealerHand, starter, false);

      setActiveShowScore({
        player: curDealer,
        title: `${curDealer === 1 ? 'Player 1' : 'Player 2'} Hand (Dealer)`,
        hand: dealerHand,
        score: dealerScore,
      });
      addPoints(curDealer, dealerScore.total, `${curDealer === 1 ? 'P1' : 'P2'} scored ${dealerScore.total} points!`);

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
        title: `${curDealer === 1 ? 'Player 1' : 'Player 2'} Crib (The Crib)`,
        hand: crib,
        score: cribScore,
      });
      addPoints(curDealer, cribScore.total, `Crib scored ${cribScore.total} points!`);

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
      setStatusMessage('Round complete! Ready for next deal.');

      if (gamePlayMode === 'remote') {
        multiplayer.send({
          type: 'CRIBBAGE_ACTION',
          gameId: 'cribbage',
          payload: { action: 'SHOW_STEP', step: 'round_complete' },
        });
      }
    }
  };

  useEffect(() => {
    handlersRef.current = {
      proceedToStarterCut,
      handleEndOfCycle,
      checkPeggingRoundOver,
      startTheShow,
    };
  });

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
          // Guest receives deal from Host (Host cards remain stripped!)
          setIsAwaitingServer(false);
          setHandP2(msg.payload.guestHand);
          setHandP1([]); // Host hand masked!
          setDealer(msg.payload.dealer);
          setTurn(msg.payload.dealer === 1 ? 2 : 1);
          setCrib([]);
          setStarterCut(null); // Masked until cut reveal!
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
          setStatusMessage('Round started! Select 2 cards to toss into the Crib.');
        } else if (action === 'HOST_DISCARD_READY') {
          // Guest learns Host has discarded 2 cards
          setP1DiscardReady(true);
          setRemoteOpponentCardCount(4);
          setStatusMessage('Opponent has discarded 2 cards to the Crib.');
        } else if (action === 'GUEST_DISCARD') {
          // Host receives Guest's 2 discards into Crib
          const { discardedCards } = msg.payload;
          setCrib((prev) => [...prev, ...discardedCards]);
          setP2DiscardReady(true);
          setRemoteOpponentCardCount(4);

          // If Host has also discarded, reveal cut card!
          if (stateRef.current.handP1.length === 4) {
            handlersRef.current.proceedToStarterCut(stateRef.current.handP1, stateRef.current.handP2);
          } else {
            setStatusMessage('Opponent tossed cards to Crib. Please select your 2 discards.');
          }
        } else if (action === 'REVEAL_CUT') {
          // Guest receives Starter Cut reveal from Host
          setStarterCut(msg.payload.starterCut);
          setPhase('cut_reveal');
          playCardPlaceSound();

          if (msg.payload.hisHeels) {
            setTimeout(() => {
              addPoints(msg.payload.dealer, 2, 'Two for His Heels! (+2)');
            }, 600);
          }

          // Advance to pegging
          setTimeout(() => {
            setPeggingHandP2(stateRef.current.handP2);
            setPhase('pegging');
            const nonDealer: PlayerNumber = msg.payload.dealer === 1 ? 2 : 1;
            setTurn(nonDealer);
            setStatusMessage(`Cut card revealed! The Play to 31: Player ${nonDealer} leads.`);
          }, 1400);
        } else if (action === 'PEG_PLAY') {
          // Peer played a card in pegging
          setIsAwaitingServer(false);
          const { card, playedBy, newRunningTotal, pointsScored, reason, isThirtyOne, nextTurn } = msg.payload;

          playCardPlaceSound();
          triggerHaptic('medium');

          setActiveCycleSequence((prev) => [...prev, card]);
          setCurrentRunningCount(newRunningTotal);
          setLastPlayerToPeg(playedBy);
          setRemoteOpponentCardCount((prev) => Math.max(0, prev - 1));

          if (pointsScored > 0) {
            addPoints(playedBy, pointsScored, reason);
          }

          setP1SaidGo(false);
          setP2SaidGo(false);

          if (isThirtyOne) {
            setTimeout(() => {
              setActiveCycleSequence([]);
              setCurrentRunningCount(0);
              handlersRef.current.checkPeggingRoundOver();
            }, 900);
          } else {
            setTurn(nextTurn);
            setStatusMessage(`Count is ${newRunningTotal}. Player ${nextTurn}'s turn.`);
          }
        } else if (action === 'PEG_GO') {
          // Peer declared GO
          const { player, isCycleEnd, pointEarner } = msg.payload;
          playTapSound();
          triggerHaptic('light');

          if (player === 1) setP1SaidGo(true);
          else setP2SaidGo(true);

          if (isCycleEnd) {
            handlersRef.current.handleEndOfCycle(pointEarner);
          } else {
            const opp: PlayerNumber = player === 1 ? 2 : 1;
            setTurn(opp);
            setStatusMessage(`Opponent declared GO! Player ${opp} must play if possible.`);
          }
        } else if (action === 'START_SHOW') {
          // Both receive The Show with all cards now legally revealed
          setHandP1(msg.payload.hostHand);
          setCrib(msg.payload.crib);
          setStarterCut(msg.payload.starterCut);
          setPhase('show_non_dealer');

          const starter = msg.payload.starterCut;
          const nonDealer: PlayerNumber = dealer === 1 ? 2 : 1;
          const nonDealerHand = nonDealer === 1 ? msg.payload.hostHand : handP2;
          const nonDealerScore = scoreHand(nonDealerHand, starter, false);

          setActiveShowScore({
            player: nonDealer,
            title: `${nonDealer === 1 ? 'Player 1' : 'Player 2'} Hand (Non-Dealer)`,
            hand: nonDealerHand,
            score: nonDealerScore,
          });
          addPoints(nonDealer, nonDealerScore.total, `${nonDealer === 1 ? 'P1' : 'P2'} scored ${nonDealerScore.total} points!`);
        } else if (action === 'SHOW_STEP') {
          const nextP = msg.payload.step as CribbagePhase;
          const starter = stateRef.current.starterCut;
          if (!starter) return;

          if (nextP === 'show_dealer') {
            setPhase('show_dealer');
            const dealerHand = dealer === 1 ? handP1 : handP2;
            const dealerScore = scoreHand(dealerHand, starter, false);
            setActiveShowScore({
              player: dealer,
              title: `${dealer === 1 ? 'Player 1' : 'Player 2'} Hand (Dealer)`,
              hand: dealerHand,
              score: dealerScore,
            });
            addPoints(dealer, dealerScore.total, `${dealer === 1 ? 'P1' : 'P2'} scored ${dealerScore.total} points!`);
          } else if (nextP === 'show_crib') {
            setPhase('show_crib');
            const cribScore = scoreHand(crib, starter, true);
            setActiveShowScore({
              player: dealer,
              title: `${dealer === 1 ? 'Player 1' : 'Player 2'} Crib (The Crib)`,
              hand: crib,
              score: cribScore,
            });
            addPoints(dealer, cribScore.total, `Crib scored ${cribScore.total} points!`);
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
  }, [gamePlayMode, localPlayer, dealer, handP2, handP1, crib, addPoints, startNewRound, setIsAwaitingServer]);

  // Perspective Normalization:
  // Local player always sees their hand at bottom of screen!
  const myCurrentHand = useMemo(() => {
    if (gamePlayMode === 'remote') {
      return localPlayer === 1 ? handP1 : handP2;
    }
    if (gamePlayMode === 'pass-and-play') {
      if (phase === 'discarding') {
        return p1DiscardReady ? handP2 : handP1;
      }
      return turn === 1 ? handP1 : handP2;
    }
    return handP1;
  }, [gamePlayMode, localPlayer, handP1, handP2, phase, p1DiscardReady, turn]);

  const myPeggingHand = useMemo(() => {
    if (gamePlayMode === 'remote') {
      return localPlayer === 1 ? peggingHandP1 : peggingHandP2;
    }
    if (gamePlayMode === 'pass-and-play') {
      return turn === 1 ? peggingHandP1 : peggingHandP2;
    }
    return peggingHandP1;
  }, [gamePlayMode, localPlayer, peggingHandP1, peggingHandP2, turn]);

  const isMyPeggingTurn = useMemo(() => {
    if (gamePlayMode === 'remote') {
      return localPlayer === turn;
    }
    if (gamePlayMode === 'vs-cpu') {
      return turn === 1;
    }
    return true;
  }, [gamePlayMode, localPlayer, turn]);

  return (
    <GameContainer className="flex flex-col h-full w-full justify-between overflow-hidden select-none">
      <GameHeader
        gameId="cribbage"
        gameName="Cribbage (121-Point Match)"
        turn={turn}
        onRestart={resetGame}
        statusMessage={statusMessage}
        gameMode={gamePlayMode}
        onToggleGameMode={(m) => {
          setGamePlayMode(m);
          resetGame();
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
          <div className="w-full flex items-center justify-between px-3 py-1 bg-black/60 border border-[#3e444c] rounded-2xl shadow-md text-xs font-black mt-1">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-amber-600 shadow-sm" />
              <span className="text-amber-400">
                {gamePlayMode === 'remote' && localPlayer === 1 ? 'You (Brass)' : 'P1 (Brass)'}: {scoreP1} / 121 pts
              </span>
              {dealer === 1 && (
                <span className="text-[9px] bg-amber-500 text-stone-950 px-1.5 py-0.5 rounded font-black uppercase shadow-xs">
                  DEALER
                </span>
              )}
            </div>

            {/* Central Callout Banner or Quick Rules Guide Button */}
            {peggingCallout ? (
              <div className="px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-stone-950 text-[11px] font-black uppercase tracking-wider animate-bounce shadow-lg">
                ✨ {peggingCallout}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowRulesModal(true)}
                className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/10 hover:bg-amber-500/20 active:scale-95 text-stone-300 hover:text-amber-300 text-[10px] font-bold border border-white/10 transition-all cursor-pointer"
                title="View Full Rules & Scoring Guide"
              >
                <span>📜</span>
                <span>Rules & Guide</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              {dealer === 2 && (
                <span className="text-[9px] bg-slate-300 text-stone-950 px-1.5 py-0.5 rounded font-black uppercase shadow-xs">
                  DEALER
                </span>
              )}
              <span className="text-slate-300">
                {gamePlayMode === 'vs-cpu' ? '🤖 CPU' : gamePlayMode === 'remote' && localPlayer === 2 ? 'You (Steel)' : 'P2 (Steel)'}: {scoreP2} / 121 pts
              </span>
              <span className="w-3.5 h-3.5 rounded-full bg-slate-300 border border-slate-500 shadow-sm" />
            </div>
          </div>
        </div>

        {/* Central Card Table Area */}
        <div className="flex-1 min-h-0 w-full flex items-center justify-between gap-2 p-1 relative">
          {/* Left Wing: Dealer's Crib Box */}
          <div className="flex flex-col items-center p-2 rounded-2xl bg-black/40 border border-white/10 shrink-0">
            <span className="text-[10px] font-black text-amber-300/80 uppercase mb-1">
              {dealer === 1 ? 'P1 Crib' : gamePlayMode === 'vs-cpu' ? 'CPU Crib' : 'P2 Crib'} ({crib.length}/4)
            </span>
            <div className="flex items-center justify-center gap-1">
              {crib.length === 0 ? (
                <div className="w-12 h-16 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center text-[10px] text-white/40 font-bold text-center px-1">
                  Awaiting Discards
                </div>
              ) : phase === 'show_crib' ? (
                crib.map((c) => <ProceduralCribbageCard key={c.id} card={c} small />)
              ) : (
                <div className="flex -space-x-4">
                  {crib.map((c) => <ProceduralCribbageCard key={c.id} card={c} faceDown small />)}
                </div>
              )}
            </div>
          </div>

          {/* Center Play Area: Pegging Sequence & Running Count Badge */}
          <div className="flex-1 flex flex-col items-center justify-center h-full px-2">
            {/* Remote Opponent Card Rack (Masked face-down cards) */}
            {gamePlayMode === 'remote' && (
              <div className="flex items-center gap-1 mb-2">
                <span className="text-[9px] font-bold text-stone-400 uppercase mr-1">Opponent:</span>
                {Array.from({ length: remoteOpponentCardCount }).map((_, i) => (
                  <ProceduralCribbageCard
                    key={`opp-card-${i}`}
                    card={{ id: `opp-${i}`, suit: 'spades', rank: 1, value: 1, rankLabel: 'A', isRed: false }}
                    faceDown
                    small
                  />
                ))}
              </div>
            )}

            {phase === 'pegging' && (
              <div className="flex flex-col items-center gap-1">
                {/* 31 Count Dial Badge */}
                <div className="flex items-center gap-2 px-4 py-1 rounded-full bg-black/70 border border-amber-500/50 text-white shadow-xl">
                  <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">COUNT:</span>
                  <span className="text-base font-black text-amber-300">{currentRunningCount}</span>
                  <span className="text-xs text-stone-400 font-bold">/ 31</span>
                </div>

                {/* Beginner Pegging Points Quick Reference */}
                <div className="text-[9px] font-semibold text-stone-400/90 tracking-tight text-center">
                  15 = 2pts • 31 = 2pts • Pair = 2pts • Run = 1pt/card • Go = 1pt
                </div>

                {/* Cards played in this 31 cycle */}
                <div className="flex items-center justify-center gap-1.5 flex-wrap min-h-16 py-1">
                  {activeCycleSequence.map((c) => (
                    <ProceduralCribbageCard key={c.id} card={c} small />
                  ))}
                </div>

                {/* "Say Go" Action Button */}
                {isMyPeggingTurn && !canPlayerPeg(myPeggingHand, currentRunningCount) && (
                  <button
                    type="button"
                    onClick={handleDeclareGo}
                    className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 animate-pulse transition-all cursor-pointer"
                  >
                    📢 Claim "GO"
                  </button>
                )}
              </div>
            )}

            {/* Discard Phase Action Header with Beginner Strategy Tips */}
            {phase === 'discarding' && (
              <div className="flex flex-col items-center gap-1.5 bg-black/50 px-4 py-2 rounded-2xl border border-white/10 text-center">
                <span className="text-xs font-bold text-amber-200">
                  Select 2 cards to toss to {dealer === (gamePlayMode === 'remote' ? localPlayer : 1) ? 'Your' : "Opponent's"} Crib
                </span>
                <span className="text-[10px] text-stone-400 font-medium">
                  {dealer === (gamePlayMode === 'remote' ? localPlayer : 1)
                    ? '💡 Tip: Feed your own Crib with 5s, pairs, or connectors!'
                    : '💡 Tip: Balk opponent\'s Crib with safe unconnected cards (K, 2, etc.)'}
                </span>
                <button
                  type="button"
                  onClick={() => handleConfirmDiscards()}
                  disabled={selectedDiscards.length !== 2}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-stone-950 font-black text-xs uppercase tracking-wider shadow-xl active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  Toss to Crib ({selectedDiscards.length}/2)
                </button>
              </div>
            )}
          </div>

          {/* Right Wing: Starter Cut Card Riser */}
          <div className="flex flex-col items-center p-2 rounded-2xl bg-black/40 border border-white/10 shrink-0">
            <span className="text-[10px] font-black text-amber-300/80 uppercase mb-1">
              Starter Cut
            </span>
            {starterCut && phase !== 'dealing' && phase !== 'discarding' ? (
              <div className="relative transform hover:scale-105 transition-transform">
                {/* 3D Stacked Deck Riser Underneath */}
                <div className="absolute -bottom-1 -right-1 w-full h-full rounded-xl bg-slate-900 border border-indigo-500/20 shadow-lg -z-10" />
                <ProceduralCribbageCard card={starterCut} small />
              </div>
            ) : (
              <div className="w-12 h-16 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center text-[10px] text-white/40 font-bold text-center px-1">
                Deck Cut
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section: Active Player Hand & Controls */}
        <div className="w-full flex flex-col items-center shrink-0 px-2 py-1 bg-black/40 border-t border-white/10 rounded-2xl">
          <div className="w-full flex items-center justify-between text-xs font-bold text-stone-300 mb-1 px-2">
            <span>
              Your Hand ({phase === 'pegging' ? myPeggingHand.length : myCurrentHand.length} cards)
            </span>
            {phase === 'pegging' && isMyPeggingTurn && (
              <span className="text-emerald-400 font-black animate-pulse">
                Your Turn to Peg
              </span>
            )}
          </div>

          {/* Card Carousel Rack */}
          <div className="w-full flex items-center justify-center gap-1.5 sm:gap-2 overflow-x-auto py-1">
            {phase === 'pegging' ? (
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

      {/* The Show Itemized Scorecard Modal */}
      {activeShowScore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
          <div className="w-full max-w-md bg-stone-900 border-2 border-amber-500/60 rounded-3xl p-5 shadow-2xl flex flex-col items-center">
            <h2 className="text-lg font-black text-amber-300 uppercase tracking-wider mb-2">
              🏆 The Show: {activeShowScore.title}
            </h2>

            {/* Cards Scored */}
            <div className="flex items-center justify-center gap-1.5 my-2">
              {activeShowScore.hand.map((c) => (
                <ProceduralCribbageCard key={c.id} card={c} small />
              ))}
              {starterCut && (
                <div className="pl-2 border-l border-white/20">
                  <ProceduralCribbageCard card={starterCut} small />
                </div>
              )}
            </div>

            {/* Itemized Points Breakdown */}
            <div className="w-full bg-black/50 rounded-2xl p-3 my-2 border border-white/10 max-h-48 overflow-y-auto flex flex-col gap-1 text-xs">
              {activeShowScore.score.items.length === 0 ? (
                <div className="text-center text-stone-400 py-2 font-bold">
                  No combinations found (0 points).
                </div>
              ) : (
                activeShowScore.score.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-stone-200 py-0.5 border-b border-white/5">
                    <span>{item.description}</span>
                    <span className="font-black text-amber-400">+{item.points} pts</span>
                  </div>
                ))
              )}
            </div>

            {/* Total Score for Hand */}
            <div className="w-full flex items-center justify-between px-2 font-black text-sm text-white mb-4">
              <span>Total Hand Score:</span>
              <span className="text-base text-amber-400">+{activeShowScore.score.total} points</span>
            </div>

            {/* Continue Button */}
            <button
              type="button"
              onClick={proceedNextShowStep}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 text-stone-950 font-black text-sm uppercase tracking-wider shadow-xl active:scale-95 transition-all cursor-pointer"
            >
              Continue Next Count ➜
            </button>
          </div>
        </div>
      )}

      {/* Round Complete Next Deal Button */}
      {phase === 'round_complete' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-bounce">
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
            className="px-8 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-black text-sm uppercase tracking-wider shadow-2xl active:scale-95 transition-all cursor-pointer"
          >
            🔀 Deal Next Round
          </button>
        </div>
      )}

      {/* Game Over Modal (121 Points Terminal Win) */}
      {winner !== null && (
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
              p1Value: winner === 1 && scoreP2 <= 60 ? 'Double Skunked Opponent!' : winner === 1 && scoreP2 <= 90 ? 'Skunked Opponent!' : '-',
              p2Value: winner === 2 && scoreP1 <= 60 ? 'Double Skunked Opponent!' : winner === 2 && scoreP1 <= 90 ? 'Skunked Opponent!' : '-',
            },
          ]}
          onRestart={resetGame}
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
