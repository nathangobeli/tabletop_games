import React, { useState, useEffect, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import {
  triggerHaptic,
  playPegSnapSound,
  playVictorySound,
} from '../utils/feedback';

export type PegColor = 'red' | 'blue' | 'green' | 'yellow' | 'orange' | 'purple';

interface RowGuess {
  pegs: (PegColor | null)[];
  hits: number;
  blows: number;
  player: PlayerNumber;
}

const PALETTE: { color: PegColor; label: string; hex: string; borderHex: string }[] = [
  { color: 'red', label: 'Red', hex: '#ef4444', borderHex: '#b91c1c' },
  { color: 'blue', label: 'Blue', hex: '#3b82f6', borderHex: '#1d4ed8' },
  { color: 'green', label: 'Green', hex: '#22c55e', borderHex: '#15803d' },
  { color: 'yellow', label: 'Yellow', hex: '#eab308', borderHex: '#a16207' },
  { color: 'orange', label: 'Orange', hex: '#f97316', borderHex: '#c2410c' },
  { color: 'purple', label: 'Purple', hex: '#a855f7', borderHex: '#7e22ce' },
];

const MAX_ROWS = 10;

export const HitAndBlow: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();

  // Mode: 'vs_codebreaker' (P1 creates secret code, P2 solves) | 'equal_duel' (P1 and P2 alternate solving random code)
  const [gameMode, setGameMode] = useState<'vs_codebreaker' | 'equal_duel'>('equal_duel');
  const [setupPhase, setSetupPhase] = useState<boolean>(false);
  const [secretCode, setSecretCode] = useState<PegColor[]>([]);
  const [showSecret, setShowSecret] = useState<boolean>(false);

  // Gameplay State
  const [rows, setRows] = useState<RowGuess[]>([]);
  const [currentRowPegs, setCurrentRowPegs] = useState<(PegColor | null)[]>([null, null, null, null]);
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [winner, setWinner] = useState<PlayerNumber | 'draw' | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Select peg colors to form your 4-peg guess');

  // Random Code Generator
  const generateRandomCode = useCallback((): PegColor[] => {
    const code: PegColor[] = [];
    for (let i = 0; i < 4; i++) {
      const randIdx = Math.floor(Math.random() * PALETTE.length);
      code.push(PALETTE[randIdx].color);
    }
    return code;
  }, []);

  // Initialize Game
  const initGame = useCallback(() => {
    if (gameMode === 'equal_duel') {
      const code = generateRandomCode();
      setSecretCode(code);
      setSetupPhase(false);
      setShowSecret(false);
      setStatusMessage('Equal Duel: P1 & P2 alternate guesses against mystery code!');
    } else {
      setSecretCode([]);
      setSetupPhase(true);
      setShowSecret(true);
      setStatusMessage('Secret Setup: Player 1, choose 4 secret pegs behind the shield');
    }

    setRows([]);
    setCurrentRowPegs([null, null, null, null]);
    setSelectedSlot(0);
    setTurn(1);
    setWinner(null);
  }, [gameMode, generateRandomCode]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  // Standard Mastermind Clue Feedback Calculation
  const calculateClues = (guess: PegColor[], secret: PegColor[]): { hits: number; blows: number } => {
    let hits = 0;
    let blows = 0;

    const secretUsed = [false, false, false, false];
    const guessUsed = [false, false, false, false];

    // 1. Check Hits (correct color & exact position)
    for (let i = 0; i < 4; i++) {
      if (guess[i] === secret[i]) {
        hits++;
        secretUsed[i] = true;
        guessUsed[i] = true;
      }
    }

    // 2. Check Blows (correct color, wrong position)
    for (let i = 0; i < 4; i++) {
      if (guessUsed[i]) continue;
      for (let j = 0; j < 4; j++) {
        if (!secretUsed[j] && guess[i] === secret[j]) {
          blows++;
          secretUsed[j] = true;
          break;
        }
      }
    }

    return { hits, blows };
  };

  // Color Palette Selection Handler
  const handleSelectColor = (color: PegColor) => {
    if (winner !== null) return;
    triggerHaptic('light');
    playPegSnapSound();

    if (setupPhase) {
      // In setup phase (Vs. Codebreaker mode)
      const nextCode = [...secretCode];
      if (nextCode.length < 4) {
        nextCode.push(color);
        setSecretCode(nextCode);
      }
      return;
    }

    // Gameplay row filling
    const nextPegs = [...currentRowPegs];
    nextPegs[selectedSlot] = color;
    setCurrentRowPegs(nextPegs);

    // Auto-advance slot to next open or wrap
    const nextOpen = nextPegs.findIndex((p, idx) => idx > selectedSlot && p === null);
    if (nextOpen !== -1) {
      setSelectedSlot(nextOpen);
    } else {
      setSelectedSlot((selectedSlot + 1) % 4);
    }
  };

  // Confirm Secret Setup (Vs Codebreaker)
  const handleConfirmSecret = () => {
    if (secretCode.length !== 4) return;
    triggerHaptic('medium');
    setShowSecret(false);
    setSetupPhase(false);
    setTurn(2);
    setStatusMessage('Code locked in vault! Player 2: You have 10 rows to crack the code.');
    setGameStatus('active');
  };

  // Submit Row Guess
  const handleSubmitGuess = () => {
    if (currentRowPegs.some((p) => p === null)) {
      triggerHaptic('medium');
      setStatusMessage('Incomplete row! Fill all 4 peg sockets before submitting.');
      return;
    }

    const fullGuess = currentRowPegs as PegColor[];
    const { hits, blows } = calculateClues(fullGuess, secretCode);

    triggerHaptic(hits === 4 ? 'success' : 'medium');

    const newRow: RowGuess = {
      pegs: fullGuess,
      hits,
      blows,
      player: turn,
    };

    const nextRows = [...rows, newRow];
    setRows(nextRows);
    setCurrentRowPegs([null, null, null, null]);
    setSelectedSlot(0);

    // Check Victory
    if (hits === 4) {
      setWinner(turn);
      setShowSecret(true);
      playVictorySound();
      setStatusMessage(`CODE CRACKED! 🎯 Player ${turn} solved the code with 4 Hits!`);
      setGameStatus('finished');
      return;
    }

    // Check if 10 rows exhausted
    if (nextRows.length >= MAX_ROWS) {
      setShowSecret(true);
      if (gameMode === 'vs_codebreaker') {
        setWinner(1); // Code maker wins
        setStatusMessage('Code Vault remained unbroken! Player 1 (Codemaker) wins!');
      } else {
        setWinner('draw');
        setStatusMessage('10 rows exhausted! The mystery code remained uncracked.');
      }
      setGameStatus('finished');
      return;
    }

    // Advance Turn
    if (gameMode === 'equal_duel') {
      const nextTurn: PlayerNumber = turn === 1 ? 2 : 1;
      setTurn(nextTurn);
      setStatusMessage(`Row ${nextRows.length}: ${hits} Hit(s), ${blows} Blow(s). Player ${nextTurn}'s turn.`);
    } else {
      setStatusMessage(`Row ${nextRows.length}: ${hits} Hit(s), ${blows} Blow(s). ${MAX_ROWS - nextRows.length} guesses left.`);
    }
    setGameStatus('active');
  };

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden select-none">
      <GameHeader
        gameId="hit-and-blow"
        gameName="Hit and Blow"
        turn={turn}
        statusText={`Player ${turn}'s Turn (${gameMode === 'equal_duel' ? 'Duel' : 'Vs. Codebreaker'})`}
        subStatusText={statusMessage}
      />

      {/* Main Console Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-3 overflow-hidden">
        {/* Top Console Mode & Vault Header */}
        <div className="w-full max-w-sm flex items-center justify-between px-3 py-1.5 bg-container-dark/95 border border-[#3e444c] rounded-2xl shadow-xl mb-1 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-amber-400">
              {gameMode === 'equal_duel' ? 'Equal Duel' : 'Vs Codebreaker'}
            </span>
          </div>

          {/* Mode Switcher Toggle */}
          <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setGameMode('equal_duel');
              }}
              className={`px-2 py-0.5 text-[9px] font-black rounded-lg transition-all ${
                gameMode === 'equal_duel' ? 'bg-amber-500 text-black' : 'text-white/60'
              }`}
            >
              Duel
            </button>
            <button
              type="button"
              onClick={() => {
                setGameMode('vs_codebreaker');
              }}
              className={`px-2 py-0.5 text-[9px] font-black rounded-lg transition-all ${
                gameMode === 'vs_codebreaker' ? 'bg-amber-500 text-black' : 'text-white/60'
              }`}
            >
              Vs P1
            </button>
          </div>
        </div>

        {/* Slanted Wooden Console Board */}
        <div className="w-full max-w-sm p-3 rounded-3xl bg-[#78350f] border-4 border-[#451a03] shadow-2xl clubhouse-board-depth flex flex-col gap-2">
          {/* Top Secret Code Vault Compartment */}
          <div className="w-full p-2 rounded-2xl bg-[#1e293b] border border-[#475569] flex items-center justify-between shadow-inner">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
              <span>🔒 Vault:</span>
            </span>

            {/* 4 Vault Peg Sockets */}
            <div className="flex items-center gap-2">
              {[0, 1, 2, 3].map((slotIdx) => {
                const col = setupPhase ? secretCode[slotIdx] : showSecret ? secretCode[slotIdx] : null;
                const paletteItem = PALETTE.find((p) => p.color === col);

                return (
                  <div
                    key={slotIdx}
                    className={`w-7 h-7 rounded-full flex items-center justify-center border-2 shadow-md ${
                      col && paletteItem
                        ? 'border-white/50'
                        : 'bg-[#0f172a] border-[#334155]'
                    }`}
                    style={{ backgroundColor: paletteItem ? paletteItem.hex : '#0f172a' }}
                  >
                    {!col && !showSecret && (
                      <span className="text-[10px] font-bold text-white/30">?</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Shield Confirmation Button in Setup */}
            {setupPhase && (
              <button
                type="button"
                onClick={handleConfirmSecret}
                disabled={secretCode.length !== 4}
                className="px-2.5 py-1 text-[10px] font-black uppercase rounded-xl bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-40 transition-all shadow-md active:scale-95"
              >
                Lock Code
              </button>
            )}
          </div>

          {/* 10-Row Pegboard Scrollable Container */}
          <div className="w-full max-h-[36vh] overflow-y-auto p-1.5 rounded-2xl bg-[#0f172a] border border-[#334155] flex flex-col gap-1.5 scrollbar-none">
            {/* Render Previous Rows */}
            {rows.map((row, rowIdx) => (
              <div
                key={rowIdx}
                className="flex items-center justify-between px-2 py-1 rounded-xl bg-white/5 border border-white/5 text-xs"
              >
                {/* Row Number */}
                <span className="w-4 text-[9px] font-bold text-white/40">{rowIdx + 1}</span>

                {/* 4 Guessed Pegs */}
                <div className="flex items-center gap-1.5">
                  {row.pegs.map((peg, pIdx) => {
                    const pItem = PALETTE.find((p) => p.color === peg);
                    return (
                      <div
                        key={pIdx}
                        className="w-6 h-6 rounded-full border border-white/40 shadow-inner"
                        style={{ backgroundColor: pItem?.hex }}
                      />
                    );
                  })}
                </div>

                {/* Player Tag */}
                <span
                  className={`text-[8px] font-black uppercase ${
                    row.player === 1 ? 'text-player-1' : 'text-player-2'
                  }`}
                >
                  P{row.player}
                </span>

                {/* Clue Pegs: 2x2 Grid (Black for Hits, White for Blows) */}
                <div className="grid grid-cols-2 gap-1 p-1 bg-black/40 rounded-lg border border-white/10">
                  {Array.from({ length: 4 }).map((_, cIdx) => {
                    const isHit = cIdx < row.hits;
                    const isBlow = cIdx >= row.hits && cIdx < row.hits + row.blows;

                    return (
                      <div
                        key={cIdx}
                        className={`w-2.5 h-2.5 rounded-full border ${
                          isHit
                            ? 'bg-black border-white shadow-sm'
                            : isBlow
                            ? 'bg-white border-black shadow-sm'
                            : 'bg-transparent border-white/20'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Current Active Input Row */}
            {!setupPhase && winner === null && rows.length < MAX_ROWS && (
              <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/40">
                <span className="w-4 text-[9px] font-bold text-amber-400">{rows.length + 1}</span>

                {/* 4 Active Slots */}
                <div className="flex items-center gap-1.5">
                  {currentRowPegs.map((peg, slotIdx) => {
                    const pItem = PALETTE.find((p) => p.color === peg);
                    const isSelected = selectedSlot === slotIdx;

                    return (
                      <div
                        key={slotIdx}
                        onClick={() => setSelectedSlot(slotIdx)}
                        className={`w-6 h-6 rounded-full cursor-pointer flex items-center justify-center border-2 transition-transform ${
                          isSelected ? 'scale-110 border-white ring-2 ring-amber-400' : 'border-white/30'
                        }`}
                        style={{ backgroundColor: pItem ? pItem.hex : '#1e293b' }}
                      />
                    );
                  })}
                </div>

                {/* Submit Row Button */}
                <button
                  type="button"
                  onClick={handleSubmitGuess}
                  disabled={currentRowPegs.some((p) => p === null)}
                  className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-30 transition-all shadow-md active:scale-95"
                >
                  Submit
                </button>
              </div>
            )}
          </div>

          {/* Bottom Color Palette Peg Selector */}
          <div className="w-full p-2 rounded-2xl bg-[#1e293b] border border-[#475569] flex items-center justify-around shadow-inner">
            {PALETTE.map((item) => (
              <button
                key={item.color}
                type="button"
                onClick={() => handleSelectColor(item.color)}
                className="w-8 h-8 rounded-full shadow-lg border-2 border-white/60 hover:scale-110 active:scale-95 transition-transform flex items-center justify-center"
                style={{ backgroundColor: item.hex }}
                title={item.label}
                aria-label={`Select ${item.label} peg`}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-white/40 -mt-1 -ml-1" />
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Game Over Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="Hit and Blow"
          onRestart={initGame}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};

export default HitAndBlow;
