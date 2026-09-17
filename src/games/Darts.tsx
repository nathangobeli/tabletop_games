import React, { useRef, useEffect, useCallback, useReducer } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameContainer } from '../components/GameContainer';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import {
  triggerHaptic,
  playDartHitSound,
  playChalkSound,
} from '../utils/feedback';

export type DartGameMode = '501' | 'cricket';

export type DartPhase =
  | 'POSITIONING'     // Stage 1: Dragging the base aim target zone
  | 'TIMING'          // Stage 2: Aim locked; reticle harmonic drift active; timing throw
  | 'IN_FLIGHT'       // Stage 3: Dart flying to board; all user input strictly blocked
  | 'BUST'            // 501 overshot or left at 1; bust message active
  | 'TURN_SWITCHING'  // 3 darts thrown; settling board before next player
  | 'GAME_OVER';      // Victory!

export interface ThrownDart {
  x: number;
  y: number;
  score: number;
  label: string;
  multiplier: number;
}

export interface CricketSectorState {
  p1Marks: number; // 0..3
  p2Marks: number; // 0..3
}

const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const BOARD_SIZE = 380;
const CENTER = BOARD_SIZE / 2;

// Radii in canvas px
const R_DOUBLE_BULL = 9;
const R_SINGLE_BULL = 20;
const R_TRIPLE_INNER = 88;
const R_TRIPLE_OUTER = 104;
const R_DOUBLE_INNER = 146;
const R_DOUBLE_OUTER = 162;

export const getCheckoutGuide = (score: number, isDoubleOut: boolean): string | null => {
  if (score <= 0) return null;
  if (!isDoubleOut) {
    if (score <= 20) return `Target: S${score} to win`;
    if (score <= 40 && score % 2 === 0) return `Target: S${score} or D${score / 2} to win`;
    if (score === 50) return 'Target: Bullseye (50) to win';
    return null;
  }
  // Double Out
  if (score === 50) return 'Target: Double Bull (50) to win';
  if (score <= 40 && score % 2 === 0) return `Target: D${score / 2} (Double ${score / 2}) to win`;
  if (score === 1) return 'Warning: 1 pt remaining is a Bust!';
  if (score <= 41 && score % 2 !== 0) return `Setup: S1 leaves D${(score - 1) / 2}`;
  return null;
};

// Calculate Dartboard Score from impact coordinates
export const calculateHit = (x: number, y: number): { score: number; label: string; multiplier: number; baseNumber: number } => {
  const dx = x - CENTER;
  const dy = y - CENTER;
  const r = Math.sqrt(dx * dx + dy * dy);

  if (r > R_DOUBLE_OUTER) {
    return { score: 0, label: 'MISS', multiplier: 0, baseNumber: 0 };
  }

  if (r <= R_DOUBLE_BULL) {
    return { score: 50, label: 'D-BULL (50)', multiplier: 2, baseNumber: 25 };
  }

  if (r <= R_SINGLE_BULL) {
    return { score: 25, label: 'BULL (25)', multiplier: 1, baseNumber: 25 };
  }

  // Determine Sector
  let angle = Math.atan2(dy, dx); // -PI to PI
  let normalized = angle + Math.PI / 2 + Math.PI / 20;
  while (normalized < 0) normalized += Math.PI * 2;
  while (normalized >= Math.PI * 2) normalized -= Math.PI * 2;

  const sectorIdx = Math.floor(normalized / (Math.PI / 10));
  const sectorVal = SECTORS[sectorIdx % 20];

  if (r >= R_TRIPLE_INNER && r <= R_TRIPLE_OUTER) {
    return { score: sectorVal * 3, label: `T${sectorVal} (${sectorVal * 3})`, multiplier: 3, baseNumber: sectorVal };
  }

  if (r >= R_DOUBLE_INNER && r <= R_DOUBLE_OUTER) {
    return { score: sectorVal * 2, label: `D${sectorVal} (${sectorVal * 2})`, multiplier: 2, baseNumber: sectorVal };
  }

  return { score: sectorVal, label: `S${sectorVal}`, multiplier: 1, baseNumber: sectorVal };
};

// =======================================================
// State Machine Definition & Reducer
// =======================================================

export interface DartState {
  phase: DartPhase;
  mode: DartGameMode;
  doubleOut: boolean;
  turn: PlayerNumber;
  winner: PlayerNumber | null;
  dartsLeftInTurn: number;
  statusMessage: string;
  score501P1: number;
  score501P2: number;
  turnStartScore501: number;
  cricketState: Record<number, CricketSectorState>;
  cricketPointsP1: number;
  cricketPointsP2: number;
  pinnedDarts: ThrownDart[];
}

