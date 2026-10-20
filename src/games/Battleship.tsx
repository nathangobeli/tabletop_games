import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { useOrientation } from '../hooks/useOrientation';
import { GameHeader, type GamePlayMode } from '../components/GameHeader';
import { RemoteDuelModal } from '../components/RemoteDuelModal';
import { multiplayer, type RemoteMessage } from '../utils/multiplayer';
import { triggerHaptic, playTapSound, playCaptureSound } from '../utils/feedback';
import type { PlayerNumber } from '../types/game';
import { useRemoteMultiplayer } from '../hooks/useRemoteMultiplayer';

// Grid Dimensions (Standard Hasbro 10x10)
const GRID_SIZE = 10;
const COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const ROW_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export type ShipId = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';

interface ShipConfig {
  id: ShipId;
  name: string;
  size: number;
  icon: string;
}

const FLEET_CONFIG: ShipConfig[] = [
  { id: 'carrier', name: 'Aircraft Carrier', size: 5, icon: '✈️' },
  { id: 'battleship', name: 'Battleship', size: 4, icon: '⚓' },
  { id: 'cruiser', name: 'Cruiser', size: 3, icon: '🛳️' },
  { id: 'submarine', name: 'Submarine', size: 3, icon: '🧭' },
  { id: 'destroyer', name: 'Patrol Destroyer', size: 2, icon: '🚤' },
];

export interface ShipPlacement {
  id: ShipId;
  name: string;
  size: number;
  row: number;
  col: number;
  orientation: 'H' | 'V';
  hits: number;
  sunk: boolean;
}

export type PegState = 'empty' | 'miss' | 'hit' | 'sunk';

interface ShotResult {
  row: number;
  col: number;
  isHit: boolean;
  shipId?: ShipId;
  shipName?: string;
  sunk: boolean;
  allSunk: boolean;
}

// Validation helper for placement
function isValidPlacement(
  ships: ShipPlacement[],
  shipId: ShipId,
  size: number,
  row: number,
  col: number,
  orientation: 'H' | 'V'
): boolean {
  if (orientation === 'H') {
    if (col + size > GRID_SIZE) return false;
  } else {
    if (row + size > GRID_SIZE) return false;
  }

  const newOccupied: [number, number][] = [];
  for (let i = 0; i < size; i++) {
    const r = orientation === 'V' ? row + i : row;
    const c = orientation === 'H' ? col + i : col;
    newOccupied.push([r, c]);
  }

  for (const ship of ships) {
    if (ship.id === shipId) continue;
    for (let i = 0; i < ship.size; i++) {
      const sr = ship.orientation === 'V' ? ship.row + i : ship.row;
      const sc = ship.orientation === 'H' ? ship.col + i : ship.col;
      for (const [nr, nc] of newOccupied) {
        if (sr === nr && sc === nc) return false;
      }
    }
  }

  return true;
}

// Random fleet generator
function generateRandomFleet(): ShipPlacement[] {
  const placements: ShipPlacement[] = [];

  for (const config of FLEET_CONFIG) {
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < 250) {
      attempts++;
      const orientation: 'H' | 'V' = Math.random() < 0.5 ? 'H' : 'V';
      const maxR = orientation === 'V' ? GRID_SIZE - config.size : GRID_SIZE - 1;
      const maxC = orientation === 'H' ? GRID_SIZE - config.size : GRID_SIZE - 1;

      const row = Math.floor(Math.random() * (maxR + 1));
      const col = Math.floor(Math.random() * (maxC + 1));

      if (isValidPlacement(placements, config.id, config.size, row, col, orientation)) {
        placements.push({
          id: config.id,
          name: config.name,
          size: config.size,
          row,
          col,
          orientation,
          hits: 0,
          sunk: false,
        });
        placed = true;
      }
    }
  }

  return placements;
}

// Visual helper: Connect ship segments into contiguous 3D hulls with rounded bows & sterns
function getShipHullClasses(
  orientation: 'H' | 'V',
  segmentIndex: number,
  size: number
): string {
  if (size <= 1) return 'rounded-md';
  if (orientation === 'H') {
    if (segmentIndex === 0) return 'rounded-l-lg rounded-r-none';
    if (segmentIndex === size - 1) return 'rounded-r-md rounded-l-none';
    return 'rounded-none';
  } else {
    if (segmentIndex === 0) return 'rounded-t-lg rounded-b-none';
    if (segmentIndex === size - 1) return 'rounded-b-md rounded-t-none';
    return 'rounded-none';
  }
}

// ---------------------------------------------------------------------------
// 3D Molded Plastic Peg Components (Matching the Physical Toy Image)
// ---------------------------------------------------------------------------

// Empty molded pin hole in the blue plastic tray
const PlasticPinHole: React.FC = () => (
  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#013554] shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.85)] border border-[#025686]/60 transition-transform" />
);

// High-Contrast Glossy 3D Black Peg (Miss)
const BlackPeg: React.FC = () => (
  <div className="relative w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-[#475569] via-[#0f172a] to-black shadow-[0_3px_6px_rgba(0,0,0,0.9),inset_0_1.5px_2px_rgba(255,255,255,0.4),inset_0_-2px_3px_rgba(0,0,0,0.95)] border-2 border-[#64748b] flex items-center justify-center animate-scale-up">
    {/* Specular glossy highlight */}
    <div className="absolute top-0.5 left-1 w-1.5 h-1 rounded-full bg-white/70 blur-[0.2px]" />
    {/* Center silver water splash marker */}
    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shadow-sm" />
  </div>
);

// Ultra-Vibrant Glossy 3D Red Peg (Hit)
const RedPeg: React.FC = () => (
  <div className="relative w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-[#f87171] via-[#dc2626] to-[#7f1d1d] shadow-[0_3px_6px_rgba(220,38,38,0.7),inset_0_1.5px_2px_rgba(254,202,202,0.9),inset_0_-2px_3px_rgba(69,10,10,0.8)] border-2 border-[#fca5a5] flex items-center justify-center animate-scale-up ring-2 ring-red-500/50">
    {/* Specular glossy highlight */}
    <div className="absolute top-0.5 left-1 w-1.5 h-1 rounded-full bg-white/90 blur-[0.2px]" />
    {/* Hot impact core */}
    <div className="w-1.5 h-1.5 rounded-full bg-amber-200 shadow-sm" />
  </div>
);

// ---------------------------------------------------------------------------
// Main Battleship Game Component
// ---------------------------------------------------------------------------

