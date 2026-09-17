import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import {
  triggerHaptic,
  triggerCollisionHaptic,
  playBilliardsHitSound,
  playPocketDropSound,
  playCueStrikeSound,
  playTapSound,
} from '../utils/feedback';
import { renderDynamicCircleShadow } from '../utils/lighting';

export type BallGroup = 'solids' | 'stripes';

export interface Ball {
  id: number; // 0 = cue ball, 1-7 = solids, 8 = 8-ball, 9-15 = stripes
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  isStripe: boolean;
  isPotted: boolean;
}

const BALL_RADIUS = 9.5;
const TABLE_WIDTH = 620;
const TABLE_HEIGHT = 340;
const RAIL_SIZE = 22;
const POCKET_RADIUS = 18;
const RESTITUTION = 0.94;
const FRICTION = 0.988;
const MIN_VELOCITY = 0.05;

const BALL_COLORS: Record<number, string> = {
  0: '#f8fafc', // Cue
  1: '#facc15', // Solid Yellow
  2: '#2563eb', // Solid Blue
  3: '#dc2626', // Solid Red
  4: '#7c3aed', // Solid Purple
  5: '#ea580c', // Solid Orange
  6: '#16a34a', // Solid Green
  7: '#831843', // Solid Maroon
  8: '#09090b', // 8-Ball Black
  9: '#facc15', // Stripe Yellow
  10: '#2563eb', // Stripe Blue
  11: '#dc2626', // Stripe Red
  12: '#7c3aed', // Stripe Purple
  13: '#ea580c', // Stripe Orange
  14: '#16a34a', // Stripe Green
  15: '#831843', // Stripe Maroon
};

const POCKETS = [
  { x: RAIL_SIZE, y: RAIL_SIZE }, // Top-Left Corner
  { x: TABLE_WIDTH / 2, y: RAIL_SIZE }, // Top Side Pocket
  { x: TABLE_WIDTH - RAIL_SIZE, y: RAIL_SIZE }, // Top-Right Corner
  { x: RAIL_SIZE, y: TABLE_HEIGHT - RAIL_SIZE }, // Bottom-Left Corner
  { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT - RAIL_SIZE }, // Bottom Side Pocket
  { x: TABLE_WIDTH - RAIL_SIZE, y: TABLE_HEIGHT - RAIL_SIZE }, // Bottom-Right Corner
];

const createRackBalls = (): Ball[] => {
  const balls: Ball[] = [];

  // Cue Ball at headstring (left side of landscape table)
  balls.push({
    id: 0,
    x: TABLE_WIDTH * 0.25,
    y: TABLE_HEIGHT / 2,
    vx: 0,
    vy: 0,
    radius: BALL_RADIUS,
    color: BALL_COLORS[0],
    isStripe: false,
    isPotted: false,
  });

  // 15 Object Balls in Triangle at foot spot (right side of landscape table)
  const rackPattern = [
    1,
    2, 9,
    3, 8, 10,
    4, 11, 5, 12,
    13, 6, 14, 7, 15,
  ];

  const startX = TABLE_WIDTH * 0.72;
  const startY = TABLE_HEIGHT / 2;
  const dx = BALL_RADIUS * Math.sqrt(3) * 1.02;
  const dy = BALL_RADIUS * 2.04;

  let index = 0;
  for (let row = 0; row < 5; row++) {
    const rowX = startX + row * dx;
    const rowStartY = startY - (row * dy) / 2;
    for (let col = 0; col <= row; col++) {
      const ballId = rackPattern[index++];
      const isStripe = ballId >= 9 && ballId <= 15;
      balls.push({
        id: ballId,
        x: rowX + (Math.random() - 0.5) * 0.4,
        y: rowStartY + col * dy + (Math.random() - 0.5) * 0.4,
        vx: 0,
        vy: 0,
        radius: BALL_RADIUS,
        color: BALL_COLORS[ballId],
        isStripe,
        isPotted: false,
      });
    }
  }
  return balls;
};

