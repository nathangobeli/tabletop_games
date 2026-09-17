// Universal Lightweight Heuristic AI Engine for Tabletop Games
// Provides fast, non-blocking tactical decisions for solo "VS CPU" play across all games.

import type { PlayerNumber } from '../types/game';

// =======================================================
// 1. MANCALA HEURISTIC AI
// =======================================================
export const getMancalaAIMove = (board: number[], cpuPlayer: PlayerNumber = 2): number => {
  // Pits: P1 is 0..5 (store 6), P2 is 7..12 (store 13)
  const legalPits = cpuPlayer === 2 
    ? [7, 8, 9, 10, 11, 12].filter((p) => board[p] > 0)
    : [0, 1, 2, 3, 4, 5].filter((p) => board[p] > 0);

  if (legalPits.length === 0) return -1;

  const myStore = cpuPlayer === 2 ? 13 : 6;
  const oppStore = cpuPlayer === 2 ? 6 : 13;
  const myPitMin = cpuPlayer === 2 ? 7 : 0;
  const myPitMax = cpuPlayer === 2 ? 12 : 5;

  let bestPit = legalPits[0];
  let highestScore = -Infinity;

  for (const pit of legalPits) {
    const stones = board[pit];
    let score = 0;

    // Simulate sowing trajectory
    let curr = pit;
    let storeLanded = 0;

    for (let s = 0; s < stones; s++) {
      curr = (curr + 1) % 14;
      if (curr === oppStore) {
        curr = (curr + 1) % 14;
      }
      if (curr === myStore) {
        storeLanded++;
      }
    }

    const lastPit = curr;

    // 1. Priority 1: EXTRA TURN (last stone lands in own store)
    if (lastPit === myStore) {
      score += 120;
    }

    // 2. Priority 2: CAPTURE OPPORTUNITY
    // If last stone lands in an empty pit on CPU side, capture that stone + opposite pit stones
    if (lastPit >= myPitMin && lastPit <= myPitMax) {
      const wouldBeEmptyBefore = board[lastPit] === 0 || (lastPit === pit && stones > 14);
      const oppositePit = 12 - lastPit;
      const oppStones = board[oppositePit];
      if (wouldBeEmptyBefore && oppStones > 0) {
        score += 60 + oppStones * 4;
      }
    }

    // 3. Store deposit points
    score += storeLanded * 10;

    // 4. Defensive positioning: prefer emptying pits that opponent could capture
    const oppositePit = 12 - pit;
    if (board[oppositePit] === 0) {
      score += 5; // moving out of an open-threat pit
    }

    // Add slight tie-breaker preference for deeper pits
    score += (pit - myPitMin) * 0.5;

    if (score > highestScore) {
      highestScore = score;
      bestPit = pit;
    }
  }

  return bestPit;
};

