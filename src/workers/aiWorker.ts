// Web Worker for Tabletop Games AI Engine
// Runs Minimax with Alpha-Beta Pruning off the main UI thread

export interface AIRequestMessage {
  id: string;
  game: 'connect-four' | 'checkers' | 'gomoku';
  board: unknown;
  player: number; // typically 2 for CPU
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface AIResponseMessage {
  id: string;
  move: unknown;
  score?: number;
}

// ==========================================
// 1. CONNECT FOUR MINIMAX (ALPHA-BETA)
// ==========================================
const C4_ROWS = 6;
const C4_COLS = 7;

type C4Grid = (0 | 1 | 2)[][];

const evaluateC4Window = (window: number[], player: number): number => {
  const opponent = player === 1 ? 2 : 1;
  let score = 0;

  const playerCount = window.filter((c) => c === player).length;
  const emptyCount = window.filter((c) => c === 0).length;
  const oppCount = window.filter((c) => c === opponent).length;

  if (playerCount === 4) return 100000;
  if (playerCount === 3 && emptyCount === 1) score += 20;
  else if (playerCount === 2 && emptyCount === 2) score += 5;

  if (oppCount === 3 && emptyCount === 1) score -= 80; // Heavy block threat

  return score;
};

const scoreC4Board = (grid: C4Grid, player: number): number => {
  let score = 0;

  // Center column preference
  const centerCol = Math.floor(C4_COLS / 2);
  let centerCount = 0;
  for (let r = 0; r < C4_ROWS; r++) {
    if (grid[r][centerCol] === player) centerCount++;
  }
  score += centerCount * 6;

  // Horizontal windows
  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c <= C4_COLS - 4; c++) {
      const window = [grid[r][c], grid[r][c + 1], grid[r][c + 2], grid[r][c + 3]];
      score += evaluateC4Window(window, player);
    }
  }

  // Vertical windows
  for (let c = 0; c < C4_COLS; c++) {
    for (let r = 0; r <= C4_ROWS - 4; r++) {
      const window = [grid[r][c], grid[r + 1][c], grid[r + 2][c], grid[r + 3][c]];
      score += evaluateC4Window(window, player);
    }
  }

  // Positive diagonal windows
  for (let r = 0; r <= C4_ROWS - 4; r++) {
    for (let c = 0; c <= C4_COLS - 4; c++) {
      const window = [grid[r][c], grid[r + 1][c + 1], grid[r + 2][c + 2], grid[r + 3][c + 3]];
      score += evaluateC4Window(window, player);
    }
  }

  // Negative diagonal windows
  for (let r = 3; r < C4_ROWS; r++) {
    for (let c = 0; c <= C4_COLS - 4; c++) {
      const window = [grid[r][c], grid[r - 1][c + 1], grid[r - 2][c + 2], grid[r - 3][c + 3]];
      score += evaluateC4Window(window, player);
    }
  }

  return score;
};

const isC4Win = (grid: C4Grid, player: number): boolean => {
  // Horizontal
  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c <= C4_COLS - 4; c++) {
      if (grid[r][c] === player && grid[r][c + 1] === player && grid[r][c + 2] === player && grid[r][c + 3] === player) {
        return true;
      }
    }
  }
  // Vertical
  for (let c = 0; c < C4_COLS; c++) {
    for (let r = 0; r <= C4_ROWS - 4; r++) {
      if (grid[r][c] === player && grid[r + 1][c] === player && grid[r + 2][c] === player && grid[r + 3][c] === player) {
        return true;
      }
    }
  }
  // Diagonals
  for (let r = 0; r <= C4_ROWS - 4; r++) {
    for (let c = 0; c <= C4_COLS - 4; c++) {
      if (grid[r][c] === player && grid[r + 1][c + 1] === player && grid[r + 2][c + 2] === player && grid[r + 3][c + 3] === player) {
        return true;
      }
    }
  }
  for (let r = 3; r < C4_ROWS; r++) {
    for (let c = 0; c <= C4_COLS - 4; c++) {
      if (grid[r][c] === player && grid[r - 1][c + 1] === player && grid[r - 2][c + 2] === player && grid[r - 3][c + 3] === player) {
        return true;
      }
    }
  }
  return false;
};

