import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import {
  triggerHaptic,
  playDartHitSound,
  playChalkSound,
} from '../utils/feedback';

export type DartGameMode = '501' | 'cricket';

interface ThrownDart {
  x: number;
  y: number;
  score: number;
  label: string;
  multiplier: number;
}

interface CricketSectorState {
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

export const Darts: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [mode, setMode] = useState<DartGameMode>('501');
  const [doubleOut, setDoubleOut] = useState<boolean>(true);
  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [winner, setWinner] = useState<PlayerNumber | null>(null);
  const [dartsLeftInTurn, setDartsLeftInTurn] = useState<number>(3);
  const [aimStage, setAimStage] = useState<'positioning' | 'timing' | 'throwing'>('positioning');
  const [statusMessage, setStatusMessage] = useState<string>('Player 1: Stage 1 - Drag target zone to aim, then lock aim!');

  // 501 Scores
  const [score501P1, setScore501P1] = useState<number>(501);
  const [score501P2, setScore501P2] = useState<number>(501);
  const [turnStartScore501, setTurnStartScore501] = useState<number>(501);

  // Cricket State (15..20 + 25 Bull)
  const [cricketState, setCricketState] = useState<Record<number, CricketSectorState>>({
    20: { p1Marks: 0, p2Marks: 0 },
    19: { p1Marks: 0, p2Marks: 0 },
    18: { p1Marks: 0, p2Marks: 0 },
    17: { p1Marks: 0, p2Marks: 0 },
    16: { p1Marks: 0, p2Marks: 0 },
    15: { p1Marks: 0, p2Marks: 0 },
    25: { p1Marks: 0, p2Marks: 0 }, // Bullseye
  });
  const [cricketPointsP1, setCricketPointsP1] = useState<number>(0);
  const [cricketPointsP2, setCricketPointsP2] = useState<number>(0);

  // Darts currently pinned in the board for this turn
  const [pinnedDarts, setPinnedDarts] = useState<ThrownDart[]>([]);

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