// =======================================================
// 2. CONNECT FOUR 2-PLY SCAN
// =======================================================
export const getConnectFourAIMove = (grid: (0 | 1 | 2)[][], cpuPlayer: 1 | 2 = 2): number => {
  const ROWS = grid.length;
  const COLS = grid[0].length;
  const oppPlayer: 1 | 2 = cpuPlayer === 1 ? 2 : 1;

  const validCols: number[] = [];
  const colOrder = [3, 2, 4, 1, 5, 0, 6];
  for (const c of colOrder) {
    if (grid[0][c] === 0) validCols.push(c);
  }
  if (validCols.length === 0) return 0;

  const checkWinAt = (g: (0 | 1 | 2)[][], r: number, c: number, p: 1 | 2): boolean => {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of directions) {
      let count = 1;
      let step = 1;
      while (true) {
        const nr = r + dr * step;
        const nc = c + dc * step;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && g[nr][nc] === p) {
          count++;
          step++;
        } else break;
      }
      step = 1;
      while (true) {
        const nr = r - dr * step;
        const nc = c - dc * step;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && g[nr][nc] === p) {
          count++;
          step++;
        } else break;
      }
      if (count >= 4) return true;
    }
    return false;
  };

  const getLowestRow = (g: (0 | 1 | 2)[][], col: number): number => {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (g[r][col] === 0) return r;
    }
    return -1;
  };

  // 1. Immediate Win Check for CPU
  for (const col of validCols) {
    const r = getLowestRow(grid, col);
    if (r !== -1 && checkWinAt(grid, r, col, cpuPlayer)) {
      return col;
    }
  }

  // 2. Immediate Block Opponent Win
  for (const col of validCols) {
    const r = getLowestRow(grid, col);
    if (r !== -1 && checkWinAt(grid, r, col, oppPlayer)) {
      return col;
    }
  }

  // 3. Avoid moves that give opponent an instant win directly above
  const safeCols: number[] = [];
  for (const col of validCols) {
    const r = getLowestRow(grid, col);
    if (r > 0) {
      // Simulate drop
      const tempGrid = grid.map((row) => [...row]);
      tempGrid[r][col] = cpuPlayer;
      // Does opponent win by dropping into r-1?
      if (!checkWinAt(tempGrid, r - 1, col, oppPlayer)) {
        safeCols.push(col);
      }
    } else {
      safeCols.push(col);
    }
  }

  return safeCols.length > 0 ? safeCols[0] : validCols[0];
};

// =======================================================
// 3. DOTS AND BOXES HEURISTIC AI
// =======================================================
export interface DotsEdgeMove {
  type: 'h' | 'v';
  r: number;
  c: number;
}

export const getDotsAndBoxesAIMove = (
  hEdges: (0 | 1 | 2)[][],
  vEdges: (0 | 1 | 2)[][],
  boxes: (0 | 1 | 2)[][]
): DotsEdgeMove | null => {
  const countBoxEdges = (
    r: number,
    c: number,
    h: (0 | 1 | 2)[][],
    v: (0 | 1 | 2)[][]
  ): number => {
    let count = 0;
    if (h[r][c] !== 0) count++;
    if (h[r + 1][c] !== 0) count++;
    if (v[r][c] !== 0) count++;
    if (v[r][c + 1] !== 0) count++;
    return count;
  };

  const getAvailableEdges = (): DotsEdgeMove[] => {
    const list: DotsEdgeMove[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        if (hEdges[r][c] === 0) list.push({ type: 'h', r, c });
      }
    }
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        if (vEdges[r][c] === 0) list.push({ type: 'v', r, c });
      }
    }
    return list;
  };

  const available = getAvailableEdges();
  if (available.length === 0) return null;

  // 1. Immediate Box Completion Move
  for (const move of available) {
    const nextH = hEdges.map((row) => [...row]);
    const nextV = vEdges.map((row) => [...row]);
    if (move.type === 'h') nextH[move.r][move.c] = 2;
    else nextV[move.r][move.c] = 2;

    let completed = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (boxes[r][c] === 0 && countBoxEdges(r, c, nextH, nextV) === 4) {
          completed++;
        }
      }
    }
    if (completed > 0) return move;
  }

  // 2. Safe Move: Avoid creating a 3rd side on any box
  const safeMoves: DotsEdgeMove[] = [];
  for (const move of available) {
    const nextH = hEdges.map((row) => [...row]);
    const nextV = vEdges.map((row) => [...row]);
    if (move.type === 'h') nextH[move.r][move.c] = 2;
    else nextV[move.r][move.c] = 2;

    let createsThirdSide = false;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (boxes[r][c] === 0 && countBoxEdges(r, c, nextH, nextV) === 3) {
          createsThirdSide = true;
          break;
        }
      }
      if (createsThirdSide) break;
    }

    if (!createsThirdSide) {
      safeMoves.push(move);
    }
  }

  if (safeMoves.length > 0) {
    // Pick randomly from safe moves to feel natural
    return safeMoves[Math.floor(Math.random() * safeMoves.length)];
  }

  // 3. Sacrificial Move if no safe edge exists
  return available[0];
};