export type DartAction =
  | { type: 'SET_MODE'; mode: DartGameMode }
  | { type: 'TOGGLE_DOUBLE_OUT' }
  | { type: 'LOCK_AIM' }
  | { type: 'UNLOCK_AIM' }
  | { type: 'START_THROW' }
  | { type: 'DART_LANDED'; dart: ThrownDart; hit: ReturnType<typeof calculateHit> }
  | { type: 'ADVANCE_TURN' }
  | { type: 'RESET_GAME'; mode?: DartGameMode };

const createInitialCricketState = (): Record<number, CricketSectorState> => ({
  20: { p1Marks: 0, p2Marks: 0 },
  19: { p1Marks: 0, p2Marks: 0 },
  18: { p1Marks: 0, p2Marks: 0 },
  17: { p1Marks: 0, p2Marks: 0 },
  16: { p1Marks: 0, p2Marks: 0 },
  15: { p1Marks: 0, p2Marks: 0 },
  25: { p1Marks: 0, p2Marks: 0 },
});

const createInitialDartState = (mode: DartGameMode = '501'): DartState => ({
  phase: 'POSITIONING',
  mode,
  doubleOut: true,
  turn: 1,
  winner: null,
  dartsLeftInTurn: 3,
  statusMessage: 'Player 1: Stage 1 - Drag target zone to aim, then lock aim!',
  score501P1: 501,
  score501P2: 501,
  turnStartScore501: 501,
  cricketState: createInitialCricketState(),
  cricketPointsP1: 0,
  cricketPointsP2: 0,
  pinnedDarts: [],
});

