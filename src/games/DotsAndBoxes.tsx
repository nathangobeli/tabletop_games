import React, { useState, useCallback, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import { triggerHaptic, playTapSound, playCaptureSound } from '../utils/feedback';

// 4x4 Dots grid -> 3x3 array of 9 capturable boxes
// Horizontal edges: 4 rows of 3 segments = 12 total
// Vertical edges: 3 rows of 4 segments = 12 total
// Boxes: 3 rows of 3 boxes = 9 total

type EdgeState = 0 | 1 | 2; // 0 = unselected, 1 = P1, 2 = P2
type BoxState = 0 | 1 | 2;  // 0 = unclaimed, 1 = P1, 2 = P2

export const DotsAndBoxes: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();

  // Horizontal edges: [row 0..3][col 0..2]
  const [hEdges, setHEdges] = useState<EdgeState[][]>(() =>
    Array.from({ length: 4 }, () => Array(3).fill(0))
  );

  // Vertical edges: [row 0..2][col 0..3]
  const [vEdges, setVEdges] = useState<EdgeState[][]>(() =>
    Array.from({ length: 3 }, () => Array(4).fill(0))
  );

  // Claimed boxes: [row 0..2][col 0..2]
  const [boxes, setBoxes] = useState<BoxState[][]>(() =>
    Array.from({ length: 3 }, () => Array(3).fill(0))
  );

  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [winner, setWinner] = useState<PlayerNumber | 'draw' | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Player 1 (Blue): Connect two dots');
  const [lastBoxClaimed, setLastBoxClaimed] = useState<boolean>(false);

  // Score count: number of claimed boxes
  const scoreP1 = useMemo(() => {
    return boxes.flat().filter((b) => b === 1).length;
  }, [boxes]);

  const scoreP2 = useMemo(() => {
    return boxes.flat().filter((b) => b === 2).length;
  }, [boxes]);

  const resetGame = useCallback(() => {
    setHEdges(Array.from({ length: 4 }, () => Array(3).fill(0)));
    setVEdges(Array.from({ length: 3 }, () => Array(4).fill(0)));
    setBoxes(Array.from({ length: 3 }, () => Array(3).fill(0)));
    setTurn(1);
    setWinner(null);
    setStatusMessage('Player 1 (Blue): Connect two dots');
    setLastBoxClaimed(false);
    setShowTurnTransition(false);
    setGameStatus('active');
  }, [setGameStatus]);

  // Check which boxes are completed by a given edge addition
  const checkCompletedBoxes = (
    nextHEdges: EdgeState[][],
    nextVEdges: EdgeState[][],
    currentBoxes: BoxState[][],
    claimingPlayer: PlayerNumber
  ): { updatedBoxes: BoxState[][]; claimedCount: number } => {
    const updated = currentBoxes.map((row) => [...row]);
    let count = 0;

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (updated[r][c] === 0) {
          const topEdge = nextHEdges[r][c] !== 0;
          const bottomEdge = nextHEdges[r + 1][c] !== 0;
          const leftEdge = nextVEdges[r][c] !== 0;
          const rightEdge = nextVEdges[r][c + 1] !== 0;

          if (topEdge && bottomEdge && leftEdge && rightEdge) {
            updated[r][c] = claimingPlayer;
            count++;
          }
        }
      }
    }

    return { updatedBoxes: updated, claimedCount: count };
  };

  const handleHorizontalClick = useCallback((r: number, c: number) => {
    if (winner !== null || hEdges[r][c] !== 0) return;

    triggerHaptic('light');
    playTapSound();

    const nextHEdges = hEdges.map((row) => [...row]);
    nextHEdges[r][c] = turn;

    const { updatedBoxes, claimedCount } = checkCompletedBoxes(nextHEdges, vEdges, boxes, turn);

    if (claimedCount > 0) {
      playCaptureSound();
      triggerHaptic('medium');
    }

    setHEdges(nextHEdges);
    setBoxes(updatedBoxes);

    const totalClaimed = updatedBoxes.flat().filter((b) => b !== 0).length;

    if (totalClaimed === 9) {
      // Game Over
      const p1Total = updatedBoxes.flat().filter((b) => b === 1).length;
      const p2Total = updatedBoxes.flat().filter((b) => b === 2).length;

      let winResult: PlayerNumber | 'draw' = 'draw';
      let msg = `Game Over! Tie game (${p1Total} - ${p2Total})`;
      if (p1Total > p2Total) {
        winResult = 1;
        msg = `🎉 Player 1 Wins with ${p1Total} boxes!`;
      } else if (p2Total > p1Total) {
        winResult = 2;
        msg = `🎉 Player 2 Wins with ${p2Total} boxes!`;
      }

      setWinner(winResult);
      setStatusMessage(msg);
      setGameStatus('finished');
      return;
    }

    if (claimedCount > 0) {
      setLastBoxClaimed(true);
      setStatusMessage(`Box completed! Player ${turn} gets an extra turn!`);
    } else {
      setLastBoxClaimed(false);
      const nextPlayer: PlayerNumber = turn === 1 ? 2 : 1;
      setTurn(nextPlayer);
      setGameStatus('active');
      setStatusMessage(`Player ${nextPlayer}'s turn.`);
    }
  }, [hEdges, vEdges, boxes, turn, winner, setGameStatus]);

  const handleVerticalClick = useCallback((r: number, c: number) => {
    if (winner !== null || vEdges[r][c] !== 0) return;

    triggerHaptic('light');
    playTapSound();

    const nextVEdges = vEdges.map((row) => [...row]);
    nextVEdges[r][c] = turn;

    const { updatedBoxes, claimedCount } = checkCompletedBoxes(hEdges, nextVEdges, boxes, turn);

    if (claimedCount > 0) {
      playCaptureSound();
      triggerHaptic('medium');
    }

    setVEdges(nextVEdges);
    setBoxes(updatedBoxes);

    const totalClaimed = updatedBoxes.flat().filter((b) => b !== 0).length;

    if (totalClaimed === 9) {
      // Game Over
      const p1Total = updatedBoxes.flat().filter((b) => b === 1).length;
      const p2Total = updatedBoxes.flat().filter((b) => b === 2).length;

      let winResult: PlayerNumber | 'draw' = 'draw';
      let msg = `Game Over! Tie game (${p1Total} - ${p2Total})`;
      if (p1Total > p2Total) {
        winResult = 1;
        msg = `🎉 Player 1 Wins with ${p1Total} boxes!`;
      } else if (p2Total > p1Total) {
        winResult = 2;
        msg = `🎉 Player 2 Wins with ${p2Total} boxes!`;
      }

      setWinner(winResult);
      setStatusMessage(msg);
      setGameStatus('finished');
      return;
    }

    if (claimedCount > 0) {
      setLastBoxClaimed(true);
      setStatusMessage(`Box completed! Player ${turn} gets an extra turn!`);
    } else {
      setLastBoxClaimed(false);
      const nextPlayer: PlayerNumber = turn === 1 ? 2 : 1;
      setTurn(nextPlayer);
      setGameStatus('active');
      setStatusMessage(`Player ${nextPlayer}'s turn.`);
    }
  }, [hEdges, vEdges, boxes, turn, winner, setGameStatus]);

  // Coordinate math for SVG 4x4 Grid
  // Grid coordinates: 4 points across 300x300 viewBox
  const DOT_COORDS = [40, 113.3, 186.6, 260];

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden">
      <GameHeader
        title="Dots and Boxes"
        subtitle="Territory Capture"
        turn={turn}
        scoreP1={`${scoreP1} boxes`}
        scoreP2={`${scoreP2} boxes`}
        p1Label="P1 (Blue)"
        p2Label="P2 (Red)"
        onRestart={resetGame}
        statusMessage={statusMessage}
      />

      {/* Main Interactive Grid Viewport - Responsive on iPhone, iPad, PC */}
      <main className="flex-1 flex flex-col items-center justify-center p-2.5 sm:p-4 md:p-6">
        <div className="w-full max-w-xs sm:max-w-md md:max-w-lg aspect-square bg-accent-light rounded-3xl sm:rounded-[36px] p-3 sm:p-5 clubhouse-board-depth border-4 sm:border-6 border-[#d8c3a5] flex items-center justify-center relative">
          
          <svg viewBox="0 0 300 300" className="w-full h-full select-none">
            {/* Background grid paper styling */}
            <rect x="15" y="15" width="270" height="270" rx="16" fill="#ffffff" stroke="#f1f5f9" strokeWidth="2" />

            {/* 1. Claimed Boxes (3x3) */}
            {boxes.map((row, r) =>
              row.map((box, c) => {
                if (box === 0) return null;
                const x = DOT_COORDS[c] + 4;
                const y = DOT_COORDS[r] + 4;
                const size = DOT_COORDS[c + 1] - DOT_COORDS[c] - 8;

                return (
                  <g key={`box-${r}-${c}`}>
                    <rect
                      x={x}
                      y={y}
                      width={size}
                      height={size}
                      rx="8"
                      fill={box === 1 ? '#3b82f6' : '#ef4444'}
                      fillOpacity="0.22"
                    />
                    <text
                      x={x + size / 2}
                      y={y + size / 2 + 5}
                      textAnchor="middle"
                      fill={box === 1 ? '#2563eb' : '#dc2626'}
                      fontSize="16"
                      fontWeight="bold"
                      fontFamily="Outfit, sans-serif"
                    >
                      P{box}
                    </text>
                  </g>
                );
              })
            )}

            {/* 2. Horizontal Edge Hitboxes & Lines (4 rows x 3 cols) */}
            {hEdges.map((row, r) =>
              row.map((edge, c) => {
                const x1 = DOT_COORDS[c];
                const x2 = DOT_COORDS[c + 1];
                const y = DOT_COORDS[r];
                const isSelected = edge !== 0;

                return (
                  <g key={`h-${r}-${c}`}>
                    {/* Generous touch target hitbox */}
                    <line
                      x1={x1}
                      y1={y}
                      x2={x2}
                      y2={y}
                      stroke="transparent"
                      strokeWidth="28"
                      className="cursor-pointer"
                      onClick={() => handleHorizontalClick(r, c)}
                    />
                    {/* Visual line */}
                    <line
                      x1={x1}
                      y1={y}
                      x2={x2}
                      y2={y}
                      stroke={
                        isSelected
                          ? edge === 1
                            ? '#3b82f6'
                            : '#ef4444'
                          : '#e2e8f0'
                      }
                      strokeWidth={isSelected ? '6' : '3'}
                      strokeLinecap="round"
                      className={`transition-colors duration-150 pointer-events-none ${
                        !isSelected ? 'hover:stroke-gray-400' : ''
                      }`}
                    />
                  </g>
                );
              })
            )}

            {/* 3. Vertical Edge Hitboxes & Lines (3 rows x 4 cols) */}
            {vEdges.map((row, r) =>
              row.map((edge, c) => {
                const x = DOT_COORDS[c];
                const y1 = DOT_COORDS[r];
                const y2 = DOT_COORDS[r + 1];
                const isSelected = edge !== 0;

                return (
                  <g key={`v-${r}-${c}`}>
                    {/* Generous touch target hitbox */}
                    <line
                      x1={x}
                      y1={y1}
                      x2={x}
                      y2={y2}
                      stroke="transparent"
                      strokeWidth="28"
                      className="cursor-pointer"
                      onClick={() => handleVerticalClick(r, c)}
                    />
                    {/* Visual line */}
                    <line
                      x1={x}
                      y1={y1}
                      x2={x}
                      y2={y2}
                      stroke={
                        isSelected
                          ? edge === 1
                            ? '#3b82f6'
                            : '#ef4444'
                          : '#e2e8f0'
                      }
                      strokeWidth={isSelected ? '6' : '3'}
                      strokeLinecap="round"
                      className={`transition-colors duration-150 pointer-events-none ${
                        !isSelected ? 'hover:stroke-gray-400' : ''
                      }`}
                    />
                  </g>
                );
              })
            )}

            {/* 4. The 4x4 Grid Dots */}
            {DOT_COORDS.map((y) =>
              DOT_COORDS.map((x) => (
                <circle
                  key={`dot-${x}-${y}`}
                  cx={x}
                  cy={y}
                  r="5.5"
                  fill="#1e293b"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className="drop-shadow-sm pointer-events-none"
                />
              ))
            )}
          </svg>
        </div>
      </main>

      {/* Footer Instructions */}
      <footer className="pb-safe px-4 py-2 border-t border-[#2a2e33]/10 bg-[#f3e9dc]/80 backdrop-blur-sm flex items-center justify-between text-xs font-semibold text-[#7d6753]">
        <span>
          {lastBoxClaimed ? '⭐ Box completed! Take extra turn' : 'Tap lines to connect dots'}
        </span>
        <span className="text-[11px] bg-accent-light px-2.5 py-1 rounded-full border border-[#d8c3a5]/50">
          Target: Most Boxes (9 total)
        </span>
      </footer>

      {/* Game Over Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="Dots & Boxes"
          stats={[
            {
              label: 'Claimed Boxes',
              p1Value: `${scoreP1} / 9`,
              p2Value: `${scoreP2} / 9`,
            },
            {
              label: 'Dominance',
              p1Value: `${Math.round((scoreP1 / 9) * 100)}%`,
              p2Value: `${Math.round((scoreP2 / 9) * 100)}%`,
            },
          ]}
          onRestart={resetGame}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};