const getC4ValidColumns = (grid: C4Grid): number[] => {
  const valid: number[] = [];
  // Center-first move ordering for faster alpha-beta pruning
  const order = [3, 2, 4, 1, 5, 0, 6];
  for (const c of order) {
    if (grid[0][c] === 0) valid.push(c);
  }
  return valid;
};

const dropC4Disc = (grid: C4Grid, col: number, player: 1 | 2): { nextGrid: C4Grid; row: number } => {
  const nextGrid = grid.map((r) => [...r]);
  let row = -1;
  for (let r = C4_ROWS - 1; r >= 0; r--) {
    if (nextGrid[r][col] === 0) {
      nextGrid[r][col] = player;
      row = r;
      break;
    }
  }
  return { nextGrid, row };
};

const minimaxC4 = (
  grid: C4Grid,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  cpuPlayer: number
): { score: number; bestCol: number } => {
  const oppPlayer = cpuPlayer === 1 ? 2 : 1;
  const validCols = getC4ValidColumns(grid);

  if (isC4Win(grid, cpuPlayer)) return { score: 1000000 + depth, bestCol: -1 };
  if (isC4Win(grid, oppPlayer)) return { score: -1000000 - depth, bestCol: -1 };
  if (validCols.length === 0 || depth === 0) {
    return { score: scoreC4Board(grid, cpuPlayer), bestCol: -1 };
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    let bestCol = validCols[0];
    for (const c of validCols) {
      const { nextGrid } = dropC4Disc(grid, c, cpuPlayer as 1 | 2);
      const evalResult = minimaxC4(nextGrid, depth - 1, alpha, beta, false, cpuPlayer);
      if (evalResult.score > maxEval) {
        maxEval = evalResult.score;
        bestCol = c;
      }
      alpha = Math.max(alpha, evalResult.score);
      if (beta <= alpha) break;
    }
    return { score: maxEval, bestCol };
  } else {
    let minEval = Infinity;
    let bestCol = validCols[0];
    for (const c of validCols) {
      const { nextGrid } = dropC4Disc(grid, c, oppPlayer as 1 | 2);
      const evalResult = minimaxC4(nextGrid, depth - 1, alpha, beta, true, cpuPlayer);
      if (evalResult.score < minEval) {
        minEval = evalResult.score;
        bestCol = c;
      }
      beta = Math.min(beta, evalResult.score);
      if (beta <= alpha) break;
    }
    return { score: minEval, bestCol };
  }
};

export const solveConnectFour = (grid: C4Grid, cpuPlayer = 2, depth = 5): number => {
  // 1. Immediate win check
  const valid = getC4ValidColumns(grid);
  for (const c of valid) {
    const { nextGrid } = dropC4Disc(grid, c, cpuPlayer as 1 | 2);
    if (isC4Win(nextGrid, cpuPlayer)) return c;
  }
  // 2. Immediate block check
  const opp = cpuPlayer === 1 ? 2 : 1;
  for (const c of valid) {
    const { nextGrid } = dropC4Disc(grid, c, opp as 1 | 2);
    if (isC4Win(nextGrid, opp)) return c;
  }

  // 3. Minimax
  const result = minimaxC4(grid, depth, -Infinity, Infinity, true, cpuPlayer);
  return result.bestCol;
};

// ==========================================
// 2. CHECKERS MINIMAX (ALPHA-BETA)
// ==========================================
type CheckerPiece = 0 | 1 | 2 | 3 | 4; // 1=P1 men, 2=P2 men (CPU), 3=P1 king, 4=P2 king

interface CheckersMove {
  fromR: number;
  fromC: number;
  toR: number;
  toC: number;
  isJump: boolean;
  capturedR?: number;
  capturedC?: number;
}

