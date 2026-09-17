import React, { useState, useCallback, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import { triggerHaptic, playCaptureSound, playWoodClackSound } from '../utils/feedback';

// 8x8 Board representation:
// 0 = empty
// 1 = P1 Men (Red, bottom, moving up toward row 0)
// 2 = P2 Men (Black/Dark, top, moving down toward row 7)
// 3 = P1 King (Red)
// 4 = P2 King (Black/Dark)
type CheckerPiece = 0 | 1 | 2 | 3 | 4;

interface JumpMove {
  toR: number;
  toC: number;
  capturedR: number;
  capturedC: number;
}

export const Checkers: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();

  // Initial 8x8 checkers setup on dark squares only
  const createInitialBoard = (): CheckerPiece[][] => {
    const b: CheckerPiece[][] = Array.from({ length: 8 }, () => Array(8).fill(0));
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        // Dark squares are where (r + c) % 2 === 1
        if ((r + c) % 2 === 1) {
          if (r < 3) b[r][c] = 2; // P2 Black
          else if (r > 4) b[r][c] = 1; // P1 Red
        }
      }
    }
    return b;
  };

  const [board, setBoard] = useState<CheckerPiece[][]>(createInitialBoard);
  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [selectedPos, setSelectedPos] = useState<[number, number] | null>(null);
  const [inMultiJump, setInMultiJump] = useState<[number, number] | null>(null);
  const [winner, setWinner] = useState<PlayerNumber | null>(null);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Player 1 (Red): Select a piece to move');

  // Count pieces
  const { p1Count, p2Count } = useMemo(() => {
    let p1 = 0;
    let p2 = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const val = board[r][c];
        if (val === 1 || val === 3) p1++;
        else if (val === 2 || val === 4) p2++;
      }
    }
    return { p1Count: p1, p2Count: p2 };
  }, [board]);

  const resetGame = useCallback(() => {
    setBoard(createInitialBoard());
    setTurn(1);
    setSelectedPos(null);
    setInMultiJump(null);
    setWinner(null);
    setShowTurnTransition(false);
    setStatusMessage('Player 1 (Red): Select a piece to move');
    setGameStatus('active');
  }, [setGameStatus]);

  // Determine if a piece belongs to player
  const isPlayerPiece = (val: CheckerPiece, player: PlayerNumber) => {
    if (player === 1) return val === 1 || val === 3;
    if (player === 2) return val === 2 || val === 4;
    return false;
  };

  const isKing = (val: CheckerPiece) => val === 3 || val === 4;

  // Get jump moves from a given cell
  const getJumpsForPiece = useCallback((b: CheckerPiece[][], r: number, c: number, player: PlayerNumber): JumpMove[] => {
    const val = b[r][c];
    if (!isPlayerPiece(val, player)) return [];

    const king = isKing(val);
    const opponent: PlayerNumber = player === 1 ? 2 : 1;
    const jumps: JumpMove[] = [];

    // Directions: P1 men move -1 (up), P2 men move +1 (down), kings move both
    const rowDirs = king ? [-1, 1] : player === 1 ? [-1] : [1];
    const colDirs = [-1, 1];

    for (const dr of rowDirs) {
      for (const dc of colDirs) {
        const midR = r + dr;
        const midC = c + dc;
        const landR = r + dr * 2;
        const landC = c + dc * 2;

        if (landR >= 0 && landR < 8 && landC >= 0 && landC < 8) {
          const midVal = b[midR][midC];
          const landVal = b[landR][landC];

          if (isPlayerPiece(midVal, opponent) && landVal === 0) {
            jumps.push({ toR: landR, toC: landC, capturedR: midR, capturedC: midC });
          }
        }
      }
    }

    return jumps;
  }, []);

  // Get simple 1-step diagonal moves from a cell
  const getSimpleMovesForPiece = useCallback((b: CheckerPiece[][], r: number, c: number, player: PlayerNumber): [number, number][] => {
    const val = b[r][c];
    if (!isPlayerPiece(val, player)) return [];

    const king = isKing(val);
    const moves: [number, number][] = [];

    const rowDirs = king ? [-1, 1] : player === 1 ? [-1] : [1];
    const colDirs = [-1, 1];

    for (const dr of rowDirs) {
      for (const dc of colDirs) {
        const nr = r + dr;
        const nc = c + dc;

        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && b[nr][nc] === 0) {
          moves.push([nr, nc]);
        }
      }
    }

    return moves;
  }, []);

  // Find all pieces that have mandatory jumps available
  const getAllJumpsForPlayer = useCallback((b: CheckerPiece[][], player: PlayerNumber) => {
    const jumpMap = new Map<string, JumpMove[]>();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const jumps = getJumpsForPiece(b, r, c, player);
        if (jumps.length > 0) {
          jumpMap.set(`${r},${c}`, jumps);
        }
      }
    }

    return jumpMap;
  }, [getJumpsForPiece]);

  // Find all valid destinations for the currently selected piece
  const availableMovesForSelected = useMemo(() => {
    if (!selectedPos || winner !== null) return [];
    const [sr, sc] = selectedPos;

    // If locked in multi-jump, only jumps from that piece are legal
    if (inMultiJump) {
      return getJumpsForPiece(board, inMultiJump[0], inMultiJump[1], turn);
    }

    const allJumps = getAllJumpsForPlayer(board, turn);

    // Rule: Mandatory capture if any jump exists across player's pieces
    if (allJumps.size > 0) {
      const jumps = allJumps.get(`${sr},${sc}`);
      return jumps || [];
    }

    // No jumps on board -> regular 1-step moves allowed
    const simple = getSimpleMovesForPiece(board, sr, sc, turn);
    return simple.map(([toR, toC]) => ({ toR, toC, capturedR: -1, capturedC: -1 }));
  }, [selectedPos, inMultiJump, winner, board, turn, getAllJumpsForPlayer, getJumpsForPiece, getSimpleMovesForPiece]);

  // Check end conditions: opponent has zero pieces or zero legal moves
  const checkGameOver = useCallback((nextBoard: CheckerPiece[][], nextPlayer: PlayerNumber) => {
    let opponentPieceCount = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (isPlayerPiece(nextBoard[r][c], nextPlayer)) {
          opponentPieceCount++;
        }
      }
    }

    if (opponentPieceCount === 0) {
      const winResult: PlayerNumber = nextPlayer === 1 ? 2 : 1;
      setWinner(winResult);
      setStatusMessage(`🎉 All opponent pieces captured! Player ${winResult} wins!`);
      setGameStatus('finished');
      return true;
    }

    // Check if opponent has any legal move
    const hasJumps = getAllJumpsForPlayer(nextBoard, nextPlayer).size > 0;
    if (hasJumps) return false;

    let hasSimple = false;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (getSimpleMovesForPiece(nextBoard, r, c, nextPlayer).length > 0) {
          hasSimple = true;
          break;
        }
      }
      if (hasSimple) break;
    }

    if (!hasSimple) {
      const winResult: PlayerNumber = nextPlayer === 1 ? 2 : 1;
      setWinner(winResult);
      setStatusMessage(`🎉 Opponent is blocked with no moves! Player ${winResult} wins!`);
      setGameStatus('finished');
      return true;
    }

    return false;
  }, [getAllJumpsForPlayer, getSimpleMovesForPiece, setGameStatus]);

  const handleSquareClick = useCallback((r: number, c: number) => {
    if (winner !== null || isAnimating) return;

    const cellVal = board[r][c];

    // If tapping one of active player's own pieces (unless locked in multi-jump)
    if (isPlayerPiece(cellVal, turn) && !inMultiJump) {
      const allJumps = getAllJumpsForPlayer(board, turn);
      // If mandatory jumps exist, player can only select pieces with jumps
      if (allJumps.size > 0 && !allJumps.has(`${r},${c}`)) {
        setStatusMessage('Mandatory jump available! You must select a capturing piece.');
        triggerHaptic('light');
        return;
      }

      triggerHaptic('light');
      setSelectedPos([r, c]);
      return;
    }

    // If a piece is currently selected, check if (r, c) is a valid move/jump target
    if (selectedPos) {
      const [fromR, fromC] = selectedPos;
      let pieceVal = board[fromR][fromC];

      const validMove = availableMovesForSelected.find((m) => m.toR === r && m.toC === c);
      if (!validMove) {
        // Not a valid destination
        if (!inMultiJump) {
          setSelectedPos(null);
        }
        return;
      }

      // Execute Move
      const nextBoard = board.map((row) => [...row]);
      nextBoard[fromR][fromC] = 0;
      nextBoard[r][c] = pieceVal;

      const isCapture = !!validMove.jump;
      if (validMove.jump) {
        // Remove captured piece
        nextBoard[validMove.jump.capturedR][validMove.jump.capturedC] = 0;
        playCaptureSound();
        triggerHaptic('medium');
      } else {
        playWoodClackSound();
        triggerHaptic('light');
      }

      // Check King promotion
      // P1 men (1) reaching row 0 promote to King (3)
      // P2 men (2) reaching row 7 promote to King (4)
      let newlyCrowned = false;
      if (turn === 1 && pieceVal === 1 && r === 0) {
        nextBoard[r][c] = 3;
        pieceVal = 3;
        newlyCrowned = true;
      } else if (turn === 2 && pieceVal === 2 && r === 7) {
        nextBoard[r][c] = 4;
        pieceVal = 4;
        newlyCrowned = true;
      }

      // Check for sequential multi-jumps if a capture just occurred
      // (Standard rule: newly promoted king cannot continue jumping on same turn)
      if (isCapture && !newlyCrowned) {
        const furtherJumps = getJumpsForPiece(nextBoard, r, c, turn);
        if (furtherJumps.length > 0) {
          setBoard(nextBoard);
          setSelectedPos([r, c]);
          setInMultiJump([r, c]);
          setStatusMessage('Multi-jump available! You must continue capturing.');
          return;
        }
      }

      // Immediate visual board update with animation lock
      setBoard(nextBoard);
      setSelectedPos(null);
      setInMultiJump(null);
      setIsAnimating(true);

      const nextPlayer: PlayerNumber = turn === 1 ? 2 : 1;

      // Allow 350ms for piece motion and capture settling before checking end
      setTimeout(() => {
        setIsAnimating(false);
        const isOver = checkGameOver(nextBoard, nextPlayer);

        if (!isOver) {
          setTurn(nextPlayer);
          setGameStatus('active');
          setStatusMessage(`Player ${nextPlayer}'s turn (${nextPlayer === 1 ? 'Red' : 'Black'}).`);
        }
      }, 350);
    }
  }, [
    board,
    turn,
    winner,
    isAnimating,
    selectedPos,
    inMultiJump,
    availableMovesForSelected,
    getAllJumpsForPlayer,
    getJumpsForPiece,
    checkGameOver,
    setGameStatus,
  ]);

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden relative select-none">
      <GameHeader
        title="Checkers"
        subtitle="Classic 8x8 Draughts"
        turn={turn}
        scoreP1={`${p1Count} Red`}
        scoreP2={`${p2Count} Dark`}
        p1Label="P1 (Red)"
        p2Label="P2 (Dark)"
        onRestart={resetGame}
        statusMessage={statusMessage}
      />

      {/* Main 8x8 Board Area - Responsive on iPhone, iPad, PC */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 relative touch-none overflow-hidden">
        <div className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl aspect-square max-h-[72vh] bg-[#2b1407] rounded-3xl sm:rounded-[36px] p-2 sm:p-3.5 clubhouse-board-depth table-flat border-4 sm:border-6 border-[#1a0b03] flex items-center justify-center relative">
          {/* Inner Hardwood Inlay Perimeter Trim */}
          <div className="w-full h-full rounded-2xl sm:rounded-3xl p-1 bg-[#180b04] border-2 border-[#8c5932]/40 shadow-inner flex items-center justify-center">
            <div className="w-full h-full rounded-xl sm:rounded-2xl grid grid-cols-8 grid-rows-8 overflow-hidden border border-black/60 shadow-[inset_0_2px_6px_rgba(0,0,0,0.7)]">
              {board.map((row, r) =>
                row.map((cell, c) => {
                  const isDarkSquare = (r + c) % 2 === 1;
                  const isSelected = selectedPos && selectedPos[0] === r && selectedPos[1] === c;
                  const isMoveTarget = availableMovesForSelected.some((m) => m.toR === r && m.toC === c);

                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      onClick={() => handleSquareClick(r, c)}
                      disabled={winner !== null || !isDarkSquare}
                      className={`relative w-full h-full flex items-center justify-center transition-all ${
                        isDarkSquare 
                          ? 'bg-gradient-to-br from-[#7f1d1d] to-[#450a0a] shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]' 
                          : 'bg-gradient-to-br from-[#f7f0e4] via-[#eedec8] to-[#dfccb0]'
                      } ${isSelected ? 'ring-3 ring-amber-400 z-10' : ''}`}
                      aria-label={`Row ${r + 1}, Col ${c + 1}`}
                    >
                      {/* Move Destination Highlight Dot */}
                      {isMoveTarget && (
                        <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-amber-400/90 shadow-md animate-pulse z-20 ring-2 ring-amber-200" />
                      )}

                      {/* Turned-Wood / Bakelite Checker Piece */}
                      {cell !== 0 && (
                        <div
                          className={`w-[84%] h-[84%] rounded-full transition-spring flex items-center justify-center relative ${
                            isSelected ? 'scale-110 -translate-y-1 table-lifted' : 'scale-100 shadow-md'
                          } ${
                            cell === 1 || cell === 3
                              ? 'bg-gradient-to-br from-[#dc2626] via-[#991b1b] to-[#450a0a] border border-[#fca5a5]/40 shadow-[inset_0_2px_3px_rgba(255,255,255,0.45),inset_0_-3px_5px_rgba(0,0,0,0.6)]'
                              : 'bg-gradient-to-br from-[#334155] via-[#1e293b] to-[#020617] border border-[#94a3b8]/30 shadow-[inset_0_2px_3px_rgba(255,255,255,0.3),inset_0_-3px_5px_rgba(0,0,0,0.8)]'
                          }`}
                        >
                          {/* Outer concentric routed ring */}
                          <div className="w-[74%] h-[74%] rounded-full border border-black/35 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5),0_1px_1px_rgba(255,255,255,0.2)] flex items-center justify-center">
                            {/* Inner concentric ring */}
                            <div className="w-[58%] h-[58%] rounded-full border border-white/20 bg-black/10 flex items-center justify-center">
                              {/* King Crown Stamp or Center Indent */}
                              {(cell === 3 || cell === 4) ? (
                                <svg className="w-4 h-4 text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] animate-pulse" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V17H19V19Z" />
                                </svg>
                              ) : (
                                <div className="w-2.5 h-2.5 rounded-full bg-black/20 border border-black/30 shadow-inner" />
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer Instructions */}
      <footer className="pb-safe px-4 py-1.5 border-t border-[#2a2e33]/10 bg-[#f3e9dc]/80 backdrop-blur-sm flex items-center justify-between text-xs font-semibold text-[#7d6753]">
        <span>Jumping captures are mandatory • King reaches end</span>
        <span className="text-[11px] bg-accent-light px-2.5 py-0.5 rounded-full border border-[#d8c3a5]/50">
          Target: Eliminate Opponent
        </span>
      </footer>

      {/* Victory Game Over Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="Checkers"
          stats={[
            {
              label: 'Remaining Pieces',
              p1Value: `${p1Count} Red`,
              p2Value: `${p2Count} Dark`,
            },
            {
              label: 'Match Outcome',
              p1Value: winner === 1 ? 'Captured All' : 'Runner Up',
              p2Value: winner === 2 ? 'Captured All' : 'Runner Up',
            },
          ]}
          onRestart={resetGame}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};