const dartReducer = (state: DartState, action: DartAction): DartState => {
  switch (action.type) {
    case 'SET_MODE':
      return createInitialDartState(action.mode);

    case 'TOGGLE_DOUBLE_OUT':
      return {
        ...state,
        doubleOut: !state.doubleOut,
      };

    case 'LOCK_AIM': {
      // Guard: only transition from POSITIONING
      if (state.phase !== 'POSITIONING') return state;
      return {
        ...state,
        phase: 'TIMING',
        statusMessage: 'Aim locked! Time the drift sway and tap THROW DART.',
      };
    }

    case 'UNLOCK_AIM': {
      // Guard: only transition from TIMING
      if (state.phase !== 'TIMING') return state;
      return {
        ...state,
        phase: 'POSITIONING',
        statusMessage: 'Stage 1: Drag target circle to reposition aim.',
      };
    }

    case 'START_THROW': {
      // Guard: strictly cannot throw unless in TIMING phase with darts remaining
      if (state.phase !== 'TIMING' || state.dartsLeftInTurn <= 0 || state.winner !== null) {
        return state;
      }
      return {
        ...state,
        phase: 'IN_FLIGHT',
        statusMessage: '⏳ Dart in flight...',
      };
    }

    case 'DART_LANDED': {
      // Guard: only handle landing when in flight
      if (state.phase !== 'IN_FLIGHT') return state;

      const { dart, hit } = action;
      const nextPinned = [...state.pinnedDarts, dart];
      const remainingDarts = state.dartsLeftInTurn - 1;

      // 1. Scoring Logic: 501 Countdown
      if (state.mode === '501') {
        const currentScore = state.turn === 1 ? state.score501P1 : state.score501P2;
        const rem = currentScore - dart.score;

        let isBust = false;
        let bustExplanation = '';

        if (rem < 0) {
          isBust = true;
          bustExplanation = `Overshot score (${rem} remaining).`;
        } else if (rem === 1 && state.doubleOut) {
          isBust = true;
          bustExplanation = `Cannot leave 1 remaining in Double Out.`;
        } else if (rem === 0) {
          if (state.doubleOut && dart.multiplier < 2) {
            isBust = true;
            const targetDouble = currentScore === 50 ? 'Bullseye (D-BULL)' : `Double ${currentScore / 2}`;
            bustExplanation = `In Double Out, must finish on a Double! (Need ${targetDouble}).`;
          } else {
            // Checked out!
            return {
              ...state,
              phase: 'GAME_OVER',
              winner: state.turn,
              pinnedDarts: nextPinned,
              score501P1: state.turn === 1 ? 0 : state.score501P1,
              score501P2: state.turn === 2 ? 0 : state.score501P2,
              statusMessage: `🎉 Player ${state.turn} checked out with ${dart.label}! Victory!`,
            };
          }
        }

        if (isBust) {
          return {
            ...state,
            phase: 'BUST',
            pinnedDarts: nextPinned,
            score501P1: state.turn === 1 ? state.turnStartScore501 : state.score501P1,
            score501P2: state.turn === 2 ? state.turnStartScore501 : state.score501P2,
            statusMessage: `BUST! Hit ${dart.label}. ${bustExplanation} Reset to ${state.turnStartScore501}.`,
          };
        }

        // Valid score reduction
        const newScoreP1 = state.turn === 1 ? rem : state.score501P1;
        const newScoreP2 = state.turn === 2 ? rem : state.score501P2;

        if (remainingDarts <= 0) {
          return {
            ...state,
            phase: 'TURN_SWITCHING',
            dartsLeftInTurn: 0,
            pinnedDarts: nextPinned,
            score501P1: newScoreP1,
            score501P2: newScoreP2,
            statusMessage: `Player ${state.turn} hit ${dart.label}! Turn complete.`,
          };
        }

        return {
          ...state,
          phase: 'TIMING',
          dartsLeftInTurn: remainingDarts,
          pinnedDarts: nextPinned,
          score501P1: newScoreP1,
          score501P2: newScoreP2,
          statusMessage: `Player ${state.turn} hit ${dart.label}! Remaining: ${rem}`,
        };
      }

      // 2. Scoring Logic: Cricket Mode
      const cricket = { ...state.cricketState };
      let addedP1 = 0;
      let addedP2 = 0;

      if (hit.baseNumber in cricket) {
        const sector = hit.baseNumber;
        const sectorData = { ...cricket[sector] };
        const marksEarned = hit.multiplier;

        const myMarks = state.turn === 1 ? sectorData.p1Marks : sectorData.p2Marks;
        const oppMarks = state.turn === 1 ? sectorData.p2Marks : sectorData.p1Marks;

        const neededToClose = Math.max(0, 3 - myMarks);
        const marksToApply = Math.min(marksEarned, neededToClose);
        const leftoverMarks = marksEarned - marksToApply;

        if (state.turn === 1) sectorData.p1Marks += marksToApply;
        else sectorData.p2Marks += marksToApply;

        if (leftoverMarks > 0 && oppMarks < 3) {
          const added = leftoverMarks * (sector === 25 ? 25 : sector);
          if (state.turn === 1) addedP1 += added;
          else addedP2 += added;
        }

        cricket[sector] = sectorData;

        // Check Cricket Win Condition
        const allClosed = Object.values(cricket).every((s) =>
          state.turn === 1 ? s.p1Marks >= 3 : s.p2Marks >= 3
        );
        const totalP1 = state.cricketPointsP1 + addedP1;
        const totalP2 = state.cricketPointsP2 + addedP2;

        if (allClosed && (state.turn === 1 ? totalP1 >= totalP2 : totalP2 >= totalP1)) {
          return {
            ...state,
            phase: 'GAME_OVER',
            winner: state.turn,
            pinnedDarts: nextPinned,
            cricketState: cricket,
            cricketPointsP1: totalP1,
            cricketPointsP2: totalP2,
            statusMessage: `🎉 Player ${state.turn} closed all sectors and leads points! Victory!`,
          };
        }
      }

      const nextCricketP1 = state.cricketPointsP1 + addedP1;
      const nextCricketP2 = state.cricketPointsP2 + addedP2;

      if (remainingDarts <= 0) {
        return {
          ...state,
          phase: 'TURN_SWITCHING',
          dartsLeftInTurn: 0,
          pinnedDarts: nextPinned,
          cricketState: cricket,
          cricketPointsP1: nextCricketP1,
          cricketPointsP2: nextCricketP2,
          statusMessage: `Player ${state.turn} finished 3 darts. Switching turns...`,
        };
      }

      return {
        ...state,
        phase: 'TIMING',
        dartsLeftInTurn: remainingDarts,
        pinnedDarts: nextPinned,
        cricketState: cricket,
        cricketPointsP1: nextCricketP1,
        cricketPointsP2: nextCricketP2,
        statusMessage: `Player ${state.turn} hit ${dart.label}! (${remainingDarts} darts remaining)`,
      };
    }

    case 'ADVANCE_TURN': {
      if (state.phase === 'GAME_OVER') return state;
      const nextPlayer: PlayerNumber = state.turn === 1 ? 2 : 1;
      return {
        ...state,
        phase: 'POSITIONING',
        turn: nextPlayer,
        dartsLeftInTurn: 3,
        pinnedDarts: [],
        turnStartScore501: nextPlayer === 1 ? state.score501P1 : state.score501P2,
        statusMessage: `Player ${nextPlayer}'s turn. Stage 1: Drag target zone, then lock aim!`,
      };
    }

    case 'RESET_GAME':
      return createInitialDartState(action.mode ?? state.mode);

    default:
      return state;
  }
};

