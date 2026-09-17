import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import { useOrientation } from '../hooks/useOrientation';
import type { PlayerNumber } from '../types/game';
import { triggerHaptic, playTapSound, playCaptureSound } from '../utils/feedback';

interface Mallet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  touchId: number | null;
}

interface Puck {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

const TARGET_SCORE = 7;
const PUCK_RADIUS = 16;
const MALLET_RADIUS = 28;
const RESTITUTION = 0.92;
const FRICTION = 0.992;
const MAX_PUCK_SPEED = 24;

export const AirHockey: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();
  const { isLandscape } = useOrientation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  const [scoreP1, setScoreP1] = useState<number>(0);
  const [scoreP2, setScoreP2] = useState<number>(0);
  const [winner, setWinner] = useState<PlayerNumber | null>(null);
  const [goalFlash, setGoalFlash] = useState<PlayerNumber | null>(null);
  const [inPlay, setInPlay] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Air Hockey: Tap anywhere to serve the puck!');

  // Mutable game state held in refs for 60fps canvas loop
  const stateRef = useRef<{
    width: number;
    height: number;
    isLandscape: boolean;
    p1Score: number;
    p2Score: number;
    p1Mallet: Mallet;
    p2Mallet: Mallet;
    puck: Puck;
    isOver: boolean;
    inPlay: boolean;
    goalScoredTimer: number;
    stagnantTimer: number;
    keys: Record<string, boolean>;
  }>({
    width: 360,
    height: 640,
    isLandscape: false,
    p1Score: 0,
    p2Score: 0,
    p1Mallet: { x: 180, y: 520, vx: 0, vy: 0, radius: MALLET_RADIUS, touchId: null },
    p2Mallet: { x: 180, y: 120, vx: 0, vy: 0, radius: MALLET_RADIUS, touchId: null },
    puck: { x: 180, y: 320, vx: 0, vy: 0, radius: PUCK_RADIUS },
    isOver: false,
    inPlay: false,
    goalScoredTimer: 0,
    stagnantTimer: 0,
    keys: {},
  });

  const repositionEntities = useCallback((s: typeof stateRef.current) => {
    if (s.isLandscape) {
      s.p1Mallet.x = s.width * 0.2;
      s.p1Mallet.y = s.height / 2;
      s.p2Mallet.x = s.width * 0.8;
      s.p2Mallet.y = s.height / 2;
    } else {
      s.p1Mallet.x = s.width / 2;
      s.p1Mallet.y = s.height * 0.8;
      s.p2Mallet.x = s.width / 2;
      s.p2Mallet.y = s.height * 0.2;
    }
    s.p1Mallet.vx = 0;
    s.p1Mallet.vy = 0;
    s.p2Mallet.vx = 0;
    s.p2Mallet.vy = 0;
    s.puck.x = s.width / 2;
    s.puck.y = s.height / 2;
    s.puck.vx = 0;
    s.puck.vy = 0;
  }, []);

  // Launch / Serve puck with an impulse toward one player
  const servePuck = useCallback((towardPlayer: PlayerNumber = 1) => {
    const s = stateRef.current;
    if (s.isOver) return;

    triggerHaptic('medium');
    playTapSound();

    s.puck.x = s.width / 2;
    s.puck.y = s.height / 2;
    const speed = 7.5;
    const angleOffset = (Math.random() - 0.5) * 0.85;

    if (s.isLandscape) {
      // In landscape, P1 is Left (x=0), P2 is Right (x=width)
      const dirX = towardPlayer === 1 ? -1 : 1;
      s.puck.vx = Math.cos(angleOffset) * speed * dirX;
      s.puck.vy = Math.sin(angleOffset) * speed;
    } else {
      // In portrait, P1 is Bottom (y=height), P2 is Top (y=0)
      const dirY = towardPlayer === 1 ? 1 : -1;
      s.puck.vx = Math.sin(angleOffset) * speed;
      s.puck.vy = Math.cos(angleOffset) * speed * dirY;
    }

    s.inPlay = true;
    s.stagnantTimer = 0;
    setInPlay(true);
    setStatusMessage('Puck in play! Defend your goal and attack!');
  }, []);

