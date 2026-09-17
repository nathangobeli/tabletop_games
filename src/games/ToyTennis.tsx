import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import { triggerHaptic, playTapSound, playCaptureSound, playNetSwishSound, playErrorBuzz } from '../utils/feedback';

interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  touchId: number | null;
}

interface Ball {
  x: number;
  y: number;
  z: number; // simulated altitude height
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  bouncesInHalf: number;
  currentHalf: 1 | 2; // 1 = bottom (P1), 2 = top (P2)
  lastHitter: PlayerNumber | null;
  clearedNetThisPass: boolean;
}

const TARGET_SCORE = 5;
const GRAVITY = 0.22; // Gentle gravitational pull
const BOUNCE_DAMPING = 0.85;
const NET_HEIGHT = 10; // Pixels of virtual clearance required to clear net
const NET_THICKNESS = 6; // Margin around center net Y

export const ToyTennis: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [scoreP1, setScoreP1] = useState<number>(0);
  const [scoreP2, setScoreP2] = useState<number>(0);
  const [winner, setWinner] = useState<PlayerNumber | null>(null);
  const [pointBanner, setPointBanner] = useState<string | null>(null);
  const [netFlash, setNetFlash] = useState<boolean>(false);
  const [rallyCount, setRallyCount] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('Toy Tennis: Slide along baseline to return ball!');

  const stateRef = useRef<{
    width: number;
    height: number;
    p1Score: number;
    p2Score: number;
    isOver: boolean;
    serveDelay: number;
    rallyCount: number;
    p1Paddle: Paddle;
    p2Paddle: Paddle;
    ball: Ball;
    keys: Record<string, boolean>;
  }>({
    width: 360,
    height: 600,
    p1Score: 0,
    p2Score: 0,
    isOver: false,
    serveDelay: 60,
    rallyCount: 0,
    p1Paddle: { x: 180, y: 568, width: 78, height: 14, touchId: null },
    p2Paddle: { x: 180, y: 32, width: 78, height: 14, touchId: null },
    ball: {
      x: 180,
      y: 300,
      z: 32,
      vx: 1.0,
      vy: 4.8,
      vz: 5.5,
      radius: 8,
      bouncesInHalf: 0,
      currentHalf: 1,
      lastHitter: 2,
      clearedNetThisPass: false,
    },
    keys: {},
  });

  // Serve Assist: Guaranteed high clearance arc across the net
  const serveBall = useCallback((server: PlayerNumber) => {
    const s = stateRef.current;
    s.serveDelay = 45;
    const isP1 = server === 1;

    s.ball = {
      x: s.width / 2 + (Math.random() - 0.5) * 30,
      y: isP1 ? s.height * 0.74 : s.height * 0.26,
      z: 28,
      vx: (Math.random() - 0.5) * 2.2,
      vy: isP1 ? -5.2 : 5.2,
      vz: 7.5, // High guaranteed clearance arc over net
      radius: 8,
      bouncesInHalf: 0,
      currentHalf: isP1 ? 2 : 1,
      lastHitter: server,
      clearedNetThisPass: false,
    };
  }, []);

  const resetGame = useCallback(() => {
    const s = stateRef.current;
    s.p1Score = 0;
    s.p2Score = 0;
    s.isOver = false;
    s.rallyCount = 0;
    setScoreP1(0);
    setScoreP2(0);
    setWinner(null);
    setPointBanner(null);
    setNetFlash(false);
    setRallyCount(0);
    setStatusMessage('First to 5 points wins! Keep rally going.');
    serveBall(1);
    setGameStatus('active');
  }, [serveBall, setGameStatus]);

  // Keyboard navigation for desktop testing (A/D for Player 2, Left/Right for Player 1)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const handleResize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);

      const s = stateRef.current;
      const prevW = s.width;
      const prevH = s.height;
      s.width = rect.width;
      s.height = rect.height;

      s.p1Paddle.y = s.height - 32;
      s.p2Paddle.y = 32;
      s.p1Paddle.height = 14;
      s.p2Paddle.height = 14;
      s.p1Paddle.width = 78;
      s.p2Paddle.width = 78;

      if (prevW === 360 && prevH === 600) {
        s.p1Paddle.x = s.width / 2;
        s.p2Paddle.x = s.width / 2;
      } else {
        s.p1Paddle.x = Math.max(s.p1Paddle.width / 2, Math.min(s.width - s.p1Paddle.width / 2, s.p1Paddle.x));
        s.p2Paddle.x = Math.max(s.p2Paddle.width / 2, Math.min(s.width - s.p2Paddle.width / 2, s.p2Paddle.x));
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const awardPoint = (recipient: PlayerNumber, reason: string) => {
      const s = stateRef.current;
      if (s.isOver) return;

      s.rallyCount = 0;
      setRallyCount(0);

      if (recipient === 1) {
        s.p1Score += 1;
        setScoreP1(s.p1Score);
      } else {
        s.p2Score += 1;
        setScoreP2(s.p2Score);
      }

      triggerHaptic('success');
      playCaptureSound();
      setPointBanner(`Point Player ${recipient}! (${reason})`);
      setTimeout(() => setPointBanner(null), 1200);

      if (s.p1Score >= TARGET_SCORE) {
        s.isOver = true;
        setWinner(1);
        setGameStatus('finished');
        return;
      }
      if (s.p2Score >= TARGET_SCORE) {
        s.isOver = true;
        setWinner(2);
        setGameStatus('finished');
        return;
      }

      // Next serve by conceding player
      serveBall(recipient === 1 ? 2 : 1);
    };

    const updatePhysics = () => {
      const s = stateRef.current;
      if (s.isOver) return;

      // Desktop controls (P2 A/D, P1 Left/Right)
      const k = s.keys;
      const keySpeed = 7.5;
      if (k['a'] || k['d']) {
        if (k['a']) s.p2Paddle.x -= keySpeed;
        if (k['d']) s.p2Paddle.x += keySpeed;
        s.p2Paddle.x = Math.max(s.p2Paddle.width / 2, Math.min(s.width - s.p2Paddle.width / 2, s.p2Paddle.x));
      } else if (s.p2Paddle.touchId === null) {
        // Subtle defensive AI for Player 2 on desktop
        const diffX = s.ball.x - s.p2Paddle.x;
        const aiSpeed = 3.6;
        s.p2Paddle.x += Math.sign(diffX) * Math.min(Math.abs(diffX), aiSpeed);
        s.p2Paddle.x = Math.max(s.p2Paddle.width / 2, Math.min(s.width - s.p2Paddle.width / 2, s.p2Paddle.x));
      }

      if (k['arrowleft'] || k['arrowright']) {
        if (k['arrowleft']) s.p1Paddle.x -= keySpeed;
        if (k['arrowright']) s.p1Paddle.x += keySpeed;
        s.p1Paddle.x = Math.max(s.p1Paddle.width / 2, Math.min(s.width - s.p1Paddle.width / 2, s.p1Paddle.x));
      }

      if (s.serveDelay > 0) {
        s.serveDelay--;
        return;
      }

      const b = s.ball;

      // Update X, Y and Z (height altitude)
      b.x += b.vx;
      b.y += b.vy;
      b.z += b.vz;
      b.vz -= GRAVITY; // Gentle gravity

      // Side wall bounds bounce
      const courtPadding = 18;
      if (b.x - b.radius <= courtPadding) {
        b.x = courtPadding + b.radius;
        b.vx = -b.vx * 0.95;
        triggerHaptic('light');
        playTapSound();
      } else if (b.x + b.radius >= s.width - courtPadding) {
        b.x = s.width - courtPadding - b.radius;
        b.vx = -b.vx * 0.95;
        triggerHaptic('light');
        playTapSound();
      }

      // Ground bounce detection (Z <= 0)
      if (b.z <= 0) {
        b.z = 0;
        b.vz = -b.vz * BOUNCE_DAMPING;

        // Ensure lively bounce response during rally
        if (Math.abs(b.vz) < 2.4) {
          b.vz = 2.8;
        }

        playTapSound();

        // Determine which half the ball bounced in
        const bounceHalf: 1 | 2 = b.y > s.height / 2 ? 1 : 2;

        if (bounceHalf === b.currentHalf) {
          b.bouncesInHalf += 1;
        } else {
          b.currentHalf = bounceHalf;
          b.bouncesInHalf = 1;
        }

        // Rule: 2 bounces on same half -> point for opponent!
        if (b.bouncesInHalf >= 2) {
          const pointWinner: PlayerNumber = bounceHalf === 1 ? 2 : 1;
          awardPoint(pointWinner, 'Double bounce');
          return;
        }
      }

      // 2. Forgiving Net Collision Logic
      const netY = s.height / 2;
      const distToNet = Math.abs(b.y - netY);

      if (distToNet < NET_THICKNESS) {
        if (b.z >= NET_HEIGHT) {
          // Ball cleanly clears the net!
          if (!b.clearedNetThisPass) {
            b.clearedNetThisPass = true;
            playNetSwishSound();
          }
        } else {
          // Ball physically clipped the net below height threshold!
          playErrorBuzz();
          triggerHaptic('heavy');
          setNetFlash(true);
          setTimeout(() => setNetFlash(false), 500);

          // Dampened rebound off net tape
          b.vy = -b.vy * 0.35;
          b.vz = Math.max(b.vz, 1.2);
          const faultWinner: PlayerNumber = b.lastHitter === 1 ? 2 : 1;
          awardPoint(faultWinner, 'NET FAULT');
          return;
        }
      } else {
        b.clearedNetThisPass = false;
      }

      // 3. Baseline Paddle Collisions & Recalibrated Trajectory Arc
      // 3.1 Bottom Baseline Paddle (Player 1 - Cobalt Blue)
      const p1 = s.p1Paddle;
      const p1Top = p1.y - p1.height / 2;
      const p1Bottom = p1.y + p1.height / 2;
      const p1Left = p1.x - p1.width / 2;
      const p1Right = p1.x + p1.width / 2;

      // Ball strikes front or body of Player 1's paddle while moving downward (vy > 0)
      if (
        b.y + b.radius >= p1Top &&
        b.y - b.radius <= p1Bottom &&
        b.vy > 0
      ) {
        if (b.x + b.radius * 0.5 >= p1Left && b.x - b.radius * 0.5 <= p1Right) {
          b.lastHitter = 1;
          b.currentHalf = 2; // Target opponent half
          b.bouncesInHalf = 0;
          b.clearedNetThisPass = false;

          // Re-seat ball cleanly on the front face of Player 1 paddle
          b.y = p1Top - b.radius;
          b.z = 2;

          const offset = (b.x - p1.x) / (p1.width / 2);

          b.vy = -Math.max(Math.abs(b.vy) * 1.03, 5.2);
          // Guaranteed net clearance trajectory arc
          b.vz = Math.max(Math.abs(b.vy) * 0.55, 7.5);
          b.vx = offset * 4.4;

          s.rallyCount += 1;
          setRallyCount(s.rallyCount);
          setStatusMessage(`Rally: ${s.rallyCount} hits!`);

          triggerHaptic('medium');
          playTapSound();
        }
      }

      // 3.2 Top Baseline Paddle (Player 2 - Crimson Red)
      const p2 = s.p2Paddle;
      const p2Top = p2.y - p2.height / 2;
      const p2Bottom = p2.y + p2.height / 2;
      const p2Left = p2.x - p2.width / 2;
      const p2Right = p2.x + p2.width / 2;

      // Ball strikes front or body of Player 2's paddle while moving upward (vy < 0)
      // Normalized: Use true ground coordinate b.y (not visual offset y - z) for 2D collision check
      if (
        b.y - b.radius <= p2Bottom &&
        b.y + b.radius >= p2Top &&
        b.vy < 0
      ) {
        if (b.x + b.radius * 0.5 >= p2Left && b.x - b.radius * 0.5 <= p2Right) {
          b.lastHitter = 2;
          b.currentHalf = 1; // Target opponent half
          b.bouncesInHalf = 0;
          b.clearedNetThisPass = false;

          // Re-seat ball cleanly on the front face of Player 2 paddle
          b.y = p2Bottom + b.radius;
          b.z = 2;

          const offset = (b.x - p2.x) / (p2.width / 2);

          b.vy = Math.max(Math.abs(b.vy) * 1.03, 5.2);
          // Guaranteed net clearance trajectory arc
          b.vz = Math.max(Math.abs(b.vy) * 0.55, 7.5);
          b.vx = offset * 4.4;

          s.rallyCount += 1;
          setRallyCount(s.rallyCount);
          setStatusMessage(`Rally: ${s.rallyCount} hits!`);

          triggerHaptic('medium');
          playTapSound();
        }
      }

      // Out of bounds past baseline (only if behind the paddles)
      if (b.y > s.height + 25) {
        awardPoint(2, 'Out past baseline');
        return;
      }
      if (b.y < -25) {
        awardPoint(1, 'Out past baseline');
        return;
      }
    };

    const render = () => {
      const s = stateRef.current;
      const w = s.width;
      const h = s.height;

      // 1. Court Surface (Classic Clubhouse Forest Green)
      ctx.fillStyle = '#14532d';
      ctx.fillRect(0, 0, w, h);

      // 2. Crisp White Court Marking Lines
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;

      const pad = 20;
      const innerW = w - pad * 2;
      const innerH = h - pad * 2;

      // Outer boundary lines
      ctx.strokeRect(pad, pad, innerW, innerH);

      // Singles sidelines
      const alleyW = innerW * 0.14;
      ctx.beginPath();
      ctx.moveTo(pad + alleyW, pad);
      ctx.lineTo(pad + alleyW, h - pad);
      ctx.moveTo(w - pad - alleyW, pad);
      ctx.lineTo(w - pad - alleyW, h - pad);
      ctx.stroke();

      // Service boxes
      const serviceLineY1 = h * 0.28;
      const serviceLineY2 = h * 0.72;
      ctx.beginPath();
      ctx.moveTo(pad + alleyW, serviceLineY1);
      ctx.lineTo(w - pad - alleyW, serviceLineY1);
      ctx.moveTo(pad + alleyW, serviceLineY2);
      ctx.lineTo(w - pad - alleyW, serviceLineY2);
      ctx.moveTo(w / 2, serviceLineY1);
      ctx.lineTo(w / 2, serviceLineY2);
      ctx.stroke();

      // 3. Center Net (Semi-transparent white mesh with tape)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(0, h / 2 - 4, w, 8);
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // 4. Player 2 Paddle (Top - Crimson Red)
      const p2 = s.p2Paddle;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(p2.x - p2.width / 2, p2.y - p2.height / 2, p2.width, p2.height, 6);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 5. Player 1 Paddle (Bottom - Cobalt Blue)
      const p1 = s.p1Paddle;
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.roundRect(p1.x - p1.width / 2, p1.y - p1.height / 2, p1.width, p1.height, 6);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 6. Tennis Ball with Altitude-Scaled Dynamic Shadow
      const b = s.ball;
      const shadowScale = Math.max(0.5, 1 - b.z / 80);
      const shadowRadius = b.radius * shadowScale;

      // Projected ground shadow
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, shadowRadius * 1.3, shadowRadius * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 0, 0, ${0.35 * shadowScale})`;
      ctx.fill();

      // Elevated Ball (Position shifted upward by Z altitude)
      const ballVisualY = b.y - b.z;
      const ballRadius = b.radius * (1 + b.z / 140);

      ctx.beginPath();
      ctx.arc(b.x, ballVisualY, ballRadius, 0, Math.PI * 2);
      const ballGrad = ctx.createRadialGradient(b.x - 2, ballVisualY - 2, 1, b.x, ballVisualY, ballRadius);
      ballGrad.addColorStop(0, '#fef08a');
      ballGrad.addColorStop(0.6, '#a3e635');
      ballGrad.addColorStop(1, '#65a30d');
      ctx.fillStyle = ballGrad;
      ctx.fill();
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Seam arc
      ctx.beginPath();
      ctx.arc(b.x, ballVisualY, ballRadius * 0.65, 0.4, 2.5);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.9;
      ctx.stroke();
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
  }, [serveBall, setGameStatus]);

  // Robust Pointer Events for desktop mouse and mobile touch
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const scaleX = stateRef.current.width / rect.width;
    const scaleY = stateRef.current.height / rect.height;
    const tx = (e.clientX - rect.left) * scaleX;
    const ty = (e.clientY - rect.top) * scaleY;
    const s = stateRef.current;

    if (ty > s.height / 2) {
      s.p1Paddle.touchId = e.pointerId;
      s.p1Paddle.x = Math.max(s.p1Paddle.width / 2, Math.min(s.width - s.p1Paddle.width / 2, tx));
    } else {
      s.p2Paddle.touchId = e.pointerId;
      s.p2Paddle.x = Math.max(s.p2Paddle.width / 2, Math.min(s.width - s.p2Paddle.width / 2, tx));
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = stateRef.current.width / rect.width;
    const scaleY = stateRef.current.height / rect.height;
    const tx = (e.clientX - rect.left) * scaleX;
    const ty = (e.clientY - rect.top) * scaleY;
    const s = stateRef.current;

    if (e.pointerId === s.p1Paddle.touchId || (e.pointerType === 'mouse' && ty > s.height / 2)) {
      s.p1Paddle.x = Math.max(s.p1Paddle.width / 2, Math.min(s.width - s.p1Paddle.width / 2, tx));
    } else if (e.pointerId === s.p2Paddle.touchId || (e.pointerType === 'mouse' && ty <= s.height / 2 && s.p2Paddle.touchId !== null)) {
      s.p2Paddle.x = Math.max(s.p2Paddle.width / 2, Math.min(s.width - s.p2Paddle.width / 2, tx));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (e.pointerId === s.p1Paddle.touchId) {
      s.p1Paddle.touchId = null;
    }
    if (e.pointerId === s.p2Paddle.touchId) {
      s.p2Paddle.touchId = null;
    }
  };

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden relative select-none">
      <GameHeader
        title="Toy Tennis"
        subtitle={rallyCount > 0 ? `Rally: ${rallyCount}` : 'Arcade Court Rally'}
        turn={1}
        scoreP1={scoreP1}
        scoreP2={scoreP2}
        p1Label="P1 (Bottom)"
        p2Label="P2 (Top)"
        onRestart={resetGame}
        statusMessage={statusMessage}
      />

      {/* Main Canvas Court */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 relative touch-none overflow-hidden">
        {/* Point Banner */}
        {pointBanner && (
          <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center justify-center py-3 px-4 bg-black/85 backdrop-blur-md rounded-2xl border-2 border-green-400 shadow-2xl animate-fade-in">
            <span className="text-sm font-black uppercase tracking-wider text-green-300">
              {pointBanner}
            </span>
          </div>
        )}

        {/* Net Fault Flash Overlay */}
        {netFlash && (
          <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center py-2 bg-red-600/90 text-white font-black text-xs uppercase tracking-widest rounded-xl border border-white/50 shadow-lg animate-bounce">
            ⚠️ Net Fault!
          </div>
        )}

        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ touchAction: 'none', userSelect: 'none' }}
          className="w-full h-full max-w-sm sm:max-w-md md:max-w-lg rounded-3xl sm:rounded-[36px] clubhouse-board-depth bg-green-900 border-4 sm:border-6 border-green-950 cursor-ew-resize shadow-2xl"
        />
      </main>

      {/* Footer Instructions */}
      <footer className="pb-safe px-4 py-1.5 border-t border-[#2a2e33]/10 bg-[#f3e9dc]/80 backdrop-blur-sm flex items-center justify-between text-xs font-semibold text-[#7d6753]">
        <span>Drag baseline paddles horizontally to hit</span>
        <span className="text-[11px] bg-accent-light px-2.5 py-0.5 rounded-full border border-[#d8c3a5]/50">
          Target: First to 5 pts
        </span>
      </footer>

      {/* Game Over Victory Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="Toy Tennis"
          stats={[
            {
              label: 'Final Points',
              p1Value: `${scoreP1} pts`,
              p2Value: `${scoreP2} pts`,
            },
            {
              label: 'Match Result',
              p1Value: winner === 1 ? 'Match Champion' : 'Runner Up',
              p2Value: winner === 2 ? 'Match Champion' : 'Runner Up',
            },
          ]}
          onRestart={resetGame}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};