export const Darts: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [state, dispatch] = useReducer(dartReducer, undefined, () => createInitialDartState('501'));

  // Sync game status with context
  useEffect(() => {
    if (state.phase === 'GAME_OVER') {
      setGameStatus('finished');
    } else {
      setGameStatus('active');
    }
  }, [state.phase, setGameStatus]);

  // Dynamic Floating Reticle & Throw State
  const stateRef = useRef<{
    baseAim: { x: number; y: number };
    isDragging: boolean;
    dragPointerStart: { x: number; y: number } | null;
    dragBaseStart: { x: number; y: number } | null;
    floatingReticle: { x: number; y: number };
    flyingDart: {
      startX: number;
      startY: number;
      targetX: number;
      targetY: number;
      progress: number;
    } | null;
  }>({
    baseAim: { x: CENTER, y: CENTER - 90 },
    isDragging: false,
    dragPointerStart: null,
    dragBaseStart: null,
    floatingReticle: { x: CENTER, y: CENTER - 90 },
    flyingDart: null,
  });

  // Handle automatic turn advance on BUST or TURN_SWITCHING
  useEffect(() => {
    if (state.phase === 'BUST') {
      triggerHaptic('warning');
      const timer = setTimeout(() => {
        playChalkSound();
        triggerHaptic('medium');
        stateRef.current.baseAim = { x: CENTER, y: CENTER - 90 };
        dispatch({ type: 'ADVANCE_TURN' });
      }, 2200);
      return () => clearTimeout(timer);
    }

    if (state.phase === 'TURN_SWITCHING') {
      const timer = setTimeout(() => {
        playChalkSound();
        triggerHaptic('medium');
        stateRef.current.baseAim = { x: CENTER, y: CENTER - 90 };
        dispatch({ type: 'ADVANCE_TURN' });
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [state.phase]);

  // Canvas Animation: Dynamic Floating Reticle with Harmonic Sine Drift, Dart Flight, & Board Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const s = stateRef.current;
      const now = performance.now();
      const nowSec = now * 0.001;

      // Autonomous chaotic harmonic drift (active in timing stage)
      if (state.phase === 'TIMING') {
        const speed1 = 2.4;
        const speed2 = 3.8;
        const speed3 = 5.2;
        const driftX = Math.sin(nowSec * speed1) * 16.5 + Math.cos(nowSec * speed2) * 8.0 + Math.sin(nowSec * speed3) * 3.5;
        const driftY = Math.cos(nowSec * 1.9) * 14.5 + Math.sin(nowSec * 3.1) * 7.0 + Math.cos(nowSec * 4.8) * 3.5;

        const reticleX = Math.max(16, Math.min(BOARD_SIZE - 16, s.baseAim.x + driftX));
        const reticleY = Math.max(16, Math.min(BOARD_SIZE - 16, s.baseAim.y + driftY));
        s.floatingReticle = { x: reticleX, y: reticleY };
      } else {
        s.floatingReticle = { x: s.baseAim.x, y: s.baseAim.y };
      }

      // Update Flying Dart
      if (s.flyingDart) {
        s.flyingDart.progress += 0.08;
        if (s.flyingDart.progress >= 1) {
          const hit = calculateHit(s.flyingDart.targetX, s.flyingDart.targetY);
          const dart: ThrownDart = {
            x: s.flyingDart.targetX,
            y: s.flyingDart.targetY,
            score: hit.score,
            label: hit.label,
            multiplier: hit.multiplier,
          };
          s.flyingDart = null;

          playDartHitSound();
          playChalkSound();
          triggerHaptic('medium');
          dispatch({ type: 'DART_LANDED', dart, hit });
        }
      }

      ctx.clearRect(0, 0, BOARD_SIZE * 2, BOARD_SIZE * 2);
      ctx.save();
      ctx.scale(2, 2);

      // 1. Rustic Oak Dartboard Cabinet Surround
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);

      // Dark sisal outer boundary ring
      ctx.fillStyle = '#09090b';
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, R_DOUBLE_OUTER + 18, 0, Math.PI * 2);
      ctx.fill();

      // 2. Bristle Sisal Sectors
      for (let i = 0; i < 20; i++) {
        const startRad = (i * 18 - 9 - 90) * (Math.PI / 180);
        const endRad = (i * 18 + 9 - 90) * (Math.PI / 180);
        const isDarkWedge = i % 2 === 0;

        // A. Outer Single Bed (between Triple and Double)
        ctx.fillStyle = isDarkWedge ? '#18181b' : '#f5f5f4';
        ctx.beginPath();
        ctx.moveTo(CENTER, CENTER);
        ctx.arc(CENTER, CENTER, R_DOUBLE_INNER, startRad, endRad);
        ctx.fill();

        // B. Inner Single Bed (between Bull and Triple)
        ctx.fillStyle = isDarkWedge ? '#18181b' : '#f5f5f4';
        ctx.beginPath();
        ctx.moveTo(CENTER, CENTER);
        ctx.arc(CENTER, CENTER, R_TRIPLE_INNER, startRad, endRad);
        ctx.fill();

        // C. Double Ring Band
        ctx.fillStyle = isDarkWedge ? '#16a34a' : '#dc2626';
        ctx.beginPath();
        ctx.arc(CENTER, CENTER, R_DOUBLE_OUTER, startRad, endRad);
        ctx.arc(CENTER, CENTER, R_DOUBLE_INNER, endRad, startRad, true);
        ctx.fill();

        // D. Triple Ring Band
        ctx.fillStyle = isDarkWedge ? '#16a34a' : '#dc2626';
        ctx.beginPath();
        ctx.arc(CENTER, CENTER, R_TRIPLE_OUTER, startRad, endRad);
        ctx.arc(CENTER, CENTER, R_TRIPLE_INNER, endRad, startRad, true);
        ctx.fill();

        // E. Sector Number on outer boundary
        const numRad = (i * 18 - 90) * (Math.PI / 180);
        const numX = CENTER + Math.cos(numRad) * (R_DOUBLE_OUTER + 10);
        const numY = CENTER + Math.sin(numRad) * (R_DOUBLE_OUTER + 10);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(SECTORS[i].toString(), numX, numY);
      }

      // 3. Thin Wire Spider Lines
      ctx.strokeStyle = '#a1a1aa';
      ctx.lineWidth = 1;
      for (let i = 0; i < 20; i++) {
        const rad = (i * 18 - 9 - 90) * (Math.PI / 180);
        ctx.beginPath();
        ctx.moveTo(CENTER + Math.cos(rad) * R_SINGLE_BULL, CENTER + Math.sin(rad) * R_SINGLE_BULL);
        ctx.lineTo(CENTER + Math.cos(rad) * R_DOUBLE_OUTER, CENTER + Math.sin(rad) * R_DOUBLE_OUTER);
        ctx.stroke();
      }

      // Wire Concentric Rings
      [R_TRIPLE_INNER, R_TRIPLE_OUTER, R_DOUBLE_INNER, R_DOUBLE_OUTER].forEach((r) => {
        ctx.beginPath();
        ctx.arc(CENTER, CENTER, r, 0, Math.PI * 2);
        ctx.stroke();
      });

      // 4. Outer Bull (Green 25)
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, R_SINGLE_BULL, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#a1a1aa';
      ctx.stroke();

      // 5. Double Bull (Red 50)
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, R_DOUBLE_BULL, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 6. Pinned Darts Rendering
      state.pinnedDarts.forEach((d) => {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.ellipse(d.x + 3, d.y + 5, 4, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(d.x, d.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + 5, d.y + 9);
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(d.x + 5, d.y + 9);
        ctx.lineTo(d.x + 7, d.y + 13);
        ctx.lineTo(d.x + 3, d.y + 12);
        ctx.closePath();
        ctx.fill();
      });

      // 7. Flying Dart in 3D Arc Motion
      if (s.flyingDart) {
        const p = s.flyingDart.progress;
        const curX = s.flyingDart.startX + (s.flyingDart.targetX - s.flyingDart.startX) * p;
        const curY = s.flyingDart.startY + (s.flyingDart.targetY - s.flyingDart.startY) * p;
        const scale = 2.8 - 1.8 * p;

        const shadowOffset = (1 - p) * 22 + 4;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(curX + shadowOffset * 0.4, curY + shadowOffset, 5 * scale, 3 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(curX, curY);
        ctx.scale(scale, scale);

        ctx.strokeStyle = '#71717a';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 6);
        ctx.stroke();

        ctx.fillStyle = '#d4af37';
        ctx.fillRect(-1.5, 6, 3, 7);

        ctx.fillStyle = state.turn === 1 ? '#3b82f6' : '#ef4444';
        ctx.beginPath();
        ctx.moveTo(-3.5, 13);
        ctx.lineTo(3.5, 13);
        ctx.lineTo(0, 20);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      // 8. Active Targeting Reticle
      if (state.dartsLeftInTurn > 0 && state.winner === null && !s.flyingDart) {
        const themeColor = state.turn === 1 ? '#60a5fa' : '#f87171';
        const glowColor = state.turn === 1 ? 'rgba(96, 165, 250, 0.4)' : 'rgba(248, 113, 113, 0.4)';

        if (state.phase === 'POSITIONING') {
          const bx = s.baseAim.x;
          const by = s.baseAim.y;

          ctx.save();
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = 12;
          ctx.strokeStyle = themeColor;
          ctx.lineWidth = 2.2;

          ctx.beginPath();
          ctx.arc(bx, by, 22, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(bx, by, 14, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(bx, by, 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = themeColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(bx - 30, by);
          ctx.lineTo(bx - 22, by);
          ctx.moveTo(bx + 22, by);
          ctx.lineTo(bx + 30, by);
          ctx.moveTo(bx, by - 30);
          ctx.lineTo(bx, by - 22);
          ctx.moveTo(bx, by + 22);
          ctx.lineTo(bx, by + 30);
          ctx.stroke();

          const estimated = calculateHit(bx, by);
          const labelText = estimated.label;
          ctx.font = 'bold 9px sans-serif';
          const badgeW = ctx.measureText(labelText).width + 8;
          const badgeH = 14;
          const badgeY = by - 31;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.strokeStyle = themeColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(bx - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#fef08a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, bx, badgeY);

          ctx.restore();
        } else if (state.phase === 'TIMING') {
          const bx = s.baseAim.x;
          const by = s.baseAim.y;
          const { x: rx, y: ry } = s.floatingReticle;

          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(bx, by, 22, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.beginPath();
          ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(rx, ry);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.shadowColor = glowColor;
          ctx.shadowBlur = 10;
          ctx.strokeStyle = themeColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(rx, ry, 14, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;

          const pulseR = 7.5 + Math.sin(nowSec * 6) * 1.5;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(rx, ry, pulseR, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(rx, ry, 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = themeColor;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(rx - 19, ry);
          ctx.lineTo(rx - 13, ry);
          ctx.moveTo(rx + 13, ry);
          ctx.lineTo(rx + 19, ry);
          ctx.moveTo(rx, ry - 19);
          ctx.lineTo(rx, ry - 13);
          ctx.moveTo(rx, ry + 13);
          ctx.lineTo(rx, ry + 19);
          ctx.stroke();

          ctx.restore();
        }
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [state.pinnedDarts, state.dartsLeftInTurn, state.turn, state.winner, state.phase]);

  // Launch Throw registering relative to reticle's actual floating coordinates
  const launchThrow = useCallback(() => {
    if (state.phase !== 'TIMING') return;

    const s = stateRef.current;
    if (s.flyingDart || state.dartsLeftInTurn <= 0 || state.winner !== null) return;

    triggerHaptic('medium');

    const targetX = Math.max(10, Math.min(BOARD_SIZE - 10, s.floatingReticle.x));
    const targetY = Math.max(10, Math.min(BOARD_SIZE - 10, s.floatingReticle.y));

    s.flyingDart = {
      startX: CENTER,
      startY: BOARD_SIZE - 15,
      targetX,
      targetY,
      progress: 0,
    };

    dispatch({ type: 'START_THROW' });
  }, [state.phase, state.dartsLeftInTurn, state.winner]);

  // Pointer / Touch Aiming - Stage 1 Drag Positioning
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (state.phase !== 'POSITIONING') return;
    if (stateRef.current.flyingDart || state.dartsLeftInTurn <= 0 || state.winner !== null) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    const scale = BOARD_SIZE / (size || 1);
    const offsetX = (rect.width - size) / 2;
    const offsetY = (rect.height - size) / 2;
    const px = (e.clientX - rect.left - offsetX) * scale;
    const py = (e.clientY - rect.top - offsetY) * scale;

    stateRef.current.isDragging = true;
    stateRef.current.dragPointerStart = { x: px, y: py };
    stateRef.current.dragBaseStart = { ...stateRef.current.baseAim };
    triggerHaptic('light');
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (!s.isDragging || !s.dragPointerStart || !s.dragBaseStart) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    const scale = BOARD_SIZE / (size || 1);
    const offsetX = (rect.width - size) / 2;
    const offsetY = (rect.height - size) / 2;
    const px = (e.clientX - rect.left - offsetX) * scale;
    const py = (e.clientY - rect.top - offsetY) * scale;

    const dx = px - s.dragPointerStart.x;
    const dy = py - s.dragPointerStart.y;

    s.baseAim.x = Math.max(25, Math.min(BOARD_SIZE - 25, s.dragBaseStart.x + dx));
    s.baseAim.y = Math.max(25, Math.min(BOARD_SIZE - 25, s.dragBaseStart.y + dy));
  };

  const handlePointerUp = () => {
    const s = stateRef.current;
    if (!s.isDragging) return;
    s.isDragging = false;
    s.dragPointerStart = null;
    s.dragBaseStart = null;
    triggerHaptic('light');
  };

  return (
    <GameContainer>
      <GameHeader
        gameId="darts"
        gameName={`Darts (${state.mode === '501' ? '501 Countdown' : 'Cricket'})`}
        turn={state.turn}
        statusMessage={state.statusMessage}
        onRestart={() => dispatch({ type: 'RESET_GAME' })}
      />

      {/* Main Container */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-between p-2 sm:p-3 overflow-hidden w-full max-w-2xl mx-auto">
        {/* Game Mode Selector & Chalkboard HUD */}
        <div className="w-full max-w-md md:max-w-lg flex items-center justify-between px-3 py-1.5 bg-container-dark/95 border border-[#3e444c] rounded-2xl shadow-md shrink-0 mb-1">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-xl border border-white/10">
            <button
              onClick={() => dispatch({ type: 'SET_MODE', mode: '501' })}
              className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase transition-all ${
                state.mode === '501' ? 'bg-amber-500 text-black shadow-sm' : 'text-accent-light/70 hover:text-white'
              }`}
            >
              501
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_MODE', mode: 'cricket' })}
              className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase transition-all ${
                state.mode === 'cricket' ? 'bg-amber-500 text-black shadow-sm' : 'text-accent-light/70 hover:text-white'
              }`}
            >
              Cricket
            </button>
          </div>

          {/* Scores Overview */}
          {state.mode === '501' ? (
            <div className="flex items-center gap-4 text-xs font-black font-mono-digital tracking-wider">
              <span className={state.turn === 1 ? 'text-player-1 scale-110 transition-transform' : 'text-white/60'}>
                P1: {state.score501P1}
              </span>
              <span className="text-white/30">|</span>
              <span className={state.turn === 2 ? 'text-player-2 scale-110 transition-transform' : 'text-white/60'}>
                P2: {state.score501P2}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-4 text-xs font-black font-mono-digital tracking-wider">
              <span className={state.turn === 1 ? 'text-player-1' : 'text-white/60'}>
                P1: {state.cricketPointsP1} pts
              </span>
              <span className="text-white/30">|</span>
              <span className={state.turn === 2 ? 'text-player-2' : 'text-white/60'}>
                P2: {state.cricketPointsP2} pts
              </span>
            </div>
          )}

          {/* Double-out toggle for 501 */}
          {state.mode === '501' && (
            <button
              onClick={() => dispatch({ type: 'TOGGLE_DOUBLE_OUT' })}
              title={
                state.doubleOut
                  ? 'Double Out is ON (regulation): Final checkout dart must be a Double (e.g. D4 for 8). Tap to switch to Open Out.'
                  : 'Open Out is ON: Any dart reducing score to 0 wins. Tap to switch to Double Out.'
              }
              className={`text-[10px] px-2.5 py-0.5 rounded-md font-black uppercase border transition-all cursor-pointer ${
                state.doubleOut
                  ? 'bg-emerald-500/25 text-emerald-400 border-emerald-500/50 shadow-sm'
                  : 'bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-sm'
              }`}
            >
              {state.doubleOut ? '🎯 Double Out' : '⚡ Open Out'}
            </button>
          )}
        </div>

        {/* 501 Checkout Suggestion Banner */}
        {state.mode === '501' && (() => {
          const currentScore = state.turn === 1 ? state.score501P1 : state.score501P2;
          const advice = getCheckoutGuide(currentScore, state.doubleOut);
          if (!advice) return null;
          return (
            <div className="flex items-center gap-1.5 px-3 py-0.5 bg-amber-500/15 border border-amber-500/30 rounded-full text-amber-300 text-[11px] font-bold font-mono-digital shadow-sm shrink-0 mb-1">
              <span>🎯</span>
              <span>{advice}</span>
            </div>
          );
        })()}

        {/* Sisal Dartboard Canvas Container with strict 1:1 Aspect Ratio Clamping */}
        <div className="flex-1 min-h-0 w-full flex items-center justify-center p-1">
          <div className="relative aspect-square w-full max-w-[min(90vw,68vh)] max-h-[min(90vw,68vh)] mx-auto clubhouse-board-depth table-flat rounded-full overflow-hidden shadow-2xl border-4 sm:border-6 border-[#3e1f0c] flex items-center justify-center bg-[#1c1917]">
            <canvas
              ref={canvasRef}
              width={BOARD_SIZE * 2}
              height={BOARD_SIZE * 2}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`w-full h-full aspect-square touch-none block ${
                state.phase === 'POSITIONING' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
              }`}
            />

            {/* Darts in Hand Indicator */}
            <div className="absolute bottom-3 left-4 flex gap-1.5 pointer-events-none bg-black/60 px-2.5 py-1 rounded-full border border-white/15">
              {[1, 2, 3].map((num) => (
                <div
                  key={num}
                  className={`w-2.5 h-6 rounded-xs transition-opacity ${
                    num <= state.dartsLeftInTurn ? (state.turn === 1 ? 'bg-player-1' : 'bg-player-2') : 'bg-stone-600 opacity-30'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Cricket Tally Card (Visible in Cricket Mode) */}
        {state.mode === 'cricket' && (
          <div className="w-full max-w-md md:max-w-lg grid grid-cols-7 gap-1 bg-black/60 p-1.5 rounded-2xl border border-[#3e444c] text-center shrink-0 mb-1">
            {[20, 19, 18, 17, 16, 15, 25].map((target) => {
              const data = state.cricketState[target];
              const p1Closed = data.p1Marks >= 3;
              const p2Closed = data.p2Marks >= 3;
              return (
                <div key={target} className="flex flex-col items-center bg-white/5 py-1 rounded-lg border border-white/5">
                  <span className="text-[10px] font-black text-amber-400">
                    {target === 25 ? 'BULL' : target}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[9px] font-bold">
                    <span className={p1Closed ? 'text-emerald-400 font-black' : 'text-player-1'}>
                      {data.p1Marks === 0 ? '-' : data.p1Marks === 1 ? '/' : data.p1Marks === 2 ? 'X' : '⨂'}
                    </span>
                    <span className="text-white/20">|</span>
                    <span className={p2Closed ? 'text-emerald-400 font-black' : 'text-player-2'}>
                      {data.p2Marks === 0 ? '-' : data.p2Marks === 1 ? '/' : data.p2Marks === 2 ? 'X' : '⨂'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Two-Stage Tactile Aiming & Throw Control Deck */}
        <div className="w-full max-w-md md:max-w-lg flex flex-col items-center gap-1.5 shrink-0 px-1">
          {state.phase === 'POSITIONING' ? (
            <div className="w-full flex flex-col gap-1.5">
              <button
                onClick={() => {
                  triggerHaptic('light');
                  dispatch({ type: 'LOCK_AIM' });
                }}
                disabled={state.dartsLeftInTurn <= 0 || state.winner !== null}
                className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  state.dartsLeftInTurn <= 0 || state.winner !== null
                    ? 'bg-stone-700 text-stone-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-400/30 cursor-pointer'
                }`}
              >
                <span>🔒 Lock Aim & Start Drift Timing</span>
              </button>
              <span className="text-[10px] text-accent-light/60 font-semibold text-center">
                Stage 1: Drag target circle on board to position • Tap Lock to begin timing
              </span>
            </div>
          ) : (
            <div className="w-full flex flex-col gap-1.5">
              <div className="w-full flex gap-2">
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    dispatch({ type: 'UNLOCK_AIM' });
                  }}
                  disabled={state.phase !== 'TIMING'}
                  className="px-3 py-2.5 rounded-xl font-bold text-xs uppercase bg-white/10 hover:bg-white/15 text-stone-200 border border-white/10 transition-all active:scale-95 flex items-center gap-1 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Reposition base target"
                >
                  <span>✏️ Adjust</span>
                </button>

                <button
                  onClick={launchThrow}
                  disabled={state.phase !== 'TIMING'}
                  className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                    state.phase !== 'TIMING'
                      ? 'bg-stone-700 text-stone-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-stone-950 border border-amber-300 shadow-amber-500/20 cursor-pointer'
                  }`}
                >
                  <span>
                    {state.phase === 'IN_FLIGHT'
                      ? '⏳ Dart in flight...'
                      : `🎯 THROW DART (${4 - state.dartsLeftInTurn}/3)`}
                  </span>
                </button>
              </div>
              <span className="text-[10px] text-amber-300/80 font-semibold text-center">
                Stage 2: Time your tap as drifting crosshairs align with your target wire!
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Game Over Modal */}
      {state.winner !== null && (
        <GameOverModal
          winner={state.winner}
          gameName={`Darts (${state.mode.toUpperCase()})`}
          onRestart={() => dispatch({ type: 'RESET_GAME' })}
          onMenu={resetToMenu}
        />
      )}
    </GameContainer>
  );
};

export default Darts;
