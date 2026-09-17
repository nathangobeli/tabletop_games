import React, { useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import {
  triggerHaptic,
  playStoneSlideSound,
  playVictorySound,
} from '../utils/feedback';

// 11 Nodes with (x, y) coordinates on a 400x360 canvas
interface NodeCoord {
  id: number;
  col: number;
  x: number;
  y: number;
}

const NODES: NodeCoord[] = [
  { id: 0, col: 0, x: 50, y: 180 },   // Left vertex
  { id: 1, col: 1, x: 130, y: 80 },   // Col 1 Top
  { id: 2, col: 1, x: 130, y: 180 },  // Col 1 Mid
  { id: 3, col: 1, x: 130, y: 280 },  // Col 1 Bot
  { id: 4, col: 2, x: 210, y: 80 },   // Col 2 Top
  { id: 5, col: 2, x: 210, y: 180 },  // Col 2 Mid
  { id: 6, col: 2, x: 210, y: 280 },  // Col 2 Bot
  { id: 7, col: 3, x: 290, y: 80 },   // Col 3 Top
  { id: 8, col: 3, x: 290, y: 180 },  // Col 3 Mid
  { id: 9, col: 3, x: 290, y: 280 },  // Col 3 Bot
  { id: 10, col: 4, x: 370, y: 180 }, // Right vertex
];

// Undirected Graph Edges
const EDGES: [number, number][] = [
  // Col 0 to Col 1
  [0, 1], [0, 2], [0, 3],
  // Col 1 Verticals
  [1, 2], [2, 3],
  // Col 1 to Col 2
  [1, 4], [1, 5],
  [2, 5],
  [3, 5], [3, 6],
  // Col 2 Verticals
  [4, 5], [5, 6],
  // Col 2 to Col 3
  [4, 7], [4, 8],
  [5, 7], [5, 8], [5, 9],
  [6, 8], [6, 9],
  // Col 3 Verticals
  [7, 8], [8, 9],
  // Col 3 to Col 4
  [7, 10], [8, 10], [9, 10],
];

// Build Adjacency List
const ADJACENCY: number[][] = Array.from({ length: 11 }, () => []);
EDGES.forEach(([u, v]) => {
  ADJACENCY[u].push(v);
  ADJACENCY[v].push(u);
});

export const HareAndHounds: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();

  // Initial token positions: Hounds at nodes 0, 1, 3; Hare at node 10
  const [hounds, setHounds] = useState<number[]>([0, 1, 3]);
  const [hare, setHare] = useState<number>(10);
  const [turn, setTurn] = useState<PlayerNumber>(1); // P1 = Hounds, P2 = Hare
  const [selectedHound, setSelectedHound] = useState<number | null>(null);
  const [winner, setWinner] = useState<PlayerNumber | null>(null);
  const [stagnationCounter, setStagnationCounter] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('Player 1 (Hounds): Select a bronze hound to advance');

  // Check if Hare has any legal moves
  const getHareLegalMoves = useCallback(
    (harePos: number, houndPositions: number[]): number[] => {
      return ADJACENCY[harePos].filter((dest) => !houndPositions.includes(dest));
    },
    []
  );

  // Check if a specific Hound can move to destination
  const isLegalHoundMove = (from: number, to: number): boolean => {
    if (!ADJACENCY[from].includes(to)) return false;
    if (hounds.includes(to) || hare === to) return false;

    // Hounds cannot move backward (to a smaller column)
    const fromCol = NODES[from].col;
    const toCol = NODES[to].col;
    return toCol >= fromCol;
  };

  // Node Click Interaction
  const handleNodeClick = (nodeId: number) => {
    if (winner !== null) return;

    if (turn === 1) {
      // --- PLAYER 1 (HOUNDS) TURN ---
      if (hounds.includes(nodeId)) {
        // Selecting a Hound
        triggerHaptic('light');
        setSelectedHound(nodeId);
        setStatusMessage(`Hound selected! Tap an adjacent forward or vertical node.`);
      } else if (selectedHound !== null) {
        // Moving selected hound
        if (!isLegalHoundMove(selectedHound, nodeId)) {
          triggerHaptic('medium');
          return;
        }

        triggerHaptic('light');
        playStoneSlideSound();

        const fromCol = NODES[selectedHound].col;
        const toCol = NODES[nodeId].col;
        const advanced = toCol > fromCol;

        const newHounds = hounds.map((h) => (h === selectedHound ? nodeId : h));
        setHounds(newHounds);
        setSelectedHound(null);

        // Update stagnation counter (resets if any hound advanced)
        const nextStag = advanced ? 0 : stagnationCounter + 1;
        setStagnationCounter(nextStag);

        // Check Stagnation win for Hare (10 vertical/stagnant moves)
        if (nextStag >= 10) {
          setWinner(2);
          playVictorySound();
          setStatusMessage('Hare wins! Hounds failed to advance forward within 10 moves.');
          setGameStatus('finished');
          return;
        }

        // Check if Hare is trapped (0 legal moves)
        const hareMoves = getHareLegalMoves(hare, newHounds);
        if (hareMoves.length === 0) {
          setWinner(1);
          playVictorySound();
          setStatusMessage('Hounds win! The Hare is completely immobilized and trapped.');
          setGameStatus('finished');
          return;
        }

        // Pass turn to Hare (Player 2)
        setTurn(2);
        setStatusMessage(`Player 2 (Hare): Move the copper hare.`);
        setGameStatus('active');
      }
    } else {
      // --- PLAYER 2 (HARE) TURN ---
      const legalMoves = getHareLegalMoves(hare, hounds);
      if (!legalMoves.includes(nodeId)) {
        triggerHaptic('medium');
        return;
      }

      triggerHaptic('light');
      playStoneSlideSound();

      setHare(nodeId);

      // Check if Hare slipped past the Hounds
      const minHoundCol = Math.min(...hounds.map((h) => NODES[h].col));
      const hareCol = NODES[nodeId].col;

      if (hareCol <= minHoundCol) {
        setWinner(2);
        playVictorySound();
        setStatusMessage('Hare wins! Successfully escaped past the hound line.');
        setGameStatus('finished');
        return;
      }

      // Check if hounds have any legal moves
      let houndsCanMove = false;
      for (const h of hounds) {
        for (const dest of ADJACENCY[h]) {
          if (dest !== nodeId && !hounds.includes(dest) && NODES[dest].col >= NODES[h].col) {
            houndsCanMove = true;
            break;
          }
        }
        if (houndsCanMove) break;
      }

      if (!houndsCanMove) {
        setWinner(2);
        playVictorySound();
        setStatusMessage('Hare wins! Hounds are blocked and cannot move forward.');
        setGameStatus('finished');
        return;
      }

      // Pass turn to Hounds (Player 1)
      setTurn(1);
      setStatusMessage(`Player 1 (Hounds): Select a bronze hound to advance.`);
      setGameStatus('active');
    }
  };

  const handleRestart = () => {
    setHounds([0, 1, 3]);
    setHare(10);
    setTurn(1);
    setSelectedHound(null);
    setWinner(null);
    setStagnationCounter(0);
    setStatusMessage('Player 1 (Hounds): Select a bronze hound to advance');
    setGameStatus('active');
  };

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden select-none">
      <GameHeader
        gameId="hare-and-hounds"
        gameName="Hare and Hounds"
        turn={turn}
        onRestart={resetGame}
        statusMessage={statusMessage}
      />

      {/* Main Track Arena */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden">
        {/* Status Tracker Bar */}
        <div className="w-full max-w-md flex items-center justify-between px-3 py-1.5 bg-container-dark/95 border border-[#3e444c] rounded-2xl shadow-xl mb-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-[#78350f] border border-[#b45309] inline-block shadow-sm" />
            <span className="font-bold text-amber-300">P1: 3 Hounds</span>
          </div>
          <span className="text-[10px] font-black uppercase text-accent-light/70">
            Stagnation: {stagnationCounter}/10
          </span>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-orange-300">P2: 1 Hare</span>
            <span className="w-3.5 h-3.5 rounded-full bg-[#ea580c] border border-[#fed7aa] inline-block shadow-sm" />
          </div>
        </div>

        {/* Carved Stone Slab SVG Board */}
        <div className="relative flex items-center justify-center max-h-[68vh] aspect-[420/360] clubhouse-board-depth table-flat rounded-3xl overflow-hidden shadow-2xl border-4 border-[#334155] bg-[#1e293b]">
          <svg viewBox="0 0 420 360" className="w-full h-full touch-none select-none">
            <defs>
              {/* Stone Slab Texture Gradient */}
              <linearGradient id="stoneSlab" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#475569" />
                <stop offset="50%" stopColor="#334155" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>

              {/* Bronze Hound Gradient */}
              <radialGradient id="houndBronze" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#d97706" />
                <stop offset="60%" stopColor="#78350f" />
                <stop offset="100%" stopColor="#451a03" />
              </radialGradient>

              {/* Gleaming Copper Hare Gradient */}
              <radialGradient id="hareCopper" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#ffedd5" />
                <stop offset="35%" stopColor="#fb923c" />
                <stop offset="80%" stopColor="#c2410c" />
                <stop offset="100%" stopColor="#7c2d12" />
              </radialGradient>
            </defs>

            {/* Background Stone Slab */}
            <rect width="420" height="360" fill="url(#stoneSlab)" />

            {/* Carved Runic Connecting Edges */}
            {EDGES.map(([u, v], idx) => {
              const nu = NODES[u];
              const nv = NODES[v];
              return (
                <line
                  key={idx}
                  x1={nu.x}
                  y1={nu.y}
                  x2={nv.x}
                  y2={nv.y}
                  stroke="#64748b"
                  strokeWidth="4"
                  strokeLinecap="round"
                  opacity="0.8"
                />
              );
            })}

            {/* 11 Track Nodes & Tokens */}
            {NODES.map((node) => {
              const isHound = hounds.includes(node.id);
              const isHare = hare === node.id;
              const isSelected = selectedHound === node.id;

              const isLegalTarget =
                (turn === 1 && selectedHound !== null && isLegalHoundMove(selectedHound, node.id)) ||
                (turn === 2 && getHareLegalMoves(hare, hounds).includes(node.id));

              return (
                <g key={node.id} onClick={() => handleNodeClick(node.id)} className="cursor-pointer">
                  {/* Carved Stone Socket */}
                  <circle cx={node.x} cy={node.y} r="16" fill="#0f172a" stroke="#475569" strokeWidth="2" />
                  <circle cx={node.x} cy={node.y} r="13" fill="#1e293b" />

                  {/* Empty Node Legal Target Highlight */}
                  {isLegalTarget && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="19"
                      fill="transparent"
                      stroke={turn === 1 ? '#eab308' : '#38bdf8'}
                      strokeWidth="3"
                      strokeDasharray="4 3"
                      className="animate-pulse"
                    />
                  )}

                  {/* Bronze Hound Token (Player 1) */}
                  {isHound && (
                    <g>
                      <ellipse cx={node.x + 1} cy={node.y + 3} rx="14" ry="8" fill="rgba(0,0,0,0.5)" />
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r="14"
                        fill="url(#houndBronze)"
                        stroke="#b45309"
                        strokeWidth="1.8"
                      />
                      {/* Brass Rim & Dog Paw / Collar Insignia */}
                      <circle cx={node.x} cy={node.y} r="9" fill="none" stroke="#d97706" strokeWidth="0.8" />
                      <circle cx={node.x} cy={node.y} r="3" fill="#fbbf24" />

                      {/* Selection Aura */}
                      {isSelected && (
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r="18"
                          fill="none"
                          stroke="#60a5fa"
                          strokeWidth="2.5"
                          className="animate-pulse"
                        />
                      )}
                    </g>
                  )}

                  {/* Gleaming Copper Hare Token (Player 2) */}
                  {isHare && (
                    <g>
                      <ellipse cx={node.x + 1} cy={node.y + 3} rx="15" ry="9" fill="rgba(0,0,0,0.5)" />
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r="15"
                        fill="url(#hareCopper)"
                        stroke="#fed7aa"
                        strokeWidth="2"
                      />
                      {/* Hare Ear Silhouette */}
                      <path
                        d={`M${node.x - 4} ${node.y + 4} Q${node.x - 6} ${node.y - 8} ${node.x - 2} ${node.y - 8} Q${node.x} ${node.y - 2} ${node.x} ${node.y + 4}`}
                        fill="#ffedd5"
                      />
                      <path
                        d={`M${node.x + 1} ${node.y + 4} Q${node.x + 3} ${node.y - 8} ${node.x + 6} ${node.y - 8} Q${node.x + 5} ${node.y - 2} ${node.x + 3} ${node.y + 4}`}
                        fill="#ffedd5"
                      />
                      <circle cx={node.x} cy={node.y + 4} r="2.5" fill="#ffedd5" />
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </main>

      {/* Game Over Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="Hare and Hounds"
          onRestart={handleRestart}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};

export default HareAndHounds;
