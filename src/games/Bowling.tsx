import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import {
  triggerHaptic,
  playBallRollSound,
  playPinCrashSound,
  playBounceSound,
} from '../utils/feedback';

interface Pin {
  id: number; // 1 to 10
  row: number; // 1 to 4
  baseX: number; // 0 is lane center
  baseY: number; // distance down lane
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  isKnocked: boolean;
  knockTime: number;
}

interface FrameScore {
  rolls: (number | 'X' | '/' | '-')[];
  cumulativeScore: number | null;
}

const LANE_WIDTH_FRONT = 260;
const LANE_WIDTH_BACK = 120;
const LANE_HEIGHT = 480;

// Standard 10-pin triangle positions (x: relative to center 0, y: lane depth 0 to 1)
const PIN_LAYOUT = [
  { id: 1, row: 1, x: 0, y: 0.82 },
  { id: 2, row: 2, x: -14, y: 0.86 },
  { id: 3, row: 2, x: 14, y: 0.86 },
  { id: 4, row: 3, x: -28, y: 0.90 },
  { id: 5, row: 3, x: 0, y: 0.90 },
  { id: 6, row: 3, x: 28, y: 0.90 },
  { id: 7, row: 4, x: -42, y: 0.94 },
  { id: 8, row: 4, x: -14, y: 0.94 },
  { id: 9, row: 4, x: 14, y: 0.94 },
  { id: 10, row: 4, x: 42, y: 0.94 },
];