export const Battleship: React.FC = () => {
  const { setGameStatus } = useGame();
  const { isLandscape } = useOrientation();

  // Mode and Modals
  const [gameMode, setGameMode] = useState<GamePlayMode>('vs-cpu');
  const [showRemoteModal, setShowRemoteModal] = useState<boolean>(false);

  // Phases: 'deploy' | 'battle' | 'game-over'
  const [phase, setPhase] = useState<'deploy' | 'battle' | 'game-over'>('deploy');
  // Turn: 1 for Player 1 (Human), 2 for Player 2 / CPU
  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [winner, setWinner] = useState<PlayerNumber | null>(null);

  // Lock to prevent multiple simultaneous shots or rapid clicks
  const [isProcessingShot, setIsProcessingShot] = useState<boolean>(false);

  // Tactical Tab for Mobile Portrait ('radar' for attacking, 'fleet' for defense)
  const [activeTab, setActiveTab] = useState<'radar' | 'fleet'>('radar');

  // Player 1 (Human Admiral) State
  const [p1Ships, setP1Ships] = useState<ShipPlacement[]>(() => generateRandomFleet());
  const [p1Radar, setP1Radar] = useState<PegState[][]>(() =>
    Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('empty'))
  );
  const [p1HitsReceived, setP1HitsReceived] = useState<PegState[][]>(() =>
    Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('empty'))
  );
  const [p1Ready, setP1Ready] = useState<boolean>(false);

  // Player 2 / CPU State
  const [p2Ships, setP2Ships] = useState<ShipPlacement[]>(() => generateRandomFleet());
  const [p2Radar, setP2Radar] = useState<PegState[][]>(() =>
    Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('empty'))
  );
  const [p2Ready, setP2Ready] = useState<boolean>(true);

  // Deployment Tool State
  const [selectedShipId, setSelectedShipId] = useState<ShipId>('carrier');
  const [deployOrientation, setDeployOrientation] = useState<'H' | 'V'>('H');
  const [hoverCoord, setHoverCoord] = useState<{ r: number; c: number } | null>(null);

  // Toast Banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Statistics
  const [p1ShotsCount, setP1ShotsCount] = useState<number>(0);
  const [p1HitsCount, setP1HitsCount] = useState<number>(0);

  // Enemy Sunk Ships Tracking (Works for both Vs CPU and Remote Duel)
  const [enemySunkShipIds, setEnemySunkShipIds] = useState<ShipId[]>([]);
  const [showGameOverModal, setShowGameOverModal] = useState<boolean>(true);
  const [, setPortraitRosterTab] = useState<'enemy' | 'friendly'>('enemy');

  // -------------------------------------------------------------------------
  // Human-Like AI Tactical Memory Brain
  // -------------------------------------------------------------------------
  // When an AI hits a ship, it acts like a human:
  // 1. Saves hit coordinate to activeHits.
  // 2. Probes North, South, East, West to find the ship's orientation.
  // 3. Once a 2nd hit confirms horizontal or vertical, it walks the line until sunk!
  // 4. Once sunk, it clears memory and returns to parity hunting.
  const aiMemory = useRef<{
    activeHits: [number, number][];
    probeQueue: [number, number][];
    direction: 'H' | 'V' | null;
  }>({
    activeHits: [],
    probeQueue: [],
    direction: null,
  });

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  // Clamshell View Switcher: Top Lid (Radar) vs Bottom Tray (My Fleet)
  const handleSelectView = useCallback((view: 'radar' | 'fleet') => {
    triggerHaptic('light');
    playTapSound();
    setActiveTab(view);
    setPortraitRosterTab(view === 'radar' ? 'enemy' : 'friendly');
  }, []);

  // Reset Game Handler
  const resetGame = useCallback((isRemote = false) => {
    setPhase('deploy');
    setTurn(1);
    setWinner(null);
    setP1Ready(false);
    setP2Ready(true);
    setIsProcessingShot(false);
    setP1ShotsCount(0);
    setP1HitsCount(0);
    setEnemySunkShipIds([]);
    setShowGameOverModal(true);
    setActiveTab('radar');
    setPortraitRosterTab('enemy');

    aiMemory.current = {
      activeHits: [],
      probeQueue: [],
      direction: null,
    };

    setP1Radar(Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('empty')));
    setP1HitsReceived(Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('empty')));
    setP2Radar(Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('empty')));

    setP1Ships(generateRandomFleet());
    setP2Ships(generateRandomFleet());

    setGameStatus('active');

    if (gameMode === 'remote' && !isRemote) {
      multiplayer.send({ type: 'RESTART', gameId: 'battleship' });
    }
  }, [gameMode, setGameStatus]);

  // Handle Deploy: Place or Reposition Selected Ship
  const handleDeployCellClick = (r: number, c: number) => {
    if (p1Ready) return;
    const currentConfig = FLEET_CONFIG.find((s) => s.id === selectedShipId);
    if (!currentConfig) return;

    if (isValidPlacement(p1Ships, selectedShipId, currentConfig.size, r, c, deployOrientation)) {
      triggerHaptic('medium');
      playTapSound();

      const updated = p1Ships.filter((s) => s.id !== selectedShipId);
      updated.push({
        id: selectedShipId,
        name: currentConfig.name,
        size: currentConfig.size,
        row: r,
        col: c,
        orientation: deployOrientation,
        hits: 0,
        sunk: false,
      });
      setP1Ships(updated);

      const unplaced = FLEET_CONFIG.find((f) => !updated.some((u) => u.id === f.id));
      if (unplaced) {
        setSelectedShipId(unplaced.id);
      }
    } else {
      triggerHaptic('error');
    }
  };

  // Lock In Fleet / Confirm Deployment
  const handleConfirmFleet = () => {
    if (p1Ships.length < FLEET_CONFIG.length) {
      triggerToast('Please place all 5 naval vessels before deploying!');
      triggerHaptic('error');
      return;
    }

    triggerHaptic('success');
    playCaptureSound();
    setP1Ready(true);

    if (gameMode === 'remote') {
      multiplayer.send({ type: 'FLEET_READY', gameId: 'battleship' });
      if (p2Ready) {
        setPhase('battle');
        setTurn(1);
        triggerToast('Armadas Ready! Alternate firing salvos.');
      } else {
        triggerToast('Fleet Ready! Awaiting Opponent Deployment...');
      }
    } else {
      setPhase('battle');
      setTurn(1);
      triggerToast('Battle Commenced! Select coordinates on Enemy Radar.');
    }
  };

  // Auto-Randomize Fleet Deployment
  const handleRandomizeFleet = () => {
    triggerHaptic('medium');
    playTapSound();
    setP1Ships(generateRandomFleet());
  };

  // Resolve a shot against a fleet (Pure logic, non-mutating)
  const processShotAgainstFleet = (
    targetShips: ShipPlacement[],
    row: number,
    col: number
  ): { nextShips: ShipPlacement[]; result: ShotResult } => {
    let hitFound = false;
    let hitShipConfig: ShipPlacement | undefined;

    const nextShips = targetShips.map((ship) => {
      let segmentHit = false;
      for (let i = 0; i < ship.size; i++) {
        const sr = ship.orientation === 'V' ? ship.row + i : ship.row;
        const sc = ship.orientation === 'H' ? ship.col + i : ship.col;
        if (sr === row && sc === col) {
          segmentHit = true;
          break;
        }
      }

      if (segmentHit) {
        hitFound = true;
        const newHits = ship.hits + 1;
        const isSunk = newHits >= ship.size;
        const updated: ShipPlacement = { ...ship, hits: newHits, sunk: isSunk };
        hitShipConfig = updated;
        return updated;
      }
      return ship;
    });

    const allSunk = nextShips.every((s) => s.sunk);
    const hitShip = hitShipConfig as ShipPlacement | undefined;

    return {
      nextShips,
      result: {
        row,
        col,
        isHit: hitFound,
        shipId: hitShip?.id,
        shipName: hitShip?.name,
        sunk: hitShip?.sunk ?? false,
        allSunk,
      },
    };
  };

  // -------------------------------------------------------------------------
  // Player 1 Fires a Salvo (Human Admiral Turn)
  // -------------------------------------------------------------------------
  const handleFireSalvo = (row: number, col: number) => {
    if (phase !== 'battle') return;
    if (winner !== null) return;
    if (isProcessingShot) return;
    if (turn !== 1) return;

    // Check remote turn authority
    if (gameMode === 'remote') {
      const localRole = multiplayer.isLocalHost() ? 1 : 2;
      if (turn !== localRole) {
        triggerToast('Awaiting opponent salvo...');
        triggerHaptic('light');
        return;
      }
    }

    // Cell already targeted?
    if (p1Radar[row][col] !== 'empty') {
      triggerHaptic('error');
      return;
    }

    setIsProcessingShot(true);
    triggerHaptic('medium');
    playTapSound();
    setP1ShotsCount((prev) => prev + 1);

    if (gameMode === 'remote') {
      setIsAwaitingServer(true);
      // Remote Duel: Send FIRE message to peer
      multiplayer.send({
        type: 'FIRE',
        gameId: 'battleship',
        payload: { row, col },
      });
      return;
    }

    // Local / VS CPU Turn Execution
    const { nextShips, result } = processShotAgainstFleet(p2Ships, row, col);
    setP2Ships(nextShips);

    // Update Radar Peg (Red for Hit, White for Miss)
    const nextRadar = p1Radar.map((r) => [...r]);
    nextRadar[row][col] = result.isHit ? 'hit' : 'miss';
    setP1Radar(nextRadar);

    if (result.isHit) {
      setP1HitsCount((prev) => prev + 1);
      playCaptureSound();
      triggerHaptic('heavy');
      if (result.sunk) {
        if (result.shipId) {
          setEnemySunkShipIds((prev) =>
            prev.includes(result.shipId!) ? prev : [...prev, result.shipId!]
          );
        }
        triggerToast(`BOOM! You sank their ${result.shipName}!`);
      } else {
        triggerToast('Direct Hit on Enemy Ship!');
      }
    } else {
      triggerHaptic('light');
      triggerToast('Miss! Black peg placed in water.');
    }

    // Check Win
    if (result.allSunk) {
      setWinner(1);
      setPhase('game-over');
      setShowGameOverModal(true);
      setIsProcessingShot(false);
      triggerHaptic('success');
      playCaptureSound();
      triggerToast('VICTORY! Enemy armada completely eradicated!');
      return;
    }

    // Cleanly pass turn to Player 2 / CPU
    setTimeout(() => {
      setTurn(2);
      setIsProcessingShot(false);
    }, 600);
  };

  // -------------------------------------------------------------------------
  // Human-Like CPU Turn (Executes Exactly ONE Shot, then Passes Turn Back)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== 'battle' || winner !== null) return;
    if (gameMode !== 'vs-cpu' || turn !== 2) return;

    let isCancelled = false;

    const timer = setTimeout(() => {
      if (isCancelled) return;

      let targetRow = -1;
      let targetCol = -1;
      const mem = aiMemory.current;

      // ---------------------------------------------------------------------
      // AI TACTIC 1: Human-like Targeted Pursuit (if an active hit exists)
      // ---------------------------------------------------------------------
      if (mem.activeHits.length > 0) {
        // Case A: Two or more hits confirm ship direction!
        if (mem.activeHits.length >= 2) {
          const hits = [...mem.activeHits];
          // Check if horizontal or vertical
          const isH = hits[0][0] === hits[1][0];
          mem.direction = isH ? 'H' : 'V';

          if (isH) {
            const r = hits[0][0];
            const cols = hits.map((h) => h[1]).sort((a, b) => a - b);
            const minC = cols[0];
            const maxC = cols[cols.length - 1];

            // Try right end first, then left end
            if (maxC + 1 < GRID_SIZE && p2Radar[r][maxC + 1] === 'empty') {
              targetRow = r;
              targetCol = maxC + 1;
            } else if (minC - 1 >= 0 && p2Radar[r][minC - 1] === 'empty') {
              targetRow = r;
              targetCol = minC - 1;
            }
          } else {
            const c = hits[0][1];
            const rows = hits.map((h) => h[0]).sort((a, b) => a - b);
            const minR = rows[0];
            const maxR = rows[rows.length - 1];

            // Try bottom end first, then top end
            if (maxR + 1 < GRID_SIZE && p2Radar[maxR + 1][c] === 'empty') {
              targetRow = maxR + 1;
              targetCol = c;
            } else if (minR - 1 >= 0 && p2Radar[minR - 1][c] === 'empty') {
              targetRow = minR - 1;
              targetCol = c;
            }
          }
        }

        // Case B: Probe queue (searching orthogonal neighbors)
        if (targetRow === -1 && mem.probeQueue.length > 0) {
          while (mem.probeQueue.length > 0) {
            const [pr, pc] = mem.probeQueue.shift()!;
            if (pr >= 0 && pr < GRID_SIZE && pc >= 0 && pc < GRID_SIZE && p2Radar[pr][pc] === 'empty') {
              targetRow = pr;
              targetCol = pc;
              break;
            }
          }
        }
      }

      // ---------------------------------------------------------------------
      // AI TACTIC 2: Parity Checkerboard Hunt (like a human searching)
      // ---------------------------------------------------------------------
      if (targetRow === -1) {
        const parityCells: [number, number][] = [];
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if ((r + c) % 2 === 0 && p2Radar[r][c] === 'empty') {
              parityCells.push([r, c]);
            }
          }
        }

        if (parityCells.length > 0) {
          const [pr, pc] = parityCells[Math.floor(Math.random() * parityCells.length)];
          targetRow = pr;
          targetCol = pc;
        } else {
          // Fallback to any remaining empty cell
          const remaining: [number, number][] = [];
          for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
              if (p2Radar[r][c] === 'empty') remaining.push([r, c]);
            }
          }
          if (remaining.length > 0) {
            const [rr, rc] = remaining[Math.floor(Math.random() * remaining.length)];
            targetRow = rr;
            targetCol = rc;
          }
        }
      }

      if (targetRow === -1 || targetCol === -1) {
        setTurn(1);
        return;
      }

      // ---------------------------------------------------------------------
      // Fire the single CPU shot!
      // ---------------------------------------------------------------------
      const { nextShips, result } = processShotAgainstFleet(p1Ships, targetRow, targetCol);
      setP1Ships(nextShips);

      // Record shot on CPU Radar
      setP2Radar((prev) => {
        const copy = prev.map((row) => [...row]);
        copy[targetRow][targetCol] = result.isHit ? 'hit' : 'miss';
        return copy;
      });

      // Place red peg or white peg on Player 1's Ocean Defense board
      setP1HitsReceived((prev) => {
        const copy = prev.map((row) => [...row]);
        copy[targetRow][targetCol] = result.isHit ? 'hit' : 'miss';
        return copy;
      });

      // Update AI Brain memory based on outcome
      if (result.isHit) {
        mem.activeHits.push([targetRow, targetCol]);

        if (result.sunk) {
          triggerToast(`⚠️ ALERT: Enemy salvo sank your ${result.shipName}!`);
          // Clear active hunt memory, target destroyed!
          mem.activeHits = [];
          mem.probeQueue = [];
          mem.direction = null;
        } else {
          triggerToast('⚠️ ALERT: Enemy salvo struck your ship!');
          // Add 4 orthogonal neighbors to probe queue if not yet confirmed
          if (mem.activeHits.length === 1) {
            const candidates: [number, number][] = [
              [targetRow - 1, targetCol],
              [targetRow + 1, targetCol],
              [targetRow, targetCol - 1],
              [targetRow, targetCol + 1],
            ];
            // Shuffle candidates so AI doesn't always go North first
            candidates.sort(() => Math.random() - 0.5);
            mem.probeQueue = candidates;
          }
        }
      } else {
        triggerToast('Enemy salvo missed in ocean waters.');
      }

      // Check CPU Win
      if (result.allSunk) {
        setWinner(2);
        setPhase('game-over');
        setShowGameOverModal(true);
        triggerHaptic('error');
        triggerToast('DEFEAT! All your warships have been sunk!');
        return;
      }

      // Turn GUARANTEED to pass back to Human (Player 1)
      setTurn(1);
    }, 1100);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [phase, turn, winner, gameMode, p1Ships, p2Radar, triggerToast]);

  // Reusable Remote Multiplayer Synchronization & Guard Hook
  const {
    localPlayer,
    latency,
    peerPresence,
    turnTimeRemaining,
    isAwaitingServer,
    setIsAwaitingServer,
  } = useRemoteMultiplayer({
    gameId: 'battleship',
    turn,
    gameMode,
    onTurnTimeout: () => {
      // Auto-fire at first empty sector if 45s timer expires on local turn
      if (phase === 'battle' && turn === (multiplayer.isLocalHost() ? 1 : 2) && !isProcessingShot) {
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (p1Radar[r][c] === 'empty') {
              triggerToast('Turn timer expired (45s)! Auto-firing salvo...');
              handleFireSalvo(r, c);
              return;
            }
          }
        }
      }
    },
    onPeerForfeit: () => {
      if (phase === 'battle') {
        setWinner(multiplayer.isLocalHost() ? 1 : 2);
        setPhase('game-over');
        setShowGameOverModal(true);
        triggerToast('Opponent forfeited after 20s disconnect grace period. VICTORY!');
      }
    },
  });

  // -------------------------------------------------------------------------
  // WebRTC Remote Duel Listeners (2-Screen Mode)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (gameMode !== 'remote') return;

    const unbind = multiplayer.onMessage((msg: RemoteMessage) => {
      if (msg.gameId !== 'battleship') return;

      if (msg.type === 'FLEET_READY') {
        setP2Ready(true);
        triggerToast('Opponent armada deployed and locked in!');
        if (p1Ready) {
          setPhase('battle');
          setTurn(1);
          triggerToast('Both Armadas Ready! Alternate firing salvos.');
        }
      } else if (msg.type === 'FIRE') {
        // Opponent fired at our fleet - evaluated locally on private board
        const { row, col } = msg.payload;
        const { nextShips, result } = processShotAgainstFleet(p1Ships, row, col);
        setP1Ships(nextShips);

        // Update our defense ocean grid with peg
        setP1HitsReceived((prev) => {
          const copy = prev.map((r) => [...r]);
          copy[row][col] = result.isHit ? 'hit' : 'miss';
          return copy;
        });

        if (result.isHit) {
          playCaptureSound();
          triggerHaptic('heavy');
          if (result.sunk) {
            triggerToast(`⚠️ ALERT: Enemy salvo sank your ${result.shipName}!`);
          } else {
            triggerToast('⚠️ ALERT: Incoming hit on your ship!');
          }
        }

        // Send sanitized reply: only this single coordinate result (unhit coordinates never sent)
        multiplayer.send({
          type: 'FIRE_RESULT',
          gameId: 'battleship',
          payload: result,
        });

        if (result.allSunk) {
          setWinner(multiplayer.isLocalHost() ? 2 : 1);
          setPhase('game-over');
          setShowGameOverModal(true);
          triggerHaptic('error');
          // Broadcast fleet coordinates ONLY at terminal game-over for post-game inspection
          multiplayer.send({
            type: 'GAME_OVER_REVEAL',
            gameId: 'battleship',
            payload: { ships: p1Ships },
          });
          return;
        }

        // Pass turn to local player
        setTurn(multiplayer.isLocalHost() ? 1 : 2);
      } else if (msg.type === 'FIRE_RESULT') {
        // Result of our shot on opponent (releases optimistic lock)
        setIsAwaitingServer(false);
        setIsProcessingShot(false);
        const result: ShotResult = msg.payload;

        setP1Radar((prev) => {
          const copy = prev.map((r) => [...r]);
          copy[result.row][result.col] = result.isHit ? 'hit' : 'miss';
          return copy;
        });

        if (result.isHit) {
          setP1HitsCount((prev) => prev + 1);
          playCaptureSound();
          triggerHaptic('heavy');
          if (result.sunk) {
            if (result.shipId) {
              setEnemySunkShipIds((prev) =>
                prev.includes(result.shipId!) ? prev : [...prev, result.shipId!]
              );
            }
            triggerToast(`DIRECT HIT! You sank their ${result.shipName}!`);
          } else {
            triggerToast('DIRECT HIT on enemy ship!');
          }
        } else {
          triggerHaptic('light');
          triggerToast('Miss! Black peg placed in water.');
        }

        if (result.allSunk) {
          setWinner(multiplayer.isLocalHost() ? 1 : 2);
          setPhase('game-over');
          setShowGameOverModal(true);
          triggerHaptic('success');
          triggerToast('VICTORY! Enemy fleet eliminated!');
          // Reveal our fleet as well for post-game inspection
          multiplayer.send({
            type: 'GAME_OVER_REVEAL',
            gameId: 'battleship',
            payload: { ships: p1Ships },
          });
          return;
        }

        // Pass turn to opponent
        setTurn(multiplayer.isLocalHost() ? 2 : 1);
      } else if (msg.type === 'GAME_OVER_REVEAL') {
        // Terminal game-over reveal: now opponent ships can be viewed for inspect board
        if (msg.payload?.ships) {
          setP2Ships(msg.payload.ships);
        }
      } else if (msg.type === 'RESTART') {
        resetGame(true);
      }
    });

    return unbind;
  }, [gameMode, p1Ready, p1Ships, triggerToast, resetGame, setIsAwaitingServer]);

  // Sunk ship counts
  const p1SunkCount = useMemo(() => p1Ships.filter((s) => s.sunk).length, [p1Ships]);

  // Check if an enemy ship is sunk (supports vs-cpu and remote)
  const isEnemyShipSunk = useCallback(
    (id: ShipId): boolean => {
      if (gameMode === 'vs-cpu') {
        return p2Ships.find((s) => s.id === id)?.sunk ?? false;
      }
      return enemySunkShipIds.includes(id);
    },
    [gameMode, p2Ships, enemySunkShipIds]
  );

  const enemySunkCount = useMemo(() => {
    if (gameMode === 'vs-cpu') {
      return p2Ships.filter((s) => s.sunk).length;
    }
    return enemySunkShipIds.length;
  }, [gameMode, p2Ships, enemySunkShipIds]);

  const isLocalWinner = useMemo(() => {
    if (winner === null) return false;
    if (gameMode === 'remote') {
      const localRole = multiplayer.isLocalHost() ? 1 : 2;
      return winner === localRole;
    }
    return winner === 1;
  }, [winner, gameMode]);

  // Check if a cell is part of Player 1's ship
  const getP1ShipAt = useCallback(
    (r: number, c: number): { ship: ShipPlacement; segmentIndex: number } | null => {
      for (const ship of p1Ships) {
        for (let i = 0; i < ship.size; i++) {
          const sr = ship.orientation === 'V' ? ship.row + i : ship.row;
          const sc = ship.orientation === 'H' ? ship.col + i : ship.col;
          if (sr === r && sc === c) {
            return { ship, segmentIndex: i };
          }
        }
      }
      return null;
    },
    [p1Ships]
  );

  // Check if an enemy ship is located here (revealed in game-over screen for vs-cpu)
  const getEnemyShipAt = useCallback(
    (r: number, c: number): { ship: ShipPlacement; segmentIndex: number } | null => {
      for (const ship of p2Ships) {
        for (let i = 0; i < ship.size; i++) {
          const sr = ship.orientation === 'V' ? ship.row + i : ship.row;
          const sc = ship.orientation === 'H' ? ship.col + i : ship.col;
          if (sr === r && sc === c) {
            return { ship, segmentIndex: i };
          }
        }
      }
      return null;
    },
    [p2Ships]
  );

  // Enemy Fleet Recon Roster Component (Compact 5-column responsive row)
  const renderEnemyFleetRoster = () => (
    <div className="w-full rounded-2xl bg-slate-900/95 border-2 border-rose-500/40 p-1.5 sm:p-2 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-[10px] sm:text-[11px] font-black uppercase text-rose-300 tracking-wider flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          Enemy Armada Recon
        </span>
        <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-300">
          <span className="text-red-400">{enemySunkCount}</span>/5 Sunk •{' '}
          <span className="text-cyan-300">{5 - enemySunkCount}</span> Afloat
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1 w-full">
        {FLEET_CONFIG.map((ship) => {
          const isSunk = isEnemyShipSunk(ship.id);
          const cleanName = ship.name.replace('Aircraft ', '').replace('Patrol ', '');

          return (
            <div
              key={ship.id}
              className={`flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-lg border transition-all text-center min-w-0 ${
                isSunk
                  ? 'bg-rose-950/80 border-rose-500/80 text-rose-200 shadow-[0_0_8px_rgba(225,29,72,0.3)]'
                  : 'bg-slate-800/90 border-slate-700/80 text-slate-300'
              }`}
            >
              <span className="text-xs sm:text-sm leading-none">{isSunk ? '💥' : ship.icon}</span>
              <span
                className={`text-[9px] sm:text-[10px] font-bold leading-tight truncate w-full mt-0.5 ${
                  isSunk ? 'line-through text-rose-300/80' : 'text-slate-100'
                }`}
                title={ship.name}
              >
                {cleanName}
              </span>
              <span
                className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider leading-none mt-0.5 ${
                  isSunk ? 'text-red-400' : 'text-cyan-400'
                }`}
              >
                {isSunk ? 'SUNK' : 'AFLOAT'}
              </span>

              {/* Pin pips */}
              <div className="flex items-center justify-center gap-0.5 mt-1">
                {Array.from({ length: ship.size }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full transition-all ${
                      isSunk
                        ? 'bg-red-500 shadow-[0_0_2px_rgba(239,68,68,0.9)]'
                        : 'bg-slate-600'
                    }`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Friendly Fleet Defense Roster Component (Compact 5-column responsive row)
  const renderFriendlyFleetRoster = () => (
    <div className="w-full rounded-2xl bg-slate-900/95 border-2 border-cyan-500/40 p-1.5 sm:p-2 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-[10px] sm:text-[11px] font-black uppercase text-cyan-300 tracking-wider flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          Your Fleet Defense
        </span>
        <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-300">
          <span className="text-cyan-300">{5 - p1SunkCount}</span>/5 Surviving
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1 w-full">
        {FLEET_CONFIG.map((ship) => {
          const p1Ship = p1Ships.find((s) => s.id === ship.id);
          const isSunk = p1Ship?.sunk ?? false;
          const hits = p1Ship?.hits ?? 0;
          const cleanName = ship.name.replace('Aircraft ', '').replace('Patrol ', '');

          return (
            <div
              key={ship.id}
              className={`flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-lg border transition-all text-center min-w-0 ${
                isSunk
                  ? 'bg-rose-950/80 border-rose-500/80 text-rose-200 opacity-80'
                  : hits > 0
                  ? 'bg-amber-950/50 border-amber-500/60 text-amber-200'
                  : 'bg-slate-800/90 border-slate-700/80 text-slate-300'
              }`}
            >
              <span className="text-xs sm:text-sm leading-none">{isSunk ? '💥' : ship.icon}</span>
              <span
                className={`text-[9px] sm:text-[10px] font-bold leading-tight truncate w-full mt-0.5 ${
                  isSunk ? 'line-through text-rose-300/80' : 'text-slate-100'
                }`}
                title={ship.name}
              >
                {cleanName}
              </span>
              <span
                className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider leading-none mt-0.5 ${
                  isSunk
                    ? 'text-red-400 font-black'
                    : hits > 0
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {isSunk ? 'SUNK' : hits > 0 ? `${hits}/${ship.size} HIT` : 'INTACT'}
              </span>

              {/* Pin pips */}
              <div className="flex items-center justify-center gap-0.5 mt-1">
                {Array.from({ length: ship.size }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full transition-all ${
                      isSunk
                        ? 'bg-red-500'
                        : idx < hits
                        ? 'bg-red-500 shadow-[0_0_2px_rgba(239,68,68,0.9)] ring-1 ring-white'
                        : 'bg-[#94a3b8]'
                    }`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden bg-[#0a192f] select-none text-slate-100 font-sans">
      <GameHeader
        title="Battleship"
        subtitle="2-Screen Naval Duel"
        turn={turn}
        scoreP1={`${5 - p1SunkCount} Afloat`}
        scoreP2={`${5 - enemySunkCount} Afloat`}
        p1Label="Your Fleet"
        p2Label={gameMode === 'vs-cpu' ? '🤖 CPU' : 'Enemy'}
        onRestart={() => resetGame(false)}
        statusMessage={
          phase === 'deploy'
            ? p1Ready
              ? 'Armada locked in. Awaiting opponent deployment...'
              : 'Arrange your 5 gray warships. Tap squares to reposition or hit Auto-Deploy.'
            : phase === 'battle'
            ? turn === 1
              ? 'Your Turn: Select an empty hole on the Enemy Radar to fire a salvo.'
              : gameMode === 'vs-cpu'
              ? '🤖 Enemy Fleet is aiming artillery...'
              : 'Enemy turn: awaiting incoming salvo report...'
            : isLocalWinner
            ? '🏆 VICTORY: You sank the entire enemy armada!'
            : '💥 DEFEAT: Your fleet was completely destroyed!'
        }
        gameMode={gameMode}
        onToggleGameMode={(m) => {
          setGameMode(m);
          resetGame(false);
        }}
        supportedModes={['remote', 'vs-cpu', 'pass-and-play']}
        onOpenRemoteModal={() => setShowRemoteModal(true)}
        latency={latency}
        turnTimeRemaining={turnTimeRemaining}
        isAwaitingServer={isAwaitingServer}
        peerPresence={peerPresence}
        localPlayer={localPlayer}
      />

      {/* Main Tabletop Board Container */}
      <main className="flex-1 min-h-0 w-full flex flex-col items-center justify-between p-1 sm:p-2.5 overflow-y-auto overflow-x-hidden relative">
        {/* Tactical Toast Alert */}
        {toastMessage && (
          <div className="absolute top-2 z-40 px-4 py-2 rounded-2xl bg-slate-900/95 border-2 border-cyan-400/80 text-cyan-200 text-xs sm:text-sm font-black tracking-wide shadow-2xl backdrop-blur-md animate-fade-in flex items-center gap-2">
            <span className="text-amber-400 text-base">⚓</span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* PHASE 1: FLEET DEPLOYMENT                                      */}
        {/* ============================================================== */}
        {phase === 'deploy' && (
          <div
            className={`w-full h-full max-w-4xl flex ${
              isLandscape ? 'flex-row' : 'flex-col md:flex-row'
            } items-center justify-center gap-2 sm:gap-4 overflow-hidden`}
          >
            {/* Ocean Grid Placement Board */}
            <div className="flex flex-col items-center justify-center min-h-0 flex-1 w-full max-w-md">
              <div className="flex items-center justify-between w-full max-w-[340px] sm:max-w-[380px] mb-1 px-1 text-xs">
                <span className="font-black text-cyan-300 uppercase tracking-widest text-[11px] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  Ocean Defense Tray (10x10)
                </span>
                <span className="text-stone-300 text-[11px] font-bold">
                  Ships Ready: <strong className="text-cyan-300">{p1Ships.length}</strong>/5
                </span>
              </div>

              {/* Physical Molded Blue Plastic Tray */}
              <div
                className={`relative aspect-square w-full max-w-[340px] sm:max-w-[380px] ${
                  isLandscape ? 'max-h-[220px] sm:max-h-[280px]' : 'max-h-[340px] sm:max-h-[380px]'
                } bg-[#0284c7] border-4 border-[#0369a1] rounded-2xl p-1.5 sm:p-2 shadow-[0_12px_28px_rgba(0,0,0,0.6),inset_0_2px_3px_rgba(255,255,255,0.4)] flex flex-col`}
              >
                {/* Column coordinate labels A-J */}
                <div className="flex w-full pl-5 pr-1 pb-1 text-[10px] font-bold text-white/90 drop-shadow-sm">
                  {COL_LABELS.map((col) => (
                    <div key={col} className="flex-1 text-center">
                      {col}
                    </div>
                  ))}
                </div>

                {/* 10x10 Grid Rows */}
                <div className="flex-1 w-full flex flex-col gap-0.5 min-h-0">
                  {Array.from({ length: GRID_SIZE }).map((_, r) => (
                    <div key={r} className="flex-1 flex items-center gap-0.5">
                      <span className="w-4 text-center text-[10px] font-bold text-white/90 drop-shadow-sm">
                        {ROW_LABELS[r]}
                      </span>

                      {Array.from({ length: GRID_SIZE }).map((_, c) => {
                        const shipData = getP1ShipAt(r, c);
                        const hullClasses = shipData
                          ? getShipHullClasses(shipData.ship.orientation, shipData.segmentIndex, shipData.ship.size)
                          : 'rounded-[4px]';
                        const isHovered =
                          hoverCoord &&
                          (() => {
                            const config = FLEET_CONFIG.find((s) => s.id === selectedShipId);
                            if (!config) return false;
                            if (deployOrientation === 'H') {
                              return (
                                hoverCoord.r === r &&
                                c >= hoverCoord.c &&
                                c < hoverCoord.c + config.size
                              );
                            } else {
                              return (
                                hoverCoord.c === c &&
                                r >= hoverCoord.r &&
                                r < hoverCoord.r + config.size
                              );
                            }
                          })();

                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => handleDeployCellClick(r, c)}
                            onMouseEnter={() => setHoverCoord({ r, c })}
                            onMouseLeave={() => setHoverCoord(null)}
                            disabled={p1Ready}
                            aria-label={`Sector ${COL_LABELS[c]}${ROW_LABELS[r]}`}
                            className={`flex-1 h-full relative flex items-center justify-center transition-all ${hullClasses} ${
                              shipData
                                ? 'bg-gradient-to-b from-[#94a3b8] via-[#64748b] to-[#475569] shadow-[0_2px_4px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.6)] border border-[#cbd5e1]'
                                : isHovered
                                ? 'bg-[#38bdf8]/60 border-2 border-white animate-pulse'
                                : 'bg-[#0284c7] border border-[#0369a1] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.15)] hover:bg-[#0ea5e9]'
                            }`}
                          >
                            {/* Pin Hole in center of tile / ship segment */}
                            <PlasticPinHole />
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Deployment Tool Dock */}
            <div
              className={`w-full max-w-sm ${
                isLandscape ? 'max-h-[250px] sm:max-h-[300px] p-2' : 'p-3'
              } flex flex-col justify-between gap-1.5 sm:gap-2 rounded-2xl bg-slate-900/90 border-2 border-cyan-500/40 shadow-2xl backdrop-blur-md`}
            >
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5">
                <span className="text-xs font-black uppercase text-cyan-200 tracking-wider">
                  Molded Fleet Dock
                </span>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    playTapSound();
                    setDeployOrientation((prev) => (prev === 'H' ? 'V' : 'H'));
                  }}
                  className="px-2.5 py-1 rounded-xl bg-cyan-950 border border-cyan-400/60 text-cyan-300 text-xs font-bold hover:bg-cyan-900/60 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <span>{deployOrientation === 'H' ? '↔ Horizontal' : '↕ Vertical'}</span>
                </button>
              </div>

              {/* Ship Roster List */}
              <div
                className={`flex flex-col gap-1 ${
                  isLandscape ? 'max-h-24 sm:max-h-36' : 'max-h-44'
                } overflow-y-auto pr-1`}
              >
                {FLEET_CONFIG.map((config) => {
                  const isPlaced = p1Ships.some((s) => s.id === config.id);
                  const isSelected = selectedShipId === config.id;

                  return (
                    <button
                      key={config.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        playTapSound();
                        setSelectedShipId(config.id);
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs transition-all ${
                        isSelected
                          ? 'bg-cyan-600/30 border-cyan-400 ring-2 ring-cyan-400/40 text-cyan-100 font-bold'
                          : isPlaced
                          ? 'bg-[#0f2942]/60 border-cyan-900/50 text-slate-300'
                          : 'bg-black/30 border-white/5 text-slate-400 hover:bg-cyan-950/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{config.icon}</span>
                        <div className="text-left">
                          <span className="block leading-tight font-semibold">{config.name}</span>
                          <span className="text-[10px] text-cyan-400/70">{config.size} Pin Holes</span>
                        </div>
                      </div>

                      {/* Visual Molded Ship Representation with Pin Holes */}
                      <div className="flex items-center gap-1 bg-[#475569] px-2 py-0.5 rounded-full border border-[#94a3b8]">
                        {Array.from({ length: config.size }).map((_, idx) => (
                          <div
                            key={idx}
                            className="w-1.5 h-1.5 rounded-full bg-[#0f172a] shadow-[inset_0_1px_1px_rgba(0,0,0,0.8)] border border-[#334155]"
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleRandomizeFleet}
                  disabled={p1Ready}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-600 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40"
                >
                  🎲 Auto-Deploy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmFleet}
                  disabled={p1Ready || p1Ships.length < 5}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:scale-95 text-white font-black text-xs uppercase tracking-wider shadow-lg transition-all disabled:opacity-40"
                >
                  {p1Ready ? '✓ Locked' : 'Ready for Battle'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PHASE 2: COMBAT ENGAGEMENT (REAL TOY BATTLESHIP VISUALS)       */}
        {/* ============================================================== */}
        {(phase === 'battle' || phase === 'game-over') && (
          <div className="w-full h-full flex flex-col items-center justify-between min-h-0">
            {/* Clamshell Case Switcher: Top Lid (Radar) vs Bottom Tray (Fleet) (Portrait Mode) */}
            {!isLandscape && (
              <div className="flex w-full max-w-sm mb-1.5 p-1 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-2 border-cyan-500/40 shadow-xl backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => handleSelectView('radar')}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'radar'
                      ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-[0_0_12px_rgba(225,29,72,0.6)] border border-rose-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <span>🎯 TOP LID • RADAR</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-black/40 text-[10px] text-rose-200 font-mono">
                    {enemySunkCount}/5 Sunk
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectView('fleet')}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'fleet'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.6)] border border-cyan-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <span>🛡️ BOTTOM TRAY • MY FLEET</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-black/40 text-[10px] text-cyan-200 font-mono">
                    {5 - p1SunkCount}/5 Left
                  </span>
                </button>
              </div>
            )}

            {/* Tactical Boards: Side-by-Side in Landscape, Clamshell-Flipped in Portrait */}
            <div
              className={`flex-1 min-h-0 w-full flex ${
                isLandscape ? 'flex-row' : 'flex-col'
              } items-center justify-center gap-2 sm:gap-6 overflow-hidden`}
            >
              {/* BOARD 1: TARGETING RADAR (Top Lid - Enemy Waters) - Insert Pegs into Blue Plastic Holes */}
              <div
                className={`flex-1 max-w-[320px] sm:max-w-[360px] flex flex-col items-center justify-center h-full max-h-full ${
                  isLandscape || activeTab === 'radar' ? 'flex' : 'hidden'
                }`}
              >
                <div className="flex items-center justify-between w-full max-w-[320px] sm:max-w-[360px] mb-1 px-1">
                  <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    Top Lid • Targeting Radar
                  </span>
                  {/* High-Contrast Peg Legend */}
                  <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-[10px] font-bold">
                    <span className="flex items-center gap-1 text-red-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600 border border-red-400 shadow-sm" /> Hit
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-500 shadow-sm" /> Miss
                    </span>
                  </div>
                </div>

                {/* Blue Plastic Molded Grid with Pin Holes and Red/Black Pegs */}
                <div
                  className={`relative aspect-square w-full max-w-[320px] sm:max-w-[360px] ${
                    isLandscape ? 'max-h-[200px] sm:max-h-[235px] md:max-h-[280px]' : 'max-h-[calc(100%-1.5rem)]'
                  } bg-[#0284c7] border-4 border-[#0369a1] rounded-2xl p-1.5 shadow-[0_10px_25px_rgba(0,0,0,0.6),inset_0_2px_3px_rgba(255,255,255,0.4)] flex flex-col`}
                >
                  {/* Column Labels */}
                  <div className="flex w-full pl-5 pr-1 text-[9px] font-bold text-white drop-shadow-sm">
                    {COL_LABELS.map((col) => (
                      <div key={col} className="flex-1 text-center">
                        {col}
                      </div>
                    ))}
                  </div>

                  {/* 10x10 Peg Grid */}
                  <div className="flex-1 w-full flex flex-col gap-0.5 min-h-0">
                    {Array.from({ length: GRID_SIZE }).map((_, r) => (
                      <div key={r} className="flex-1 flex items-center gap-0.5">
                        <span className="w-4 text-center text-[9px] font-bold text-white drop-shadow-sm">
                          {ROW_LABELS[r]}
                        </span>
                        {Array.from({ length: GRID_SIZE }).map((_, c) => {
                          const peg = p1Radar[r][c];
                          const enemyGhostShip =
                            phase === 'game-over' && gameMode === 'vs-cpu' ? getEnemyShipAt(r, c) : null;

                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => handleFireSalvo(r, c)}
                              disabled={peg !== 'empty' || turn !== 1 || isProcessingShot || phase === 'game-over'}
                              aria-label={`Fire at ${COL_LABELS[c]}${ROW_LABELS[r]}`}
                              className={`flex-1 h-full rounded-[4px] relative flex items-center justify-center transition-all ${
                                peg === 'hit'
                                  ? 'bg-rose-950/70 border-2 border-red-500 shadow-inner'
                                  : peg === 'miss'
                                  ? 'bg-slate-900/80 border-2 border-slate-700 shadow-inner'
                                  : enemyGhostShip
                                  ? 'bg-[#334155] border border-amber-400/80 shadow-inner'
                                  : 'bg-[#0284c7] border border-[#0369a1] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.15)] hover:bg-[#0ea5e9]'
                              } ${
                                peg === 'empty' && turn === 1 && !isProcessingShot && phase !== 'game-over'
                                  ? 'cursor-pointer active:scale-95'
                                  : 'cursor-default'
                              }`}
                            >
                              {peg === 'hit' ? (
                                <RedPeg />
                              ) : peg === 'miss' ? (
                                <BlackPeg />
                              ) : enemyGhostShip ? (
                                <span className="text-[10px] opacity-80" title={`Surviving ${enemyGhostShip.ship.name}`}>
                                  ⚓
                                </span>
                              ) : (
                                <PlasticPinHole />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Landscape: Enemy Fleet Roster directly beneath Targeting Radar */}
                {isLandscape && (
                  <div className="w-full max-w-[320px] sm:max-w-[360px] mt-1">
                    {renderEnemyFleetRoster()}
                  </div>
                )}
              </div>

              {/* BOARD 2: MY FLEET (Bottom Tray - Friendly Ocean) - Gray Plastic Warships with Inserted Hit Pegs */}
              <div
                className={`flex-1 max-w-[320px] sm:max-w-[360px] flex flex-col items-center justify-center h-full max-h-full ${
                  isLandscape || activeTab === 'fleet' ? 'flex' : 'hidden'
                }`}
              >
                <div className="flex items-center justify-between w-full max-w-[320px] sm:max-w-[360px] mb-1 px-1">
                  <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    Bottom Tray • Ocean Grid (My Fleet)
                  </span>
                  <span className="text-[10px] text-slate-300 font-mono">
                    Surviving: <strong className="text-cyan-300">{5 - p1SunkCount}</strong>/5
                  </span>
                </div>

                {/* Ocean Board with Gray Ships and Pegs */}
                <div
                  className={`relative aspect-square w-full max-w-[320px] sm:max-w-[360px] ${
                    isLandscape ? 'max-h-[200px] sm:max-h-[235px] md:max-h-[280px]' : 'max-h-[calc(100%-1.5rem)]'
                  } bg-[#0284c7] border-4 border-[#0369a1] rounded-2xl p-1.5 shadow-[0_10px_25px_rgba(0,0,0,0.6),inset_0_2px_3px_rgba(255,255,255,0.4)] flex flex-col`}
                >
                  {/* Column Labels */}
                  <div className="flex w-full pl-5 pr-1 text-[9px] font-bold text-white drop-shadow-sm">
                    {COL_LABELS.map((col) => (
                      <div key={col} className="flex-1 text-center">
                        {col}
                      </div>
                    ))}
                  </div>

                  {/* 10x10 Defense Grid */}
                  <div className="flex-1 w-full flex flex-col gap-0.5 min-h-0">
                    {Array.from({ length: GRID_SIZE }).map((_, r) => (
                      <div key={r} className="flex-1 flex items-center gap-0.5">
                        <span className="w-4 text-center text-[9px] font-bold text-white drop-shadow-sm">
                          {ROW_LABELS[r]}
                        </span>
                        {Array.from({ length: GRID_SIZE }).map((_, c) => {
                          const shipData = getP1ShipAt(r, c);
                          const peg = p1HitsReceived[r][c];
                          const hullClasses = shipData
                            ? getShipHullClasses(shipData.ship.orientation, shipData.segmentIndex, shipData.ship.size)
                            : 'rounded-[4px]';

                          return (
                            <div
                              key={c}
                              className={`flex-1 h-full relative flex items-center justify-center transition-all ${hullClasses} ${
                                shipData
                                  ? peg === 'hit'
                                    ? 'bg-gradient-to-b from-[#94a3b8] via-[#64748b] to-[#475569] border-2 border-rose-400 ring-2 ring-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.7)]'
                                    : 'bg-gradient-to-b from-[#94a3b8] via-[#64748b] to-[#475569] shadow-[0_2px_4px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.6)] border border-[#cbd5e1]'
                                  : peg === 'miss'
                                  ? 'bg-slate-900/80 border-2 border-slate-700 shadow-inner'
                                  : 'bg-[#0284c7] border border-[#0369a1] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.15)]'
                              }`}
                            >
                              {/* If hit on ship: Red Peg inserted into ship's hole! */}
                              {peg === 'hit' ? (
                                <RedPeg />
                              ) : peg === 'miss' ? (
                                /* Black peg inserted into water hole */
                                <BlackPeg />
                              ) : (
                                /* Empty pin hole */
                                <PlasticPinHole />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Landscape: Friendly Fleet Roster directly beneath Ocean Defense */}
                {isLandscape && (
                  <div className="w-full max-w-[320px] sm:max-w-[360px] mt-1">
                    {renderFriendlyFleetRoster()}
                  </div>
                )}
              </div>
            </div>

            {/* Portrait Mode: Clamshell Roster Bar */}
            {!isLandscape && (
              <div className="w-full max-w-sm mt-1 flex flex-col gap-1">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-xl border border-white/10 text-[11px] w-full">
                    <button
                      type="button"
                      onClick={() => handleSelectView('radar')}
                      className={`flex-1 py-1 px-2 rounded-lg font-black transition-all flex items-center justify-center gap-1 ${
                        activeTab === 'radar'
                          ? 'bg-rose-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>🎯 Top Lid • Radar ({enemySunkCount}/5 Sunk)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectView('fleet')}
                      className={`flex-1 py-1 px-2 rounded-lg font-black transition-all flex items-center justify-center gap-1 ${
                        activeTab === 'fleet'
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>🛡️ Bottom Tray • My Fleet ({5 - p1SunkCount}/5 Left)</span>
                    </button>
                  </div>
                </div>

                {activeTab === 'radar' ? renderEnemyFleetRoster() : renderFriendlyFleetRoster()}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* PHASE 3: GAME OVER VICTORY / DEFEAT MODAL                      */}
        {/* ============================================================== */}
        {phase === 'game-over' && showGameOverModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
            <div
              className={`w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl p-4 sm:p-6 flex flex-col items-center gap-3 text-center shadow-2xl border-4 ${
                isLocalWinner
                  ? 'bg-gradient-to-b from-[#064e3b]/95 via-[#042f2e]/98 to-[#022c22] border-emerald-400 shadow-[0_0_50px_rgba(16,185,129,0.35)]'
                  : 'bg-gradient-to-b from-[#4c0519]/95 via-[#3b0714]/98 to-[#1c040b] border-rose-500 shadow-[0_0_50px_rgba(244,63,94,0.35)]'
              }`}
            >
              {/* Massive Winner / Loser Crown or Skull */}
              <div
                className={`w-18 h-18 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-4xl sm:text-5xl border-4 shadow-xl ${
                  isLocalWinner
                    ? 'bg-emerald-500/30 border-emerald-300 text-yellow-300 animate-bounce'
                    : 'bg-rose-600/30 border-rose-400 text-rose-200'
                }`}
              >
                {isLocalWinner ? '🏆' : '💀'}
              </div>

              {/* UNMISTAKABLE VICTORY / DEFEAT HEADLINES */}
              <div>
                <div
                  className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-black tracking-widest uppercase mb-1 border ${
                    isLocalWinner
                      ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-300'
                      : 'bg-rose-950/80 border-rose-400/60 text-rose-300'
                  }`}
                >
                  {isLocalWinner ? 'NAVAL VICTORY' : 'FLEET DESTROYED'}
                </div>

                <h2
                  className={`text-3xl sm:text-4xl font-black uppercase tracking-wider drop-shadow-md ${
                    isLocalWinner ? 'text-emerald-300' : 'text-rose-400'
                  }`}
                >
                  {isLocalWinner ? 'YOU WON!' : 'YOU LOST!'}
                </h2>

                <p className="text-xs sm:text-sm text-slate-200 mt-1 max-w-sm">
                  {isLocalWinner
                    ? 'Outstanding Admiral! You located and sank all 5 enemy warships!'
                    : `${
                        gameMode === 'vs-cpu' ? 'The CPU' : 'Enemy Admiral'
                      } bombarded and sank all 5 of your warships!`}
                </p>
              </div>

              {/* SIDE-BY-SIDE FLEET SURVIVAL BREAKDOWN */}
              <div className="w-full grid grid-cols-2 gap-2 text-xs">
                {/* Your Fleet Box */}
                <div
                  className={`p-2.5 rounded-2xl border flex flex-col items-center gap-1 ${
                    isLocalWinner
                      ? 'bg-emerald-950/60 border-emerald-500/40'
                      : 'bg-slate-900/80 border-slate-700'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase text-cyan-300 tracking-wider">
                    Your Fleet
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`text-xl font-black font-mono ${
                        5 - p1SunkCount > 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {5 - p1SunkCount}
                    </span>
                    <span className="text-slate-400 text-xs font-bold">/ 5 Left</span>
                  </div>
                  {/* List of Your Ships */}
                  <div className="flex flex-col gap-0.5 w-full text-[10px] text-left pt-1 border-t border-white/10">
                    {FLEET_CONFIG.map((s) => {
                      const p1s = p1Ships.find((x) => x.id === s.id);
                      const sunk = p1s?.sunk ?? false;
                      return (
                        <div key={s.id} className="flex items-center justify-between">
                          <span className={sunk ? 'line-through text-slate-500' : 'text-emerald-200 font-semibold'}>
                            {s.icon} {s.name}
                          </span>
                          <span className={`font-bold text-[9px] ${sunk ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {sunk ? 'SUNK' : 'SURVIVED'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Enemy Fleet Box */}
                <div
                  className={`p-2.5 rounded-2xl border flex flex-col items-center gap-1 ${
                    !isLocalWinner
                      ? 'bg-rose-950/60 border-rose-500/40'
                      : 'bg-slate-900/80 border-slate-700'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase text-rose-300 tracking-wider">
                    {gameMode === 'vs-cpu' ? 'CPU Fleet' : 'Enemy Fleet'}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`text-xl font-black font-mono ${
                        5 - enemySunkCount > 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {5 - enemySunkCount}
                    </span>
                    <span className="text-slate-400 text-xs font-bold">/ 5 Left</span>
                  </div>
                  {/* List of Enemy Ships */}
                  <div className="flex flex-col gap-0.5 w-full text-[10px] text-left pt-1 border-t border-white/10">
                    {FLEET_CONFIG.map((s) => {
                      const sunk = isEnemyShipSunk(s.id);
                      return (
                        <div key={s.id} className="flex items-center justify-between">
                          <span className={sunk ? 'line-through text-slate-500' : 'text-rose-200 font-semibold'}>
                            {s.icon} {s.name}
                          </span>
                          <span className={`font-bold text-[9px] ${sunk ? 'text-rose-400' : 'text-cyan-400'}`}>
                            {sunk ? 'SUNK' : 'SURVIVED'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Engagement Stats */}
              <div className="w-full grid grid-cols-4 gap-1 py-1.5 px-2 rounded-2xl bg-black/40 border border-white/10 text-xs">
                <div className="flex flex-col items-center">
                  <span className="text-slate-400 text-[9px] uppercase tracking-wider font-bold">Salvos</span>
                  <span className="font-mono font-bold text-cyan-300 text-sm">{p1ShotsCount}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-slate-400 text-[9px] uppercase tracking-wider font-bold">Hits</span>
                  <span className="font-mono font-bold text-rose-400 text-sm">{p1HitsCount}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-slate-400 text-[9px] uppercase tracking-wider font-bold">Misses</span>
                  <span className="font-mono font-bold text-slate-300 text-sm">
                    {Math.max(0, p1ShotsCount - p1HitsCount)}
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-slate-400 text-[9px] uppercase tracking-wider font-bold">Accuracy</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {p1ShotsCount > 0 ? Math.round((p1HitsCount / p1ShotsCount) * 100) : 0}%
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 w-full pt-1">
                <button
                  type="button"
                  onClick={() => setShowGameOverModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-600 font-bold text-xs uppercase tracking-wider transition-all"
                >
                  🔍 Inspect Board
                </button>
                <button
                  type="button"
                  onClick={() => resetGame(false)}
                  className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all text-white ${
                    isLocalWinner
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400'
                      : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500'
                  }`}
                >
                  🔄 Play Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating post-game banner if user is inspecting board */}
        {phase === 'game-over' && !showGameOverModal && (
          <div className="absolute bottom-3 z-40 px-4 py-2 rounded-2xl bg-slate-900/95 border-2 border-cyan-400 shadow-2xl flex items-center gap-3">
            <span className={`font-black text-xs ${isLocalWinner ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isLocalWinner ? '🏆 YOU WON!' : '💀 YOU LOST!'}
            </span>
            <button
              type="button"
              onClick={() => setShowGameOverModal(true)}
              className="px-3 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-xs font-bold text-white transition-all"
            >
              📊 Show Results
            </button>
            <button
              type="button"
              onClick={() => resetGame(false)}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-all"
            >
              🔄 Rematch
            </button>
          </div>
        )}
      </main>

      {/* Online Remote Duel Modal */}
      <RemoteDuelModal
        isOpen={showRemoteModal}
        onClose={() => setShowRemoteModal(false)}
      />
    </div>
  );
};

export default Battleship;