  const resetGame = useCallback(() => {
    const s = stateRef.current;
    s.p1Score = 0;
    s.p2Score = 0;
    s.isOver = false;
    s.inPlay = false;
    s.goalScoredTimer = 0;
    s.stagnantTimer = 0;
    repositionEntities(s);
    setScoreP1(0);
    setScoreP2(0);
    setWinner(null);
    setGoalFlash(null);
    setInPlay(false);
    setStatusMessage('Tap to serve! First to 7 goals wins.');
    setGameStatus('active');
  }, [setGameStatus, repositionEntities]);

  // Keyboard navigation for desktop testing (WASD for Player 2, Arrow keys for Player 1)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key.toLowerCase()] = true;
      if (e.key === ' ' || e.key === 'Enter') {
        if (!stateRef.current.inPlay) {
          servePuck(1);
        }
      }
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
  }, [servePuck]);

  // Main canvas animation, resize observer, and physics loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const handleCanvasResize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);

      const s = stateRef.current;
      const prevW = s.width;
      const prevH = s.height;
      const newLandscape = rect.width > rect.height;
      const orientationChanged = s.isLandscape !== newLandscape;

      s.width = rect.width;
      s.height = rect.height;
      s.isLandscape = newLandscape;

      // Position mallets if initial or orientation changed
      if ((prevW === 360 && prevH === 640) || orientationChanged) {
        repositionEntities(s);
      }
    };

    // Immediate measure
    handleCanvasResize();

    const resizeObserver = new ResizeObserver(() => {
      handleCanvasResize();
    });
    resizeObserver.observe(container);
    window.addEventListener('resize', handleCanvasResize);

    const checkMalletPuckCollision = (mallet: Mallet, puck: Puck) => {
      const dx = puck.x - mallet.x;
      const dy = puck.y - mallet.y;
      const dist = Math.hypot(dx, dy);
      const minDist = mallet.radius + puck.radius;

      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const ny = dy / dist;

        // Separate bodies
        const overlap = minDist - dist;
        puck.x += nx * overlap;
        puck.y += ny * overlap;

        // Relative velocity
        const rvx = puck.vx - mallet.vx;
        const rvy = puck.vy - mallet.vy;
        const velAlongNormal = rvx * nx + rvy * ny;

        if (velAlongNormal < 0) {
          const impulse = -(1 + RESTITUTION) * velAlongNormal;
          puck.vx += (nx * impulse) + mallet.vx * 0.75;
          puck.vy += (ny * impulse) + mallet.vy * 0.75;

          // Cap speed
          const speed = Math.hypot(puck.vx, puck.vy);
          if (speed > MAX_PUCK_SPEED) {
            puck.vx = (puck.vx / speed) * MAX_PUCK_SPEED;
            puck.vy = (puck.vy / speed) * MAX_PUCK_SPEED;
          }

          triggerHaptic('light');
          playTapSound();
        }
      }
    };

    const updatePhysics = () => {
      const s = stateRef.current;
      if (s.isOver) return;

      const isLandscapeMode = s.isLandscape;

      // Keyboard controls update for desktop (P2 WASD, P1 Arrow Keys)
      const k = s.keys;
      const keySpeed = 8.5;
      if (k['w'] || k['a'] || k['s'] || k['d']) {
        let vx = 0;
        let vy = 0;
        if (k['a']) vx -= keySpeed;
        if (k['d']) vx += keySpeed;
        if (k['w']) vy -= keySpeed;
        if (k['s']) vy += keySpeed;
        s.p2Mallet.vx = vx;
        s.p2Mallet.vy = vy;

        if (isLandscapeMode) {
          // P2 guards Right half
          s.p2Mallet.x = Math.max(s.width / 2 + s.p2Mallet.radius, Math.min(s.width - s.p2Mallet.radius, s.p2Mallet.x + vx));
          s.p2Mallet.y = Math.max(s.p2Mallet.radius, Math.min(s.height - s.p2Mallet.radius, s.p2Mallet.y + vy));
        } else {
          // P2 guards Top half
          s.p2Mallet.x = Math.max(s.p2Mallet.radius, Math.min(s.width - s.p2Mallet.radius, s.p2Mallet.x + vx));
          s.p2Mallet.y = Math.max(s.p2Mallet.radius, Math.min(s.height / 2 - s.p2Mallet.radius, s.p2Mallet.y + vy));
        }
      } else if (s.p2Mallet.touchId === null && s.inPlay) {
        // Simple AI for Player 2 when no touch/keys are active
        const aiSpeed = 4.2;
        if (isLandscapeMode) {
          const targetY = s.puck.y;
          const targetX = Math.max(s.width * 0.72, Math.min(s.width - s.p2Mallet.radius * 1.5, s.puck.x + 40));
          const diffX = targetX - s.p2Mallet.x;
          const diffY = targetY - s.p2Mallet.y;
          s.p2Mallet.vx = Math.sign(diffX) * Math.min(Math.abs(diffX), aiSpeed);
          s.p2Mallet.vy = Math.sign(diffY) * Math.min(Math.abs(diffY), aiSpeed);
          s.p2Mallet.x = Math.max(s.width / 2 + s.p2Mallet.radius, Math.min(s.width - s.p2Mallet.radius, s.p2Mallet.x + s.p2Mallet.vx));
          s.p2Mallet.y = Math.max(s.p2Mallet.radius, Math.min(s.height - s.p2Mallet.radius, s.p2Mallet.y + s.p2Mallet.vy));
        } else {
          const targetX = s.puck.x;
          const targetY = Math.min(s.height * 0.28, Math.max(s.p2Mallet.radius * 1.5, s.puck.y - 40));
          const diffX = targetX - s.p2Mallet.x;
          const diffY = targetY - s.p2Mallet.y;
          s.p2Mallet.vx = Math.sign(diffX) * Math.min(Math.abs(diffX), aiSpeed);
          s.p2Mallet.vy = Math.sign(diffY) * Math.min(Math.abs(diffY), aiSpeed);
          s.p2Mallet.x = Math.max(s.p2Mallet.radius, Math.min(s.width - s.p2Mallet.radius, s.p2Mallet.x + s.p2Mallet.vx));
          s.p2Mallet.y = Math.max(s.p2Mallet.radius, Math.min(s.height / 2 - s.p2Mallet.radius, s.p2Mallet.y + s.p2Mallet.vy));
        }
      }

      if (k['arrowleft'] || k['arrowright'] || k['arrowup'] || k['arrowdown']) {
        let vx = 0;
        let vy = 0;
        if (k['arrowleft']) vx -= keySpeed;
        if (k['arrowright']) vx += keySpeed;
        if (k['arrowup']) vy -= keySpeed;
        if (k['arrowdown']) vy += keySpeed;
        s.p1Mallet.vx = vx;
        s.p1Mallet.vy = vy;

        if (isLandscapeMode) {
          // P1 guards Left half
          s.p1Mallet.x = Math.max(s.p1Mallet.radius, Math.min(s.width / 2 - s.p1Mallet.radius, s.p1Mallet.x + vx));
          s.p1Mallet.y = Math.max(s.p1Mallet.radius, Math.min(s.height - s.p1Mallet.radius, s.p1Mallet.y + vy));
        } else {
          // P1 guards Bottom half
          s.p1Mallet.x = Math.max(s.p1Mallet.radius, Math.min(s.width - s.p1Mallet.radius, s.p1Mallet.x + vx));
          s.p1Mallet.y = Math.max(s.height / 2 + s.p1Mallet.radius, Math.min(s.height - s.p1Mallet.radius, s.p1Mallet.y + vy));
        }
      }

      // If pausing right after goal or waiting for serve
      if (!s.inPlay || s.goalScoredTimer > 0) {
        if (s.goalScoredTimer > 0) s.goalScoredTimer--;
        return;
      }

      const p = s.puck;
      p.x += p.vx;
      p.y += p.vy;

      // Surface friction
      p.vx *= FRICTION;
      p.vy *= FRICTION;

      // Anti-stagnation drift if puck stops moving (< 0.25 speed for > 2 seconds)
      const currentPuckSpeed = Math.hypot(p.vx, p.vy);
      if (currentPuckSpeed < 0.25) {
        s.stagnantTimer++;
        if (s.stagnantTimer > 120) {
          if (isLandscapeMode) {
            const driftX = p.x < s.width / 2 ? 2.5 : -2.5;
            p.vx = driftX;
            p.vy = (Math.random() - 0.5) * 2;
          } else {
            const driftY = p.y < s.height / 2 ? 2.5 : -2.5;
            p.vy = driftY;
            p.vx = (Math.random() - 0.5) * 2;
          }
          s.stagnantTimer = 0;
        }
      } else {
        s.stagnantTimer = 0;
      }

      // Orientation-specific goal boundaries & wall bounces
      if (isLandscapeMode) {
        const goalHeight = s.height * 0.38;
        const goalTop = (s.height - goalHeight) / 2;
        const goalBottom = goalTop + goalHeight;

        // Check Left Goal (Player 2 scores on Player 1)
        if (p.x - p.radius <= 0) {
          if (p.y >= goalTop && p.y <= goalBottom) {
            s.p2Score += 1;
            setScoreP2(s.p2Score);
            triggerHaptic('success');
            playCaptureSound();
            setGoalFlash(2);
            setTimeout(() => setGoalFlash(null), 800);

            if (s.p2Score >= TARGET_SCORE) {
              s.isOver = true;
              setWinner(2);
              setGameStatus('finished');
              return;
            }

            p.x = s.width * 0.35;
            p.y = s.height / 2;
            p.vx = 0;
            p.vy = 0;
            s.inPlay = false;
            s.goalScoredTimer = 45;
            setInPlay(false);
            setStatusMessage('Player 2 Scores! Tap to serve next round.');
            return;
          } else {
            p.x = p.radius;
            p.vx = -p.vx * RESTITUTION;
            triggerHaptic('light');
          }
        }

        // Check Right Goal (Player 1 scores on Player 2)
        if (p.x + p.radius >= s.width) {
          if (p.y >= goalTop && p.y <= goalBottom) {
            s.p1Score += 1;
            setScoreP1(s.p1Score);
            triggerHaptic('success');
            playCaptureSound();
            setGoalFlash(1);
            setTimeout(() => setGoalFlash(null), 800);

            if (s.p1Score >= TARGET_SCORE) {
              s.isOver = true;
              setWinner(1);
              setGameStatus('finished');
              return;
            }

            p.x = s.width * 0.65;
            p.y = s.height / 2;
            p.vx = 0;
            p.vy = 0;
            s.inPlay = false;
            s.goalScoredTimer = 45;
            setInPlay(false);
            setStatusMessage('Player 1 Scores! Tap to serve next round.');
            return;
          } else {
            p.x = s.width - p.radius;
            p.vx = -p.vx * RESTITUTION;
            triggerHaptic('light');
          }
        }

        // Top & Bottom walls bounce
        if (p.y - p.radius <= 0) {
          p.y = p.radius;
          p.vy = -p.vy * RESTITUTION;
          triggerHaptic('light');
        } else if (p.y + p.radius >= s.height) {
          p.y = s.height - p.radius;
          p.vy = -p.vy * RESTITUTION;
          triggerHaptic('light');
        }
      } else {
        // PORTRAIT MODE (Top = P2, Bottom = P1)
        const goalWidth = s.width * 0.38;
        const goalLeft = (s.width - goalWidth) / 2;
        const goalRight = goalLeft + goalWidth;

        // Check Top Goal (Player 1 scores on Player 2)
        if (p.y - p.radius <= 0) {
          if (p.x >= goalLeft && p.x <= goalRight) {
            s.p1Score += 1;
            setScoreP1(s.p1Score);
            triggerHaptic('success');
            playCaptureSound();
            setGoalFlash(1);
            setTimeout(() => setGoalFlash(null), 800);

            if (s.p1Score >= TARGET_SCORE) {
              s.isOver = true;
              setWinner(1);
              setGameStatus('finished');
              return;
            }

            p.x = s.width / 2;
            p.y = s.height * 0.35;
            p.vx = 0;
            p.vy = 0;
            s.inPlay = false;
            s.goalScoredTimer = 45;
            setInPlay(false);
            setStatusMessage('Player 1 Scores! Tap to serve next round.');
            return;
          } else {
            p.y = p.radius;
            p.vy = -p.vy * RESTITUTION;
            triggerHaptic('light');
          }
        }

        // Check Bottom Goal (Player 2 scores on Player 1)
        if (p.y + p.radius >= s.height) {
          if (p.x >= goalLeft && p.x <= goalRight) {
            s.p2Score += 1;
            setScoreP2(s.p2Score);
            triggerHaptic('success');
            playCaptureSound();
            setGoalFlash(2);
            setTimeout(() => setGoalFlash(null), 800);

            if (s.p2Score >= TARGET_SCORE) {
              s.isOver = true;
              setWinner(2);
              setGameStatus('finished');
              return;
            }

            p.x = s.width / 2;
            p.y = s.height * 0.65;
            p.vx = 0;
            p.vy = 0;
            s.inPlay = false;
            s.goalScoredTimer = 45;
            setInPlay(false);
            setStatusMessage('Player 2 Scores! Tap to serve next round.');
            return;
          } else {
            p.y = s.height - p.radius;
            p.vy = -p.vy * RESTITUTION;
            triggerHaptic('light');
          }
        }

        // Left & Right walls bounce
        if (p.x - p.radius <= 0) {
          p.x = p.radius;
          p.vx = -p.vx * RESTITUTION;
          triggerHaptic('light');
        } else if (p.x + p.radius >= s.width) {
          p.x = s.width - p.radius;
          p.vx = -p.vx * RESTITUTION;
          triggerHaptic('light');
        }
      }

      // Mallet vs Puck Collisions
      checkMalletPuckCollision(s.p1Mallet, p);
      checkMalletPuckCollision(s.p2Mallet, p);
    };

    const render = () => {
      const s = stateRef.current;
      const w = s.width;
      const h = s.height;
      const isLandscapeMode = s.isLandscape;

      // 1. Rink Surface & Ice Sheen
      const iceGrad = ctx.createLinearGradient(0, 0, w, h);
      iceGrad.addColorStop(0, '#f8fafc');
      iceGrad.addColorStop(1, '#e2e8f0');
      ctx.fillStyle = iceGrad;
      ctx.fillRect(0, 0, w, h);

      // Micro air holes grid effect
      ctx.fillStyle = '#cbd5e1';
      for (let x = 16; x < w; x += 22) {
        for (let y = 16; y < h; y += 22) {
          ctx.beginPath();
          ctx.arc(x, y, 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 2. Goal Slots & Creases
      if (isLandscapeMode) {
        const goalHeight = h * 0.38;
        const goalTop = (h - goalHeight) / 2;

        // Left Goal Crease (P1 Blue)
        ctx.fillStyle = '#dbeafe';
        ctx.beginPath();
        ctx.arc(0, h / 2, goalHeight * 0.6, -Math.PI / 2, Math.PI / 2);
        ctx.fill();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Left Goal mouth slot
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(0, goalTop, 8, goalHeight);

        // Right Goal Crease (P2 Red)
        ctx.fillStyle = '#fee2e2';
        ctx.beginPath();
        ctx.arc(w, h / 2, goalHeight * 0.6, Math.PI / 2, (3 * Math.PI) / 2);
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Right Goal mouth slot
        ctx.fillStyle = '#b91c1c';
        ctx.fillRect(w - 8, goalTop, 8, goalHeight);

        // Center Red Line & Faceoff Circle (Vertical in landscape)
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(w / 2, 0);
        ctx.lineTo(w / 2, h);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(w / 2, h / 2, h * 0.22, 0, Math.PI * 2);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
      } else {
        const goalWidth = w * 0.38;
        const goalLeft = (w - goalWidth) / 2;

        // Top Goal Crease (P2 Red)
        ctx.fillStyle = '#fee2e2';
        ctx.beginPath();
        ctx.arc(w / 2, 0, goalWidth * 0.6, 0, Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Top Goal mouth slot
        ctx.fillStyle = '#b91c1c';
        ctx.fillRect(goalLeft, 0, goalWidth, 8);

        // Bottom Goal Crease (P1 Blue)
        ctx.fillStyle = '#dbeafe';
        ctx.beginPath();
        ctx.arc(w / 2, h, goalWidth * 0.6, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Bottom Goal mouth slot
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(goalLeft, h - 8, goalWidth, 8);

        // Center Red Line & Faceoff Circle (Horizontal in portrait)
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(w / 2, h / 2, w * 0.22, 0, Math.PI * 2);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
      }

      // 3. Rink Outer Border Rim
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 6;
      ctx.strokeRect(0, 0, w, h);

      // 4. Draw Puck (with drop shadow)
      const p = s.puck;
      ctx.beginPath();
      ctx.arc(p.x + 2, p.y + 3, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fill();

      // Puck body
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      const puckGrad = ctx.createRadialGradient(p.x - 3, p.y - 3, 2, p.x, p.y, p.radius);
      puckGrad.addColorStop(0, '#334155');
      puckGrad.addColorStop(1, '#090d16');
      ctx.fillStyle = puckGrad;
      ctx.fill();
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // 5. Draw Mallet Player 2 (Red - Top in portrait, Right in landscape)
      const m2 = s.p2Mallet;
      ctx.beginPath();
      ctx.arc(m2.x + 3, m2.y + 4, m2.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(m2.x, m2.y, m2.radius, 0, Math.PI * 2);
      const m2Grad = ctx.createRadialGradient(m2.x - 5, m2.y - 5, 4, m2.x, m2.y, m2.radius);
      m2Grad.addColorStop(0, '#f87171');
      m2Grad.addColorStop(0.7, '#dc2626');
      m2Grad.addColorStop(1, '#991b1b');
      ctx.fillStyle = m2Grad;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(m2.x, m2.y, m2.radius * 0.44, 0, Math.PI * 2);
      ctx.fillStyle = '#fee2e2';
      ctx.fill();
      ctx.strokeStyle = '#b91c1c';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 6. Draw Mallet Player 1 (Blue - Bottom in portrait, Left in landscape)
      const m1 = s.p1Mallet;
      ctx.beginPath();
      ctx.arc(m1.x + 3, m1.y + 4, m1.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(m1.x, m1.y, m1.radius, 0, Math.PI * 2);
      const m1Grad = ctx.createRadialGradient(m1.x - 5, m1.y - 5, 4, m1.x, m1.y, m1.radius);
      m1Grad.addColorStop(0, '#60a5fa');
      m1Grad.addColorStop(0.7, '#2563eb');
      m1Grad.addColorStop(1, '#1e40af');
      ctx.fillStyle = m1Grad;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(m1.x, m1.y, m1.radius * 0.44, 0, Math.PI * 2);
      ctx.fillStyle = '#dbeafe';
      ctx.fill();
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 1.5;
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
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleCanvasResize);
    };
  }, [setGameStatus, repositionEntities]);

  // Coordinate normalizer from viewport pointer to canvas internal dimensions
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = stateRef.current.width / rect.width;
    const scaleY = stateRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // Robust Pointer Events: handles mouse drags and multi-touch seamlessly
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = getCanvasCoords(e);
    const s = stateRef.current;
    const isLandscapeMode = s.isLandscape;

    const isP1Side = isLandscapeMode ? x < s.width / 2 : y > s.height / 2;

    // If not in play, serve immediately on tap!
    if (!s.inPlay && !s.isOver) {
      servePuck(isP1Side ? 2 : 1);
    }

    if (isP1Side) {
      s.p1Mallet.touchId = e.pointerId;
      s.p1Mallet.vx = 0;
      s.p1Mallet.vy = 0;
      if (isLandscapeMode) {
        s.p1Mallet.x = Math.max(s.p1Mallet.radius, Math.min(s.width / 2 - s.p1Mallet.radius, x));
        s.p1Mallet.y = Math.max(s.p1Mallet.radius, Math.min(s.height - s.p1Mallet.radius, y));
      } else {
        s.p1Mallet.x = Math.max(s.p1Mallet.radius, Math.min(s.width - s.p1Mallet.radius, x));
        s.p1Mallet.y = Math.max(s.height / 2 + s.p1Mallet.radius, Math.min(s.height - s.p1Mallet.radius, y));
      }
      triggerHaptic('light');
    } else {
      s.p2Mallet.touchId = e.pointerId;
      s.p2Mallet.vx = 0;
      s.p2Mallet.vy = 0;
      if (isLandscapeMode) {
        s.p2Mallet.x = Math.max(s.width / 2 + s.p2Mallet.radius, Math.min(s.width - s.p2Mallet.radius, x));
        s.p2Mallet.y = Math.max(s.p2Mallet.radius, Math.min(s.height - s.p2Mallet.radius, y));
      } else {
        s.p2Mallet.x = Math.max(s.p2Mallet.radius, Math.min(s.width - s.p2Mallet.radius, x));
        s.p2Mallet.y = Math.max(s.p2Mallet.radius, Math.min(s.height / 2 - s.p2Mallet.radius, y));
      }
      triggerHaptic('light');
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    const s = stateRef.current;
    const isLandscapeMode = s.isLandscape;

    const isP1Side = isLandscapeMode ? x < s.width / 2 : y > s.height / 2;

    if (e.pointerId === s.p1Mallet.touchId || (e.pointerType === 'mouse' && isP1Side)) {
      let nextX: number;
      let nextY: number;
      if (isLandscapeMode) {
        nextX = Math.max(s.p1Mallet.radius, Math.min(s.width / 2 - s.p1Mallet.radius, x));
        nextY = Math.max(s.p1Mallet.radius, Math.min(s.height - s.p1Mallet.radius, y));
      } else {
        nextX = Math.max(s.p1Mallet.radius, Math.min(s.width - s.p1Mallet.radius, x));
        nextY = Math.max(s.height / 2 + s.p1Mallet.radius, Math.min(s.height - s.p1Mallet.radius, y));
      }
      s.p1Mallet.vx = nextX - s.p1Mallet.x;
      s.p1Mallet.vy = nextY - s.p1Mallet.y;
      s.p1Mallet.x = nextX;
      s.p1Mallet.y = nextY;
    } else if (e.pointerId === s.p2Mallet.touchId || (e.pointerType === 'mouse' && !isP1Side && s.p2Mallet.touchId !== null)) {
      let nextX: number;
      let nextY: number;
      if (isLandscapeMode) {
        nextX = Math.max(s.width / 2 + s.p2Mallet.radius, Math.min(s.width - s.p2Mallet.radius, x));
        nextY = Math.max(s.p2Mallet.radius, Math.min(s.height - s.p2Mallet.radius, y));
      } else {
        nextX = Math.max(s.p2Mallet.radius, Math.min(s.width - s.p2Mallet.radius, x));
        nextY = Math.max(s.p2Mallet.radius, Math.min(s.height / 2 - s.p2Mallet.radius, y));
      }
      s.p2Mallet.vx = nextX - s.p2Mallet.x;
      s.p2Mallet.vy = nextY - s.p2Mallet.y;
      s.p2Mallet.x = nextX;
      s.p2Mallet.y = nextY;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (e.pointerId === s.p1Mallet.touchId) {
      s.p1Mallet.touchId = null;
      s.p1Mallet.vx = 0;
      s.p1Mallet.vy = 0;
    }
    if (e.pointerId === s.p2Mallet.touchId) {
      s.p2Mallet.touchId = null;
      s.p2Mallet.vx = 0;
      s.p2Mallet.vy = 0;
    }
  };

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden relative select-none">
      <GameHeader
        title="Air Hockey"
        subtitle="Fast-Paced Action"
        turn={1}
        scoreP1={scoreP1}
        scoreP2={scoreP2}
        p1Label={isLandscape ? 'P1 (Left)' : 'P1 (Bottom)'}
        p2Label={isLandscape ? 'P2 (Right)' : 'P2 (Top)'}
        onRestart={resetGame}
        statusMessage={statusMessage}
      />

      {/* Rink Canvas Container */}
      <main
        ref={containerRef}
        className="flex-1 min-h-0 w-full flex flex-col items-center justify-center p-1.5 sm:p-3 relative touch-none overflow-hidden"
      >
        {/* Goal Scoring Banner Overlay */}
        {goalFlash !== null && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center justify-center py-4 bg-black/85 backdrop-blur-md rounded-3xl border-2 border-yellow-400 shadow-2xl animate-bounce">
            <span className="text-2xl font-black uppercase tracking-widest text-yellow-300">
              GOAL!
            </span>
            <span className={`text-sm font-black uppercase mt-1 ${goalFlash === 1 ? 'text-blue-400' : 'text-red-400'}`}>
              Player {goalFlash} Scores!
            </span>
          </div>
        )}

        {/* Floating "Tap To Serve" Prompt when puck is stationary */}
        {!inPlay && winner === null && (
          <button
            onClick={() => servePuck(1)}
            type="button"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 px-6 py-2.5 rounded-full bg-amber-500/90 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest shadow-xl border-2 border-white/60 animate-pulse active:scale-95 transition-all"
          >
            ⚡ Tap To Serve
          </button>
        )}

        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ touchAction: 'none', userSelect: 'none' }}
          className={`min-h-0 min-w-0 object-contain rounded-3xl sm:rounded-[36px] clubhouse-board-depth bg-slate-100 border-4 sm:border-6 border-slate-700 cursor-crosshair shadow-2xl ${
            isLandscape
              ? 'h-full max-h-full w-auto aspect-[1.7/1] max-w-full'
              : 'h-full max-h-full w-auto aspect-[1/1.7] max-w-full'
          }`}
        />
      </main>

      {/* Footer Instructions (hidden in landscape to save vertical space) */}
      <footer className="landscape:hidden pb-safe px-4 py-1.5 border-t border-[#2a2e33]/10 bg-[#f3e9dc]/80 backdrop-blur-sm flex items-center justify-between text-xs font-semibold text-[#7d6753]">
        <span>Hold phone flat on table between both players</span>
        <span className="text-[11px] bg-accent-light px-2.5 py-0.5 rounded-full border border-[#d8c3a5]/50">
          Target: First to 7
        </span>
      </footer>

      {/* Victory Game Over Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="Air Hockey"
          stats={[
            {
              label: 'Final Goals',
              p1Value: `${scoreP1} goals`,
              p2Value: `${scoreP2} goals`,
            },
            {
              label: 'Match Result',
              p1Value: winner === 1 ? 'Champion' : 'Runner Up',
              p2Value: winner === 2 ? 'Champion' : 'Runner Up',
            },
          ]}
          onRestart={resetGame}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};
