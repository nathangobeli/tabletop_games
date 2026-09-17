import React, { useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import {
  triggerHaptic,
  playWoodClackSound,
  playCaptureSound,
  playTapSound,
} from '../utils/feedback';

export type ShogiPieceType = 'K' | 'G' | 'S' | 'B' | 'R' | 'P';

export interface ShogiPiece {
  id: string;
  type: ShogiPieceType;
  owner: PlayerNumber;
  isPromoted: boolean;
}

export type BoardGrid = (ShogiPiece | null)[][];

const BOARD_SIZE = 5;

// Kanji and Romanized name maps
const PIECE_NAMES: Record<ShogiPieceType, { kanji: string; name: string; promotedKanji: string; promotedName: string }> = {
  K: { kanji: '王', name: 'King', promotedKanji: '王', promotedName: 'King' },
  G: { kanji: '金', name: 'Gold', promotedKanji: '金', promotedName: 'Gold' },
  S: { kanji: '銀', name: 'Silver', promotedKanji: '全', promotedName: '+Silver' },
  B: { kanji: '角', name: 'Bishop', promotedKanji: '馬', promotedName: 'Horse' },
  R: { kanji: '飛', name: 'Rook', promotedKanji: '竜', promotedName: 'Dragon' },
  P: { kanji: '歩', name: 'Pawn', promotedKanji: 'と', promotedName: 'Tokin' },
};

export const MiniShogi: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();

  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [winner, setWinner] = useState<PlayerNumber | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Player 1: Select a piece to move or drop.');

  // Promotion Dialog State
  const [pendingPromotion, setPendingPromotion] = useState<{
    piece: ShogiPiece;
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
  } | null>(null);

  // 5x5 Board Setup (Standard Minishogi setup)
  // Row 0 = P2 Back Rank (Top), Row 4 = P1 Back Rank (Bottom)
  const [grid, setGrid] = useState<BoardGrid>(() => {
    const b: BoardGrid = Array.from({ length: 5 }, () => Array(5).fill(null));

    // Player 2 (Top)
    b[0][0] = { id: 'p2-r', type: 'R', owner: 2, isPromoted: false };
    b[0][1] = { id: 'p2-b', type: 'B', owner: 2, isPromoted: false };
    b[0][2] = { id: 'p2-s', type: 'S', owner: 2, isPromoted: false };
    b[0][3] = { id: 'p2-g', type: 'G', owner: 2, isPromoted: false };
    b[0][4] = { id: 'p2-k', type: 'K', owner: 2, isPromoted: false };
    b[1][4] = { id: 'p2-p', type: 'P', owner: 2, isPromoted: false };

    // Player 1 (Bottom)
    b[4][0] = { id: 'p1-k', type: 'K', owner: 1, isPromoted: false };
    b[4][1] = { id: 'p1-g', type: 'G', owner: 1, isPromoted: false };
    b[4][2] = { id: 'p1-s', type: 'S', owner: 1, isPromoted: false };
    b[4][3] = { id: 'p1-b', type: 'B', owner: 1, isPromoted: false };
    b[4][4] = { id: 'p1-r', type: 'R', owner: 1, isPromoted: false };
    b[3][0] = { id: 'p1-p', type: 'P', owner: 1, isPromoted: false };

    return b;
  });

  // Captured pieces in reserve trays (komadai)
  const [p1Reserve, setP1Reserve] = useState<ShogiPieceType[]>([]);
  const [p2Reserve, setP2Reserve] = useState<ShogiPieceType[]>([]);

  // Selection State: either a board square [row, col] or a reserve piece index
  const [selectedSquare, setSelectedSquare] = useState<[number, number] | null>(null);
  const [selectedReservePiece, setSelectedReservePiece] = useState<ShogiPieceType | null>(null);

  // Check if position is on board
  const isOnBoard = (r: number, c: number) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;

  // Calculate valid moves for a piece on the board
  const getLegalMoves = useCallback((r: number, c: number, board: BoardGrid): [number, number][] => {
    const piece = board[r][c];
    if (!piece) return [];

    const moves: [number, number][] = [];
    const forward = piece.owner === 1 ? -1 : 1; // P1 moves up (negative row), P2 moves down (positive row)

    const addMove = (nr: number, nc: number) => {
      if (!isOnBoard(nr, nc)) return false;
      const target = board[nr][nc];
      if (!target) {
        moves.push([nr, nc]);
        return true; // continue sliding
      }
      if (target.owner !== piece.owner) {
        moves.push([nr, nc]);
      }
      return false; // hit a piece, stop sliding
    };

    // Movement definitions
    if (piece.isPromoted) {
      if (piece.type === 'P' || piece.type === 'S') {
        // Tokin (+P) and Narigin (+S) move identically to Gold
        const goldOffsets = [
          [forward, 0], // forward
          [forward, -1], // forward-left
          [forward, 1], // forward-right
          [0, -1], // left
          [0, 1], // right
          [-forward, 0], // backward
        ];
        goldOffsets.forEach(([dr, dc]) => addMove(r + dr, c + dc));
      } else if (piece.type === 'B') {
        // Horse (+B): Bishop diagonal slides + 1 step orthogonally
        const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        diagDirs.forEach(([dr, dc]) => {
          for (let step = 1; step < BOARD_SIZE; step++) {
            if (!addMove(r + dr * step, c + dc * step)) break;
          }
        });
        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => addMove(r + dr, c + dc));
      } else if (piece.type === 'R') {
        // Dragon (+R): Rook orthogonal slides + 1 step diagonally
        const orthoDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        orthoDirs.forEach(([dr, dc]) => {
          for (let step = 1; step < BOARD_SIZE; step++) {
            if (!addMove(r + dr * step, c + dc * step)) break;
          }
        });
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([dr, dc]) => addMove(r + dr, c + dc));
      }
    } else {
      // Unpromoted Pieces
      switch (piece.type) {
        case 'K': {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              addMove(r + dr, c + dc);
            }
          }
          break;
        }

        case 'G': {
          const goldOffsets = [
            [forward, 0],
            [forward, -1],
            [forward, 1],
            [0, -1],
            [0, 1],
            [-forward, 0],
          ];
          goldOffsets.forEach(([dr, dc]) => addMove(r + dr, c + dc));
          break;
        }

        case 'S': {
          const silverOffsets = [
            [forward, 0], // forward
            [forward, -1], // forward-left
            [forward, 1], // forward-right
            [-forward, -1], // backward-left
            [-forward, 1], // backward-right
          ];
          silverOffsets.forEach(([dr, dc]) => addMove(r + dr, c + dc));
          break;
        }

        case 'P': {
          addMove(r + forward, c);
          break;
        }

        case 'B': {
          const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
          diagDirs.forEach(([dr, dc]) => {
            for (let step = 1; step < BOARD_SIZE; step++) {
              if (!addMove(r + dr * step, c + dc * step)) break;
            }
          });
          break;
        }

        case 'R': {
          const orthoDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
          orthoDirs.forEach(([dr, dc]) => {
            for (let step = 1; step < BOARD_SIZE; step++) {
              if (!addMove(r + dr * step, c + dc * step)) break;
            }
          });
          break;
        }
      }
    }

    return moves;
  }, []);

  // Calculate valid drop squares for a reserve piece
  const getLegalDrops = useCallback((pieceType: ShogiPieceType, player: PlayerNumber, board: BoardGrid): [number, number][] => {
    const drops: [number, number][] = [];
    const deadRank = player === 1 ? 0 : 4;

    // Check Nifu (Two Pawns): check if column already has an unpromoted friendly pawn
    const colsWithPawn = new Set<number>();
    if (pieceType === 'P') {
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const p = board[r][c];
          if (p && p.owner === player && p.type === 'P' && !p.isPromoted) {
            colsWithPawn.add(c);
          }
        }
      }
    }

    for (let r = 0; r < BOARD_SIZE; r++) {
      // Pawn cannot be dropped on furthest rank
      if (pieceType === 'P' && r === deadRank) continue;

      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] !== null) continue; // square must be empty
        if (pieceType === 'P' && colsWithPawn.has(c)) continue; // Nifu violation

        drops.push([r, c]);
      }
    }

    return drops;
  }, []);

  // Check if a move can trigger promotion
  const canPromote = (piece: ShogiPiece, fromRow: number, toRow: number): boolean => {
    if (piece.isPromoted || piece.type === 'K' || piece.type === 'G') return false;
    const promoRank = piece.owner === 1 ? 0 : 4;
    return fromRow === promoRank || toRow === promoRank;
  };

  // Must promote (e.g. Pawn reaching back rank has no legal moves unless promoted)
  const mustPromote = (piece: ShogiPiece, toRow: number): boolean => {
    if (piece.type === 'P') {
      const deadRank = piece.owner === 1 ? 0 : 4;
      return toRow === deadRank;
    }
    return false;
  };

  // Execute Move on Board
  const executeMove = (fromRow: number, fromCol: number, toRow: number, toCol: number, promote: boolean) => {
    const newGrid = grid.map((row) => [...row]);
    const piece = newGrid[fromRow][fromCol];
    if (!piece) return;

    const target = newGrid[toRow][toCol];

    // Capture handling
    if (target) {
      playCaptureSound();
      triggerHaptic('medium');

      // Captured piece reverts to unpromoted and changes owner
      const capturedType = target.type;
      if (target.type === 'K') {
        // King captured -> Immediate Victory!
        setWinner(turn);
        setStatusMessage(`Player ${turn} captured the King! Victory!`);
        return;
      }

      if (turn === 1) setP1Reserve((prev) => [...prev, capturedType]);
      else setP2Reserve((prev) => [...prev, capturedType]);
    } else {
      playWoodClackSound();
      triggerHaptic('light');
    }

    // Move piece
    newGrid[fromRow][fromCol] = null;
    newGrid[toRow][toCol] = {
      ...piece,
      isPromoted: promote ? true : piece.isPromoted,
    };

    setGrid(newGrid);
    setSelectedSquare(null);
    setSelectedReservePiece(null);

    // Advance Turn
    const nextPlayer: PlayerNumber = turn === 1 ? 2 : 1;
    setTurn(nextPlayer);
    setGameStatus('active');
    setStatusMessage(`Player ${nextPlayer}'s turn.`);
  };

  // Execute Drop from Reserve Tray
  const executeDrop = (pieceType: ShogiPieceType, toRow: number, toCol: number) => {
    playWoodClackSound();
    triggerHaptic('light');

    const newGrid = grid.map((row) => [...row]);
    newGrid[toRow][toCol] = {
      id: `drop-${turn}-${pieceType}-${toRow}-${toCol}`,
      type: pieceType,
      owner: turn,
      isPromoted: false,
    };

    // Remove from player reserve
    if (turn === 1) {
      const idx = p1Reserve.indexOf(pieceType);
      if (idx !== -1) {
        const nextRes = [...p1Reserve];
        nextRes.splice(idx, 1);
        setP1Reserve(nextRes);
      }
    } else {
      const idx = p2Reserve.indexOf(pieceType);
      if (idx !== -1) {
        const nextRes = [...p2Reserve];
        nextRes.splice(idx, 1);
        setP2Reserve(nextRes);
      }
    }

    setGrid(newGrid);
    setSelectedSquare(null);
    setSelectedReservePiece(null);

    // Advance Turn
    const nextPlayer: PlayerNumber = turn === 1 ? 2 : 1;
    setTurn(nextPlayer);
    setGameStatus('active');
    setStatusMessage(`Player ${nextPlayer}'s turn.`);
  };

  // Handle Board Square Click
  const handleSquareClick = (r: number, c: number) => {
    if (winner !== null) return;
    const pieceAtSquare = grid[r][c];

    // Case 1: Dropping a selected reserve piece
    if (selectedReservePiece) {
      const legalDrops = getLegalDrops(selectedReservePiece, turn, grid);
      const isLegal = legalDrops.some(([dr, dc]) => dr === r && dc === c);
      if (isLegal) {
        executeDrop(selectedReservePiece, r, c);
      } else {
        setSelectedReservePiece(null);
      }
      return;
    }

    // Case 2: Destination square selected for moving board piece
    if (selectedSquare) {
      const [fromR, fromC] = selectedSquare;

      // Deselect if clicking same square
      if (fromR === r && fromC === c) {
        setSelectedSquare(null);
        return;
      }

      // Check if clicking another friendly piece
      if (pieceAtSquare && pieceAtSquare.owner === turn) {
        playTapSound();
        setSelectedSquare([r, c]);
        return;
      }

      const legalMoves = getLegalMoves(fromR, fromC, grid);
      const isLegal = legalMoves.some(([mr, mc]) => mr === r && mc === c);

      if (isLegal) {
        const piece = grid[fromR][fromC]!;
        if (mustPromote(piece, r)) {
          executeMove(fromR, fromC, r, c, true);
        } else if (canPromote(piece, fromR, r)) {
          // Open promotion modal
          setPendingPromotion({
            piece,
            fromRow: fromR,
            fromCol: fromC,
            toRow: r,
            toCol: c,
          });
        } else {
          executeMove(fromR, fromC, r, c, false);
        }
        return;
      }
    }

    // Case 3: Selecting friendly piece to move
    if (pieceAtSquare && pieceAtSquare.owner === turn) {
      playTapSound();
      setSelectedSquare([r, c]);
      setSelectedReservePiece(null);
    }
  };

  // Active highlights
  const activeLegalTargets = selectedSquare
    ? getLegalMoves(selectedSquare[0], selectedSquare[1], grid)
    : selectedReservePiece
    ? getLegalDrops(selectedReservePiece, turn, grid)
    : [];

  const handleRestart = useCallback(() => {
    setTurn(1);
    setWinner(null);
    setP1Reserve([]);
    setP2Reserve([]);
    setSelectedSquare(null);
    setSelectedReservePiece(null);
    setStatusMessage('Player 1: Select a piece to move or drop.');
    const b: BoardGrid = Array.from({ length: 5 }, () => Array(5).fill(null));
    b[0][0] = { id: 'p2-r', type: 'R', owner: 2, isPromoted: false };
    b[0][1] = { id: 'p2-b', type: 'B', owner: 2, isPromoted: false };
    b[0][2] = { id: 'p2-s', type: 'S', owner: 2, isPromoted: false };
    b[0][3] = { id: 'p2-g', type: 'G', owner: 2, isPromoted: false };
    b[0][4] = { id: 'p2-k', type: 'K', owner: 2, isPromoted: false };
    b[1][4] = { id: 'p2-p', type: 'P', owner: 2, isPromoted: false };
    b[4][0] = { id: 'p1-k', type: 'K', owner: 1, isPromoted: false };
    b[4][1] = { id: 'p1-g', type: 'G', owner: 1, isPromoted: false };
    b[4][2] = { id: 'p1-s', type: 'S', owner: 1, isPromoted: false };
    b[4][3] = { id: 'p1-b', type: 'B', owner: 1, isPromoted: false };
    b[4][4] = { id: 'p1-r', type: 'R', owner: 1, isPromoted: false };
    b[3][0] = { id: 'p1-p', type: 'P', owner: 1, isPromoted: false };
    setGrid(b);
  }, []);

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden select-none">
      <GameHeader
        gameId="mini-shogi"
        gameName="Mini Shogi (5x5)"
        turn={turn}
        onRestart={handleRestart}
        statusMessage={statusMessage}
      />

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden">
        {/* Top: Player 2 Reserve Tray (Komadai) */}
        <div className="w-full max-w-sm flex items-center justify-between px-3 py-1.5 bg-[#d4a373] border-2 border-[#8c5932] rounded-2xl shadow-md mb-2">
          <span className="text-[10px] font-black uppercase text-[#422006]">
            P2 Tray ({p2Reserve.length})
          </span>
          <div className="flex gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
            {p2Reserve.length === 0 ? (
              <span className="text-[10px] italic text-[#78350f]">Empty</span>
            ) : (
              p2Reserve.map((pt, idx) => (
                <button
                  key={`${pt}-${idx}`}
                  disabled={turn !== 2}
                  onClick={() => {
                    playTapSound();
                    setSelectedReservePiece(pt);
                    setSelectedSquare(null);
                  }}
                  className={`px-2 py-0.5 rounded-md font-bold text-xs shadow-sm border transition-all ${
                    selectedReservePiece === pt && turn === 2
                      ? 'bg-amber-300 border-amber-600 ring-2 ring-amber-500 scale-105'
                      : 'bg-[#fef3c7] text-[#78350f] border-[#b45309]'
                  }`}
                >
                  {PIECE_NAMES[pt].kanji}
                </button>
              ))
            )}
          </div>
        </div>

        {/* 5x5 Shogi Board Container */}
        <div className="relative flex items-center justify-center max-h-[60vh] aspect-square bg-[#e8c89b] border-4 border-[#8c5932] rounded-3xl clubhouse-board-depth table-flat p-2 shadow-2xl">
          {/* Wood Grain Overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-black/10 via-transparent to-white/10 rounded-2xl pointer-events-none" />

          {/* 5x5 Grid */}
          <div className="w-full h-full grid grid-cols-5 grid-rows-5 gap-1 relative z-10">
            {grid.map((row, r) =>
              row.map((piece, c) => {
                const isSelected = selectedSquare && selectedSquare[0] === r && selectedSquare[1] === c;
                const isTarget = activeLegalTargets.some(([tr, tc]) => tr === r && tc === c);

                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    onClick={() => handleSquareClick(r, c)}
                    className={`relative rounded-xl border flex items-center justify-center transition-all ${
                      isSelected
                        ? 'border-amber-500 ring-4 ring-amber-400 bg-amber-200/40'
                        : isTarget
                        ? 'border-emerald-500 ring-2 ring-emerald-400 bg-emerald-300/30 cursor-pointer animate-pulse'
                        : 'border-[#a37844]/60 bg-[#f4deb8]/40 hover:bg-[#f4deb8]/80'
                    }`}
                  >
                    {/* Render Pentagonal Shogi Koma Tile */}
                    {piece && (
                      <div
                        className={`w-[84%] h-[88%] flex flex-col items-center justify-center relative transition-transform ${
                          piece.owner === 2 ? 'rotate-180' : ''
                        }`}
                      >
                        {/* Pentagonal Tile SVG */}
                        <svg viewBox="0 0 100 120" className="w-full h-full filter drop-shadow-md">
                          {/* Wedge Polygon */}
                          <polygon
                            points="50,6 92,26 86,114 14,114 8,26"
                            fill={piece.isPromoted ? '#fed7aa' : '#fef3c7'}
                            stroke="#8c5932"
                            strokeWidth="3.5"
                          />
                          {/* Kanji Character */}
                          <text
                            x="50"
                            y="70"
                            fontSize="44"
                            fontWeight="bold"
                            fill={piece.isPromoted ? '#dc2626' : '#1c1917'}
                            textAnchor="middle"
                            fontFamily="serif"
                          >
                            {piece.isPromoted ? PIECE_NAMES[piece.type].promotedKanji : PIECE_NAMES[piece.type].kanji}
                          </text>
                          {/* Subtitle Latin Character */}
                          <text
                            x="50"
                            y="98"
                            fontSize="16"
                            fontWeight="900"
                            fill={piece.owner === 1 ? '#2563eb' : '#dc2626'}
                            textAnchor="middle"
                            fontFamily="sans-serif"
                          >
                            {piece.isPromoted ? PIECE_NAMES[piece.type].promotedName : PIECE_NAMES[piece.type].name}
                          </text>
                        </svg>
                      </div>
                    )}

                    {/* Move Guide Dot */}
                    {isTarget && !piece && (
                      <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-md ring-2 ring-white/80" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Bottom: Player 1 Reserve Tray (Komadai) */}
        <div className="w-full max-w-sm flex items-center justify-between px-3 py-1.5 bg-[#d4a373] border-2 border-[#8c5932] rounded-2xl shadow-md mt-2">
          <span className="text-[10px] font-black uppercase text-[#422006]">
            P1 Tray ({p1Reserve.length})
          </span>
          <div className="flex gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
            {p1Reserve.length === 0 ? (
              <span className="text-[10px] italic text-[#78350f]">Empty</span>
            ) : (
              p1Reserve.map((pt, idx) => (
                <button
                  key={`${pt}-${idx}`}
                  disabled={turn !== 1}
                  onClick={() => {
                    playTapSound();
                    setSelectedReservePiece(pt);
                    setSelectedSquare(null);
                  }}
                  className={`px-2 py-0.5 rounded-md font-bold text-xs shadow-sm border transition-all ${
                    selectedReservePiece === pt && turn === 1
                      ? 'bg-amber-300 border-amber-600 ring-2 ring-amber-500 scale-105'
                      : 'bg-[#fef3c7] text-[#78350f] border-[#b45309]'
                  }`}
                >
                  {PIECE_NAMES[pt].kanji}
                </button>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Promotion Choice Modal Dialog */}
      {pendingPromotion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xs bg-container-dark border-2 border-amber-400 rounded-3xl p-5 text-center shadow-2xl flex flex-col items-center">
            <h3 className="text-base font-black text-amber-300 uppercase tracking-wide mb-1">
              Promote Piece?
            </h3>
            <p className="text-xs text-accent-light/80 mb-4">
              Promote to{' '}
              <strong className="text-white">
                {PIECE_NAMES[pendingPromotion.piece.type].promotedName}
              </strong>{' '}
              ({PIECE_NAMES[pendingPromotion.piece.type].promotedKanji})?
            </p>

            <div className="flex gap-3 w-full">
              <button
                onClick={() => {
                  const { fromRow, fromCol, toRow, toCol } = pendingPromotion;
                  setPendingPromotion(null);
                  executeMove(fromRow, fromCol, toRow, toCol, true);
                }}
                className="flex-1 py-2.5 rounded-xl font-black text-xs uppercase bg-amber-500 hover:bg-amber-400 text-black shadow-lg"
              >
                Promote
              </button>
              <button
                onClick={() => {
                  const { fromRow, fromCol, toRow, toCol } = pendingPromotion;
                  setPendingPromotion(null);
                  executeMove(fromRow, fromCol, toRow, toCol, false);
                }}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs uppercase bg-white/10 hover:bg-white/20 text-white border border-white/20"
              >
                Stay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="Mini Shogi"
          onRestart={() => {
            setTurn(1);
            setWinner(null);
            setP1Reserve([]);
            setP2Reserve([]);
            setSelectedSquare(null);
            setSelectedReservePiece(null);
            // Reset grid
            const b: BoardGrid = Array.from({ length: 5 }, () => Array(5).fill(null));
            b[0][0] = { id: 'p2-r', type: 'R', owner: 2, isPromoted: false };
            b[0][1] = { id: 'p2-b', type: 'B', owner: 2, isPromoted: false };
            b[0][2] = { id: 'p2-s', type: 'S', owner: 2, isPromoted: false };
            b[0][3] = { id: 'p2-g', type: 'G', owner: 2, isPromoted: false };
            b[0][4] = { id: 'p2-k', type: 'K', owner: 2, isPromoted: false };
            b[1][4] = { id: 'p2-p', type: 'P', owner: 2, isPromoted: false };

            b[4][0] = { id: 'p1-k', type: 'K', owner: 1, isPromoted: false };
            b[4][1] = { id: 'p1-g', type: 'G', owner: 1, isPromoted: false };
            b[4][2] = { id: 'p1-s', type: 'S', owner: 1, isPromoted: false };
            b[4][3] = { id: 'p1-b', type: 'B', owner: 1, isPromoted: false };
            b[4][4] = { id: 'p1-r', type: 'R', owner: 1, isPromoted: false };
            b[3][0] = { id: 'p1-p', type: 'P', owner: 1, isPromoted: false };
            setGrid(b);
          }}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};
export default MiniShogi;