// =======================================================
// 4. RENEGADE (REVERSI) POSITIONAL HEURISTIC AI
// =======================================================
const REVERSI_WEIGHTS: number[][] = [
  [120, -30, 20,  5,  5, 20, -30, 120],
  [-30, -50, -5, -5, -5, -5, -50, -30],
  [ 20,  -5, 15,  3,  3, 15,  -5,  20],
  [  5,  -5,  3,  1,  1,  3,  -5,   5],
  [  5,  -5,  3,  1,  1,  3,  -5,   5],
  [ 20,  -5, 15,  3,  3, 15,  -5,  20],
  [-30, -50, -5, -5, -5, -5, -50, -30],
  [120, -30, 20,  5,  5, 20, -30, 120],
];

export const getRenegadeAIMove = (
  validMovesMap: Map<string, [number, number][]>,
  board: (0 | 1 | 2)[][]
): [number, number] | null => {
  if (validMovesMap.size === 0) return null;

  let bestMove: [number, number] | null = null;
  let highestScore = -Infinity;

  validMovesMap.forEach((flips, key) => {
    const [r, c] = key.split(',').map(Number);
    let weight = REVERSI_WEIGHTS[r][c];

    // If corner is already occupied by CPU (2), C-squares and X-squares are safe!
    const corners = [
      { cr: 0, cc: 0, adj: [[0, 1], [1, 0], [1, 1]] },
      { cr: 0, cc: 7, adj: [[0, 6], [1, 7], [1, 6]] },
      { cr: 7, cc: 0, adj: [[6, 0], [7, 1], [6, 1]] },
      { cr: 7, cc: 7, adj: [[6, 7], [7, 6], [6, 6]] },
    ];

    for (const { cr, cc, adj } of corners) {
      if (board[cr][cc] === 2) {
        if (adj.some(([ar, ac]) => ar === r && ac === c)) {
          weight = 15; // safely claim border adjacent to owned corner
        }
      }
    }

    // Score combines positional weight + flip count
    const score = weight + flips.length * 2.5;

    if (score > highestScore) {
      highestScore = score;
      bestMove = [r, c];
    }
  });

  return bestMove;
};

// =======================================================
// 5. YACHT DICE EXPECTED VALUE AI
// =======================================================
export type YachtCategoryKey =
  | 'ones'
  | 'twos'
  | 'threes'
  | 'fours'
  | 'fives'
  | 'sixes'
  | 'choice'
  | 'fourOfAKind'
  | 'fullHouse'
  | 'smallStraight'
  | 'largeStraight'
  | 'yacht';

export interface YachtAIDecision {
  action: 'hold' | 'score';
  heldIndices?: number[];
  category?: YachtCategoryKey;
}