const getCheckersMovesForPiece = (
  b: CheckerPiece[][],
  r: number,
  c: number,
  player: number
): CheckersMove[] => {
  const piece = b[r][c];
  if (piece === 0) return [];
  const isP1 = piece === 1 || piece === 3;
  if (isP1 !== (player === 1)) return [];

  const isKing = piece === 3 || piece === 4;
  const moves: CheckersMove[] = [];

  const dirRows = isKing ? [-1, 1] : player === 1 ? [-1] : [1];
  const dirCols = [-1, 1];

  for (const dr of dirRows) {
    for (const dc of dirCols) {
      const nr = r + dr;
      const nc = c + dc;
      // Normal single slide
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && b[nr][nc] === 0) {
        moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, isJump: false });
      }
      // Jump capture
      const jr = r + dr * 2;
      const jc = c + dc * 2;
      if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && b[jr][jc] === 0) {
        const mid = b[nr][nc];
        const isMidOpponent = player === 1 ? (mid === 2 || mid === 4) : (mid === 1 || mid === 3);
        if (isMidOpponent) {
          moves.push({ fromR: r, fromC: c, toR: jr, toC: jc, isJump: true, capturedR: nr, capturedC: nc });
        }
      }
    }
  }

  return moves;
};

const getAllCheckersMoves = (b: CheckerPiece[][], player: number): CheckersMove[] => {
  const allMoves: CheckersMove[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      allMoves.push(...getCheckersMovesForPiece(b, r, c, player));
    }
  }
  // Mandatory Jump rule: If any jump exists, only jumps are legal!
  const jumps = allMoves.filter((m) => m.isJump);
  return jumps.length > 0 ? jumps : allMoves;
};

const applyCheckersMove = (b: CheckerPiece[][], move: CheckersMove): CheckerPiece[][] => {
  const next = b.map((row) => [...row]);
  const p = next[move.fromR][move.fromC];
  next[move.fromR][move.fromC] = 0;

  if (move.isJump && move.capturedR !== undefined && move.capturedC !== undefined) {
    next[move.capturedR][move.capturedC] = 0;
  }

  // King promotion
  let finalPiece = p;
  if (p === 1 && move.toR === 0) finalPiece = 3;
  if (p === 2 && move.toR === 7) finalPiece = 4;

  next[move.toR][move.toC] = finalPiece;
  return next;
};

const evaluateCheckersBoard = (b: CheckerPiece[][], player: number): number => {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (p === 0) continue;
      let val = 0;
      if (p === 1) val = -10 - (7 - r) * 0.5; // P1 men
      else if (p === 3) val = -22;           // P1 king
      else if (p === 2) val = 10 + r * 0.5;   // P2 men
      else if (p === 4) val = 22;            // P2 king

      // Center board positioning bonus
      if (c >= 2 && c <= 5 && r >= 2 && r <= 5) {
        val += p === 2 || p === 4 ? 1.5 : -1.5;
      }

      score += val;
    }
  }
  return player === 2 ? score : -score;
};

const minimaxCheckers = (
  b: CheckerPiece[][],
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  player: number
): { score: number; bestMove: CheckersMove | null } => {
  const opp = player === 1 ? 2 : 1;
  const currentP = isMaximizing ? player : opp;
  const moves = getAllCheckersMoves(b, currentP);

  if (moves.length === 0) {
    return { score: isMaximizing ? -10000 : 10000, bestMove: null };
  }
  if (depth === 0) {
    return { score: evaluateCheckersBoard(b, player), bestMove: moves[0] };
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    let bestMove = moves[0];
    for (const m of moves) {
      const nextB = applyCheckersMove(b, m);
      const evalRes = minimaxCheckers(nextB, depth - 1, alpha, beta, false, player);
      if (evalRes.score > maxEval) {
        maxEval = evalRes.score;
        bestMove = m;
      }
      alpha = Math.max(alpha, evalRes.score);
      if (beta <= alpha) break;
    }
    return { score: maxEval, bestMove };
  } else {
    let minEval = Infinity;
    let bestMove = moves[0];
    for (const m of moves) {
      const nextB = applyCheckersMove(b, m);
      const evalRes = minimaxCheckers(nextB, depth - 1, alpha, beta, true, player);
      if (evalRes.score < minEval) {
        minEval = evalRes.score;
        bestMove = m;
      }
      beta = Math.min(beta, evalRes.score);
      if (beta <= alpha) break;
    }
    return { score: minEval, bestMove };
  }
};

export const solveCheckers = (b: CheckerPiece[][], cpuPlayer = 2, depth = 4): CheckersMove | null => {
  const result = minimaxCheckers(b, depth, -Infinity, Infinity, true, cpuPlayer);
  return result.bestMove;
};

