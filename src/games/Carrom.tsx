import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import { triggerHaptic, playTapSound, playCaptureSound } from '../utils/feedback';

type PieceType = 'white' | 'black' | 'queen' | 'striker';

interface Piece {
  id: number;
  type: PieceType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  points: number;
  pocketsSunk: boolean;
}

const BOARD_SIZE = 360;
const POCKET_RADIUS = 20;
const STRIKER_RADIUS = 16;
const CARROM_RADIUS = 11;
const BOARD_FRICTION = 0.985;
const RESTITUTION = 0.94;

export const Carrom: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [scoreP1, setScoreP1] = useState<number>(0);
  const [scoreP2, setScoreP2] = useState<number>(0);
  const [winner, setWinner] = useState<PlayerNumber | 'draw' | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Player 1: Position striker on baseline, drag back to aim!');

  // Aiming and shot state
  const stateRef = useRef<{
    width: number;
    height: number;
    turn: PlayerNumber;
    scoreP1: number;
    scoreP2: number;
    pieces: Piece[];
    striker: Piece;
    isAiming: boolean;
    isMoving: boolean;
    dragStart: { x: number; y: number } | null;
    dragCurrent: { x: number; y: number } | null;
    baselineY: number;
    queenPendingCover: PlayerNumber | null;
    sunkThisTurn: Piece[];
  }>({
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    turn: 1,
    scoreP1: 0,
    scoreP2: 0,
    pieces: [],
    striker: {
      id: 999,
      type: 'striker',
      x: BOARD_SIZE / 2,
      y: BOARD_SIZE - 45,
      vx: 0,
      vy: 0,
      radius: STRIKER_RADIUS,
      points: 0,
      pocketsSunk: false,
    },
    isAiming: false,
    isMoving: false,
    dragStart: null,
    dragCurrent: null,
    baselineY: BOARD_SIZE - 45,
    queenPendingCover: null,
    sunkThisTurn: [],
  });

  const setupBoardPieces = useCallback(() => {
    const pieces: Piece[] = [];
    let id = 1;
    const cx = BOARD_SIZE / 2;
    const cy = BOARD_SIZE / 2;

    // Center Queen (Red - 30 pts)
    pieces.push({
      id: id++,
      type: 'queen',
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      radius: CARROM_RADIUS,
      points: 30,
      pocketsSunk: false,
    });

    // Ring 1: 6 pieces surrounding Queen (alternating White 10pts, Black 5pts)
    const ring1Dist = CARROM_RADIUS * 2.05;
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const isWhite = i % 2 === 0;
      pieces.push({
        id: id++,
        type: isWhite ? 'white' : 'black',
        x: cx + ring1Dist * Math.cos(angle),
        y: cy + ring1Dist * Math.sin(angle),
        vx: 0,
        vy: 0,
        radius: CARROM_RADIUS,
        points: isWhite ? 10 : 5,
        pocketsSunk: false,
      });
    }

    // Ring 2: 12 pieces outer ring (alternating)
    const ring2Dist = CARROM_RADIUS * 4.05;
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6 + Math.PI / 12;
      const isWhite = i % 2 !== 0; // Alternating
      pieces.push({
        id: id++,
        type: isWhite ? 'white' : 'black',
        x: cx + ring2Dist * Math.cos(angle),
        y: cy + ring2Dist * Math.sin(angle),
        vx: 0,
        vy: 0,
        radius: CARROM_RADIUS,
        points: isWhite ? 10 : 5,
        pocketsSunk: false,
      });
    }

    return pieces;
  }, []);

  const positionStrikerForTurn = useCallback((player: PlayerNumber) => {
    const s = stateRef.current;
    const baselineY = player === 1 ? s.height - 45 : 45;
    s.baselineY = baselineY;
    s.striker.x = s.width / 2;
    s.striker.y = baselineY;
    s.striker.vx = 0;
    s.striker.vy = 0;
    s.striker.pocketsSunk = false;
    s.isMoving = false;
    s.isAiming = false;
    s.dragStart = null;
    s.dragCurrent = null;
  }, []);

  const resetGame = useCallback(() => {
    const s = stateRef.current;
    s.turn = 1;
    s.scoreP1 = 0;
    s.scoreP2 = 0;
    s.queenPendingCover = null;
    s.pieces = setupBoardPieces();
    setTurn(1);
    setScoreP1(0);
    setScoreP2(0);
    setWinner(null);
    setShowTurnTransition(false);
    setStatusMessage('Player 1: Position striker on baseline, drag back to aim!');
    positionStrikerForTurn(1);
    setGameStatus('active');
  }, [setupBoardPieces, positionStrikerForTurn, setGameStatus]);

  // Handle end of shot momentum and pass-and-play turn advancement
  const handleShotComplete = useCallback(() => {
    const s = stateRef.current;
    s.isMoving = false;

    let extraShotAwarded = false;
    let p1Earned = 0;
    let p2Earned = 0;

    // Check scratch penalty (striker sunk)
    if (s.striker.pocketsSunk) {
      triggerHaptic('medium');
      if (s.turn === 1) {
        p1Earned -= 5;
        s.scoreP1 = Math.max(0, s.scoreP1 - 5);
        setScoreP1(s.scoreP1);
      } else {
        p2Earned -= 5;
        s.scoreP2 = Math.max(0, s.scoreP2 - 5);
        setScoreP2(s.scoreP2);
      }
      setStatusMessage(`Scratch! Striker pocketed (-5 pts penalty).`);
    }

    // Process sunk carrom pieces
    const sunkPieces = s.sunkThisTurn;
    const sunkQueen = sunkPieces.find((p) => p.type === 'queen');
    const sunkCarromMen = sunkPieces.filter((p) => p.type !== 'queen' && p.type !== 'striker');

    if (sunkCarromMen.length > 0) {
      extraShotAwarded = true; // Sinking a piece earns another shot!
      sunkCarromMen.forEach((p) => {
        if (s.turn === 1) s.scoreP1 += p.points;
        else s.scoreP2 += p.points;
      });

      // If Queen was pending cover, covered successfully!
      if (s.queenPendingCover === s.turn) {
        if (s.turn === 1) s.scoreP1 += 30;
        else s.scoreP2 += 30;
        s.queenPendingCover = null;
        setStatusMessage(`Queen covered (+30 pts)! Extra shot awarded.`);
      }
    }

    if (sunkQueen) {
      // Queen requires cover shot
      if (sunkCarromMen.length > 0) {
        // Covered on the exact same turn!
        if (s.turn === 1) s.scoreP1 += 30;
        else s.scoreP2 += 30;
        s.queenPendingCover = null;
        extraShotAwarded = true;
        setStatusMessage(`Queen sunk and covered on same shot (+30 pts)!`);
      } else {
        // Queen pending cover on next shot
        s.queenPendingCover = s.turn;
        extraShotAwarded = true;
        setStatusMessage(`Queen pocketed! Sink another piece to cover the Queen.`);
      }
    } else if (s.queenPendingCover === s.turn && sunkCarromMen.length === 0) {
      // Failed to cover queen -> queen returns to center
      const queenPiece: Piece = {
        id: 888,
        type: 'queen',
        x: s.width / 2,
        y: s.height / 2,
        vx: 0,
        vy: 0,
        radius: CARROM_RADIUS,
        points: 30,
        pocketsSunk: false,
      };
      s.pieces.push(queenPiece);
      s.queenPendingCover = null;
      setStatusMessage(`Failed to cover Queen! Queen returns to center.`);
    }

    setScoreP1(s.scoreP1);
    setScoreP2(s.scoreP2);
    s.sunkThisTurn = [];

    // Check if board cleared
    const remainingPieces = s.pieces.filter((p) => !p.pocketsSunk);
    if (remainingPieces.length === 0) {
      // Game finished!
      let winResult: PlayerNumber | 'draw' = 'draw';
      if (s.scoreP1 > s.scoreP2) winResult = 1;
      else if (s.scoreP2 > s.scoreP1) winResult = 2;

      setWinner(winResult);
      setStatusMessage(
        winResult === 'draw'
          ? 'Board cleared! Tie match.'
          : `Board cleared! Player ${winResult} wins!`
      );
      setGameStatus('finished');
      return;
    }

    // Turn resolution:
    if (extraShotAwarded && !s.striker.pocketsSunk) {
      // Player keeps turn (no transition modal)
      positionStrikerForTurn(s.turn);
    } else {
      // Switch player smoothly
      const nextPlayer: PlayerNumber = s.turn === 1 ? 2 : 1;
      s.turn = nextPlayer;
      setTurn(nextPlayer);
      positionStrikerForTurn(nextPlayer);
      setGameStatus('active');
      setStatusMessage(`Player ${nextPlayer}'s turn.`);
    }
  }, [positionStrikerForTurn, setGameStatus]);

  // Main canvas animation and physics engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const s = stateRef.current;
    s.pieces = setupBoardPieces();
    positionStrikerForTurn(1);

    const handleResize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);

      s.width = rect.width;
      s.height = rect.height;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const pockets = [
      { x: 26, y: 26 },
      { x: s.width - 26, y: 26 },
      { x: 26, y: s.height - 26 },
      { x: s.width - 26, y: s.height - 26 },
    ];

    const checkCircleCollision = (p1: Piece, p2: Piece) => {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);
      const minDist = p1.radius + p2.radius;

      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const ny = dy / dist;

        // Separate overlap
        const overlap = minDist - dist;
        p1.x -= nx * overlap * 0.5;
        p1.y -= ny * overlap * 0.5;
        p2.x += nx * overlap * 0.5;
        p2.y += ny * overlap * 0.5;

        // Normal and tangential relative velocity
        const kx = p1.vx - p2.vx;
        const ky = p1.vy - p2.vy;
        const p = 2 * (nx * kx + ny * ky) / 2;

        p1.vx -= p * nx * RESTITUTION;
        p1.vy -= p * ny * RESTITUTION;
        p2.vx += p * nx * RESTITUTION;
        p2.vy += p * ny * RESTITUTION;

        if (Math.hypot(kx, ky) > 1.2) {
          playTapSound();
          triggerHaptic('light');
        }
      }
    };

    const updatePhysics = () => {
      if (!s.isMoving) return;

      const activeDiscs = [...s.pieces.filter((p) => !p.pocketsSunk)];
      if (!s.striker.pocketsSunk) {
        activeDiscs.push(s.striker);
      }

      let totalSpeed = 0;

      // Update positions & friction
      for (const disc of activeDiscs) {
        disc.x += disc.vx;
        disc.y += disc.vy;
        disc.vx *= BOARD_FRICTION;
        disc.vy *= BOARD_FRICTION;

        // Cushion rebound (board walls)
        const wallMin = 18 + disc.radius;
        const wallMax = s.width - 18 - disc.radius;

        if (disc.x <= wallMin) {
          disc.x = wallMin;
          disc.vx = -disc.vx * RESTITUTION;
        } else if (disc.x >= wallMax) {
          disc.x = wallMax;
          disc.vx = -disc.vx * RESTITUTION;
        }

        if (disc.y <= wallMin) {
          disc.y = wallMin;
          disc.vy = -disc.vy * RESTITUTION;
        } else if (disc.y >= wallMax) {
          disc.y = wallMax;
          disc.vy = -disc.vy * RESTITUTION;
        }

        // Check pocket entry
        for (const pkt of pockets) {
          const pDist = Math.hypot(disc.x - pkt.x, disc.y - pkt.y);
          if (pDist < POCKET_RADIUS) {
            disc.pocketsSunk = true;
            disc.vx = 0;
            disc.vy = 0;
            s.sunkThisTurn.push(disc);
            playCaptureSound();
            triggerHaptic('medium');
            break;
          }
        }

        totalSpeed += Math.hypot(disc.vx, disc.vy);
      }

      // Inter-piece collisions
      for (let i = 0; i < activeDiscs.length; i++) {
        for (let j = i + 1; j < activeDiscs.length; j++) {
          if (!activeDiscs[i].pocketsSunk && !activeDiscs[j].pocketsSunk) {
            checkCircleCollision(activeDiscs[i], activeDiscs[j]);
          }
        }
      }

      // Check if all pieces stopped moving
      if (totalSpeed < 0.25) {
        for (const disc of activeDiscs) {
          disc.vx = 0;
          disc.vy = 0;
        }
        handleShotComplete();
      }
    };

    const render = () => {
      const w = s.width;
      const h = s.height;

      // 1. Wooden Carrom Board Frame
      const frameGrad = ctx.createLinearGradient(0, 0, w, h);
      frameGrad.addColorStop(0, '#9a6b38');
      frameGrad.addColorStop(1, '#66411a');
      ctx.fillStyle = frameGrad;
      ctx.fillRect(0, 0, w, h);

      // Playing Surface (Light Maple Wood)
      const surfacePad = 18;
      const surfaceW = w - surfacePad * 2;
      const surfaceH = h - surfacePad * 2;
      const surfaceGrad = ctx.createLinearGradient(surfacePad, surfacePad, surfaceW, surfaceH);
      surfaceGrad.addColorStop(0, '#f9f3ea');
      surfaceGrad.addColorStop(1, '#eee2d0');
      ctx.fillStyle = surfaceGrad;
      ctx.fillRect(surfacePad, surfacePad, surfaceW, surfaceH);

      // 2. Corner Pockets (Dark sunken circular felt)
      for (const pkt of pockets) {
        ctx.beginPath();
        ctx.arc(pkt.x, pkt.y, POCKET_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // 3. Center Patterns & Concentric Circles
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 45, 0, Math.PI * 2);
      ctx.strokeStyle = '#be123c';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 14, 0, Math.PI * 2);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 4. Baseline Shooting Lines (Top & Bottom)
      // Bottom Baseline (P1)
      const bY1 = h - 45;
      ctx.strokeStyle = '#be123c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(55, bY1);
      ctx.lineTo(w - 55, bY1);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(55, bY1, 6, 0, Math.PI * 2);
      ctx.arc(w - 55, bY1, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#be123c';
      ctx.fill();

      // Top Baseline (P2)
      const bY2 = 45;
      ctx.beginPath();
      ctx.moveTo(55, bY2);
      ctx.lineTo(w - 55, bY2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(55, bY2, 6, 0, Math.PI * 2);
      ctx.arc(w - 55, bY2, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#be123c';
      ctx.fill();

      // 5. Carrom Men Discs
      for (const piece of s.pieces) {
        if (piece.pocketsSunk) continue;

        ctx.beginPath();
        ctx.arc(piece.x + 1.5, piece.y + 2, piece.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(piece.x, piece.y, piece.radius, 0, Math.PI * 2);

        if (piece.type === 'queen') {
          const qGrad = ctx.createRadialGradient(piece.x - 2, piece.y - 2, 2, piece.x, piece.y, piece.radius);
          qGrad.addColorStop(0, '#f43f5e');
          qGrad.addColorStop(1, '#9f1239');
          ctx.fillStyle = qGrad;
          ctx.fill();
          ctx.strokeStyle = '#fecdd3';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (piece.type === 'white') {
          const wGrad = ctx.createRadialGradient(piece.x - 2, piece.y - 2, 2, piece.x, piece.y, piece.radius);
          wGrad.addColorStop(0, '#ffffff');
          wGrad.addColorStop(1, '#cbd5e1');
          ctx.fillStyle = wGrad;
          ctx.fill();
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          // Black piece
          const bGrad = ctx.createRadialGradient(piece.x - 2, piece.y - 2, 2, piece.x, piece.y, piece.radius);
          bGrad.addColorStop(0, '#475569');
          bGrad.addColorStop(1, '#0f172a');
          ctx.fillStyle = bGrad;
          ctx.fill();
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Tactile concentric circle
        ctx.beginPath();
        ctx.arc(piece.x, piece.y, piece.radius * 0.45, 0, Math.PI * 2);
        ctx.strokeStyle = piece.type === 'white' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 6. Striker Disc
      const stk = s.striker;
      if (!stk.pocketsSunk) {
        ctx.beginPath();
        ctx.arc(stk.x + 2, stk.y + 2.5, stk.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(stk.x, stk.y, stk.radius, 0, Math.PI * 2);
        const sGrad = ctx.createRadialGradient(stk.x - 3, stk.y - 3, 3, stk.x, stk.y, stk.radius);
        sGrad.addColorStop(0, '#fef08a');
        sGrad.addColorStop(0.7, '#f59e0b');
        sGrad.addColorStop(1, '#b45309');
        ctx.fillStyle = sGrad;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // Striker inner ring
        ctx.beginPath();
        ctx.arc(stk.x, stk.y, stk.radius * 0.55, 0, Math.PI * 2);
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // 7. Aim Trajectory & Impulse Vector
      if (s.isAiming && s.dragStart && s.dragCurrent && !s.isMoving) {
        const pullDx = s.dragStart.x - s.dragCurrent.x;
        const pullDy = s.dragStart.y - s.dragCurrent.y;
        const pullDist = Math.hypot(pullDx, pullDy);
        const powerRatio = Math.min(1, pullDist / 80);

        // Projected firing line
        const aimAngle = Math.atan2(pullDy, pullDx);
        const aimLen = powerRatio * 110;

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(stk.x, stk.y);
        ctx.lineTo(stk.x + Math.cos(aimAngle) * aimLen, stk.y + Math.sin(aimAngle) * aimLen);
        ctx.stroke();
        ctx.setLineDash([]);

        // Power arc gauge
        ctx.beginPath();
        ctx.arc(stk.x, stk.y, stk.radius + 8, aimAngle - 0.6, aimAngle + 0.6);
        ctx.strokeStyle = powerRatio > 0.7 ? '#ef4444' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    };

    const loop = () => {
      updatePhysics();
      render();
      animId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [setupBoardPieces, positionStrikerForTurn, handleShotComplete]);

  // Touch handlers for baseline placement & flick impulse
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const s = stateRef.current;
    if (s.isMoving || winner !== null) return;

    const touch = e.touches[0];
    const tx = touch.clientX - rect.left;
    const ty = touch.clientY - rect.top;

    const distToStriker = Math.hypot(tx - s.striker.x, ty - s.striker.y);

    if (distToStriker < s.striker.radius * 2.2) {
      // Start flick aiming
      s.isAiming = true;
      s.dragStart = { x: tx, y: ty };
      s.dragCurrent = { x: tx, y: ty };
      triggerHaptic('light');
    } else if (Math.abs(ty - s.baselineY) < 30) {
      // Reposition striker along baseline
      const minX = 65;
      const maxX = s.width - 65;
      s.striker.x = Math.max(minX, Math.min(maxX, tx));
      triggerHaptic('light');
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const s = stateRef.current;
    if (s.isMoving || !s.isAiming) return;

    const touch = e.touches[0];
    const tx = touch.clientX - rect.left;
    const ty = touch.clientY - rect.top;
    s.dragCurrent = { x: tx, y: ty };
  };

  const handleTouchEnd = () => {
    const s = stateRef.current;
    if (!s.isAiming || !s.dragStart || !s.dragCurrent || s.isMoving) return;

    const pullDx = s.dragStart.x - s.dragCurrent.x;
    const pullDy = s.dragStart.y - s.dragCurrent.y;
    const pullDist = Math.hypot(pullDx, pullDy);

    s.isAiming = false;
    s.dragStart = null;
    s.dragCurrent = null;

    if (pullDist > 10) {
      // Launch impulse force
      const maxForce = 22;
      const forceRatio = Math.min(1, pullDist / 80);
      const angle = Math.atan2(pullDy, pullDx);

      s.striker.vx = Math.cos(angle) * maxForce * forceRatio;
      s.striker.vy = Math.sin(angle) * maxForce * forceRatio;
      s.isMoving = true;

      playTapSound();
      triggerHaptic('medium');
    }
  };

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden relative select-none">
      <GameHeader
        title="Carrom"
        subtitle="Precision Flick Board"
        turn={turn}
        scoreP1={`${scoreP1} pts`}
        scoreP2={`${scoreP2} pts`}
        p1Label="P1 (Bottom)"
        p2Label="P2 (Top)"
        onRestart={resetGame}
        statusMessage={statusMessage}
      />

      {/* Main Square Board Container - Responsive on iPhone, iPad, PC */}
      <main className="flex-1 flex flex-col items-center justify-center p-2.5 sm:p-4 md:p-6 relative touch-none overflow-hidden">
        <div className="w-full max-w-xs sm:max-w-md md:max-w-lg aspect-square bg-[#784d1e] rounded-3xl sm:rounded-[36px] p-2 sm:p-3.5 shadow-2xl border-4 sm:border-6 border-[#4d2f14] flex items-center justify-center relative">
          <canvas
            ref={canvasRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            className="w-full h-full rounded-2xl sm:rounded-3xl cursor-grab active:cursor-grabbing"
          />
        </div>
      </main>

      {/* Footer Instructions */}
      <footer className="pb-safe px-4 py-1.5 border-t border-[#2a2e33]/10 bg-[#f3e9dc]/80 backdrop-blur-sm flex items-center justify-between text-xs font-semibold text-[#7d6753]">
        <span>Tap baseline to position, drag back to shoot</span>
        <span className="text-[11px] bg-accent-light px-2.5 py-0.5 rounded-full border border-[#d8c3a5]/50">
          White: 10p • Queen: 30p
        </span>
      </footer>

      {/* Victory Game Over Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="Carrom"
          stats={[
            {
              label: 'Total Points',
              p1Value: `${scoreP1} pts`,
              p2Value: `${scoreP2} pts`,
            },
            {
              label: 'Match Result',
              p1Value: winner === 1 ? 'Board Champion' : 'Runner Up',
              p2Value: winner === 2 ? 'Board Champion' : 'Runner Up',
            },
          ]}
          onRestart={resetGame}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};