export const getYachtDiceAIMove = (
  dice: { value: number; held: boolean }[],
  rollsRemaining: number,
  scorecard: Partial<Record<YachtCategoryKey, number>>,
  calculateScore: (key: YachtCategoryKey, values: number[]) => number
): YachtAIDecision => {
  const values = dice.map((d) => d.value);
  const counts = new Map<number, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));

  const isCategoryOpen = (k: YachtCategoryKey) => scorecard[k] === undefined;

  // 1. If rolls remain, decide whether to re-roll and which dice to hold
  if (rollsRemaining > 0) {
    // A. Five of a kind (Yacht achieved!)
    if (Array.from(counts.values()).some((c) => c === 5)) {
      if (isCategoryOpen('yacht')) {
        return { action: 'score', category: 'yacht' };
      }
    }

    // B. Large Straight achieved
    const sortedStr = [...values].sort((a, b) => a - b).join('');
    if ((sortedStr === '12345' || sortedStr === '23456') && isCategoryOpen('largeStraight')) {
      return { action: 'score', category: 'largeStraight' };
    }

    // C. Full House achieved
    const countArr = Array.from(counts.values()).sort((a, b) => b - a);
    if (countArr[0] === 3 && countArr[1] === 2 && isCategoryOpen('fullHouse')) {
      return { action: 'score', category: 'fullHouse' };
    }

    // D. Build toward Straights: if 4 sequential unique numbers exist
    const uniqueSorted = Array.from(new Set(values)).sort((a, b) => a - b);
    const uStr = uniqueSorted.join('');
    if (
      (uStr.includes('1234') || uStr.includes('2345') || uStr.includes('3456')) &&
      (isCategoryOpen('smallStraight') || isCategoryOpen('largeStraight'))
    ) {
      // Hold the 4 straight dice
      const straightSeq = uStr.includes('1234') ? [1, 2, 3, 4] : uStr.includes('2345') ? [2, 3, 4, 5] : [3, 4, 5, 6];
      const holds: number[] = [];
      const usedValues = new Set<number>();
      dice.forEach((d, idx) => {
        if (straightSeq.includes(d.value) && !usedValues.has(d.value)) {
          holds.push(idx);
          usedValues.add(d.value);
        }
      });
      return { action: 'hold', heldIndices: holds };
    }

    // E. Hold matching multiples (prioritize higher values)
    let bestMultipleValue = -1;
    let maxCount = 1;
    for (const [val, count] of counts.entries()) {
      if (count > maxCount || (count === maxCount && val > bestMultipleValue)) {
        maxCount = count;
        bestMultipleValue = val;
      }
    }

    if (maxCount >= 2 && bestMultipleValue !== -1) {
      const holds = dice
        .map((d, i) => (d.value === bestMultipleValue ? i : -1))
        .filter((i) => i !== -1);
      return { action: 'hold', heldIndices: holds };
    }

    // Default: hold 5s and 6s
    const highHolds = dice
      .map((d, i) => (d.value >= 5 ? i : -1))
      .filter((i) => i !== -1);
    return { action: 'hold', heldIndices: highHolds };
  }

  // 2. No rolls remaining: select best open category to score
  const allCategories: YachtCategoryKey[] = [
    'yacht',
    'largeStraight',
    'smallStraight',
    'fullHouse',
    'fourOfAKind',
    'choice',
    'sixes',
    'fives',
    'fours',
    'threes',
    'twos',
    'ones',
  ];

  let bestCat: YachtCategoryKey = 'ones';
  let bestScore = -Infinity;

  for (const cat of allCategories) {
    if (!isCategoryOpen(cat)) continue;
    const pts = calculateScore(cat, values);

    // Heuristic weighting
    let weightedScore = pts;
    if (cat === 'yacht' && pts === 50) weightedScore += 100;
    if (cat === 'largeStraight' && pts === 40) weightedScore += 80;
    if (cat === 'smallStraight' && pts === 30) weightedScore += 60;
    if (cat === 'fullHouse' && pts === 25) weightedScore += 50;
    if (['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'].includes(cat) && pts > 0) {
      weightedScore += 15; // bonus towards the 35 upper section goal
    }

    if (weightedScore > bestScore) {
      bestScore = weightedScore;
      bestCat = cat;
    }
  }

  return { action: 'score', category: bestCat };
};