// ==========================================
// 3. GOMOKU THREAT-SPACE MINIMAX
// ==========================================
type GomokuGrid = (0 | 1 | 2)[][];
const GOMOKU_SIZE = 15;

const evaluateGomokuDirection = (
  b: GomokuGrid,
  r: number,
  c: number,
  dr: number,
  dc: number,
  player: number
): number => {
  let count = 1;
  let openEnds = 0;

  // Forward
  let step = 1;
  while (true) {
    const nr = r + dr * step;
    const nc = c + dc * step;
    if (nr < 0 || nr >= GOMOKU_SIZE || nc < 0 || nc >= GOMOKU_SIZE) break;
    if (b[nr][nc] === player) count++;
    else if (b[nr][nc] === 0) {
      openEnds++;
      break;
    } else break;
    step++;
  }

  // Backward
  step = 1;
  while (true) {
    const nr = r - dr * step;
    const nc = c - dc * step;
    if (nr < 0 || nr >= GOMOKU_SIZE || nc < 0 || nc >= GOMOKU_SIZE) break;
    if (b[nr][nc] === player) count++;
    else if (b[nr][nc] === 0) {
      openEnds++;
      break;
    } else break;
    step++;
  }

  if (count >= 5) return 100000;
  if (count === 4) return openEnds === 2 ? 10000 : openEnds === 1 ? 1200 : 0;
  if (count === 3) return openEnds === 2 ? 1000 : openEnds === 1 ? 150 : 0;
  if (count === 2) return openEnds === 2 ? 80 : 10;
  return 1;
};

const evaluateGomokuPosition = (b: GomokuGrid, r: number, c: number, player: number): number => {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  let score = 0;
  for (const [dr, dc] of directions) {
    score += evaluateGomokuDirection(b, r, c, dr, dc, player);
  }
  return score;
};

export const solveGomoku = (b: GomokuGrid, cpuPlayer = 2): [number, number] => {
  const opp = cpuPlayer === 1 ? 2 : 1;

  // Get active candidates near placed stones
  const candidates: [number, number][] = [];
  const candidateSet = new Set<string>();

  let hasStones = false;
  for (let r = 0; r < GOMOKU_SIZE; r++) {
    for (let c = 0; c < GOMOKU_SIZE; c++) {
      if (b[r][c] !== 0) {
        hasStones = true;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < GOMOKU_SIZE && nc >= 0 && nc < GOMOKU_SIZE && b[nr][nc] === 0) {
              const key = `${nr},${nc}`;
              if (!candidateSet.has(key)) {
                candidateSet.add(key);
                candidates.push([nr, nc]);
              }
            }
          }
        }
      }
    }
  }

  // If opening on completely empty board, play center
  if (!hasStones || candidates.length === 0) {
    return [7, 7];
  }

  let bestScore = -Infinity;
  let bestMove = candidates[0];

  for (const [r, c] of candidates) {
    // Score offensive potential for CPU
    b[r][c] = cpuPlayer as 1 | 2;
    const cpuVal = evaluateGomokuPosition(b, r, c, cpuPlayer);

    // Score defensive denial against opponent
    b[r][c] = opp as 1 | 2;
    const oppVal = evaluateGomokuPosition(b, r, c, opp);

    b[r][c] = 0; // Revert

    // Heavy weight on blocking opponent 4-in-a-rows and creating own wins
    const totalScore = cpuVal + oppVal * 1.15 + (14 - Math.abs(r - 7) - Math.abs(c - 7));

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestMove = [r, c];
    }
  }

  return bestMove;
};

// ==========================================
// WORKER EVENT LISTENER
// ==========================================
self.onmessage = (e: MessageEvent<AIRequestMessage>) => {
  const { id, game, board, player, difficulty } = e.data;

  try {
    let move: unknown = null;

    if (game === 'connect-four') {
      const depth = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 4 : 5;
      move = solveConnectFour(board as C4Grid, player, depth);
    } else if (game === 'checkers') {
      const depth = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 3 : 4;
      move = solveCheckers(board as CheckerPiece[][], player, depth);
    } else if (game === 'gomoku') {
      move = solveGomoku(board as GomokuGrid, player);
    }

    const response: AIResponseMessage = { id, move };
    self.postMessage(response);
  } catch (err) {
    self.postMessage({ id, move: null, error: String(err) });
  }
};
