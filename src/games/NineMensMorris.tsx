import React, { useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import {
  triggerHaptic,
  playWoodPieceMoveSound,
  playCaptureSound,
  playVictorySound,
} from '../utils/feedback';

type PointState = PlayerNumber | null;

// 24 Points Topology: [x, y] on a 0-6 grid
const POINT_COORDS: [number, number][] = [
  // Outer square (0 to 7)
  [0, 0], [3, 0], [6, 0], // 0, 1, 2
  [6, 3], // 3
  [6, 6], [3, 6], [0, 6], // 4, 5, 6
  [0, 3], // 7
  // Middle square (8 to 15)
  [1, 1], [3, 1], [5, 1], // 8, 9, 10
  [5, 3], // 11
  [5, 5], [3, 5], [1, 5], // 12, 13, 14
  [1, 3], // 15
  // Inner square (16 to 23)
  [2, 2], [3, 2], [4, 2], // 16, 17, 18
  [4, 3], // 19
  [4, 4], [3, 4], [2, 4], // 20, 21, 22
  [2, 3], // 23
];

const ADJACENCY: number[][] = [
  [1, 7],           // 0
  [0, 2, 9],        // 1
  [1, 3],           // 2
  [2, 4, 11],       // 3
  [3, 5],           // 4
  [4, 6, 13],       // 5
  [5, 7],           // 6
  [0, 6, 15],       // 7
  [9, 15],          // 8
  [8, 10, 1, 17],   // 9
  [9, 11],          // 10
  [10, 12, 3, 19],  // 11
  [11, 13],         // 12
  [12, 14, 5, 21],  // 13
  [13, 15],         // 14
  [14, 8, 7, 23],   // 15
  [17, 23],         // 16
  [16, 18, 9],      // 17
  [17, 19],         // 18
  [18, 20, 11],     // 19
  [19, 21],         // 20
  [20, 22, 13],     // 21
  [21, 23],         // 22
  [22, 16, 15],     // 23
];

const ALL_MILLS: number[][] = [
  // Outer Square
  [0, 1, 2], [2, 3, 4], [4, 5, 6], [6, 7, 0],
  // Middle Square
  [8, 9, 10], [10, 11, 12], [12, 13, 14], [14, 15, 8],
  // Inner Square
  [16, 17, 18], [18, 19, 20], [20, 21, 22], [22, 23, 16],
  // Crossbars
  [1, 9, 17], [3, 11, 19], [5, 13, 21], [7, 15, 23],
];

export const NineMensMorris: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();

  const [board, setBoard] = useState<PointState[]>(() => Array(24).fill(null));
  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [p1Reserve, setP1Reserve] = useState<number>(9);
  const [p2Reserve, setP2Reserve] = useState<number>(9);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [isRemovingPiece, setIsRemovingPiece] = useState<boolean>(false);
  const [winner, setWinner] = useState<PlayerNumber | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Phase 1 (Placement): Player 1, place a piece from reserve');

  // Check if point p is part of any active mill for owner
  const isPartOfMill = useCallback(
    (p: number, currentBoard: PointState[], owner: PlayerNumber): boolean => {
      for (const mill of ALL_MILLS) {
        if (mill.includes(p)) {
          if (mill.every((idx) => currentBoard[idx] === owner)) {
            return true;
          }
        }
      }
      return false;
    },
    []
  );

  // Check if ALL pieces of a player on the board are currently inside mills
  const areAllPiecesInMills = useCallback(
    (currentBoard: PointState[], player: PlayerNumber): boolean => {
      const playerPieces = currentBoard
        .map((owner, idx) => (owner === player ? idx : null))
        .filter((idx): idx is number => idx !== null);

      if (playerPieces.length === 0) return false;
      return playerPieces.every((idx) => isPartOfMill(idx, currentBoard, player));
    },
    [isPartOfMill]
  );

  // Check if a move formed a new mill
  const didFormMill = (point: number, currentBoard: PointState[], player: PlayerNumber): boolean => {
    return ALL_MILLS.some((mill) => mill.includes(point) && mill.every((idx) => currentBoard[idx] === player));
  };

  // Check for legal moves in Movement / Flying phase
  const hasLegalMoves = useCallback(
    (currentBoard: PointState[], player: PlayerNumber, isFlying: boolean): boolean => {
      const playerPieces = currentBoard
        .map((owner, idx) => (owner === player ? idx : null))
        .filter((idx): idx is number => idx !== null);

      if (isFlying) {
        // Can fly to any empty space
        return currentBoard.some((cell) => cell === null);
      }

      // Normal movement: check if any adjacent point is empty
      for (const idx of playerPieces) {
        const neighbors = ADJACENCY[idx];
        if (neighbors.some((n) => currentBoard[n] === null)) {
          return true;
        }
      }
      return false;
    },
    []
  );

  // Handle Point Interaction
  const handlePointClick = (idx: number) => {
    if (winner !== null) return;
    const isP1 = turn === 1;
    const opponent: PlayerNumber = isP1 ? 2 : 1;

    // Sub-Phase: Removing an Opponent Piece after forming a Mill
    if (isRemovingPiece) {
      if (board[idx] !== opponent) return;

      // Mill Protection Rule: Cannot remove piece in an active mill unless all are in mills
      const inMill = isPartOfMill(idx, board, opponent);
      const allInMills = areAllPiecesInMills(board, opponent);

      if (inMill && !allInMills) {
        triggerHaptic('medium');
        setStatusMessage('Protected! Cannot remove a piece from an active mill while other pieces exist.');
        return;
      }

      // Remove opponent piece
      triggerHaptic('success');
      playCaptureSound();

      const newBoard = [...board];
      newBoard[idx] = null;
      setBoard(newBoard);
      setIsRemovingPiece(false);

      // Check win condition: Has opponent been reduced to fewer than 3 pieces after placement phase?
      const oppPiecesCount = newBoard.filter((p) => p === opponent).length;
      const oppReserve = opponent === 1 ? p1Reserve : p2Reserve;

      if (oppReserve === 0 && oppPiecesCount < 3) {
        setWinner(turn);
        playVictorySound();
        setStatusMessage(`Player ${turn} wins! Opponent reduced to fewer than 3 pieces.`);
        setGameStatus('finished');
        return;
      }

      // Check if opponent is trapped with zero moves
      const isOppFlying = oppPiecesCount === 3;
      if (oppReserve === 0 && !hasLegalMoves(newBoard, opponent, isOppFlying)) {
        setWinner(turn);
        playVictorySound();
        setStatusMessage(`Player ${turn} wins! Opponent has no legal moves.`);
        setGameStatus('finished');
        return;
      }

      // Pass turn to opponent
      setTurn(opponent);
      setSelectedPoint(null);
      const isPlacement = (isP1 ? p2Reserve : p1Reserve) > 0;
      setStatusMessage(
        isPlacement
          ? `Piece removed! Player ${opponent}: Place a piece from reserve.`
          : `Piece removed! Player ${opponent}: Move a piece.`
      );
      setGameStatus('active');
      return;
    }

    // PHASE 1: Placement Phase (Placing unplaced pieces from reserve)
    const currentReserve = isP1 ? p1Reserve : p2Reserve;
    if (currentReserve > 0) {
      if (board[idx] !== null) return;

      triggerHaptic('light');
      playWoodPieceMoveSound();

      const newBoard = [...board];
      newBoard[idx] = turn;
      setBoard(newBoard);

      if (isP1) setP1Reserve((r) => r - 1);
      else setP2Reserve((r) => r - 1);

      // Check if this placement formed a mill
      if (didFormMill(idx, newBoard, turn)) {
        triggerHaptic('medium');
        setIsRemovingPiece(true);
        setStatusMessage(`MILL FORMED! 💥 Player ${turn}, select an opponent piece to capture.`);
      } else {
        const nextTurn = opponent;
        setTurn(nextTurn);
        const nextReserve = nextTurn === 1 ? p1Reserve : p2Reserve - (isP1 ? 0 : 1);
        setStatusMessage(
          nextReserve > 0
            ? `Player ${nextTurn}: Place a piece from reserve (${nextReserve} left)`
            : `Player ${nextTurn}: Move a piece along the lines`
        );
        setGameStatus('active');
      }
      return;
    }

    // PHASE 2 & 3: Movement & Flying Phase
    const myPiecesCount = board.filter((p) => p === turn).length;
    const isFlying = myPiecesCount === 3;

    if (selectedPoint === null) {
      // Selecting piece to move
      if (board[idx] === turn) {
        triggerHaptic('light');
        setSelectedPoint(idx);
        setStatusMessage(
          isFlying
            ? `Flying: Piece selected! Tap ANY empty point on the board to fly.`
            : `Piece selected! Tap an adjacent connected empty point to move.`
        );
      }
    } else {
      // If clicking own piece again, reselect
      if (board[idx] === turn) {
        triggerHaptic('light');
        setSelectedPoint(idx);
        return;
      }

      // Moving to target point
      if (board[idx] === null) {
        const isLegal = isFlying || ADJACENCY[selectedPoint].includes(idx);
        if (!isLegal) {
          triggerHaptic('medium');
          return;
        }

        triggerHaptic('light');
        playWoodPieceMoveSound();

        const newBoard = [...board];
        newBoard[selectedPoint] = null;
        newBoard[idx] = turn;
        setBoard(newBoard);
        setSelectedPoint(null);

        // Check if mill formed
        if (didFormMill(idx, newBoard, turn)) {
          triggerHaptic('medium');
          setIsRemovingPiece(true);
          setStatusMessage(`MILL FORMED! 💥 Player ${turn}, select an opponent piece to capture.`);
        } else {
          // Check if opponent has legal moves
          const oppCount = newBoard.filter((p) => p === opponent).length;
          const oppFlying = oppCount === 3;
          if (!hasLegalMoves(newBoard, opponent, oppFlying)) {
            setWinner(turn);
            playVictorySound();
            setStatusMessage(`Player ${turn} wins! Opponent has zero legal moves.`);
            setGameStatus('finished');
            return;
          }

          setTurn(opponent);
          setStatusMessage(`Player ${opponent}'s turn: Select a piece to move.`);
          setGameStatus('active');
        }
      }
    }
  };

  const handleRestart = () => {
    setBoard(Array(24).fill(null));
    setTurn(1);
    setP1Reserve(9);
    setP2Reserve(9);
    setSelectedPoint(null);
    setIsRemovingPiece(false);
    setWinner(null);
    setStatusMessage('Phase 1 (Placement): Player 1, place a piece from reserve');
    setGameStatus('active');
  };

  // Board layout geometry in SVG
  const svgSize = 360;
  const margin = 35;
  const usable = svgSize - margin * 2;
  const step = usable / 6; // Grid step (0 to 6)

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden select-none">
      <GameHeader
        gameId="nine-mens-morris"
        gameName="Nine Men's Morris"
        turn={turn}
        statusText={`Player ${turn}'s Turn (${turn === 1 ? 'Dark Walnut' : 'Light Maple'})`}
        subStatusText={statusMessage}
      />

      {/* Main Board Arena */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden">
        {/* Reserve Tracker Bar */}
        <div className="w-full max-w-sm flex items-center justify-between px-3 py-1.5 bg-container-dark/95 border border-[#3e444c] rounded-2xl shadow-xl mb-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-[#3e2723] border border-[#5d4037] inline-block shadow-sm" />
            <span className="font-bold text-white">P1 Reserve: {p1Reserve}</span>
          </div>
          <span className="text-[10px] font-black uppercase text-amber-400">
            {p1Reserve > 0 || p2Reserve > 0 ? 'Placement Phase' : 'Movement Phase'}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white">P2 Reserve: {p2Reserve}</span>
            <span className="w-3.5 h-3.5 rounded-full bg-[#faedcd] border border-[#d4a373] inline-block shadow-sm" />
          </div>
        </div>

        {/* Blonde Oak Slab SVG Board Container */}
        <div className="relative flex items-center justify-center max-h-[70vh] aspect-square clubhouse-board-depth table-flat rounded-3xl overflow-hidden shadow-2xl border-4 border-[#8c5932] bg-[#d4a373]">
          <svg viewBox={`0 0 ${svgSize} ${svgSize}`} className="w-full h-full touch-none select-none">
            <defs>
              <linearGradient id="oakWood" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e5b887" />
                <stop offset="50%" stopColor="#d4a373" />
                <stop offset="100%" stopColor="#c59261" />
              </linearGradient>

              {/* Dark Walnut Gradient (P1) */}
              <radialGradient id="walnutPiece" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#5d4037" />
                <stop offset="60%" stopColor="#271506" />
                <stop offset="100%" stopColor="#140a03" />
              </radialGradient>

              {/* Light Maple Gradient (P2) */}
              <radialGradient id="maplePiece" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="60%" stopColor="#faedcd" />
                <stop offset="100%" stopColor="#d4a373" />
              </radialGradient>
            </defs>

            {/* Board Background */}
            <rect width={svgSize} height={svgSize} fill="url(#oakWood)" />

            {/* 3 Concentric Squares */}
            {/* Outer Square */}
            <rect
              x={margin}
              y={margin}
              width={usable}
              height={usable}
              fill="none"
              stroke="#5c3818"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            {/* Middle Square */}
            <rect
              x={margin + step}
              y={margin + step}
              width={usable - step * 2}
              height={usable - step * 2}
              fill="none"
              stroke="#5c3818"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Inner Square */}
            <rect
              x={margin + step * 2}
              y={margin + step * 2}
              width={usable - step * 4}
              height={usable - step * 4}
              fill="none"
              stroke="#5c3818"
              strokeWidth="3"
              strokeLinejoin="round"
            />

            {/* 4 Connecting Crossbars */}
            {/* Top Crossbar */}
            <line
              x1={margin + step * 3}
              y1={margin}
              x2={margin + step * 3}
              y2={margin + step * 2}
              stroke="#5c3818"
              strokeWidth="3.5"
            />
            {/* Bottom Crossbar */}
            <line
              x1={margin + step * 3}
              y1={margin + step * 4}
              x2={margin + step * 3}
              y2={margin + usable}
              stroke="#5c3818"
              strokeWidth="3.5"
            />
            {/* Left Crossbar */}
            <line
              x1={margin}
              y1={margin + step * 3}
              x2={margin + step * 2}
              y2={margin + step * 3}
              stroke="#5c3818"
              strokeWidth="3.5"
            />
            {/* Right Crossbar */}
            <line
              x1={margin + step * 4}
              y1={margin + step * 3}
              x2={margin + usable}
              y2={margin + step * 3}
              stroke="#5c3818"
              strokeWidth="3.5"
            />

            {/* 24 Board Intersection Points */}
            {POINT_COORDS.map(([gx, gy], idx) => {
              const cx = margin + gx * step;
              const cy = margin + gy * step;
              const occupant = board[idx];
              const isSelected = selectedPoint === idx;
              const isMoveTarget =
                selectedPoint !== null &&
                board[idx] === null &&
                (board.filter((p) => p === turn).length === 3 || ADJACENCY[selectedPoint].includes(idx));
              const isRemovableTarget =
                isRemovingPiece &&
                occupant === (turn === 1 ? 2 : 1) &&
                (!isPartOfMill(idx, board, turn === 1 ? 2 : 1) || areAllPiecesInMills(board, turn === 1 ? 2 : 1));

              return (
                <g key={idx} onClick={() => handlePointClick(idx)} className="cursor-pointer">
                  {/* Intersection Dot */}
                  <circle cx={cx} cy={cy} r="6" fill="#3e2312" />

                  {/* Empty Point Hover Ring */}
                  {occupant === null && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="12"
                      fill="transparent"
                      stroke={isMoveTarget ? '#22c55e' : 'transparent'}
                      strokeWidth="2.5"
                      strokeDasharray={isMoveTarget ? '3 3' : undefined}
                      className={isMoveTarget ? 'animate-pulse' : 'hover:fill-black/10'}
                    />
                  )}

                  {/* Turned Wooden Pieces */}
                  {occupant !== null && (
                    <g>
                      {/* Piece Drop Shadow */}
                      <ellipse cx={cx + 1.5} cy={cy + 3} rx="12" ry="7" fill="rgba(0,0,0,0.4)" />

                      {/* Main Turned Wood Disc */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r="12"
                        fill={occupant === 1 ? 'url(#walnutPiece)' : 'url(#maplePiece)'}
                        stroke={occupant === 1 ? '#4e342e' : '#e0a96d'}
                        strokeWidth="1.5"
                      />

                      {/* Concentric Wood Turn Ring */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r="8"
                        fill="none"
                        stroke={occupant === 1 ? '#3e2723' : '#faedcd'}
                        strokeWidth="0.8"
                        opacity="0.8"
                      />

                      {/* Center Dimple */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r="2.5"
                        fill={occupant === 1 ? '#1a0c03' : '#c59261'}
                      />

                      {/* Selection Glow Indicator */}
                      {isSelected && (
                        <circle
                          cx={cx}
                          cy={cy}
                          r="15"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2.5"
                          className="animate-pulse"
                        />
                      )}

                      {/* Removable Target Glow (Mill Capture) */}
                      {isRemovableTarget && (
                        <circle
                          cx={cx}
                          cy={cy}
                          r="15"
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="2.5"
                          strokeDasharray="4 2"
                          className="animate-bounce"
                        />
                      )}
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
          gameName="Nine Men's Morris"
          onRestart={handleRestart}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};

export default NineMensMorris;