// =======================================================
// 6. PRESIDENT (DAIFUGO) CARD AI
// =======================================================
export const getPresidentAIMove = (
  hand: { id: string; rank: number; isJoker?: boolean }[],
  currentStack: { cards: { id: string; rank: number }[]; effectiveRank: number; count: number } | null,
  isRevolution: boolean
): string[] | null => {
  if (hand.length === 0) return null;

  // Group cards by rank
  const rankMap = new Map<number, string[]>();
  hand.forEach((c) => {
    const list = rankMap.get(c.rank) || [];
    list.push(c.id);
    rankMap.set(c.rank, list);
  });

  const sortedRanks = Array.from(rankMap.keys()).sort((a, b) => (isRevolution ? b - a : a - b));

  // Case A: CPU leads (stack is empty)
  if (!currentStack) {
    // Prefer playing lowest singles or pairs, saving 2s and Jokers for defense
    for (const r of sortedRanks) {
      if (r === 15 || r === 99) continue; // save 2 and Joker
      const cardIds = rankMap.get(r)!;
      // Play single or pair
      return cardIds.slice(0, Math.min(2, cardIds.length));
    }
    // If only 2s/Jokers left, play lowest
    const firstRank = sortedRanks[0];
    return rankMap.get(firstRank)!.slice(0, 1);
  }

  // Case B: Must match stack count and beat effectiveRank
  const neededCount = currentStack.count;
  const targetRank = currentStack.effectiveRank;

  for (const r of sortedRanks) {
    const beats = isRevolution ? r < targetRank : r > targetRank;
    if (beats) {
      const cardIds = rankMap.get(r)!;
      if (cardIds.length >= neededCount) {
        // Conserve 2s and Jokers if opponent has many cards
        if ((r === 15 || r === 99) && hand.length > 4) {
          continue;
        }
        return cardIds.slice(0, neededCount);
      }
    }
  }

  // Pass if no suitable play
  return null;
};

// =======================================================
// 7. LAST CARD (SHEDDING) CARD AI
// =======================================================
export interface LastCardDecision {
  action: 'play' | 'draw';
  cardId?: string;
  chosenSuit?: 'spades' | 'hearts' | 'diamonds' | 'clubs';
  callLastCard?: boolean;
}

export const getLastCardAIMove = (
  hand: { id: string; suit: string; rank: string }[],
  topDiscard: { suit: string; rank: string },
  activeSuit: string,
  stackedDrawCount: number
): LastCardDecision => {
  // 1. Defend against stacked draws with a '2'
  if (stackedDrawCount > 0) {
    const drawTwoCard = hand.find((c) => c.rank === '2');
    if (drawTwoCard) {
      return {
        action: 'play',
        cardId: drawTwoCard.id,
        callLastCard: hand.length === 2,
      };
    }
    return { action: 'draw' };
  }

  // 2. Playable cards matching suit or rank (excluding 8s for now)
  const regularMatches = hand.filter(
    (c) => c.rank !== '8' && (c.suit === activeSuit || c.rank === topDiscard.rank)
  );

  if (regularMatches.length > 0) {
    // Prioritize action cards (+2, Skip J, Again A) if helpful
    const actionCard = regularMatches.find((c) => ['2', 'J', 'A'].includes(c.rank));
    const chosen = actionCard || regularMatches[0];
    return {
      action: 'play',
      cardId: chosen.id,
      callLastCard: hand.length === 2,
    };
  }

  // 3. Play Wild 8 if available
  const wildCard = hand.find((c) => c.rank === '8');
  if (wildCard) {
    // Pick the suit CPU has the most of
    const suitCounts = { spades: 0, hearts: 0, diamonds: 0, clubs: 0 };
    hand.forEach((c) => {
      if (c.suit in suitCounts && c.rank !== '8') {
        suitCounts[c.suit as keyof typeof suitCounts]++;
      }
    });

    let bestSuit: 'spades' | 'hearts' | 'diamonds' | 'clubs' = 'spades';
    let maxS = -1;
    (Object.keys(suitCounts) as ('spades' | 'hearts' | 'diamonds' | 'clubs')[]).forEach((s) => {
      if (suitCounts[s] > maxS) {
        maxS = suitCounts[s];
        bestSuit = s;
      }
    });

    return {
      action: 'play',
      cardId: wildCard.id,
      chosenSuit: bestSuit,
      callLastCard: hand.length === 2,
    };
  }

  // 4. No legal plays -> Draw
  return { action: 'draw' };
};

// =======================================================
// 8. HANAFUDA KOI-KOI AI
// =======================================================
export interface HanafudaAIDecision {
  action: 'match' | 'discard' | 'decision';
  handCardId?: string;
  fieldCardId?: string;
  koiDecision?: 'stop' | 'koi';
}

