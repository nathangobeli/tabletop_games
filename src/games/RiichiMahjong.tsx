import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import { GameContainer } from '../components/GameContainer';
import { useOrientation } from '../hooks/useOrientation';
import type { PlayerNumber } from '../types/game';
import {
  playTileClackSound,
  playCaptureSound,
  playVictorySound,
  triggerHaptic,
} from '../utils/feedback';
import { shuffleDeck, dealCards } from '../utils/deck';

export type TileSuit = 'pin' | 'sou' | 'man' | 'honor';

export interface MahjongTile {
  id: string;
  suit: TileSuit;
  value: number; // 1..9 for pin/sou, 1 or 9 for man, 1..7 for honors (1=East, 2=South, 3=West, 4=North, 5=White, 6=Green, 7=Red)
  label: string;
  kanji: string;
}

const HONOR_NAMES: Record<number, { label: string; kanji: string }> = {
  1: { label: 'East', kanji: '東' },
  2: { label: 'South', kanji: '南' },
  3: { label: 'West', kanji: '西' },
  4: { label: 'North', kanji: '北' },
  5: { label: 'White', kanji: '白' },
  6: { label: 'Green', kanji: '發' },
  7: { label: 'Red', kanji: '中' },
};

// Generate 108-Tile 2-Player Sanma Subset (4 copies each)
export const CREATE_SANMA_DECK = (): MahjongTile[] => {
  const deck: MahjongTile[] = [];

  for (let copy = 0; copy < 4; copy++) {
    // 1. Pinzu (Dots 1..9)
    for (let v = 1; v <= 9; v++) {
      deck.push({ id: `pin-${v}-${copy}`, suit: 'pin', value: v, label: `${v} Pin`, kanji: `${v}筒` });
    }

    // 2. Souzu (Bamboo 1..9)
    for (let v = 1; v <= 9; v++) {
      deck.push({ id: `sou-${v}-${copy}`, suit: 'sou', value: v, label: `${v} Sou`, kanji: `${v}索` });
    }

    // 3. Manzu (Terminals Only: 1-Man & 9-Man)
    deck.push({ id: `man-1-${copy}`, suit: 'man', value: 1, label: '1 Man', kanji: '一萬' });
    deck.push({ id: `man-9-${copy}`, suit: 'man', value: 9, label: '9 Man', kanji: '九萬' });

    // 4. Honors (Winds & Dragons 1..7)
    for (let v = 1; v <= 7; v++) {
      const h = HONOR_NAMES[v];
      deck.push({ id: `honor-${v}-${copy}`, suit: 'honor', value: v, label: h.label, kanji: h.kanji });
    }
  }

  return deck;
};

// Check hand for Win & Yaku
export interface YakuEvaluation {
  isWin: boolean;
  yakuList: string[];
  han: number;
  points: number;
}