  // Calculate Dartboard Score from impact coordinates
  const calculateHit = (x: number, y: number): { score: number; label: string; multiplier: number; baseNumber: number } => {
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
    // Rotate so top (-PI/2) aligns with 0
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

  // Reset Game
  const resetGame = useCallback((newMode = mode) => {
    setMode(newMode);
    setTurn(1);
    setWinner(null);
    setDartsLeftInTurn(3);
    setAimStage('positioning');
    setPinnedDarts([]);
    setScore501P1(501);
    setScore501P2(501);
    setTurnStartScore501(501);
    setCricketPointsP1(0);
    setCricketPointsP2(0);
    setCricketState({
      20: { p1Marks: 0, p2Marks: 0 },
      19: { p1Marks: 0, p2Marks: 0 },
      18: { p1Marks: 0, p2Marks: 0 },
      17: { p1Marks: 0, p2Marks: 0 },
      16: { p1Marks: 0, p2Marks: 0 },
      15: { p1Marks: 0, p2Marks: 0 },
      25: { p1Marks: 0, p2Marks: 0 },
    });
    stateRef.current.baseAim = { x: CENTER, y: CENTER - 90 };
    setStatusMessage(`Player 1: Stage 1 - Drag target zone to aim, then lock aim!`);
  }, [mode]);

  // Turn Advancement
  const advanceTurn = useCallback(() => {
    playChalkSound();
    triggerHaptic('medium');
    const nextPlayer: PlayerNumber = turn === 1 ? 2 : 1;
    setTurn(nextPlayer);
    setDartsLeftInTurn(3);
    setAimStage('positioning');
    setPinnedDarts([]);
    setTurnStartScore501(nextPlayer === 1 ? score501P1 : score501P2);
    setGameStatus('active');
    stateRef.current.baseAim = { x: CENTER, y: CENTER - 90 };
    setStatusMessage(`Player ${nextPlayer}'s turn. Stage 1: Drag target zone, then lock aim!`);
  }, [turn, score501P1, score501P2, setGameStatus]);

  // Handle Dart Landing & Score Update
  const handleDartLanded = useCallback((dart: ThrownDart, nextDartsLeft: number) => {
    playDartHitSound();
    playChalkSound();
    triggerHaptic('medium');

    const newPinned = [...pinnedDarts, dart];
    setPinnedDarts(newPinned);

    // 1. Scoring Logic: 501 Countdown
    if (mode === '501') {
      const currentScore = turn === 1 ? score501P1 : score501P2;
      const rem = currentScore - dart.score;

      let isBust = false;
      if (rem < 0) {
        isBust = true;
      } else if (rem === 1 && doubleOut) {
        isBust = true;
      } else if (rem === 0) {
        if (doubleOut && dart.multiplier < 2) {
          isBust = true;
        } else {
          // WIN!
          if (turn === 1) setScore501P1(0);
          else setScore501P2(0);
          setWinner(turn);
          setStatusMessage(`Player ${turn} checked out with ${dart.label}! Victory!`);
          return;
        }
      }

      if (isBust) {
        triggerHaptic('success');
        // Reset score back to turn start
        if (turn === 1) setScore501P1(turnStartScore501);
        else setScore501P2(turnStartScore501);

        setStatusMessage(`BUST! Scored ${dart.label}. Reset to ${turnStartScore501}. Turn over.`);
        // End turn immediately
        setTimeout(() => {
          advanceTurn();
        }, 1200);
        return;
      } else {
        // Valid score reduction
        if (turn === 1) setScore501P1(rem);
        else setScore501P2(rem);
        setStatusMessage(`Player ${turn} hit ${dart.label}! Remaining: ${rem}`);
      }
    }

    // 2. Scoring Logic: Cricket Mode
    if (mode === 'cricket') {
      const hit = calculateHit(dart.x, dart.y);
      if (hit.baseNumber in cricketState) {
        const sector = hit.baseNumber;
        const state = { ...cricketState };
        const sectorData = { ...state[sector] };
        const marksEarned = hit.multiplier;

        const myMarks = turn === 1 ? sectorData.p1Marks : sectorData.p2Marks;
        const oppMarks = turn === 1 ? sectorData.p2Marks : sectorData.p1Marks;

        const neededToClose = Math.max(0, 3 - myMarks);
        const marksToApply = Math.min(marksEarned, neededToClose);
        const leftoverMarks = marksEarned - marksToApply;

        if (turn === 1) sectorData.p1Marks += marksToApply;
        else sectorData.p2Marks += marksToApply;

        // Extra marks score points if opponent hasn't closed
        let addedPoints = 0;
        if (leftoverMarks > 0 && oppMarks < 3) {
          addedPoints = leftoverMarks * (sector === 25 ? 25 : sector);
          if (turn === 1) setCricketPointsP1((p) => p + addedPoints);
          else setCricketPointsP2((p) => p + addedPoints);
        }

        state[sector] = sectorData;
        setCricketState(state);

        // Check Cricket Win Condition
        const allClosedByMe = Object.values(state).every((s) =>
          turn === 1 ? s.p1Marks >= 3 : s.p2Marks >= 3
        );
        const myPoints = (turn === 1 ? cricketPointsP1 : cricketPointsP2) + addedPoints;
        const oppPoints = turn === 1 ? cricketPointsP2 : cricketPointsP1;

        if (allClosedByMe && myPoints >= oppPoints) {
          setWinner(turn);
          setStatusMessage(`Player ${turn} closed all sectors and leads points! Victory!`);
          return;
        }
      }
    }

    // Check if turn finished (3 darts)
    if (nextDartsLeft <= 0) {
      setDartsLeftInTurn(0);
      setAimStage('throwing');
      setTimeout(() => {
        advanceTurn();
      }, 1400);
    } else {
      setDartsLeftInTurn(nextDartsLeft);
      setAimStage('timing');
    }
  }, [mode, turn, doubleOut, pinnedDarts, score501P1, score501P2, turnStartScore501, cricketState, cricketPointsP1, cricketPointsP2, advanceTurn]);

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
      if (aimStage === 'timing') {
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
          handleDartLanded(dart, dartsLeftInTurn - 1);
        }
      }