export const getHanafudaAIMove = (
  hand: { id: string; month: number; type: string; isCup?: boolean }[],
  field: { id: string; month: number; type: string; isCup?: boolean }[],
  step: 'hand' | 'koi_decision',
  currentYakuScore: number
): HanafudaAIDecision => {
  if (step === 'koi_decision') {
    // Push-your-luck decision:
    // If secured 5+ points or hand is short, stop and take the win!
    if (currentYakuScore >= 5 || hand.length <= 2) {
      return { action: 'decision', koiDecision: 'stop' };
    }
    // Otherwise stop to secure guaranteed points
    return { action: 'decision', koiDecision: 'stop' };
  }

  // Find all cards in hand that match a card on the field
  const possibleMatches: { handCard: typeof hand[0]; fieldCard: typeof field[0]; value: number }[] = [];

  for (const h of hand) {
    for (const f of field) {
      if (h.month === f.month) {
        let val = 10;
        if (h.type === 'bright' || f.type === 'bright') val += 50;
        if (h.isCup || f.isCup) val += 45;
        if (h.type === 'animal' || f.type === 'animal') val += 20;
        if (h.type === 'ribbon' || f.type === 'ribbon') val += 20;
        possibleMatches.push({ handCard: h, fieldCard: f, value: val });
      }
    }
  }

  if (possibleMatches.length > 0) {
    possibleMatches.sort((a, b) => b.value - a.value);
    const top = possibleMatches[0];
    return {
      action: 'match',
      handCardId: top.handCard.id,
      fieldCardId: top.fieldCard.id,
    };
  }

  // No match: discard lowest value card (chaff)
  const chaff = hand.find((c) => c.type === 'chaff') || hand[0];
  return {
    action: 'discard',
    handCardId: chaff.id,
  };
};

// =======================================================
// 9. HEX CONNECTIVITY AI
// =======================================================
export const getHexAIMove = (
  board: (1 | 2 | null)[][],
  cpuPlayer: 1 | 2 = 2
): { r: number; c: number } | null => {
  const SIZE = board.length;
  const oppPlayer: 1 | 2 = cpuPlayer === 1 ? 2 : 1;

  const emptyCells: { r: number; c: number; score: number }[] = [];

  const deltas = [
    [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0]
  ];

  // 2-bridge offsets (virtual connections in Hex)
  const bridgeDeltas = [
    [-1, 2], [1, 1], [2, -1], [1, -2], [-1, -1], [-2, 1]
  ];

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== null) continue;

      let score = 0;

      // 1. Board center bias
      const centerDist = Math.hypot(r - 5, c - 5);
      score += Math.max(0, 8 - centerDist * 1.2);

      // 2. Player 2 connects Left (c=0) to Right (c=10)
      if (cpuPlayer === 2) {
        if (c === 0 || c === SIZE - 1) score += 15;
      } else {
        // Player 1 connects Top (r=0) to Bottom (r=10)
        if (r === 0 || r === SIZE - 1) score += 15;
      }

      // 3. Proximity to friendly stones
      for (const [dr, dc] of deltas) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
          if (board[nr][nc] === cpuPlayer) score += 18;
          else if (board[nr][nc] === oppPlayer) score += 12; // block opponent
        }
      }

      // 4. Two-bridge completion
      for (const [bdr, bdc] of bridgeDeltas) {
        const br = r + bdr;
        const bc = c + bdc;
        if (br >= 0 && br < SIZE && bc >= 0 && bc < SIZE && board[br][bc] === cpuPlayer) {
          score += 28;
        }
      }

      emptyCells.push({ r, c, score });
    }
  }

  if (emptyCells.length === 0) return null;

  emptyCells.sort((a, b) => b.score - a.score);
  return { r: emptyCells[0].r, c: emptyCells[0].c };
};
