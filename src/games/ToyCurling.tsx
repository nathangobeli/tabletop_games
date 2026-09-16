import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import {
  triggerHaptic,
  playCurlingGlideSound,
  playCurlingSweepSound,
  playCurlingClackSound,
  playBounceSound,
} from '../utils/feedback';

interface CurlingStone {
  id: number;
  player: PlayerNumber;
  x: number;
  y: number;
  vx: number;
  vy: number;
  curlRate: number; // -1 for in-turn (left), 1 for out-turn (right)
  inPlay: boolean;
  thrown: boolean;
  stopped: boolean;
}

interface SweepParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

const SHEET_WIDTH = 340;
const SHEET_HEIGHT = 560;
const STONE_RADIUS = 13;

// Target House Center (The Button)
const HOUSE_CX = SHEET_WIDTH / 2; // 170
const HOUSE_CY = 110;
const HOUSE_R12 = 88; // 12-foot ring (Blue)
const HOUSE_R8 = 58;  // 8-foot ring (White)
const HOUSE_R4 = 28;  // 4-foot ring (Red)
const HOUSE_BUTTON = 9; // The Button (Gold)

const HOG_LINE_Y = 240;
const BACK_LINE_Y = 22;
const DELIVERY_Y = 490;
const SIDE_MARGIN = 20;