export const evaluateHand = (
  tiles: MahjongTile[],
  melds: MahjongTile[][],
  isRiichi: boolean,
  isTsumo: boolean,
  doraTile: MahjongTile | null
): YakuEvaluation => {
  if (tiles.length % 3 !== 2) {
    return { isWin: false, yakuList: [], han: 0, points: 0 };
  }

  const allTiles = [...tiles, ...melds.flat()];

  // Check Seven Pairs (Chitoitsu)
  if (tiles.length === 14 && melds.length === 0) {
    const counts: Record<string, number> = {};
    tiles.forEach((t) => {
      const key = `${t.suit}-${t.value}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    const pairCount = Object.values(counts).filter((c) => c === 2).length;
    if (pairCount === 7) {
      const yaku = ['Seven Pairs (Chitoitsu - 2 Han)'];
      let han = 2;
      if (isRiichi) {
        yaku.push('Riichi (1 Han)');
        han += 1;
      }
      return { isWin: true, yakuList: yaku, han, points: 4000 };
    }
  }

  // Count frequencies
  const counts: Record<string, number> = {};
  tiles.forEach((t) => {
    const key = `${t.suit}-${t.value}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  // Find candidate pairs for 4 sets + 1 pair
  let canWinStandard = false;
  const uniqueKeys = Object.keys(counts);

  for (const pairKey of uniqueKeys) {
    if (counts[pairKey] >= 2) {
      // Test remaining tiles
      const testCounts = { ...counts };
      testCounts[pairKey] -= 2;

      // Decompose sets
      if (decomposeSets(testCounts)) {
        canWinStandard = true;
        break;
      }
    }
  }

  if (!canWinStandard) {
    return { isWin: false, yakuList: [], han: 0, points: 0 };
  }

  // Detect Yaku
  const yakuList: string[] = [];
  let han = 0;

  if (isRiichi) {
    yakuList.push('Riichi (1 Han)');
    han += 1;
  }

  if (isTsumo && melds.length === 0) {
    yakuList.push('Menzen Tsumo (1 Han)');
    han += 1;
  }

  // Tanyao (All Simples) - No 1, 9, or Honors
  const isTanyao = allTiles.every(
    (t) => t.suit !== 'honor' && t.value >= 2 && t.value <= 8
  );
  if (isTanyao) {
    yakuList.push('All Simples (Tanyao - 1 Han)');
    han += 1;
  }

  // Dragons (Yakuhai)
  const dragonCounts = {
    white: allTiles.filter((t) => t.suit === 'honor' && t.value === 5).length,
    green: allTiles.filter((t) => t.suit === 'honor' && t.value === 6).length,
    red: allTiles.filter((t) => t.suit === 'honor' && t.value === 7).length,
  };
  if (dragonCounts.white >= 3) {
    yakuList.push('White Dragon (Haku - 1 Han)');
    han += 1;
  }
  if (dragonCounts.green >= 3) {
    yakuList.push('Green Dragon (Hatsu - 1 Han)');
    han += 1;
  }
  if (dragonCounts.red >= 3) {
    yakuList.push('Red Dragon (Chun - 1 Han)');
    han += 1;
  }

  // Honitsu (Half Flush) & Chinitsu (Full Flush)
  const suitsPresent = new Set(allTiles.map((t) => t.suit));
  if (suitsPresent.size === 1 && !suitsPresent.has('honor')) {
    yakuList.push('Full Flush (Chinitsu - 6 Han)');
    han += 6;
  } else if (suitsPresent.size === 2 && suitsPresent.has('honor')) {
    yakuList.push('Half Flush (Honitsu - 3 Han)');
    han += 3;
  }

  // Dora count
  if (doraTile) {
    const doraCount = allTiles.filter(
      (t) => t.suit === doraTile.suit && t.value === doraTile.value
    ).length;
    if (doraCount > 0) {
      yakuList.push(`Dora (+${doraCount} Han)`);
      han += doraCount;
    }
  }

  // Fallback 1-Han win for head-to-head fun if structured properly
  if (han === 0) {
    yakuList.push('Standard Hand (1 Han)');
    han = 1;
  }

  // Points calculation
  let points = 1000;
  if (han === 2) points = 2000;
  else if (han === 3) points = 4000;
  else if (han >= 4 && han <= 5) points = 8000; // Mangan
  else if (han >= 6 && han <= 7) points = 12000; // Haneman
  else if (han >= 8) points = 16000; // Baiman

  return { isWin: true, yakuList, han, points };
};

// Helper to check if tile frequencies decompose into triplets and sequences
const decomposeSets = (counts: Record<string, number>): boolean => {
  const keys = Object.keys(counts).filter((k) => counts[k] > 0);
  if (keys.length === 0) return true;

  keys.sort();
  const firstKey = keys[0];
  const [suit, valStr] = firstKey.split('-');
  const val = parseInt(valStr, 10);

  // Try Triplet
  if (counts[firstKey] >= 3) {
    counts[firstKey] -= 3;
    if (decomposeSets(counts)) return true;
    counts[firstKey] += 3;
  }

  // Try Sequence (only for pin/sou)
  if (suit !== 'honor' && val <= 7) {
    const k2 = `${suit}-${val + 1}`;
    const k3 = `${suit}-${val + 2}`;
    if ((counts[k2] || 0) >= 1 && (counts[k3] || 0) >= 1) {
      counts[firstKey] -= 1;
      counts[k2] -= 1;
      counts[k3] -= 1;
      if (decomposeSets(counts)) return true;
      counts[firstKey] += 1;
      counts[k2] += 1;
      counts[k3] += 1;
    }
  }

  return false;
};

export const MahjongTileGraphic: React.FC<{
  tile: MahjongTile;
  isSelected?: boolean;
  isDora?: boolean;
  onClick?: () => void;
  small?: boolean;
}> = ({ tile, isSelected, isDora = false, onClick, small = false }) => {
  const isRed = tile.suit === 'honor' && tile.value === 7;
  const isGreen = tile.suit === 'honor' && tile.value === 6;

  const textColor = isRed
    ? 'text-rose-600'
    : isGreen
    ? 'text-emerald-600'
    : tile.suit === 'honor'
    ? 'text-indigo-900'
    : tile.suit === 'sou'
    ? 'text-emerald-700'
    : tile.suit === 'pin'
    ? 'text-blue-700'
    : 'text-amber-800';

  const tileWidth = small ? 'clamp(18px, 3.2vw, 30px)' : 'clamp(24px, 4.8vw, 42px)';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`relative rounded-lg select-none transition-all duration-150 transform cursor-pointer flex items-center justify-center p-0.5 shrink-0 ${
        isSelected
          ? 'ring-3 ring-amber-400 -translate-y-3 scale-108 z-30 shadow-2xl'
          : 'hover:-translate-y-1 shadow-md hover:shadow-xl active:scale-95'
      }`}
      style={{
        width: tileWidth,
        aspectRatio: '3 / 4',
        backgroundColor: '#78350f', // Bamboo wood backing
      }}
    >
      {/* Ivory Resin Front Face */}
      <div className="w-full h-full rounded-md bg-[#fffdfa] border border-[#d6d3d1] shadow-inner flex flex-col items-center justify-between p-0.5 sm:p-1 relative overflow-hidden">
        {/* Kanji / Value Glyph */}
        <span
          className={`font-black ${textColor} leading-none`}
          style={{ fontSize: small ? 'clamp(9px, 1.8vw, 13px)' : 'clamp(12px, 2.5vw, 20px)' }}
        >
          {tile.kanji}
        </span>

        {/* Small label indicator */}
        <span
          className="font-bold text-stone-500 uppercase tracking-tighter"
          style={{ fontSize: small ? '6px' : 'clamp(6px, 0.9vw, 8px)' }}
        >
          {tile.suit === 'honor' ? tile.label.slice(0, 3) : `${tile.value}${tile.suit[0]}`}
        </span>

        {/* Dora Star */}
        {isDora && (
          <span className="absolute top-0.5 right-1 text-[7px] sm:text-[8px] text-amber-500 font-black">
            ★
          </span>
        )}

        {/* Specular resin gloss */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/30 pointer-events-none" />
      </div>
    </button>
  );
};

export const RiichiMahjong: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();

  const [wall, setWall] = useState<MahjongTile[]>([]);
  const [doraTile, setDoraTile] = useState<MahjongTile | null>(null);

  const [handP1, setHandP1] = useState<MahjongTile[]>([]);
  const [handP2, setHandP2] = useState<MahjongTile[]>([]);
  const [meldsP1, setMeldsP1] = useState<MahjongTile[][]>([]);
  const [meldsP2, setMeldsP2] = useState<MahjongTile[][]>([]);

  const [riverP1, setRiverP1] = useState<MahjongTile[]>([]);
  const [riverP2, setRiverP2] = useState<MahjongTile[]>([]);

  const [pointsP1, setPointsP1] = useState<number>(25000);
  const [pointsP2, setPointsP2] = useState<number>(25000);

  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [turnStep, setTurnStep] = useState<'draw' | 'discard' | 'call_response'>('draw');
  const [drawnTile, setDrawnTile] = useState<MahjongTile | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);

  const [riichiP1, setRiichiP1] = useState<boolean>(false);
  const [riichiP2, setRiichiP2] = useState<boolean>(false);

  const [statusMessage, setStatusMessage] = useState<string>('Player 1: Draw a tile to begin.');
  const [winner, setWinner] = useState<PlayerNumber | null>(null);
  const [winningDetails, setWinningDetails] = useState<YakuEvaluation | null>(null);

  // Sort Hand helper
  const sortHand = (tiles: MahjongTile[]) => {
    const suitOrder: Record<TileSuit, number> = { pin: 1, sou: 2, man: 3, honor: 4 };
    return [...tiles].sort((a, b) => {
      if (a.suit !== b.suit) return suitOrder[a.suit] - suitOrder[b.suit];
      return a.value - b.value;
    });
  };

  // Initialize Game
  const resetGame = useCallback(() => {
    const deck = shuffleDeck(CREATE_SANMA_DECK());
    const { hands, remaining: remainingWall } = dealCards(deck, [13, 13, 1]);
    const [p1Raw, p2Raw, doraArr] = hands;

    const p1 = sortHand(p1Raw);
    const p2 = sortHand(p2Raw);
    const dora = doraArr[0];

    setWall(remainingWall);
    setDoraTile(dora);
    setHandP1(p1);
    setHandP2(p2);
    setMeldsP1([]);
    setMeldsP2([]);
    setRiverP1([]);
    setRiverP2([]);
    setRiichiP1(false);
    setRiichiP2(false);
    setTurn(1);
    setTurnStep('draw');
    setDrawnTile(null);
    setSelectedTileId(null);
    setWinner(null);
    setWinningDetails(null);
    setStatusMessage('Player 1: Draw your tile from the wall.');
    setGameStatus('active');
  }, [setGameStatus]);

  // Initial deal
  useEffect(() => {
    resetGame();
  }, [resetGame]);

  const activeHand = turn === 1 ? handP1 : handP2;
  const activeMelds = turn === 1 ? meldsP1 : meldsP2;
  const activeRiichi = turn === 1 ? riichiP1 : riichiP2;

  // Active full hand
  const fullHand = useMemo(() => {
    if (drawnTile) return [...activeHand, drawnTile];
    return activeHand;
  }, [activeHand, drawnTile]);

  // Check winning on Tsumo (self-draw)
  const tsumoEvaluation = useMemo(() => {
    if (turnStep !== 'discard' || !drawnTile) return { isWin: false, yakuList: [], han: 0, points: 0 };
    return evaluateHand(fullHand, activeMelds, activeRiichi, true, doraTile);
  }, [turnStep, drawnTile, fullHand, activeMelds, activeRiichi, doraTile]);

  // Check Ron availability on opponent's last discard
  const lastDiscard = useMemo(() => {
    const oppRiver = turn === 1 ? riverP2 : riverP1;
    return oppRiver.length > 0 ? oppRiver[oppRiver.length - 1] : null;
  }, [turn, riverP1, riverP2]);

  const ronEvaluation = useMemo(() => {
    if (!lastDiscard) return { isWin: false, yakuList: [], han: 0, points: 0 };
    const testHand = [...activeHand, lastDiscard];
    return evaluateHand(testHand, activeMelds, activeRiichi, false, doraTile);
  }, [lastDiscard, activeHand, activeMelds, activeRiichi, doraTile]);

  // Check Pon availability on opponent's discard
  const canPon = useMemo(() => {
    if (!lastDiscard) return false;
    const count = activeHand.filter(
      (t) => t.suit === lastDiscard.suit && t.value === lastDiscard.value
    ).length;
    return count >= 2;
  }, [lastDiscard, activeHand]);

  // Step 1: Draw Tile from Wall
  const handleDrawTile = useCallback(() => {
    if (wall.length === 0) {
      setStatusMessage('Wall exhausted (Ryuukyoku - Exhaustive Draw)!');
      return;
    }

    playTileClackSound();
    triggerHaptic('light');

    const [tile, ...nextWall] = wall;
    setWall(nextWall);
    setDrawnTile(tile);
    setTurnStep('discard');

    // If active player is in Riichi: auto-win if tsumo, else auto-discard!
    if (activeRiichi) {
      const evalWin = evaluateHand([...activeHand, tile], activeMelds, true, true, doraTile);
      if (evalWin.isWin) {
        // Auto Tsumo
        handleTsumoWin(evalWin);
      } else {
        // Auto discard drawn tile
        setTimeout(() => {
          handleDiscard(tile);
        }, 800);
      }
    } else {
      setStatusMessage(`Player ${turn} drew ${tile.label}. Select a tile to discard.`);
    }
  }, [wall, activeRiichi, activeHand, activeMelds, doraTile, turn]);

  // Step 2: Discard Tile
  const handleDiscard = (tile: MahjongTile) => {
    playTileClackSound();
    triggerHaptic('medium');

    const fullCurrent = drawnTile ? [...activeHand, drawnTile] : activeHand;
    const nextHand = sortHand(fullCurrent.filter((t) => t.id !== tile.id));

    if (turn === 1) {
      setHandP1(nextHand);
      setRiverP1((prev) => [...prev, tile]);
    } else {
      setHandP2(nextHand);
      setRiverP2((prev) => [...prev, tile]);
    }

    setDrawnTile(null);
    setSelectedTileId(null);

    // Pass turn to opponent
    const nextPlayer: PlayerNumber = turn === 1 ? 2 : 1;
    setTurn(nextPlayer);
    setTurnStep('draw');
    setStatusMessage(`Player ${turn} discarded ${tile.label}. Player ${nextPlayer}'s turn.`);
  };

  // Declare Riichi
  const handleDeclareRiichi = () => {
    if (activeRiichi || (turn === 1 ? pointsP1 : pointsP2) < 1000) return;

    playTileClackSound();
    triggerHaptic('success');

    if (turn === 1) {
      setRiichiP1(true);
      setPointsP1((prev) => prev - 1000);
    } else {
      setRiichiP2(true);
      setPointsP2((prev) => prev - 1000);
    }

    setStatusMessage(`🚨 RIICHI DECLARED! Player ${turn} deposited 1,000 pts! Auto-draw enabled.`);
  };

  // Win on Tsumo
  const handleTsumoWin = (evalWin = tsumoEvaluation) => {
    if (!evalWin.isWin) return;
    playVictorySound();
    triggerHaptic('success');

    const payout = evalWin.points;
    if (turn === 1) {
      setPointsP1((p) => p + payout);
      setPointsP2((p) => Math.max(0, p - payout));
    } else {
      setPointsP2((p) => p + payout);
      setPointsP1((p) => Math.max(0, p - payout));
    }

    setWinner(turn);
    setWinningDetails(evalWin);
    setStatusMessage(`Player ${turn} declared TSUMO! (${evalWin.han} Han - ${payout} pts)`);
  };

  // Win on Ron (Opponent Discard)
  const handleRonWin = () => {
    if (!ronEvaluation.isWin || !lastDiscard) return;
    playVictorySound();
    triggerHaptic('success');

    const payout = ronEvaluation.points;
    if (turn === 1) {
      setPointsP1((p) => p + payout);
      setPointsP2((p) => Math.max(0, p - payout));
    } else {
      setPointsP2((p) => p + payout);
      setPointsP1((p) => Math.max(0, p - payout));
    }

    setWinner(turn);
    setWinningDetails(ronEvaluation);
    setStatusMessage(`Player ${turn} declared RON on ${lastDiscard.label}! (${ronEvaluation.han} Han - ${payout} pts)`);
  };

  // Call Pon on Opponent Discard
  const handleCallPon = () => {
    if (!lastDiscard || !canPon) return;
    playTileClackSound();
    triggerHaptic('medium');

    // Find 2 matching tiles in hand
    const matching = activeHand.filter(
      (t) => t.suit === lastDiscard.suit && t.value === lastDiscard.value
    ).slice(0, 2);

    const remainingHand = activeHand.filter(
      (t) => !matching.some((m) => m.id === t.id)
    );

    const meld = [...matching, lastDiscard];

    if (turn === 1) {
      setHandP1(remainingHand);
      setMeldsP1((prev) => [...prev, meld]);
      setRiverP2((prev) => prev.slice(0, prev.length - 1)); // Remove from opponent river
    } else {
      setHandP2(remainingHand);
      setMeldsP2((prev) => [...prev, meld]);
      setRiverP1((prev) => prev.slice(0, prev.length - 1));
    }

    setTurnStep('discard');
    setStatusMessage(`Player ${turn} called PON on ${lastDiscard.label}! Select a tile to discard.`);
  };

  return (
    <GameContainer className="flex flex-col h-full w-full justify-between overflow-hidden select-none">
      <GameHeader
        gameId="riichi-mahjong"
        gameName="Riichi Mahjong (2-Player Duel)"
        turn={turn}
        statusText={`Player ${turn}'s Turn`}
        subStatusText={statusMessage}
      />

      {/* Main Mat Arena - Responsive scaling */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-between p-1.5 sm:p-3 overflow-hidden w-full max-w-5xl mx-auto">
        {/* Top Status & Point Sticks */}
        <div className="w-full flex items-center justify-between px-3 py-1.5 bg-black/60 border border-[#3e444c] rounded-2xl shadow-md shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-player-1" />
            <span className={`text-xs font-black ${turn === 1 ? 'text-player-1' : 'text-stone-400'}`}>
              P1: {pointsP1.toLocaleString()} pts
            </span>
            {riichiP1 && (
              <span className="text-[9px] bg-rose-600 text-white px-1.5 py-0.5 rounded font-black uppercase shadow-xs">
                Riichi
              </span>
            )}
          </div>

          {/* Dora Indicator Plate */}
          <div className="flex items-center gap-2 px-3 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-xs font-black">
            <span className="text-emerald-400">DORA:</span>
            {doraTile && (
              <div className="scale-75">
                <MahjongTileGraphic tile={doraTile} isDora small />
              </div>
            )}
            <span className="text-white/60 text-[10px] ml-1">Wall: {wall.length}</span>
          </div>

          <div className="flex items-center gap-2">
            {riichiP2 && (
              <span className="text-[9px] bg-rose-600 text-white px-1.5 py-0.5 rounded font-black uppercase shadow-xs">
                Riichi
              </span>
            )}
            <span className={`text-xs font-black ${turn === 2 ? 'text-player-2' : 'text-stone-400'}`}>
              P2: {pointsP2.toLocaleString()} pts
            </span>
            <span className="w-3 h-3 rounded-full bg-player-2" />
          </div>
        </div>

        {/* Central Green Baize Table with Discard River (Kawa) */}
        <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center py-1">
          <div className="w-full h-full max-h-[46vh] bg-[#064e3b] rounded-3xl border-4 border-[#022c22] shadow-2xl p-2 sm:p-3 flex flex-col justify-between relative overflow-hidden clubhouse-board-depth">
            {/* P2 Discard River (Top) */}
            <div className="w-full flex flex-col items-center">
              <span className="text-[9px] font-bold text-emerald-300/70 uppercase mb-0.5">
                Player 2 River (Discards)
              </span>
              <div className="flex flex-wrap gap-1 max-w-md justify-center">
                {riverP2.map((tile) => (
                  <MahjongTileGraphic key={tile.id} tile={tile} small />
                ))}
              </div>
            </div>

            {/* Riichi Center Tenbo Stick Display */}
            <div className="flex items-center justify-center gap-4 my-1">
              {(riichiP1 || riichiP2) && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 border border-white/20 text-white text-[10px] font-black animate-pulse">
                  <span>🎯 Riichi Pot:</span>
                  <span>{((riichiP1 ? 1000 : 0) + (riichiP2 ? 1000 : 0)).toLocaleString()} pts</span>
                </div>
              )}
            </div>

            {/* P1 Discard River (Bottom) */}
            <div className="w-full flex flex-col items-center">
              <div className="flex flex-wrap gap-1 max-w-md justify-center mb-0.5">
                {riverP1.map((tile) => (
                  <MahjongTileGraphic key={tile.id} tile={tile} small />
                ))}
              </div>
              <span className="text-[9px] font-bold text-emerald-300/70 uppercase">
                Player 1 River (Discards)
              </span>
            </div>
          </div>
        </div>

        {/* Floating Call Action Bar directly above player hand */}
        <div className="w-full flex items-center justify-center gap-2 z-20 my-1 shrink-0">
          {turnStep === 'draw' && !activeRiichi && (
            <button
              type="button"
              onClick={handleDrawTile}
              className="px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center gap-1.5"
            >
              <span>🀄 Draw Tile</span>
            </button>
          )}

          {tsumoEvaluation.isWin && (
            <button
              type="button"
              onClick={() => handleTsumoWin()}
              className="px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-stone-950 font-black text-xs uppercase tracking-wider shadow-xl animate-bounce active:scale-95 transition-all"
            >
              🏆 Declare TSUMO! ({tsumoEvaluation.points}p)
            </button>
          )}

          {ronEvaluation.isWin && (
            <button
              type="button"
              onClick={handleRonWin}
              className="px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white font-black text-xs uppercase tracking-wider shadow-xl animate-bounce active:scale-95 transition-all"
            >
              ⚡ Declare RON! ({ronEvaluation.points}p)
            </button>
          )}

          {canPon && !activeRiichi && (
            <button
              type="button"
              onClick={handleCallPon}
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all"
            >
              📢 Call PON!
            </button>
          )}

          {!activeRiichi && (turn === 1 ? pointsP1 : pointsP2) >= 1000 && activeMelds.length === 0 && (
            <button
              type="button"
              onClick={handleDeclareRiichi}
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-400 border border-amber-400/40 font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all"
            >
              🎯 Riichi (1,000p)
            </button>
          )}
        </div>

        {/* Active Player Hand & Exposed Melds */}
        <div className="w-full flex flex-col items-center shrink-0 px-1">
          <div className="w-full flex items-center justify-between text-[11px] font-bold text-stone-300 mb-1 px-2">
            <span>
              Player {turn}'s Hand ({fullHand.length} tiles)
            </span>
            {turnStep === 'discard' && (
              <span className="text-amber-400 font-black animate-pulse">
                Tap tile to discard
              </span>
            )}
          </div>

          <div className="w-full flex items-center justify-center gap-1 sm:gap-1.5 overflow-x-auto py-1 px-1">
            {/* Concealed Hand */}
            {activeHand.map((tile) => (
              <MahjongTileGraphic
                key={tile.id}
                tile={tile}
                isSelected={selectedTileId === tile.id}
                isDora={doraTile?.suit === tile.suit && doraTile?.value === tile.value}
                onClick={turnStep === 'discard' && !activeRiichi ? () => handleDiscard(tile) : undefined}
              />
            ))}

            {/* Drawn 14th Tile */}
            {drawnTile && (
              <div className="ml-1.5 pl-1.5 border-l-2 border-white/20">
                <MahjongTileGraphic
                  tile={drawnTile}
                  isSelected={selectedTileId === drawnTile.id}
                  isDora={doraTile?.suit === drawnTile.suit && doraTile?.value === drawnTile.value}
                  onClick={turnStep === 'discard' && !activeRiichi ? () => handleDiscard(drawnTile) : undefined}
                />
              </div>
            )}

            {/* Exposed Melds */}
            {activeMelds.length > 0 && (
              <div className="ml-2 pl-2 border-l-2 border-amber-400/40 flex gap-1.5">
                {activeMelds.map((meld, mIdx) => (
                  <div key={mIdx} className="flex gap-0.5 bg-black/30 p-1 rounded-lg">
                    {meld.map((t) => (
                      <MahjongTileGraphic key={t.id} tile={t} small />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Victory Game Over Modal */}
      {winner !== null && winningDetails && (
        <GameOverModal
          winner={winner}
          gameName="Riichi Mahjong"
          stats={[
            {
              label: 'Final Payout',
              p1Value: winner === 1 ? `+${winningDetails.points.toLocaleString()} pts` : `-${winningDetails.points.toLocaleString()} pts`,
              p2Value: winner === 2 ? `+${winningDetails.points.toLocaleString()} pts` : `-${winningDetails.points.toLocaleString()} pts`,
            },
            {
              label: 'Yaku Formed',
              p1Value: winner === 1 ? winningDetails.yakuList.join(', ') : '-',
              p2Value: winner === 2 ? winningDetails.yakuList.join(', ') : '-',
            },
            {
              label: 'Total Han',
              p1Value: winner === 1 ? `${winningDetails.han} Han` : '-',
              p2Value: winner === 2 ? `${winningDetails.han} Han` : '-',
            },
          ]}
          onRestart={resetGame}
          onMenu={resetToMenu}
        />
      )}
    </GameContainer>
  );
};