export const Billiards: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [p1Group, setP1Group] = useState<BallGroup | null>(null);
  const [p2Group, setP2Group] = useState<BallGroup | null>(null);
  const [winner, setWinner] = useState<PlayerNumber | null>(null);
  const [isBallInHand, setIsBallInHand] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Player 1: Break shot! Aim and strike.');
  const [power, setPower] = useState<number>(50); // 0 to 100
  const [aimAngle, setAimAngle] = useState<number>(0); // default aiming right towards rack
  const [isMoving, setIsMoving] = useState<boolean>(false);
  const [pottedIds, setPottedIds] = useState<number[]>([]);

  // Internal state ref for animation loop
  const stateRef = useRef<{
    balls: Ball[];
    isMoving: boolean;
    aimAngle: number;
    power: number;
    turn: PlayerNumber;
    p1Group: BallGroup | null;
    p2Group: BallGroup | null;
    isBallInHand: boolean;
    dragMode: 'aim' | 'ballInHand' | null;
    pottedThisShot: number[];
    cueScratchedThisShot: boolean;
  }>({
    balls: createRackBalls(),
    isMoving: false,
    aimAngle: 0,
    power: 50,
    turn: 1,
    p1Group: null,
    p2Group: null,
    isBallInHand: false,
    dragMode: null,
    pottedThisShot: [],
    cueScratchedThisShot: false,
  });

  // Setup Rack of 15 Balls + Cue Ball
  const setupRack = useCallback(() => {
    stateRef.current.balls = createRackBalls();
    stateRef.current.isMoving = false;
    stateRef.current.turn = 1;
    stateRef.current.p1Group = null;
    stateRef.current.p2Group = null;
    stateRef.current.isBallInHand = false;
    stateRef.current.pottedThisShot = [];
    stateRef.current.cueScratchedThisShot = false;

    setTurn(1);
    setAimAngle(0);
    setP1Group(null);
    setP2Group(null);
    setWinner(null);
    setIsBallInHand(false);
    setIsMoving(false);
    setPottedIds([]);
    setStatusMessage('Player 1: Break shot! Aim and strike.');
  }, []);

  // Sync state ref
  useEffect(() => {
    stateRef.current.aimAngle = aimAngle;
    stateRef.current.power = power;
    stateRef.current.turn = turn;
    stateRef.current.p1Group = p1Group;
    stateRef.current.p2Group = p2Group;
    stateRef.current.isBallInHand = isBallInHand;
  }, [aimAngle, power, turn, p1Group, p2Group, isBallInHand]);

  // Handle Shot Strike
  const handleStrike = useCallback(() => {
    const s = stateRef.current;
    if (s.isMoving || winner !== null || isBallInHand) return;

    const cueBall = s.balls.find((b) => b.id === 0);
    if (!cueBall || cueBall.isPotted) return;

    triggerHaptic('medium');
    playCueStrikeSound(s.power / 100);

    const speed = 2.5 + (s.power / 100) * 16.5;
    cueBall.vx = Math.cos(s.aimAngle) * speed;
    cueBall.vy = Math.sin(s.aimAngle) * speed;

    s.isMoving = true;
    setIsMoving(true);
    s.pottedThisShot = [];
    s.cueScratchedThisShot = false;
  }, [winner, isBallInHand]);

  // Post-shot evaluation and turn progression
  const handleShotEnd = useCallback(() => {
    const s = stateRef.current;
    s.isMoving = false;
    setIsMoving(false);

    const cueBall = s.balls.find((b) => b.id === 0);
    const cueScratched = !cueBall || cueBall.isPotted || s.cueScratchedThisShot;
    const potted = [...s.pottedThisShot];
    if (potted.length > 0) {
      setPottedIds((prev) => Array.from(new Set([...prev, ...potted])));
    }

    // Check 8-Ball conditions
    const eightPotted = potted.includes(8);
    if (eightPotted) {
      const activeGroup = s.turn === 1 ? s.p1Group : s.p2Group;
      const unpottedGroupBalls = s.balls.filter((b) => {
        if (b.id === 0 || b.id === 8 || b.isPotted) return false;
        if (!activeGroup) return true;
        return activeGroup === 'solids' ? b.id <= 7 : b.id >= 9;
      });

      if (cueScratched || !activeGroup || unpottedGroupBalls.length > 0) {
        // Early 8-ball pot or scratch on 8-ball = LOSS
        const winningPlayer: PlayerNumber = s.turn === 1 ? 2 : 1;
        setWinner(winningPlayer);
        setStatusMessage(`Player ${s.turn} scratched/potted 8-ball prematurely! Player ${winningPlayer} Wins!`);
        return;
      } else {
        // Legitimate 8-ball pot = WIN
        setWinner(s.turn);
        setStatusMessage(`Player ${s.turn} potted the 8-Ball! Victory!`);
        return;
      }
    }

    // Assign groups if open table and ball potted
    let nextP1Group = s.p1Group;
    let nextP2Group = s.p2Group;

    if (!s.p1Group && !s.p2Group && !cueScratched) {
      const firstGroupBall = potted.find((id) => id >= 1 && id <= 15 && id !== 8);
      if (firstGroupBall) {
        const isSolid = firstGroupBall <= 7;
        if (s.turn === 1) {
          nextP1Group = isSolid ? 'solids' : 'stripes';
          nextP2Group = isSolid ? 'stripes' : 'solids';
        } else {
          nextP2Group = isSolid ? 'solids' : 'stripes';
          nextP1Group = isSolid ? 'stripes' : 'solids';
        }
        setP1Group(nextP1Group);
        setP2Group(nextP2Group);
      }
    }

    // Handle Scratch
    if (cueScratched) {
      triggerHaptic('medium');
      playPocketDropSound();

      // Reposition cue ball for ball in hand
      if (cueBall) {
        cueBall.isPotted = false;
        cueBall.x = TABLE_WIDTH * 0.25;
        cueBall.y = TABLE_HEIGHT / 2;
        cueBall.vx = 0;
        cueBall.vy = 0;
      }

      const nextPlayer: PlayerNumber = s.turn === 1 ? 2 : 1;
      setTurn(nextPlayer);
      setIsBallInHand(true);
      setGameStatus('active');
      setStatusMessage(`Scratch! Player ${nextPlayer} has Ball-in-Hand. Drag cue ball to place.`);
      return;
    }

    // Determine Turn Continuation
    const currentGroup = s.turn === 1 ? nextP1Group : nextP2Group;
    let keepTurn = false;

    if (currentGroup) {
      const validGroupPot = potted.some((id) =>
        currentGroup === 'solids' ? id >= 1 && id <= 7 : id >= 9 && id <= 15
      );
      if (validGroupPot) {
        keepTurn = true;
      }
    } else if (potted.length > 0) {
      // Table was open, potted a ball
      keepTurn = true;
    }

    if (keepTurn) {
      setStatusMessage(`Player ${s.turn} potted! Take another shot.`);
    } else {
      const nextPlayer: PlayerNumber = s.turn === 1 ? 2 : 1;
      setTurn(nextPlayer);
      setGameStatus('active');
      setStatusMessage(`Player ${nextPlayer}'s turn. Aim and strike.`);
    }
  }, [setGameStatus]);

  // Continuous Physics & Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const s = stateRef.current;

      // Update Physics if moving
      if (s.isMoving) {
        let stillMoving = false;

        // 1. Move and Apply Friction
        for (const ball of s.balls) {
          if (ball.isPotted) continue;

          ball.x += ball.vx;
          ball.y += ball.vy;

          ball.vx *= FRICTION;
          ball.vy *= FRICTION;

          if (Math.abs(ball.vx) < MIN_VELOCITY && Math.abs(ball.vy) < MIN_VELOCITY) {
            ball.vx = 0;
            ball.vy = 0;
          } else {
            stillMoving = true;
          }

          // Cushion Collisions
          const minX = RAIL_SIZE + ball.radius;
          const maxX = TABLE_WIDTH - RAIL_SIZE - ball.radius;
          const minY = RAIL_SIZE + ball.radius;
          const maxY = TABLE_HEIGHT - RAIL_SIZE - ball.radius;

          if (ball.x < minX) {
            ball.x = minX;
            ball.vx = -ball.vx * RESTITUTION;
            triggerHaptic('light');
          } else if (ball.x > maxX) {
            ball.x = maxX;
            ball.vx = -ball.vx * RESTITUTION;
            triggerHaptic('light');
          }

          if (ball.y < minY) {
            ball.y = minY;
            ball.vy = -ball.vy * RESTITUTION;
            triggerHaptic('light');
          } else if (ball.y > maxY) {
            ball.y = maxY;
            ball.vy = -ball.vy * RESTITUTION;
            triggerHaptic('light');
          }

          // Pocket Detection
          for (const pocket of POCKETS) {
            const distSq = (ball.x - pocket.x) ** 2 + (ball.y - pocket.y) ** 2;
            if (distSq <= POCKET_RADIUS ** 2) {
              ball.isPotted = true;
              ball.vx = 0;
              ball.vy = 0;
              playPocketDropSound();
              triggerHaptic('medium');

              if (ball.id === 0) {
                s.cueScratchedThisShot = true;
              } else {
                s.pottedThisShot.push(ball.id);
              }
              break;
            }
          }
        }

        // 2. Ball-to-Ball Elastic Collisions
        for (let i = 0; i < s.balls.length; i++) {
          const b1 = s.balls[i];
          if (b1.isPotted) continue;

          for (let j = i + 1; j < s.balls.length; j++) {
            const b2 = s.balls[j];
            if (b2.isPotted) continue;

            const dx = b2.x - b1.x;
            const dy = b2.y - b1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = b1.radius + b2.radius;

            if (dist < minDist && dist > 0) {
              // Normal vector
              const nx = dx / dist;
              const ny = dy / dist;

              // Separate overlapping balls
              const overlap = (minDist - dist) / 2;
              b1.x -= nx * overlap;
              b1.y -= ny * overlap;
              b2.x += nx * overlap;
              b2.y += ny * overlap;

              // Relative velocity
              const kx = b1.vx - b2.vx;
              const ky = b1.vy - b2.vy;
              const p = 2 * (nx * kx + ny * ky) / 2; // Equal masses

              if (p > 0) {
                b1.vx -= p * nx * RESTITUTION;
                b1.vy -= p * ny * RESTITUTION;
                b2.vx += p * nx * RESTITUTION;
                b2.vy += p * ny * RESTITUTION;

                const impactSpeed = Math.sqrt(kx * kx + ky * ky);
                const hitForce = Math.min(1.0, impactSpeed / 8);
                playBilliardsHitSound(hitForce);
                triggerCollisionHaptic(impactSpeed, 8);
              }
            }
          }
        }

        if (!stillMoving) {
          handleShotEnd();
        }
      }

      // --- CANVAS RENDERING ---
      ctx.clearRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

      // 1. Mahogany Rails & Table Border
      ctx.fillStyle = '#3e1f0c';
      ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

      // Rail Wood Bevel
      ctx.strokeStyle = '#241105';
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, TABLE_WIDTH - 3, TABLE_HEIGHT - 3);

      // 2. Baize Green Felt Bed
      const feltX = RAIL_SIZE;
      const feltY = RAIL_SIZE;
      const feltW = TABLE_WIDTH - RAIL_SIZE * 2;
      const feltH = TABLE_HEIGHT - RAIL_SIZE * 2;

      const feltGrad = ctx.createRadialGradient(
        TABLE_WIDTH / 2,
        TABLE_HEIGHT / 2,
        40,
        TABLE_WIDTH / 2,
        TABLE_HEIGHT / 2,
        TABLE_WIDTH * 0.45
      );
      feltGrad.addColorStop(0, '#0f7633');
      feltGrad.addColorStop(1, '#08481e');
      ctx.fillStyle = feltGrad;
      ctx.fillRect(feltX, feltY, feltW, feltH);

      // Headstring and Foot Spot Inlay Lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      // Headstring (vertical line at kitchen on left side)
      ctx.beginPath();
      ctx.moveTo(TABLE_WIDTH * 0.25, feltY);
      ctx.lineTo(TABLE_WIDTH * 0.25, feltY + feltH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Foot Spot Dot (on right side)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(TABLE_WIDTH * 0.72, TABLE_HEIGHT / 2, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // 3. Pockets (6 deep leather drop pockets)
      for (const pocket of POCKETS) {
        // Outer leather rim
        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.arc(pocket.x, pocket.y, POCKET_RADIUS + 2, 0, Math.PI * 2);
        ctx.fill();

        // Deep drop recess
        const pGrad = ctx.createRadialGradient(pocket.x, pocket.y, 2, pocket.x, pocket.y, POCKET_RADIUS);
        pGrad.addColorStop(0, '#09090b');
        pGrad.addColorStop(1, '#18181b');
        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.arc(pocket.x, pocket.y, POCKET_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#292524';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // 4. Balls Rendering
      for (const ball of s.balls) {
        if (ball.isPotted) continue;

        // Dynamic 2.5D Ball Drop Shadow onto felt relative to overhead light
        renderDynamicCircleShadow(
          ctx,
          ball.x,
          ball.y,
          ball.radius,
          TABLE_WIDTH * 0.5,
          TABLE_HEIGHT * 0.45,
          5.0,
          2.5
        );

        // Ball Base Body
        const bGrad = ctx.createRadialGradient(
          ball.x - ball.radius * 0.35,
          ball.y - ball.radius * 0.35,
          ball.radius * 0.1,
          ball.x,
          ball.y,
          ball.radius
        );

        if (ball.isStripe) {
          // Stripe ball: White base with colored center band
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
          ctx.fill();

          // Colored horizontal stripe
          ctx.save();
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
          ctx.clip();

          ctx.fillStyle = ball.color;
          ctx.fillRect(ball.x - ball.radius, ball.y - ball.radius * 0.5, ball.radius * 2, ball.radius);
          ctx.restore();
        } else {
          // Solid ball
          bGrad.addColorStop(0, '#ffffff');
          bGrad.addColorStop(0.25, ball.color);
          bGrad.addColorStop(1, '#0f172a');
          ctx.fillStyle = ball.color === '#f8fafc' ? '#f8fafc' : bGrad;
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
          ctx.fill();
        }

        // Center White Number Circle (for balls 1-15)
        if (ball.id > 0) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ball.radius * 0.42, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 6px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ball.id.toString(), ball.x, ball.y + 0.5);
        }

        // Specular White Gloss Dot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.beginPath();
        ctx.arc(ball.x - ball.radius * 0.35, ball.y - ball.radius * 0.35, ball.radius * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5. Aiming & Cue Stick (When not moving and cue ball exists)
      const cueBall = s.balls.find((b) => b.id === 0);
      if (cueBall && !cueBall.isPotted && !s.isMoving && winner === null) {
        if (s.isBallInHand) {
          // Ball-in-hand glowing halo
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(cueBall.x, cueBall.y, cueBall.radius + 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          // Ghost Trajectory Raycast
          const rayAngle = s.aimAngle;
          const rayDirX = Math.cos(rayAngle);
          const rayDirY = Math.sin(rayAngle);

          let hitBall: Ball | null = null;
          let hitDist = 9999;

          for (const b of s.balls) {
            if (b.id === 0 || b.isPotted) continue;
            // Circle raycast
            const ocX = b.x - cueBall.x;
            const ocY = b.y - cueBall.y;
            const proj = ocX * rayDirX + ocY * rayDirY;

            if (proj > 0) {
              const perpDistSq = (ocX * ocX + ocY * ocY) - proj * proj;
              const radiusSum = BALL_RADIUS * 2;
              if (perpDistSq < radiusSum * radiusSum) {
                const dTh = Math.sqrt(radiusSum * radiusSum - perpDistSq);
                const contactDist = proj - dTh;
                if (contactDist < hitDist && contactDist > 0) {
                  hitDist = contactDist;
                  hitBall = b;
                }
              }
            }
          }

          // Max ray distance to cushion if no ball hit
          const maxDist = hitBall ? hitDist : 260;
          const targetX = cueBall.x + rayDirX * maxDist;
          const targetY = cueBall.y + rayDirY * maxDist;

          // Render Dashed Cue Line
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(cueBall.x, cueBall.y);
          ctx.lineTo(targetX, targetY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Ghost Cue Ball at Impact
          if (hitBall) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(targetX, targetY, BALL_RADIUS, 0, Math.PI * 2);
            ctx.stroke();

            // Target Ball Deflection Line
            const defX = hitBall.x - targetX;
            const defY = hitBall.y - targetY;
            const defLen = Math.sqrt(defX * defX + defY * defY);
            if (defLen > 0) {
              const ndx = defX / defLen;
              const ndy = defY / defLen;
              ctx.strokeStyle = '#38bdf8';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(hitBall.x, hitBall.y);
              ctx.lineTo(hitBall.x + ndx * 35, hitBall.y + ndy * 35);
              ctx.stroke();
            }
          }

          // Turned Wood Cue Stick
          const cuePullBack = 12 + (s.power / 100) * 35;
          const stickLen = 140;
          const cueTipX = cueBall.x - rayDirX * (BALL_RADIUS + cuePullBack);
          const cueTipY = cueBall.y - rayDirY * (BALL_RADIUS + cuePullBack);
          const cueBackX = cueTipX - rayDirX * stickLen;
          const cueBackY = cueTipY - rayDirY * stickLen;

          // Cue Stick Shadow
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(cueTipX + 3, cueTipY + 4);
          ctx.lineTo(cueBackX + 3, cueBackY + 4);
          ctx.stroke();

          // Maple/Rosewood Cue Stick Shaft
          ctx.strokeStyle = '#92400e';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(cueTipX, cueTipY);
          ctx.lineTo(cueBackX, cueBackY);
          ctx.stroke();

          // White Ferrule & Blue Chalk Leather Tip
          const ferruleLen = 8;
          ctx.strokeStyle = '#fef3c7';
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(cueTipX, cueTipY);
          ctx.lineTo(cueTipX - rayDirX * ferruleLen, cueTipY - rayDirY * ferruleLen);
          ctx.stroke();

          // Chalk Tip
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.arc(cueTipX, cueTipY, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [handleShotEnd, winner]);

  // Pointer / Touch Aiming & Ball-In-Hand Interaction
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || stateRef.current.isMoving || winner !== null) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = TABLE_WIDTH / rect.width;
    const scaleY = TABLE_HEIGHT / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    const cueBall = stateRef.current.balls.find((b) => b.id === 0);
    if (!cueBall) return;

    if (isBallInHand) {
      stateRef.current.dragMode = 'ballInHand';
      cueBall.x = Math.max(RAIL_SIZE + BALL_RADIUS, Math.min(TABLE_WIDTH - RAIL_SIZE - BALL_RADIUS, px));
      cueBall.y = Math.max(RAIL_SIZE + BALL_RADIUS, Math.min(TABLE_HEIGHT - RAIL_SIZE - BALL_RADIUS, py));
    } else {
      stateRef.current.dragMode = 'aim';
      const angle = Math.atan2(py - cueBall.y, px - cueBall.x);
      setAimAngle(angle);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !stateRef.current.dragMode) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = TABLE_WIDTH / rect.width;
    const scaleY = TABLE_HEIGHT / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    const cueBall = stateRef.current.balls.find((b) => b.id === 0);
    if (!cueBall) return;

    if (stateRef.current.dragMode === 'ballInHand') {
      cueBall.x = Math.max(RAIL_SIZE + BALL_RADIUS, Math.min(TABLE_WIDTH - RAIL_SIZE - BALL_RADIUS, px));
      cueBall.y = Math.max(RAIL_SIZE + BALL_RADIUS, Math.min(TABLE_HEIGHT - RAIL_SIZE - BALL_RADIUS, py));
    } else if (stateRef.current.dragMode === 'aim') {
      const angle = Math.atan2(py - cueBall.y, px - cueBall.x);
      setAimAngle(angle);
    }
  };

  const handlePointerUp = () => {
    if (stateRef.current.dragMode === 'ballInHand') {
      setIsBallInHand(false);
      stateRef.current.isBallInHand = false;
      playTapSound();
      setStatusMessage(`Cue ball placed! Aim and strike.`);
    }
    stateRef.current.dragMode = null;
  };

  // Remaining balls count
  const allNumberedBalls = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
  const p1BallsLeft = allNumberedBalls.filter((id) => {
    if (pottedIds.includes(id)) return false;
    return p1Group === 'solids' ? id <= 7 : p1Group === 'stripes' ? id >= 9 : true;
  }).length;

  const p2BallsLeft = allNumberedBalls.filter((id) => {
    if (pottedIds.includes(id)) return false;
    return p2Group === 'solids' ? id <= 7 : p2Group === 'stripes' ? id >= 9 : true;
  }).length;

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden select-none">
      <GameHeader
        gameId="billiards"
        gameName="Billiards (8-Ball)"
        turn={turn}
        statusText={`Player ${turn}'s Turn`}
        subStatusText={statusMessage}
      />

      {/* Main Playing Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden">
        {/* Scoreboard / Assigned Group Pills */}
        <div className="w-full max-w-2xl flex items-center justify-between px-3 py-1.5 bg-container-dark/90 border border-[#3e444c] rounded-2xl shadow-md mb-2">
          {/* P1 Group Info */}
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${p1Group === 'solids' ? 'bg-amber-500' : p1Group === 'stripes' ? 'bg-blue-500 ring-1 ring-white' : 'bg-stone-500'}`} />
            <div className="text-left">
              <span className="text-[10px] font-black uppercase text-player-1 block leading-tight">P1 {p1Group || 'Open'}</span>
              <span className="text-xs font-bold text-accent-light">{p1Group ? `${p1BallsLeft} left` : 'Any ball'}</span>
            </div>
          </div>

          {/* Center 8-Ball Badge */}
          <div className="w-7 h-7 rounded-full bg-black border border-white/20 flex items-center justify-center text-white text-xs font-black shadow-inner">
            8
          </div>

          {/* P2 Group Info */}
          <div className="flex items-center gap-2 text-right">
            <div className="text-right">
              <span className="text-[10px] font-black uppercase text-player-2 block leading-tight">P2 {p2Group || 'Open'}</span>
              <span className="text-xs font-bold text-accent-light">{p2Group ? `${p2BallsLeft} left` : 'Any ball'}</span>
            </div>
            <span className={`w-3 h-3 rounded-full ${p2Group === 'solids' ? 'bg-amber-500' : p2Group === 'stripes' ? 'bg-blue-500 ring-1 ring-white' : 'bg-stone-500'}`} />
          </div>
        </div>

        {/* Billiards Table Canvas Container */}
        <div className="relative flex items-center justify-center w-full max-w-2xl aspect-[620/340] clubhouse-board-depth table-flat rounded-2xl overflow-hidden shadow-2xl border-4 border-[#241105]">
          <canvas
            ref={canvasRef}
            width={TABLE_WIDTH}
            height={TABLE_HEIGHT}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="w-full h-full touch-none cursor-crosshair"
          />

          {/* Ball In Hand Helper Overlay */}
          {isBallInHand && (
            <div className="absolute top-3 inset-x-3 bg-emerald-600/90 text-white text-xs font-black text-center py-1 rounded-xl shadow-md pointer-events-none animate-pulse">
              Ball-in-Hand: Drag the cue ball anywhere on the table
            </div>
          )}
        </div>

        {/* Tactical Controls: Rotary Aim & Strike Bar */}
        <div className="w-full max-w-2xl flex items-center justify-between gap-3 mt-2 px-2">
          {/* Power Meter Slider */}
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex justify-between text-[10px] font-black uppercase text-accent-light/80">
              <span>Strike Power</span>
              <span>{power}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={power}
              onChange={(e) => setPower(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-2 bg-black/40 rounded-lg appearance-none"
            />
          </div>

          {/* Strike Cue Button */}
          <button
            onClick={handleStrike}
            disabled={isMoving || isBallInHand || winner !== null}
            className={`px-5 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider shadow-lg transition-all active:scale-95 ${
              isMoving || isBallInHand
                ? 'bg-stone-700 text-stone-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black border border-amber-300'
            }`}
          >
            Shoot!
          </button>
        </div>
      </main>

      {/* Game Over Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="Billiards (8-Ball)"
          onRestart={setupRack}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};
export default Billiards;