export const Bowling: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [currentFrame, setCurrentFrame] = useState<number>(1); // 1 to 10
  const [currentRollInFrame, setCurrentRollInFrame] = useState<number>(1); // 1, 2, or 3
  const [winner, setWinner] = useState<PlayerNumber | 'draw' | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Player 1: Drag ball along approach to aim, swipe up to roll!');

  // Approach slider position (-65 to +65)
  const [ballStartX, setBallStartX] = useState<number>(0);
  const [isRolling, setIsRolling] = useState<boolean>(false);

  // Score History: Frame by frame for P1 and P2
  const [p1Frames, setP1Frames] = useState<FrameScore[]>(() =>
    Array.from({ length: 10 }, () => ({ rolls: [], cumulativeScore: null }))
  );
  const [p2Frames, setP2Frames] = useState<FrameScore[]>(() =>
    Array.from({ length: 10 }, () => ({ rolls: [], cumulativeScore: null }))
  );

  // Raw rolls history for calculation
  const p1RawRolls = useRef<number[]>([]);
  const p2RawRolls = useRef<number[]>([]);

  // Simulation State Ref
  const stateRef = useRef<{
    pins: Pin[];
    ball: {
      active: boolean;
      x: number;
      y: number; // 0 (foul line) to 1 (pin deck)
      vx: number;
      vy: number;
      hook: number;
      inGutter: boolean;
    };
    isDragging: boolean;
    dragMode: 'none' | 'stance' | 'swipe';
    startBallX: number;
    dragStart: { x: number; y: number; time: number } | null;
    pinsFallenThisRoll: number;
  }>({
    pins: [],
    ball: { active: false, x: 0, y: 0, vx: 0, vy: 0, hook: 0, inGutter: false },
    isDragging: false,
    dragMode: 'none',
    startBallX: 0,
    dragStart: null,
    pinsFallenThisRoll: 0,
  });

  // Reset 10 pins
  const setupPins = useCallback((preserveKnocked = false) => {
    const s = stateRef.current;
    if (!preserveKnocked) {
      s.pins = PIN_LAYOUT.map((p) => ({
        id: p.id,
        row: p.row,
        baseX: p.x,
        baseY: p.y,
        x: p.x,
        y: p.y,
        vx: 0,
        vy: 0,
        rotation: 0,
        vRot: 0,
        isKnocked: false,
        knockTime: 0,
      }));
    } else {
      // Remove knocked pins for 2nd roll in same frame
      s.pins = s.pins.filter((p) => !p.isKnocked);
    }
  }, []);

  useEffect(() => {
    setupPins(false);
  }, [setupPins]);

  // Compute standard bowling frame totals
  const computeBowlingScores = (rawRolls: number[]): FrameScore[] => {
    const frames: FrameScore[] = Array.from({ length: 10 }, () => ({ rolls: [], cumulativeScore: null }));
    let rollIdx = 0;
    let runningTotal = 0;

    for (let f = 0; f < 10; f++) {
      if (rollIdx >= rawRolls.length) break;

      if (f < 9) {
        // Frames 1 to 9
        const first = rawRolls[rollIdx];
        if (first === 10) {
          // Strike
          frames[f].rolls = ['X'];
          if (rollIdx + 2 < rawRolls.length) {
            runningTotal += 10 + rawRolls[rollIdx + 1] + rawRolls[rollIdx + 2];
            frames[f].cumulativeScore = runningTotal;
          }
          rollIdx += 1;
        } else {
          // Open or Spare
          if (rollIdx + 1 < rawRolls.length) {
            const second = rawRolls[rollIdx + 1];
            if (first + second === 10) {
              // Spare
              frames[f].rolls = [first, '/'];
              if (rollIdx + 2 < rawRolls.length) {
                runningTotal += 10 + rawRolls[rollIdx + 2];
                frames[f].cumulativeScore = runningTotal;
              }
            } else {
              // Open
              frames[f].rolls = [first, second === 0 ? '-' : second];
              runningTotal += first + second;
              frames[f].cumulativeScore = runningTotal;
            }
            rollIdx += 2;
          } else {
            // In progress 1st roll
            frames[f].rolls = [first === 0 ? '-' : first];
            rollIdx += 1;
          }
        }
      } else {
        // Frame 10
        const f10Rolls: (number | 'X' | '/' | '-')[] = [];
        let f10Total = 0;
        let rollsCount = 0;

        while (rollIdx < rawRolls.length && rollsCount < 3) {
          const r = rawRolls[rollIdx];
          if (r === 10) f10Rolls.push('X');
          else if (rollsCount === 1 && f10Rolls[0] !== 'X' && (rawRolls[rollIdx - 1] + r === 10)) f10Rolls.push('/');
          else f10Rolls.push(r === 0 ? '-' : r);

          f10Total += r;
          rollIdx++;
          rollsCount++;
        }

        frames[9].rolls = f10Rolls;
        const isStrike = rawRolls[rawRolls.length - rollsCount] === 10;
        const isSpare = rollsCount >= 2 && rawRolls[rawRolls.length - rollsCount] + rawRolls[rawRolls.length - rollsCount + 1] === 10;
        const needs3 = isStrike || isSpare;

        if ((needs3 && rollsCount === 3) || (!needs3 && rollsCount === 2)) {
          runningTotal += f10Total;
          frames[9].cumulativeScore = runningTotal;
        }
      }
    }

    return frames;
  };

  const advanceToNextTurnOrFrame = useCallback(() => {
    if (currentFrame === 10) {
      if (turn === 1) {
        // P1 finished frame 10, pass to P2 for frame 10
        setTurn(2);
        setCurrentFrame(10);
        setCurrentRollInFrame(1);
        setupPins(false);
        setGameStatus('active');
        setStatusMessage(`Player 2: Final 10th Frame!`);
      } else {
        // Both players finished 10 frames -> Game Over!
        const p1Final = p1Frames[9]?.cumulativeScore ?? p1RawRolls.current.reduce((a, b) => a + b, 0);
        const p2Final = p2Frames[9]?.cumulativeScore ?? p2RawRolls.current.reduce((a, b) => a + b, 0);

        if (p1Final > p2Final) setWinner(1);
        else if (p2Final > p1Final) setWinner(2);
        else setWinner('draw');

        setStatusMessage(`Match Finished! P1: ${p1Final} - P2: ${p2Final}`);
      }
      return;
    }

    // Frames 1 to 9: Alternate player turns per frame
    if (turn === 1) {
      setTurn(2);
      setCurrentRollInFrame(1);
      setupPins(false);
      setGameStatus('active');
      setStatusMessage(`Player 2's Turn. Frame ${currentFrame}.`);
    } else {
      setTurn(1);
      setCurrentFrame((f) => f + 1);
      setCurrentRollInFrame(1);
      setupPins(false);
      setGameStatus('active');
      setStatusMessage(`Player 1's Turn. Frame ${currentFrame + 1}.`);
    }
  }, [currentFrame, turn, p1Frames, p2Frames, setupPins, setGameStatus]);

  // Roll Finish & Score Processing
  const handleRollFinish = useCallback((fallenPins: number) => {
    const s = stateRef.current;
    s.ball.active = false;
    setIsRolling(false);

    // Record roll in player raw rolls
    const isP1 = turn === 1;
    const rollsArray = isP1 ? p1RawRolls.current : p2RawRolls.current;
    rollsArray.push(fallenPins);

    // Compute updated scores
    const updatedFrames = computeBowlingScores(rollsArray);
    if (isP1) setP1Frames(updatedFrames);
    else setP2Frames(updatedFrames);

    // Progression Logic
    if (currentFrame < 10) {
      if (currentRollInFrame === 1 && fallenPins === 10) {
        // STRIKE in frames 1-9!
        triggerHaptic('success');
        setStatusMessage(`STRIKE! 💥 10 pins down!`);
        setTimeout(() => {
          advanceToNextTurnOrFrame();
        }, 1400);
      } else if (currentRollInFrame === 1) {
        // Roll 2 coming up
        setupPins(true); // Keep standing pins
        setCurrentRollInFrame(2);
        setStatusMessage(`Player ${turn} knocked ${fallenPins} pins! Roll 2 for the spare.`);
      } else {
        // Roll 2 finished
        advanceToNextTurnOrFrame();
      }
    } else {
      // 10th Frame Logic
      const rollsInF10 = isP1 ? p1RawRolls.current.slice(-currentRollInFrame) : p2RawRolls.current.slice(-currentRollInFrame);
      const firstRoll = rollsInF10[0] ?? fallenPins;

      if (currentRollInFrame === 1) {
        if (fallenPins === 10) {
          setupPins(false);
          setCurrentRollInFrame(2);
          setStatusMessage(`Strike in the 10th! 2 bonus rolls remain.`);
        } else {
          setupPins(true);
          setCurrentRollInFrame(2);
          setStatusMessage(`Roll 2 for the spare.`);
        }
      } else if (currentRollInFrame === 2) {
        if (firstRoll === 10 || (firstRoll + fallenPins === 10)) {
          setupPins(false);
          setCurrentRollInFrame(3);
          setStatusMessage(`Bonus roll unlocked! Final roll.`);
        } else {
          advanceToNextTurnOrFrame();
        }
      } else {
        advanceToNextTurnOrFrame();
      }
    }
  }, [turn, currentFrame, currentRollInFrame, setupPins, advanceToNextTurnOrFrame]);

  // Canvas 2.5D Alley Perspective & Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const s = stateRef.current;

      // 1. Update Ball Physics
      if (s.ball.active) {
        s.ball.y += s.ball.vy;
        s.ball.x += s.ball.vx + s.ball.hook * s.ball.y * 0.08;

        // Gutter bounds based on perspective narrowing
        const currentHalfWidth = (LANE_WIDTH_FRONT / 2) * (1 - s.ball.y) + (LANE_WIDTH_BACK / 2) * s.ball.y;

        if (Math.abs(s.ball.x) > currentHalfWidth && !s.ball.inGutter) {
          s.ball.inGutter = true;
          s.ball.vx = 0;
          playBounceSound(180);
          triggerHaptic('light');
        }

        // Check Pin Collisions when ball enters pin deck area (y > 0.8)
        if (s.ball.y >= 0.8 && !s.ball.inGutter) {
          for (const pin of s.pins) {
            if (pin.isKnocked) continue;

            const dx = pin.x - s.ball.x;
            const dy = (pin.y - s.ball.y) * 260; // scale y to px
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Pin hitbox enlarged by ~28% (dist < 18 vs 14)
            if (dist < 18) {
              pin.isKnocked = true;
              s.pinsFallenThisRoll++;
              triggerHaptic('medium');

              // Headpin (Pin 1) specific dynamics
              if (pin.id === 1) {
                const impactOffset = s.ball.x; // offset from headpin center
                const absOffset = Math.abs(impactOffset);

                if (absOffset < 4) {
                  // Head-on dead-center hit: absorbs ball velocity, punches straight through 1 & 5
                  // Fails to deflect sideways into 7 and 10, leaving classic split (7-10 or 4-7)
                  s.ball.vy *= 0.36;
                  pin.vx = (impactOffset * 0.25) + (Math.random() - 0.5) * 0.8;
                  pin.vy = 4.2;
                  pin.vRot = (Math.random() - 0.5) * 0.2;
                } else if (absOffset >= 5 && absOffset <= 15) {
                  // Pocket Hit! (1-3 pocket if x > 0, 1-2 pocket if x < 0)
                  // High kinetic lateral transfer: Pin 1 sweeps violently into 2, 4, 7,
                  // while ball drives through 3, 5, 9, 10 for a full STRIKE domino cascade!
                  if (impactOffset > 0) {
                    // Right pocket (1-3): Pin 1 flies left into 2, 4, 7
                    pin.vx = -6.8 + (Math.random() - 0.5) * 1.0;
                    pin.vy = 4.6;
                    s.ball.vx += 0.8;
                  } else {
                    // Left pocket (1-2): Pin 1 flies right into 3, 6, 10
                    pin.vx = 6.8 + (Math.random() - 0.5) * 1.0;
                    pin.vy = 4.6;
                    s.ball.vx -= 0.8;
                  }
                  pin.vRot = (Math.random() - 0.5) * 0.45;
                } else {
                  // Glancing headpin hit
                  pin.vx = (dx / (dist || 1)) * 5.5 + s.ball.vx * 0.4;
                  pin.vy = 3.8;
                  pin.vRot = (Math.random() - 0.5) * 0.3;
                }
              } else {
                // Direct ball collision on other pins
                pin.vx = (dx / (dist || 1)) * 6.5 + s.ball.vx * 0.5 + (Math.random() - 0.5) * 0.8;
                pin.vy = 4.2;
                pin.vRot = (Math.random() - 0.5) * 0.35;
              }
            }
          }
        }

        // Chain Reaction: Knocked pins hitting other standing pins
        for (const p1 of s.pins) {
          if (!p1.isKnocked) continue;

          for (const p2 of s.pins) {
            if (p2.isKnocked) continue;

            const dx = p2.x - p1.x;
            const dy = (p2.y - p1.y) * 260;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Hitbox increased by ~31% from 16 to 21
            if (dist < 21) {
              // Corner pins 7 (x=-42) and 10 (x=42) require sufficient kinetic energy to tumble
              const isCornerPin = p2.id === 7 || p2.id === 10;
              const incomingEnergy = Math.hypot(p1.vx, p1.vy);

              if (!isCornerPin || incomingEnergy > 1.8) {
                p2.isKnocked = true;
                p2.vx = (dx / (dist || 1)) * 5.4 + p1.vx * 0.42 + (Math.random() - 0.5) * 1.2;
                p2.vy = 3.4 + Math.random() * 0.8;
                p2.vRot = (Math.random() - 0.5) * 0.38;
                s.pinsFallenThisRoll++;
              }
            }
          }
        }

        // End of Roll
        if (s.ball.y >= 1.05) {
          const totalKnocked = s.pins.filter((p) => p.isKnocked).length;
          playPinCrashSound(totalKnocked);
          handleRollFinish(totalKnocked);
        }
      }

      // Update Flying / Toppling Pins
      for (const pin of s.pins) {
        if (pin.isKnocked && pin.vy > 0) {
          pin.x += pin.vx;
          pin.rotation += pin.vRot;
          pin.vx *= 0.92;
          pin.vy *= 0.92;
        }
      }

      // --- CANVAS 2.5D DRAWING ---
      ctx.clearRect(0, 0, 320, LANE_HEIGHT);
      const cx = 160;

      // 1. Dark Pit Background
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, 320, LANE_HEIGHT);

      // 2. Gutters
      ctx.fillStyle = '#1e293b';
      // Left Gutter
      ctx.beginPath();
      ctx.moveTo(cx - LANE_WIDTH_FRONT / 2 - 18, LANE_HEIGHT);
      ctx.lineTo(cx - LANE_WIDTH_FRONT / 2, LANE_HEIGHT);
      ctx.lineTo(cx - LANE_WIDTH_BACK / 2, 40);
      ctx.lineTo(cx - LANE_WIDTH_BACK / 2 - 12, 40);
      ctx.closePath();
      ctx.fill();

      // Right Gutter
      ctx.beginPath();
      ctx.moveTo(cx + LANE_WIDTH_FRONT / 2, LANE_HEIGHT);
      ctx.lineTo(cx + LANE_WIDTH_FRONT / 2 + 18, LANE_HEIGHT);
      ctx.lineTo(cx + LANE_WIDTH_BACK / 2 + 12, 40);
      ctx.lineTo(cx + LANE_WIDTH_BACK / 2, 40);
      ctx.closePath();
      ctx.fill();

      // 3. Polished Maple Lane Planks with Light Sheen
      const laneGrad = ctx.createLinearGradient(0, LANE_HEIGHT, 0, 40);
      laneGrad.addColorStop(0, '#e5b887');
      laneGrad.addColorStop(0.5, '#c89560');
      laneGrad.addColorStop(1, '#966738');

      ctx.fillStyle = laneGrad;
      ctx.beginPath();
      ctx.moveTo(cx - LANE_WIDTH_FRONT / 2, LANE_HEIGHT);
      ctx.lineTo(cx + LANE_WIDTH_FRONT / 2, LANE_HEIGHT);
      ctx.lineTo(cx + LANE_WIDTH_BACK / 2, 40);
      ctx.lineTo(cx - LANE_WIDTH_BACK / 2, 40);
      ctx.closePath();
      ctx.fill();

      // Plank Seams
      ctx.strokeStyle = 'rgba(74, 43, 19, 0.2)';
      ctx.lineWidth = 1;
      [-0.3, -0.15, 0, 0.15, 0.3].forEach((ratio) => {
        ctx.beginPath();
        ctx.moveTo(cx + (LANE_WIDTH_FRONT / 2) * ratio, LANE_HEIGHT);
        ctx.lineTo(cx + (LANE_WIDTH_BACK / 2) * ratio, 40);
        ctx.stroke();
      });

      // Target Guide Chevrons
      const arrowY = LANE_HEIGHT * 0.58;
      const arrowHalfW = (LANE_WIDTH_FRONT / 2) * 0.42 + (LANE_WIDTH_BACK / 2) * 0.58;
      [-2, -1, 0, 1, 2].forEach((offset) => {
        const ax = cx + (offset * arrowHalfW) / 3;
        ctx.fillStyle = '#6e3c15';
        ctx.beginPath();
        ctx.moveTo(ax, arrowY);
        ctx.lineTo(ax - 3, arrowY + 6);
        ctx.lineTo(ax + 3, arrowY + 6);
        ctx.closePath();
        ctx.fill();
      });

      // Foul Line
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - LANE_WIDTH_FRONT / 2, LANE_HEIGHT - 35);
      ctx.lineTo(cx + LANE_WIDTH_FRONT / 2, LANE_HEIGHT - 35);
      ctx.stroke();

      // Board Marker Dots along Foul Line
      [-40, -20, 0, 20, 40].forEach((ox) => {
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.arc(cx + ox, LANE_HEIGHT - 35, 1.8, 0, Math.PI * 2);
        ctx.fill();
      });

      // 4. Pin Deck & Pins (Sort by row so back pins draw first)
      const sortedPins = [...s.pins].sort((a, b) => b.row - a.row);

      for (const pin of sortedPins) {
        // 2.5D Screen coordinates - scale enlarged by ~28%
        const scale = 0.50 + pin.y * 0.15;
        const currentHalfW = (LANE_WIDTH_FRONT / 2) * (1 - pin.y) + (LANE_WIDTH_BACK / 2) * pin.y;
        const px = cx + pin.x * (currentHalfW / 45);
        const py = LANE_HEIGHT - pin.y * (LANE_HEIGHT - 60);

        ctx.save();
        ctx.translate(px, py);
        ctx.scale(scale, scale);
        ctx.rotate(pin.rotation);

        // Pin Drop Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.ellipse(2, 24, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // White Maple Pin Body
        ctx.fillStyle = pin.isKnocked ? '#e2e8f0' : '#ffffff';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.4;

        // Base & Belly (enlarged)
        ctx.beginPath();
        ctx.ellipse(0, 15, 10, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Neck & Head (enlarged)
        ctx.beginPath();
        ctx.ellipse(0, -8, 6.5, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Red Neck Stripes
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-5, -8, 10, 2.5);
        ctx.fillRect(-5, -3, 10, 2.5);

        ctx.restore();
      }

      // 5. Bowling Ball
      if (s.ball.active) {
        // Perspective position & scale
        const scale = 1.0 - s.ball.y * 0.62;
        const bx = cx + s.ball.x;
        const by = LANE_HEIGHT - 35 - s.ball.y * (LANE_HEIGHT - 80);

        ctx.save();
        ctx.translate(bx, by);
        ctx.scale(scale, scale);

        // Ball Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.ellipse(3, 10, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Metallic Swirl Ball (P1 Cobalt Blue, P2 Crimson Red)
        const bColor = turn === 1 ? '#1d4ed8' : '#b91c1c';
        const bHighlight = turn === 1 ? '#60a5fa' : '#f87171';

        ctx.fillStyle = bColor;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();

        // Swirl Accent
        ctx.strokeStyle = bHighlight;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 10, -0.6, 1.4);
        ctx.stroke();

        // 3 Finger Holes
        ctx.fillStyle = '#09090b';
        ctx.beginPath();
        ctx.arc(-3, -3, 1.8, 0, Math.PI * 2);
        ctx.arc(3, -3, 1.8, 0, Math.PI * 2);
        ctx.arc(0, 4, 2.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      } else if (winner === null) {
        // Ball resting on approach line
        const bx = cx + ballStartX;
        const by = LANE_HEIGHT - 20;

        // Lane Alignment Guide Indicator
        ctx.save();
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = turn === 1 ? 'rgba(96, 165, 250, 0.45)' : 'rgba(248, 113, 113, 0.45)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        // Project target vector towards pin deck pocket
        const targetPocketX = cx + (ballStartX >= 0 ? 10 : -10) * 0.6;
        ctx.lineTo(targetPocketX, LANE_HEIGHT * 0.45);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        ctx.save();
        ctx.translate(bx, by);

        // Ball Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(2, 12, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ball Body
        const bColor = turn === 1 ? '#1d4ed8' : '#b91c1c';
        ctx.fillStyle = bColor;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();

        // Touch Stance Guidance Ring & Arrows
        ctx.strokeStyle = turn === 1 ? 'rgba(147, 197, 253, 0.6)' : 'rgba(252, 165, 165, 0.6)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.stroke();

        // 3 Finger Holes
        ctx.fillStyle = '#09090b';
        ctx.beginPath();
        ctx.arc(-3, -4, 2, 0, Math.PI * 2);
        ctx.arc(3, -4, 2, 0, Math.PI * 2);
        ctx.arc(0, 4, 2.4, 0, Math.PI * 2);
        ctx.fill();

        // Drag to aim chevrons below ball
        ctx.fillStyle = turn === 1 ? '#93c5fd' : '#fca5a5';
        ctx.font = '900 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('‹ DRAG ›', 0, 32);

        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [ballStartX, turn, winner, handleRollFinish]);

  // Pointer / Swipe Gestures with Horizontal Stance Repositioning & Upward Launch
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isRolling || winner !== null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (320 / rect.width);
    const py = (e.clientY - rect.top) * (LANE_HEIGHT / rect.height);

    const s = stateRef.current;
    s.isDragging = true;
    s.dragStart = { x: px, y: py, time: performance.now() };
    s.startBallX = ballStartX;
    s.dragMode = 'none';
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (!s.isDragging || !s.dragStart || isRolling || winner !== null) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (320 / rect.width);
    const py = (e.clientY - rect.top) * (LANE_HEIGHT / rect.height);

    const dx = px - s.dragStart.x;
    const dy = py - s.dragStart.y;

    if (s.dragMode === 'none') {
      if (dy < -14) {
        s.dragMode = 'swipe';
      } else if (Math.abs(dx) > 4) {
        s.dragMode = 'stance';
      }
    }

    if (s.dragMode === 'stance') {
      const newX = Math.max(-65, Math.min(65, s.startBallX + dx));
      setBallStartX(newX);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (!s.isDragging || !s.dragStart) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const releaseX = (e.clientX - rect.left) * (320 / rect.width);
    const releaseY = (e.clientY - rect.top) * (LANE_HEIGHT / rect.height);
    const duration = performance.now() - s.dragStart.time;

    const dy = releaseY - s.dragStart.y;
    const dx = releaseX - s.dragStart.x;

    s.isDragging = false;

    // Upward swipe to roll
    if (dy < -20 && duration < 750) {
      triggerHaptic('medium');
      playBallRollSound();
      setIsRolling(true);

      const speedY = Math.min(0.042, Math.max(0.016, Math.abs(dy) / (duration * 18)));
      const hookCurve = dx * 0.0028; // Lateral swipe imparts curve hook

      s.ball = {
        active: true,
        x: ballStartX,
        y: 0,
        vx: dx * 0.007,
        vy: speedY,
        hook: hookCurve,
        inGutter: false,
      };
      s.pinsFallenThisRoll = 0;
    }
    s.dragMode = 'none';
  };

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden select-none">
      <GameHeader
        gameId="bowling"
        gameName="10-Frame Bowling"
        turn={turn}
        statusText={`Player ${turn}'s Turn (Frame ${currentFrame}/10)`}
        subStatusText={statusMessage}
      />

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden">
        {/* Retro LED Dot-Matrix Scorecard Banner */}
        <div className="w-full max-w-sm bg-[#09090b] border-2 border-[#3e444c] rounded-2xl p-2 shadow-2xl mb-2 overflow-x-auto scrollbar-none">
          {/* Player 1 Row */}
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className={`text-[10px] font-black uppercase w-8 ${turn === 1 ? 'text-player-1' : 'text-white/60'}`}>
              P1
            </span>
            <div className="flex-1 grid grid-cols-10 gap-0.5 text-center">
              {p1Frames.map((f, i) => (
                <div key={i} className="bg-white/5 p-1 rounded-xs border border-white/5 flex flex-col justify-between h-8">
                  <div className="flex justify-between text-[8px] font-bold text-amber-300">
                    <span>{f.rolls[0] ?? ''}</span>
                    <span>{f.rolls[1] ?? ''}</span>
                    {i === 9 && <span>{f.rolls[2] ?? ''}</span>}
                  </div>
                  <span className="text-[9px] font-black text-white">{f.cumulativeScore ?? ''}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Player 2 Row */}
          <div className="flex items-center justify-between gap-1">
            <span className={`text-[10px] font-black uppercase w-8 ${turn === 2 ? 'text-player-2' : 'text-white/60'}`}>
              P2
            </span>
            <div className="flex-1 grid grid-cols-10 gap-0.5 text-center">
              {p2Frames.map((f, i) => (
                <div key={i} className="bg-white/5 p-1 rounded-xs border border-white/5 flex flex-col justify-between h-8">
                  <div className="flex justify-between text-[8px] font-bold text-amber-300">
                    <span>{f.rolls[0] ?? ''}</span>
                    <span>{f.rolls[1] ?? ''}</span>
                    {i === 9 && <span>{f.rolls[2] ?? ''}</span>}
                  </div>
                  <span className="text-[9px] font-black text-white">{f.cumulativeScore ?? ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2.5D Bowling Alley Canvas Container */}
        <div className="relative flex items-center justify-center max-h-[64vh] aspect-[320/480] clubhouse-board-depth table-flat rounded-2xl overflow-hidden shadow-2xl border-4 border-[#1e293b]">
          <canvas
            ref={canvasRef}
            width={320}
            height={LANE_HEIGHT}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="w-full h-full touch-none cursor-pointer"
          />

          {/* Swipe Guide Arrow Overlay */}
          {!isRolling && (
            <div className="absolute bottom-14 pointer-events-none flex flex-col items-center opacity-65 animate-bounce">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-wider text-white">Swipe Up to Roll</span>
            </div>
          )}
        </div>

        {/* Approach Slider (Positioning ball left/right) */}
        <div className="w-full max-w-sm flex items-center justify-between gap-3 mt-2 px-2 bg-container-dark/80 p-2 rounded-2xl border border-[#3e444c]">
          <span className="text-[10px] font-black uppercase text-accent-light/80 shrink-0">
            Lane Stance
          </span>
          <input
            type="range"
            min="-65"
            max="65"
            value={ballStartX}
            disabled={isRolling}
            onChange={(e) => setBallStartX(Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer h-2 bg-black/40 rounded-lg appearance-none"
          />
        </div>
      </main>

      {/* Game Over Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="10-Frame Bowling"
          onRestart={() => {
            p1RawRolls.current = [];
            p2RawRolls.current = [];
            setP1Frames(Array.from({ length: 10 }, () => ({ rolls: [], cumulativeScore: null })));
            setP2Frames(Array.from({ length: 10 }, () => ({ rolls: [], cumulativeScore: null })));
            setTurn(1);
            setCurrentFrame(1);
            setCurrentRollInFrame(1);
            setWinner(null);
            setupPins(false);
          }}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};
export default Bowling;