export const ToyCurling: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Turn & End State
  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [currentEnd, setCurrentEnd] = useState<number>(1);
  const totalEnds = 2; // 2 Ends per Match
  const [p1Score, setP1Score] = useState<number>(0);
  const [p2Score, setP2Score] = useState<number>(0);
  const [stonesThrownCount, setStonesThrownCount] = useState<number>(0); // 0 to 8
  const [winner, setWinner] = useState<PlayerNumber | 'draw' | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Player 1: Aim vector, choose curl, then drag launch!');

  // Delivery Controls State
  const [aimAngle, setAimAngle] = useState<number>(0); // -16 to +16 degrees
  const [curlDirection, setCurlDirection] = useState<'in' | 'straight' | 'out'>('in'); // in = curve left, straight = none, out = curve right
  const [curlStrength, setCurlStrength] = useState<number>(0.35); // 0.05 to 1.0 (5% to 100%)
  const [power, setPower] = useState<number>(0.58); // 0.05 to 1.0 (calibrated for guards, draws, takeouts)
  const [isStoneMoving, setIsStoneMoving] = useState<boolean>(false);

  // Simulation State Ref
  const simRef = useRef<{
    stones: CurlingStone[];
    activeStoneIdx: number | null;
    particles: SweepParticle[];
    sweepEnergy: number; // Boost from active sweeping
    lastSweepX: number;
    lastSweepY: number;
    lastSweepTime: number;
  }>({
    stones: [],
    activeStoneIdx: null,
    particles: [],
    sweepEnergy: 0,
    lastSweepX: 0,
    lastSweepY: 0,
    lastSweepTime: 0,
  });

  // Setup 8 stones (4 for P1, 4 for P2 alternating: P1, P2, P1, P2, P1, P2, P1, P2)
  const initStones = useCallback(() => {
    const newStones: CurlingStone[] = [];
    for (let i = 0; i < 8; i++) {
      const p: PlayerNumber = i % 2 === 0 ? 1 : 2;
      newStones.push({
        id: i,
        player: p,
        x: HOUSE_CX,
        y: DELIVERY_Y,
        vx: 0,
        vy: 0,
        curlRate: 0,
        inPlay: true,
        thrown: false,
        stopped: false,
      });
    }
    simRef.current.stones = newStones;
    simRef.current.activeStoneIdx = null;
    setStonesThrownCount(0);
    setTurn(1);
    setIsStoneMoving(false);
  }, []);

  useEffect(() => {
    initStones();
  }, [initStones]);

  // Scoring at the end of an End (8 stones)
  const evaluateEndScoring = useCallback(() => {
    const stones = simRef.current.stones;
    // Filter stones in house: distance to button <= HOUSE_R12 + STONE_RADIUS
    const inHouse = stones.filter((s) => {
      if (!s.inPlay || !s.thrown) return false;
      const d = Math.hypot(s.x - HOUSE_CX, s.y - HOUSE_CY);
      return d <= HOUSE_R12 + STONE_RADIUS;
    });

    if (inHouse.length === 0) {
      setStatusMessage(`Blank End! No stones in the house. Score: P1 ${p1Score} - P2 ${p2Score}`);
      triggerHaptic('medium');
    } else {
      // Find stone closest to button
      inHouse.sort((a, b) => {
        const da = Math.hypot(a.x - HOUSE_CX, a.y - HOUSE_CY);
        const db = Math.hypot(b.x - HOUSE_CX, b.y - HOUSE_CY);
        return da - db;
      });

      const closestStone = inHouse[0];
      const endWinnerPlayer = closestStone.player;

      // Find closest opponent stone distance
      const opponentStones = inHouse.filter((s) => s.player !== endWinnerPlayer);
      const oppClosestDist = opponentStones.length > 0
        ? Math.hypot(opponentStones[0].x - HOUSE_CX, opponentStones[0].y - HOUSE_CY)
        : Infinity;

      // Count points for end winner
      let pointsScored = 0;
      for (const s of inHouse) {
        if (s.player === endWinnerPlayer) {
          const d = Math.hypot(s.x - HOUSE_CX, s.y - HOUSE_CY);
          if (d < oppClosestDist) {
            pointsScored++;
          }
        }
      }

      if (endWinnerPlayer === 1) {
        setP1Score((prev) => prev + pointsScored);
      } else {
        setP2Score((prev) => prev + pointsScored);
      }

      triggerHaptic('success');
      setStatusMessage(`End ${currentEnd} Complete! Player ${endWinnerPlayer} scores ${pointsScored} pt${pointsScored > 1 ? 's' : ''}!`);
    }

    // Check if match is finished or advance to next end
    if (currentEnd >= totalEnds) {
      setTimeout(() => {
        const finalP1 = p1Score + (inHouse[0]?.player === 1 ? 1 : 0);
        const finalP2 = p2Score + (inHouse[0]?.player === 2 ? 1 : 0);
        if (finalP1 > finalP2) setWinner(1);
        else if (finalP2 > finalP1) setWinner(2);
        else setWinner('draw');
      }, 1800);
    } else {
      setTimeout(() => {
        setCurrentEnd((e) => e + 1);
        initStones();
        setStatusMessage(`End ${currentEnd + 1} of ${totalEnds}: Slide your stones!`);
        setGameStatus('active');
      }, 2400);
    }
  }, [p1Score, p2Score, currentEnd, totalEnds, initStones, setGameStatus]);

  // Launch Stone Delivery
  const handleDeliverStone = () => {
    if (isStoneMoving || stonesThrownCount >= 8 || winner !== null) return;

    const s = simRef.current;
    const stoneIdx = stonesThrownCount;
    const stone = s.stones[stoneIdx];
    if (!stone) return;

    triggerHaptic('medium');
    playCurlingGlideSound();

    // Convert aim angle to radians
    const rad = (aimAngle * Math.PI) / 180;
    // Calibrated speed: power 0.05 to 1.0 -> speed ~2.48 to 7.80 (guards, draws, takeouts)
    const baseSpeed = 2.2 + power * 5.6;
    const vx = Math.sin(rad) * baseSpeed;
    const vy = -Math.cos(rad) * baseSpeed;

    // Effective curl rate: -1 for in-turn, 0 for straight, +1 for out-turn multiplied by curl strength
    const effectiveCurl = curlDirection === 'straight' ? 0 : (curlDirection === 'in' ? -1 : 1) * curlStrength;

    stone.x = HOUSE_CX;
    stone.y = DELIVERY_Y;
    stone.vx = vx;
    stone.vy = vy;
    stone.curlRate = effectiveCurl;
    stone.thrown = true;
    stone.stopped = false;

    s.activeStoneIdx = stoneIdx;
    setIsStoneMoving(true);
    setStatusMessage(`Stone in motion! Swiftly swipe ahead on ice to SWEEP! 🧹`);
  };

  // Main Canvas & Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const s = simRef.current;

      // 1. Update In-Flight & Moving Stones Physics
      let anyStoneMoving = false;

      // Decay sweep energy
      if (s.sweepEnergy > 0) {
        s.sweepEnergy = Math.max(0, s.sweepEnergy - 0.02);
      }

      for (let i = 0; i < s.stones.length; i++) {
        const stone = s.stones[i];
        if (!stone.thrown || stone.stopped || !stone.inPlay) continue;

        const speed = Math.hypot(stone.vx, stone.vy);
        if (speed > 0.08) {
          anyStoneMoving = true;

          // Dynamic ice friction: normal ice 0.9855, swept ice up to 0.9935
          const activeFriction = 0.9855 + s.sweepEnergy * 0.008;
          stone.vx *= activeFriction;
          stone.vy *= activeFriction;

          // Rotational Curl: As stone slows down, curl torque curves its path
          // Sweeping straightens the stone by reducing curl torque
          const curlSuppression = 1 - s.sweepEnergy * 0.75;
          const curlForce = (0.024 * stone.curlRate * curlSuppression) * (Math.abs(stone.vy) / 5.0) * Math.max(0.2, (1 - speed / 8.0));
          stone.vx += curlForce;

          stone.x += stone.vx;
          stone.y += stone.vy;

          // Sideline out-of-bounds check
          if (stone.x < SIDE_MARGIN || stone.x > SHEET_WIDTH - SIDE_MARGIN) {
            stone.inPlay = false;
            stone.stopped = true;
            playBounceSound(220);
          }

          // Past Back Line out-of-bounds check
          if (stone.y < BACK_LINE_Y) {
            stone.inPlay = false;
            stone.stopped = true;
          }
        } else {
          stone.vx = 0;
          stone.vy = 0;
          stone.stopped = true;
        }
      }

      // 2. Elastic Circle-to-Circle Stone Collisions
      for (let i = 0; i < s.stones.length; i++) {
        const st1 = s.stones[i];
        if (!st1.thrown || !st1.inPlay) continue;

        for (let j = i + 1; j < s.stones.length; j++) {
          const st2 = s.stones[j];
          if (!st2.thrown || !st2.inPlay) continue;

          const dx = st2.x - st1.x;
          const dy = st2.y - st1.y;
          const dist = Math.hypot(dx, dy);
          const minDist = STONE_RADIUS * 2;

          if (dist < minDist && dist > 0) {
            // Overlap separation
            const overlap = (minDist - dist) / 2;
            const nx = dx / dist;
            const ny = dy / dist;

            st1.x -= nx * overlap;
            st1.y -= ny * overlap;
            st2.x += nx * overlap;
            st2.y += ny * overlap;

            // Normal & Tangential momentum transfer
            const kx = st1.vx - st2.vx;
            const ky = st1.vy - st2.vy;
            const p = 2 * (nx * kx + ny * ky) / 2;

            const restitution = 0.92;
            st1.vx -= p * nx * restitution;
            st1.vy -= p * ny * restitution;
            st2.vx += p * nx * restitution;
            st2.vy += p * ny * restitution;

            st1.stopped = false;
            st2.stopped = false;
            anyStoneMoving = true;

            const impactForce = Math.hypot(kx, ky);
            if (impactForce > 0.4) {
              playCurlingClackSound(Math.min(1.5, impactForce / 4));
              triggerHaptic('medium');
            }
          }
        }
      }

      // Check if roll / throw finished
      if (isStoneMoving && !anyStoneMoving) {
        setIsStoneMoving(false);
        s.activeStoneIdx = null;

        // Check Hog Line rule for the delivered stone
        const deliveredStone = s.stones[stonesThrownCount];
        let hogged = false;
        if (deliveredStone && deliveredStone.inPlay && deliveredStone.y > HOG_LINE_Y) {
          deliveredStone.inPlay = false;
          deliveredStone.stopped = true;
          hogged = true;
          playBounceSound(180);
        }

        const nextCount = stonesThrownCount + 1;
        setStonesThrownCount(nextCount);

        if (nextCount < 8) {
          const nextTurn: PlayerNumber = nextCount % 2 === 0 ? 1 : 2;
          setTurn(nextTurn);
          if (hogged) {
            setStatusMessage(`Short throw! Did not cross Hog Line (removed). Player ${nextTurn}'s delivery (Stone ${Math.floor(nextCount / 2) + 1}/4)`);
          } else {
            setStatusMessage(`Stone settled! Player ${nextTurn}'s delivery (Stone ${Math.floor(nextCount / 2) + 1}/4)`);
          }
        } else {
          // All 8 stones thrown -> evaluate end scoring
          evaluateEndScoring();
        }
      }

      // 3. Update Sweep Particles
      for (let pIdx = s.particles.length - 1; pIdx >= 0; pIdx--) {
        const p = s.particles[pIdx];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        if (p.life <= 0) {
          s.particles.splice(pIdx, 1);
        }
      }

      // --- CANVAS DRAWING ---
      ctx.clearRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);

      // A. Frosted Ice Sheet Bed
      const iceGrad = ctx.createLinearGradient(0, 0, 0, SHEET_HEIGHT);
      iceGrad.addColorStop(0, '#bae6fd');
      iceGrad.addColorStop(0.5, '#e0f2fe');
      iceGrad.addColorStop(1, '#f0f9ff');
      ctx.fillStyle = iceGrad;
      ctx.fillRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);

      // Pebbled Ice Texture Overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      for (let py = 10; py < SHEET_HEIGHT; py += 18) {
        for (let px = 10; px < SHEET_WIDTH; px += 18) {
          ctx.beginPath();
          ctx.arc(px + ((py % 36 === 0) ? 9 : 0), py, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Sidelines
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(SIDE_MARGIN, 0);
      ctx.lineTo(SIDE_MARGIN, SHEET_HEIGHT);
      ctx.moveTo(SHEET_WIDTH - SIDE_MARGIN, 0);
      ctx.lineTo(SHEET_WIDTH - SIDE_MARGIN, SHEET_HEIGHT);
      ctx.stroke();

      // Center Line
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(HOUSE_CX, 0);
      ctx.lineTo(HOUSE_CX, SHEET_HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);

      // Back Line
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(SIDE_MARGIN, BACK_LINE_Y);
      ctx.lineTo(SHEET_WIDTH - SIDE_MARGIN, BACK_LINE_Y);
      ctx.stroke();

      // Tee Line (through Button)
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(SIDE_MARGIN, HOUSE_CY);
      ctx.lineTo(SHEET_WIDTH - SIDE_MARGIN, HOUSE_CY);
      ctx.stroke();

      // Hog Line
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(SIDE_MARGIN, HOG_LINE_Y);
      ctx.lineTo(SHEET_WIDTH - SIDE_MARGIN, HOG_LINE_Y);
      ctx.stroke();

      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('HOG LINE', SIDE_MARGIN + 6, HOG_LINE_Y - 5);

      // Delivery Hack Line
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(HOUSE_CX - 30, DELIVERY_Y);
      ctx.lineTo(HOUSE_CX + 30, DELIVERY_Y);
      ctx.stroke();

      // B. The House (Concentric Scoring Rings)
      // 12-foot ring (Blue)
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(HOUSE_CX, HOUSE_CY, HOUSE_R12, 0, Math.PI * 2);
      ctx.fill();

      // 8-foot ring (White)
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(HOUSE_CX, HOUSE_CY, HOUSE_R8, 0, Math.PI * 2);
      ctx.fill();

      // 4-foot ring (Red)
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(HOUSE_CX, HOUSE_CY, HOUSE_R4, 0, Math.PI * 2);
      ctx.fill();

      // The Button (Center Circle)
      ctx.fillStyle = '#fef08a';
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(HOUSE_CX, HOUSE_CY, HOUSE_BUTTON, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // C. Sweep Particles
      for (const p of s.particles) {
        ctx.fillStyle = `rgba(255, 255, 255, ${p.life})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5 * p.life, 0, Math.PI * 2);
        ctx.fill();
      }

      // D. Curved Trajectory Prediction & Predicted Ghost Landing Stone
      if (!isStoneMoving && stonesThrownCount < 8 && winner === null) {
        const rad = (aimAngle * Math.PI) / 180;
        const launchSpeed = 2.2 + power * 5.6;
        let simVx = Math.sin(rad) * launchSpeed;
        let simVy = -Math.cos(rad) * launchSpeed;
        let simX = HOUSE_CX;
        let simY = DELIVERY_Y;
        const effectiveCurl = curlDirection === 'straight' ? 0 : (curlDirection === 'in' ? -1 : 1) * curlStrength;

        ctx.save();
        ctx.strokeStyle = turn === 1 ? 'rgba(59, 130, 246, 0.75)' : 'rgba(239, 68, 68, 0.75)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(simX, simY);

        for (let step = 0; step < 240; step++) {
          const spd = Math.hypot(simVx, simVy);
          if (spd < 0.08) break;
          simVx *= 0.9855;
          simVy *= 0.9855;
          const cForce = (0.024 * effectiveCurl) * (Math.abs(simVy) / 5.0) * Math.max(0.2, (1 - spd / 8.0));
          simVx += cForce;
          simX += simVx;
          simY += simVy;
          ctx.lineTo(simX, simY);

          if (simY < BACK_LINE_Y || simX < SIDE_MARGIN || simX > SHEET_WIDTH - SIDE_MARGIN) {
            break;
          }
        }
        ctx.stroke();

        // Target Ghost Stone ring at predicted resting position
        ctx.setLineDash([]);
        const isOutOfPlay = simY > HOG_LINE_Y || simY < BACK_LINE_Y || simX < SIDE_MARGIN || simX > SHEET_WIDTH - SIDE_MARGIN;

        ctx.strokeStyle = isOutOfPlay
          ? 'rgba(239, 68, 68, 0.85)'
          : (turn === 1 ? 'rgba(59, 130, 246, 0.85)' : 'rgba(239, 68, 68, 0.85)');
        ctx.fillStyle = isOutOfPlay
          ? 'rgba(239, 68, 68, 0.15)'
          : (turn === 1 ? 'rgba(59, 130, 246, 0.22)' : 'rgba(239, 68, 68, 0.22)');
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(simX, simY, STONE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Ghost Stone Handle Center Dot
        ctx.fillStyle = isOutOfPlay ? '#ef4444' : (turn === 1 ? '#3b82f6' : '#ef4444');
        ctx.beginPath();
        ctx.arc(simX, simY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // E. Render All Curling Stones
      for (let i = 0; i < s.stones.length; i++) {
        const stone = s.stones[i];
        if (!stone.thrown && i !== stonesThrownCount) continue;
        if (!stone.inPlay) continue;

        const isCurrent = i === stonesThrownCount && !isStoneMoving;
        const sx = stone.x;
        const sy = stone.y;

        ctx.save();
        ctx.translate(sx, sy);

        // Stone Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(2, 4, STONE_RADIUS, STONE_RADIUS * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();

        // Outer Granite Band
        const graniteGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, STONE_RADIUS);
        graniteGrad.addColorStop(0, '#64748b');
        graniteGrad.addColorStop(0.7, '#334155');
        graniteGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = graniteGrad;
        ctx.beginPath();
        ctx.arc(0, 0, STONE_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // Inner Striking Band
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, STONE_RADIUS - 2, 0, Math.PI * 2);
        ctx.stroke();

        // Colored Top Cap (P1 Blue, P2 Red)
        const capColor = stone.player === 1 ? '#1d4ed8' : '#b91c1c';
        ctx.fillStyle = capColor;
        ctx.beginPath();
        ctx.arc(0, 0, STONE_RADIUS - 4, 0, Math.PI * 2);
        ctx.fill();

        // Brass Gooseneck Handle
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.roundRect(-4, -2, 8, 4, 1.5);
        ctx.fill();
        ctx.stroke();

        // Gloss Specular Dot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(-4, -4, 2, 0, Math.PI * 2);
        ctx.fill();

        // Active stone guidance ring
        if (isCurrent) {
          ctx.strokeStyle = stone.player === 1 ? '#60a5fa' : '#f87171';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(0, 0, STONE_RADIUS + 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.restore();
      }

      // F. Sweeping Brush overlay ahead of active stone
      if (isStoneMoving && s.activeStoneIdx !== null) {
        const activeStone = s.stones[s.activeStoneIdx];
        if (activeStone && activeStone.inPlay && !activeStone.stopped) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(activeStone.x - 35, activeStone.y - 80, 70, 60);
          ctx.restore();
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [aimAngle, power, curlDirection, curlStrength, isStoneMoving, stonesThrownCount, turn, winner, evaluateEndScoring]);

  // Pointer Sweeping Interactions across the Ice
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isStoneMoving) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (SHEET_WIDTH / rect.width);
    const py = (e.clientY - rect.top) * (SHEET_HEIGHT / rect.height);

    const s = simRef.current;
    const now = performance.now();
    const dt = now - s.lastSweepTime;

    if (dt > 30) {
      const dx = px - s.lastSweepX;
      // If sweeping horizontally ahead of the active stone
      if (Math.abs(dx) > 8 && s.activeStoneIdx !== null) {
        const activeStone = s.stones[s.activeStoneIdx];
        if (activeStone && py < activeStone.y && py > activeStone.y - 120) {
          // Boost sweeping energy
          s.sweepEnergy = Math.min(1.0, s.sweepEnergy + 0.35);
          playCurlingSweepSound();
          triggerHaptic('light');

          // Spawn icy sweeping particles
          for (let k = 0; k < 3; k++) {
            s.particles.push({
              x: px + (Math.random() - 0.5) * 20,
              y: py + (Math.random() - 0.5) * 10,
              vx: (Math.random() - 0.5) * 3,
              vy: -Math.random() * 2,
              life: 1.0,
              maxLife: 1.0,
            });
          }
        }
      }
      s.lastSweepX = px;
      s.lastSweepY = py;
      s.lastSweepTime = now;
    }
  };

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden select-none">
      <GameHeader
        gameId="toy-curling"
        gameName="Toy Curling"
        turn={turn}
        statusText={`Player ${turn}'s Delivery (End ${currentEnd}/${totalEnds})`}
        subStatusText={statusMessage}
      />

      {/* Main Tabletop Sheet Arena */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-3 overflow-hidden">
        {/* Scorecard Bar */}
        <div className="w-full max-w-sm flex items-center justify-between px-3 py-1.5 bg-container-dark/95 border border-[#3e444c] rounded-2xl shadow-xl mb-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-player-1 inline-block" />
            <span className="font-bold text-white">P1: {p1Score} pts</span>
          </div>
          <span className="text-[10px] font-black uppercase text-amber-400">
            End {currentEnd} of {totalEnds}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">P2: {p2Score} pts</span>
            <span className="w-3 h-3 rounded-full bg-player-2 inline-block" />
          </div>
        </div>

        {/* 2D Canvas Container */}
        <div className="relative flex items-center justify-center max-h-[66vh] aspect-[340/560] clubhouse-board-depth table-flat rounded-2xl overflow-hidden shadow-2xl border-4 border-[#0284c7]/60">
          <canvas
            ref={canvasRef}
            width={SHEET_WIDTH}
            height={SHEET_HEIGHT}
            onPointerMove={handlePointerMove}
            className="w-full h-full touch-none cursor-crosshair"
          />

          {/* Sweeping Overlay Indicator */}
          {isStoneMoving && (
            <div className="absolute top-4 pointer-events-none flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full border border-white/20 animate-pulse">
              <span className="text-sm">🧹</span>
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                Swipe Ahead to Sweep!
              </span>
            </div>
          )}
        </div>

        {/* Controls Deck */}
        {!isStoneMoving && stonesThrownCount < 8 && winner === null && (
          <div className="w-full max-w-sm mt-1.5 p-2 bg-container-dark/95 rounded-2xl border border-[#3e444c] shadow-xl flex flex-col gap-1.5">
            {/* Row 1: Aim Vector + Curl Direction */}
            <div className="flex items-center gap-2">
              {/* Aim Vector Slider */}
              <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-center text-[10px] font-bold text-accent-light/80 mb-0.5">
                  <div className="flex items-center gap-1">
                    <span>Aim Angle</span>
                    <button
                      type="button"
                      onClick={() => { setAimAngle(0); triggerHaptic('light'); }}
                      className="text-[8px] px-1 py-0.2 bg-white/10 hover:bg-white/20 rounded text-white/70"
                      title="Reset Aim to Center"
                    >
                      0°
                    </button>
                  </div>
                  <span className="font-mono text-cyan-400">
                    {aimAngle > 0 ? `+${aimAngle}°` : `${aimAngle}°`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-16"
                  max="16"
                  value={aimAngle}
                  onChange={(e) => setAimAngle(Number(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Curl Direction Buttons */}
              <div className="flex flex-col shrink-0">
                <span className="text-[10px] font-bold text-accent-light/80 mb-0.5 text-center">Curl Direction</span>
                <div className="flex items-center gap-0.5 bg-black/50 p-0.5 rounded-lg border border-white/10">
                  <button
                    type="button"
                    onClick={() => { setCurlDirection('in'); triggerHaptic('light'); }}
                    className={`px-1.5 py-0.5 text-[10px] font-black rounded transition-all ${
                      curlDirection === 'in' ? 'bg-cyan-500 text-black shadow' : 'text-white/60 hover:text-white'
                    }`}
                    title="In-Turn (Curves Left)"
                  >
                    ↶ In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCurlDirection('straight'); triggerHaptic('light'); }}
                    className={`px-1.5 py-0.5 text-[10px] font-black rounded transition-all ${
                      curlDirection === 'straight' ? 'bg-cyan-500 text-black shadow' : 'text-white/60 hover:text-white'
                    }`}
                    title="Straight (Zero Curl)"
                  >
                    Straight
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCurlDirection('out'); triggerHaptic('light'); }}
                    className={`px-1.5 py-0.5 text-[10px] font-black rounded transition-all ${
                      curlDirection === 'out' ? 'bg-cyan-500 text-black shadow' : 'text-white/60 hover:text-white'
                    }`}
                    title="Out-Turn (Curves Right)"
                  >
                    ↷ Out
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Delivery Weight (Power) & Curl Strength */}
            <div className="grid grid-cols-2 gap-2">
              {/* Delivery Weight (Power) Slider */}
              <div className="flex flex-col bg-black/30 p-1.5 rounded-xl border border-white/5">
                <div className="flex justify-between items-center text-[10px] font-bold text-accent-light/80 mb-0.5">
                  <span>Weight</span>
                  <span className="font-mono text-amber-300">
                    {Math.round(power * 100)}%
                    <span className="text-[8.5px] text-white/50 ml-1 font-sans">
                      {power < 0.25 ? 'Short' : power < 0.48 ? 'Guard' : power <= 0.68 ? 'Draw' : power <= 0.85 ? 'Back' : 'Takeout'}
                    </span>
                  </span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.01"
                  value={power}
                  onChange={(e) => setPower(Number(e.target.value))}
                  className="w-full accent-amber-400 h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer"
                />
                {/* Weight Preset Chips */}
                <div className="flex justify-between items-center mt-1 gap-1">
                  <button
                    type="button"
                    onClick={() => { setPower(0.35); triggerHaptic('light'); }}
                    className={`flex-1 py-0.5 text-[8px] font-bold rounded transition-colors ${
                      Math.abs(power - 0.35) < 0.05 ? 'bg-amber-500/30 text-amber-200 border border-amber-500/40' : 'bg-white/5 hover:bg-white/10 text-white/70'
                    }`}
                  >
                    Guard
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPower(0.58); triggerHaptic('light'); }}
                    className={`flex-1 py-0.5 text-[8px] font-bold rounded transition-colors ${
                      Math.abs(power - 0.58) < 0.05 ? 'bg-amber-500/30 text-amber-200 border border-amber-500/40' : 'bg-white/5 hover:bg-white/10 text-white/70'
                    }`}
                  >
                    Draw
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPower(0.95); triggerHaptic('light'); }}
                    className={`flex-1 py-0.5 text-[8px] font-bold rounded transition-colors ${
                      Math.abs(power - 0.95) < 0.05 ? 'bg-amber-500/30 text-amber-200 border border-amber-500/40' : 'bg-white/5 hover:bg-white/10 text-white/70'
                    }`}
                  >
                    Takeout
                  </button>
                </div>
              </div>

              {/* Curl Strength Slider */}
              <div className="flex flex-col bg-black/30 p-1.5 rounded-xl border border-white/5">
                <div className="flex justify-between items-center text-[10px] font-bold text-accent-light/80 mb-0.5">
                  <span>Curl Spin</span>
                  <span className="font-mono text-cyan-300">
                    {curlDirection === 'straight' ? '0% (Off)' : `${Math.round(curlStrength * 100)}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={curlStrength}
                  disabled={curlDirection === 'straight'}
                  onChange={(e) => setCurlStrength(Number(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer disabled:opacity-30"
                />
                {/* Curl Preset Chips */}
                <div className="flex justify-between items-center mt-1 gap-1">
                  <button
                    type="button"
                    disabled={curlDirection === 'straight'}
                    onClick={() => { setCurlStrength(0.20); triggerHaptic('light'); }}
                    className={`flex-1 py-0.5 text-[8px] font-bold rounded transition-colors disabled:opacity-30 ${
                      curlDirection !== 'straight' && Math.abs(curlStrength - 0.20) < 0.05 ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-500/40' : 'bg-white/5 hover:bg-white/10 text-white/70'
                    }`}
                  >
                    Gentle
                  </button>
                  <button
                    type="button"
                    disabled={curlDirection === 'straight'}
                    onClick={() => { setCurlStrength(0.40); triggerHaptic('light'); }}
                    className={`flex-1 py-0.5 text-[8px] font-bold rounded transition-colors disabled:opacity-30 ${
                      curlDirection !== 'straight' && Math.abs(curlStrength - 0.40) < 0.05 ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-500/40' : 'bg-white/5 hover:bg-white/10 text-white/70'
                    }`}
                  >
                    Med
                  </button>
                  <button
                    type="button"
                    disabled={curlDirection === 'straight'}
                    onClick={() => { setCurlStrength(0.75); triggerHaptic('light'); }}
                    className={`flex-1 py-0.5 text-[8px] font-bold rounded transition-colors disabled:opacity-30 ${
                      curlDirection !== 'straight' && Math.abs(curlStrength - 0.75) < 0.05 ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-500/40' : 'bg-white/5 hover:bg-white/10 text-white/70'
                    }`}
                  >
                    Sharp
                  </button>
                </div>
              </div>
            </div>

            {/* Row 3: Deliver Stone Action Button */}
            <button
              type="button"
              onClick={handleDeliverStone}
              className={`w-full py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2 ${
                turn === 1
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/20'
                  : 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 shadow-red-500/20'
              }`}
            >
              <span>🥌</span>
              <span>Slide Stone (Player {turn})</span>
            </button>
          </div>
        )}
      </main>

      {/* Game Over Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="Toy Curling"
          onRestart={() => {
            setP1Score(0);
            setP2Score(0);
            setCurrentEnd(1);
            setWinner(null);
            initStones();
          }}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};

export default ToyCurling;