      ctx.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);

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

      // 6. Pinned Darts Rendering (Darts already landed this round)
      pinnedDarts.forEach((d) => {
        // Drop Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.ellipse(d.x + 3, d.y + 5, 4, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Brass Barrel & Steel Needle
        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 6, d.y - 12);
        ctx.stroke();

        // Red/Blue Flight
        ctx.fillStyle = turn === 1 ? '#3b82f6' : '#ef4444';
        ctx.beginPath();
        ctx.moveTo(d.x - 6, d.y - 12);
        ctx.lineTo(d.x - 12, d.y - 20);
        ctx.lineTo(d.x - 4, d.y - 18);
        ctx.closePath();
        ctx.fill();
      });

      // 7. In-Flight Dart (Approaching board)
      if (s.flyingDart) {
        const p = s.flyingDart.progress;
        const curX = s.flyingDart.startX + (s.flyingDart.targetX - s.flyingDart.startX) * p;
        const curY = s.flyingDart.startY + (s.flyingDart.targetY - s.flyingDart.startY) * p - Math.sin(p * Math.PI) * 20;
        const scale = 1.4 - p * 0.4;

        ctx.save();
        ctx.translate(curX, curY);
        ctx.scale(scale, scale);

        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-8, -16);
        ctx.stroke();

        ctx.fillStyle = turn === 1 ? '#2563eb' : '#dc2626';
        ctx.beginPath();
        ctx.moveTo(-8, -16);
        ctx.lineTo(-16, -26);
        ctx.lineTo(-6, -24);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      // 8. Two-Stage Visual Targeting System: Stage 1 (Base Target Zone) vs Stage 2 (Drifting Crosshairs)
      if (!s.flyingDart && dartsLeftInTurn > 0 && winner === null) {
        const themeColor = turn === 1 ? '#3b82f6' : '#ef4444';
        const glowColor = turn === 1 ? 'rgba(59, 130, 246, 0.45)' : 'rgba(239, 68, 68, 0.45)';

        if (aimStage === 'positioning') {
          // STAGE 1: Large Stationary Base Target Zone
          const bx = s.baseAim.x;
          const by = s.baseAim.y;
          const targetSector = calculateHit(bx, by);

          ctx.save();
          // Subtle radial glow area
          ctx.fillStyle = turn === 1 ? 'rgba(59, 130, 246, 0.16)' : 'rgba(239, 68, 68, 0.16)';
          ctx.beginPath();
          ctx.arc(bx, by, 26, 0, Math.PI * 2);
          ctx.fill();

          // Outer dashed target ring
          ctx.strokeStyle = themeColor;
          ctx.lineWidth = s.isDragging ? 2.2 : 1.8;
          ctx.setLineDash([5, 4]);
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = s.isDragging ? 14 : 6;
          ctx.beginPath();
          ctx.arc(bx, by, 26, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.setLineDash([]);

          // Center crosshair marker
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx - 8, by);
          ctx.lineTo(bx + 8, by);
          ctx.moveTo(bx, by - 8);
          ctx.lineTo(bx, by + 8);
          ctx.stroke();

          // Sector Target Pill badge
          const labelText = targetSector.label || 'AIM';
          ctx.font = 'bold 9px sans-serif';
          const textWidth = ctx.measureText(labelText).width;
          const badgeW = textWidth + 12;
          const badgeH = 14;
          const badgeY = by - 36 < 16 ? by + 30 : by - 36;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
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
        } else if (aimStage === 'timing') {
          // STAGE 2: Locked Base Anchor + Tether Sightline + Active Drifting Reticle
          const bx = s.baseAim.x;
          const by = s.baseAim.y;
          const { x: rx, y: ry } = s.floatingReticle;

          ctx.save();
          // A. Locked Base Anchor (dashed ring)
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(bx, by, 22, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Center base anchor dot
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.beginPath();
          ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
          ctx.fill();

          // B. Sightline tether to drifting reticle
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(rx, ry);
          ctx.stroke();
          ctx.setLineDash([]);

          // C. High-Precision Drifting Reticle
          // Outer glow target ring
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = 10;
          ctx.strokeStyle = themeColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(rx, ry, 14, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Harmonic breathing rhythm ring
          const pulseR = 7.5 + Math.sin(nowSec * 6) * 1.5;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(rx, ry, pulseR, 0, Math.PI * 2);
          ctx.stroke();

          // Center precision pinpoint
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(rx, ry, 2, 0, Math.PI * 2);
          ctx.fill();

          // Razor fine crosshairs
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

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [pinnedDarts, dartsLeftInTurn, turn, winner, aimStage, handleDartLanded]);

  // Launch Throw registering relative to reticle's actual floating coordinates at tap millisecond (zero auto-aim snapping)
  const launchThrow = useCallback(() => {
    const s = stateRef.current;
    if (s.flyingDart || dartsLeftInTurn <= 0 || winner !== null) return;

    setAimStage('throwing');
    triggerHaptic('medium');

    // Reticle floating coordinates at the exact millisecond of tap
    const targetX = Math.max(10, Math.min(BOARD_SIZE - 10, s.floatingReticle.x));
    const targetY = Math.max(10, Math.min(BOARD_SIZE - 10, s.floatingReticle.y));

    s.flyingDart = {
      startX: CENTER,
      startY: BOARD_SIZE - 15,
      targetX,
      targetY,
      progress: 0,
    };
  }, [dartsLeftInTurn, winner]);

  // Pointer / Touch Aiming - Stage 1 Drag Positioning
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (stateRef.current.flyingDart || dartsLeftInTurn <= 0 || winner !== null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scale = BOARD_SIZE / rect.width;
    const px = (e.clientX - rect.left) * scale;
    const py = (e.clientY - rect.top) * scale;

    stateRef.current.isDragging = true;
    stateRef.current.dragPointerStart = { x: px, y: py };
    stateRef.current.dragBaseStart = { ...stateRef.current.baseAim };
    setAimStage('positioning');
    triggerHaptic('light');
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (!s.isDragging || !s.dragPointerStart || !s.dragBaseStart) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scale = BOARD_SIZE / rect.width;
    const px = (e.clientX - rect.left) * scale;
    const py = (e.clientY - rect.top) * scale;

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
    // Releasing drag locks target and transitions to Stage 2 drift timing
    setAimStage('timing');
    setStatusMessage('Aim locked! Time the drift sway and tap THROW DART.');
    triggerHaptic('light');
  };

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden select-none">
      <GameHeader
        gameId="darts"
        gameName={`Darts (${mode === '501' ? '501 Countdown' : 'Cricket'})`}
        turn={turn}
        statusText={`Player ${turn}'s Turn (${dartsLeftInTurn} Darts)`}
        subStatusText={statusMessage}
      />

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden">
        {/* Game Mode Selector & Chalkboard HUD */}
        <div className="w-full max-w-sm flex items-center justify-between px-3 py-1.5 bg-container-dark/95 border border-[#3e444c] rounded-2xl shadow-md mb-2">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-xl border border-white/10">
            <button
              onClick={() => resetGame('501')}
              className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase transition-all ${
                mode === '501' ? 'bg-amber-500 text-black shadow-sm' : 'text-accent-light/70 hover:text-white'
              }`}
            >
              501
            </button>
            <button
              onClick={() => resetGame('cricket')}
              className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase transition-all ${
                mode === 'cricket' ? 'bg-amber-500 text-black shadow-sm' : 'text-accent-light/70 hover:text-white'
              }`}
            >
              Cricket
            </button>
          </div>

          {/* Scores Overview */}
          {mode === '501' ? (
            <div className="flex items-center gap-4 text-xs font-black">
              <span className={turn === 1 ? 'text-player-1 scale-110 transition-transform' : 'text-white/60'}>
                P1: {score501P1}
              </span>
              <span className="text-white/30">|</span>
              <span className={turn === 2 ? 'text-player-2 scale-110 transition-transform' : 'text-white/60'}>
                P2: {score501P2}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-4 text-xs font-black">
              <span className={turn === 1 ? 'text-player-1' : 'text-white/60'}>
                P1: {cricketPointsP1} pts
              </span>
              <span className="text-white/30">|</span>
              <span className={turn === 2 ? 'text-player-2' : 'text-white/60'}>
                P2: {cricketPointsP2} pts
              </span>
            </div>
          )}

          {/* Double-out toggle for 501 */}
          {mode === '501' && (
            <button
              onClick={() => setDoubleOut(!doubleOut)}
              className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase border ${
                doubleOut ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-white/5 text-white/40 border-white/10'
              }`}
            >
              {doubleOut ? 'Double Out' : 'Open Out'}
            </button>
          )}
        </div>

        {/* Sisal Dartboard Canvas Container */}
        <div className="relative flex items-center justify-center max-h-[66vh] aspect-square clubhouse-board-depth table-flat rounded-full overflow-hidden shadow-2xl border-4 border-[#3e1f0c]">
          <canvas
            ref={canvasRef}
            width={BOARD_SIZE}
            height={BOARD_SIZE}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="w-full h-full touch-none cursor-crosshair"
          />

          {/* Darts in Hand Indicator (Bottom Left) */}
          <div className="absolute bottom-3 left-4 flex gap-1.5 pointer-events-none bg-black/60 px-2.5 py-1 rounded-full border border-white/15">
            {[1, 2, 3].map((num) => (
              <div
                key={num}
                className={`w-2.5 h-6 rounded-xs transition-opacity ${
                  num <= dartsLeftInTurn ? (turn === 1 ? 'bg-player-1' : 'bg-player-2') : 'bg-stone-600 opacity-30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Cricket Tally Card (Visible in Cricket Mode) */}
        {mode === 'cricket' && (
          <div className="w-full max-w-sm grid grid-cols-7 gap-1 mt-2 bg-black/60 p-2 rounded-2xl border border-[#3e444c] text-center">
            {[20, 19, 18, 17, 16, 15, 25].map((target) => {
              const data = cricketState[target];
              const p1Closed = data.p1Marks >= 3;
              const p2Closed = data.p2Marks >= 3;
              return (
                <div key={target} className="flex flex-col items-center bg-white/5 py-1 rounded-lg border border-white/5">
                  <span className="text-[10px] font-black text-amber-400">
                    {target === 25 ? 'BULL' : target}
                  </span>
                  {/* Marks P1 vs P2 */}
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
        <div className="w-full max-w-sm flex flex-col items-center gap-2 mt-2 px-1">
          {aimStage === 'positioning' ? (
            <div className="w-full flex flex-col gap-1.5">
              <button
                onClick={() => {
                  setAimStage('timing');
                  setStatusMessage('Aim locked! Time the drift sway and tap THROW DART.');
                  triggerHaptic('light');
                }}
                disabled={dartsLeftInTurn <= 0 || winner !== null}
                className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  dartsLeftInTurn <= 0 || winner !== null
                    ? 'bg-stone-700 text-stone-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-400/30'
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
                    setAimStage('positioning');
                    setStatusMessage('Stage 1: Drag target circle to reposition aim.');
                    triggerHaptic('light');
                  }}
                  disabled={aimStage === 'throwing' || dartsLeftInTurn <= 0 || winner !== null}
                  className="px-3 py-2.5 rounded-xl font-bold text-xs uppercase bg-white/10 hover:bg-white/15 text-stone-200 border border-white/10 transition-all active:scale-95 flex items-center gap-1 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Reposition base target"
                >
                  <span>✏️ Adjust</span>
                </button>

                <button
                  onClick={launchThrow}
                  disabled={aimStage === 'throwing' || dartsLeftInTurn <= 0 || winner !== null}
                  className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                    aimStage === 'throwing' || dartsLeftInTurn <= 0 || winner !== null
                      ? 'bg-stone-700 text-stone-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-stone-950 border border-amber-300 shadow-amber-500/20'
                  }`}
                >
                  <span>
                    {aimStage === 'throwing'
                      ? '⏳ Dart in flight...'
                      : `🎯 THROW DART (${4 - dartsLeftInTurn}/3)`}
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
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName={`Darts (${mode.toUpperCase()})`}
          onRestart={() => resetGame(mode)}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};
export default Darts;
