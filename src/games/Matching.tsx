import React, { useState, useEffect, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import { triggerHaptic, playCardFlipSound, playCaptureSound } from '../utils/feedback';
import { shuffleDeck } from '../utils/deck';

interface CardItem {
  id: number;
  pairId: number;
  name: string;
  isFlipped: boolean;
  isMatched: boolean;
  matchedBy: PlayerNumber | null;
}

const CARD_ICONS = [
  { pairId: 1, name: 'Dice' },
  { pairId: 2, name: 'Pawn' },
  { pairId: 3, name: 'Meeple' },
  { pairId: 4, name: 'Stone' },
  { pairId: 5, name: '8-Ball' },
  { pairId: 6, name: 'Dart' },
  { pairId: 7, name: 'Pin' },
  { pairId: 8, name: 'Striker' },
  { pairId: 9, name: 'Tennis' },
  { pairId: 10, name: 'Koma' },
  { pairId: 11, name: 'Gem' },
  { pairId: 12, name: 'Crown' },
];

export const Matching: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();

  const [cards, setCards] = useState<CardItem[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [p1Score, setP1Score] = useState<number>(0);
  const [p2Score, setP2Score] = useState<number>(0);
  const [winner, setWinner] = useState<PlayerNumber | 'draw' | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Player 1: Flip card 1 to start your turn!');

  // Initialize and shuffle 24 cards (12 pairs)
  const initGame = useCallback(() => {
    const deck: CardItem[] = [];
    let idCounter = 0;

    CARD_ICONS.forEach((icon) => {
      // Create 2 copies of each icon
      deck.push({
        id: idCounter++,
        pairId: icon.pairId,
        name: icon.name,
        isFlipped: false,
        isMatched: false,
        matchedBy: null,
      });
      deck.push({
        id: idCounter++,
        pairId: icon.pairId,
        name: icon.name,
        isFlipped: false,
        isMatched: false,
        matchedBy: null,
      });
    });

    setCards(shuffleDeck(deck));
    setFlippedIndices([]);
    setIsProcessing(false);
    setTurn(1);
    setP1Score(0);
    setP2Score(0);
    setWinner(null);
    setStatusMessage('Player 1: Flip card 1 to start your turn!');
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  // Card Flip Click Handler
  const handleCardClick = (index: number) => {
    if (isProcessing || winner !== null) return;
    const card = cards[index];
    if (card.isFlipped || card.isMatched) return;

    triggerHaptic('light');
    playCardFlipSound();

    const newCards = [...cards];
    newCards[index] = { ...card, isFlipped: true };
    setCards(newCards);

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 1) {
      setStatusMessage(`Player ${turn}: Card 1 is ${card.name}. Choose card 2!`);
    } else if (newFlipped.length === 2) {
      setIsProcessing(true);
      const [firstIdx, secondIdx] = newFlipped;
      const firstCard = newCards[firstIdx];
      const secondCard = newCards[secondIdx];

      if (firstCard.pairId === secondCard.pairId) {
        // MATCH!
        setTimeout(() => {
          triggerHaptic('success');
          playCaptureSound();

          const matchedCards = newCards.map((c, i) =>
            i === firstIdx || i === secondIdx
              ? { ...c, isMatched: true, matchedBy: turn }
              : c
          );
          setCards(matchedCards);
          setFlippedIndices([]);
          setIsProcessing(false);

          let updatedP1 = p1Score;
          let updatedP2 = p2Score;

          if (turn === 1) {
            updatedP1 = p1Score + 1;
            setP1Score(updatedP1);
          } else {
            updatedP2 = p2Score + 1;
            setP2Score(updatedP2);
          }

          // Check if all 12 pairs matched
          if (updatedP1 + updatedP2 === 12) {
            if (updatedP1 > updatedP2) setWinner(1);
            else if (updatedP2 > updatedP1) setWinner(2);
            else setWinner('draw');
            setStatusMessage(`All pairs found! P1: ${updatedP1} - P2: ${updatedP2}`);
            setGameStatus('finished');
          } else {
            // Consecutive Turn Bonus
            setStatusMessage(`MATCH! 🎉 Player ${turn} paired ${firstCard.name} and earns a BONUS TURN!`);
          }
        }, 450);
      } else {
        // MISMATCH -> 850ms visual pause then flip back and pass turn
        setStatusMessage(`Mismatch (${firstCard.name} & ${secondCard.name}). Passing turn...`);
        setTimeout(() => {
          const resetCards = newCards.map((c, i) =>
            i === firstIdx || i === secondIdx ? { ...c, isFlipped: false } : c
          );
          setCards(resetCards);
          setFlippedIndices([]);
          setIsProcessing(false);

          const nextTurn: PlayerNumber = turn === 1 ? 2 : 1;
          setTurn(nextTurn);
          setStatusMessage(`Player ${nextTurn}'s turn: Flip card 1!`);
          setGameStatus('active');
        }, 850);
      }
    }
  };

  // Procedural SVG Card Face Art
  const renderCardArt = (pairId: number) => {
    switch (pairId) {
      case 1: // Dice
        return (
          <svg viewBox="0 0 40 40" className="w-8 h-8">
            <rect x="4" y="4" width="32" height="32" rx="7" fill="#dc2626" stroke="#b91c1c" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="2.8" fill="#ffffff" />
            <circle cx="28" cy="12" r="2.8" fill="#ffffff" />
            <circle cx="20" cy="20" r="3.2" fill="#ffffff" />
            <circle cx="12" cy="28" r="2.8" fill="#ffffff" />
            <circle cx="28" cy="28" r="2.8" fill="#ffffff" />
          </svg>
        );
      case 2: // Chess Pawn
        return (
          <svg viewBox="0 0 40 40" className="w-8 h-8">
            <circle cx="20" cy="11" r="5" fill="#d97706" stroke="#92400e" strokeWidth="1" />
            <path d="M16 16 L24 16 L23 27 L17 27 Z" fill="#b45309" />
            <rect x="13" y="27" width="14" height="6" rx="2" fill="#92400e" />
          </svg>
        );
      case 3: // Meeple
        return (
          <svg viewBox="0 0 40 40" className="w-8 h-8">
            <circle cx="20" cy="10" r="4.5" fill="#3b82f6" />
            <path d="M12 18 C14 17 17 16 20 16 C23 16 26 17 28 18 C29 20 30 23 30 25 L26 26 L26 34 L21 34 L20 28 L19 34 L14 34 L14 26 L10 25 C10 23 11 20 12 18 Z" fill="#1d4ed8" />
          </svg>
        );
      case 4: // Curling Stone
        return (
          <svg viewBox="0 0 40 40" className="w-8 h-8">
            <circle cx="20" cy="20" r="14" fill="#334155" stroke="#1e293b" strokeWidth="1.5" />
            <circle cx="20" cy="20" r="10" fill="#0284c7" />
            <rect x="16" y="17" width="8" height="6" rx="2" fill="#fbbf24" stroke="#b45309" strokeWidth="0.8" />
          </svg>
        );
      case 5: // 8-Ball
        return (
          <svg viewBox="0 0 40 40" className="w-8 h-8">
            <circle cx="20" cy="20" r="14" fill="#09090b" stroke="#27272a" strokeWidth="1" />
            <circle cx="20" cy="20" r="6" fill="#ffffff" />
            <text x="20" y="24" fontSize="10" fontWeight="bold" fill="#09090b" textAnchor="middle" fontFamily="sans-serif">8</text>
          </svg>
        );
      case 6: // Dart
        return (
          <svg viewBox="0 0 40 40" className="w-8 h-8">
            <line x1="8" y1="32" x2="28" y2="12" stroke="#eab308" strokeWidth="3" strokeLinecap="round" />
            <line x1="6" y1="34" x2="10" y2="30" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
            <polygon points="26,14 34,6 26,10" fill="#ef4444" />
            <polygon points="26,14 34,6 30,14" fill="#dc2626" />
          </svg>
        );
      case 7: // Bowling Pin
        return (
          <svg viewBox="0 0 40 40" className="w-8 h-8">
            <ellipse cx="20" cy="26" r="7" ry="9" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
            <ellipse cx="20" cy="11" r="4" ry="5" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
            <rect x="17" y="13" width="6" height="2" fill="#ef4444" />
            <rect x="17" y="17" width="6" height="2" fill="#ef4444" />
          </svg>
        );
      case 8: // Carrom Striker
        return (
          <svg viewBox="0 0 40 40" className="w-8 h-8">
            <circle cx="20" cy="20" r="14" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" />
            <circle cx="20" cy="20" r="8" fill="none" stroke="#b45309" strokeWidth="1.2" strokeDasharray="3 2" />
            <circle cx="20" cy="20" r="3" fill="#b45309" />
          </svg>
        );
      case 9: // Tennis Ball
        return (
          <svg viewBox="0 0 40 40" className="w-8 h-8">
            <circle cx="20" cy="20" r="14" fill="#a3e635" stroke="#65a30d" strokeWidth="1.5" />
            <path d="M12 10 C18 16 18 24 12 30" fill="none" stroke="#ffffff" strokeWidth="1.8" />
            <path d="M28 10 C22 16 22 24 28 30" fill="none" stroke="#ffffff" strokeWidth="1.8" />
          </svg>
        );
      case 10: // Shogi Tile
        return (
          <svg viewBox="0 0 40 40" className="w-8 h-8">
            <polygon points="20,6 30,13 28,34 12,34 10,13" fill="#fef3c7" stroke="#b45309" strokeWidth="1.5" />
            <text x="20" y="26" fontSize="12" fontWeight="bold" fill="#78350f" textAnchor="middle" fontFamily="serif">歩</text>
          </svg>
        );
      case 11: // Sparkling Gem
        return (
          <svg viewBox="0 0 40 40" className="w-8 h-8">
            <polygon points="20,6 32,15 26,34 14,34 8,15" fill="#a855f7" stroke="#7e22ce" strokeWidth="1.5" />
            <polygon points="20,6 32,15 20,20 8,15" fill="#c084fc" opacity="0.6" />
          </svg>
        );
      case 12: // Golden Crown
        return (
          <svg viewBox="0 0 40 40" className="w-8 h-8">
            <polygon points="8,28 10,14 16,20 20,10 24,20 30,14 32,28" fill="#eab308" stroke="#ca8a04" strokeWidth="1.5" />
            <circle cx="20" cy="9" r="1.8" fill="#ef4444" />
            <circle cx="10" cy="13" r="1.5" fill="#3b82f6" />
            <circle cx="30" cy="13" r="1.5" fill="#3b82f6" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden select-none">
      <GameHeader
        gameId="matching"
        gameName="Matching (Memory)"
        turn={turn}
        statusText={`Player ${turn}'s Turn`}
        subStatusText={statusMessage}
      />

      {/* Main Tabletop Grid Arena */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden">
        {/* Scorecard Bar */}
        <div className="w-full max-w-md flex items-center justify-between px-3 py-1.5 bg-container-dark/95 border border-[#3e444c] rounded-2xl shadow-xl mb-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-player-1 inline-block" />
            <span className="font-bold text-white">P1: {p1Score} pairs</span>
          </div>
          <span className="text-[10px] font-black uppercase text-amber-400">
            {12 - (p1Score + p2Score)} pairs remaining
          </span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">P2: {p2Score} pairs</span>
            <span className="w-3 h-3 rounded-full bg-player-2 inline-block" />
          </div>
        </div>

        {/* Green Baize Table Mat holding 6x4 Grid */}
        <div className="w-full max-w-md p-3 sm:p-4 rounded-3xl bg-[#065f46] border-4 border-[#044e39] shadow-2xl clubhouse-board-depth flex items-center justify-center">
          <div className="grid grid-cols-6 gap-2 w-full aspect-[6/4]">
            {cards.map((card, idx) => {
              const showFace = card.isFlipped || card.isMatched;

              return (
                <div
                  key={card.id}
                  onClick={() => handleCardClick(idx)}
                  className={`relative w-full h-full rounded-xl cursor-pointer perspective-500 transition-transform duration-200 active:scale-95 ${
                    card.isMatched ? 'opacity-85' : ''
                  }`}
                >
                  {/* Card Inner with 3D Flip */}
                  <div
                    className={`w-full h-full rounded-xl shadow-md border transition-transform duration-300 transform-style-3d flex items-center justify-center ${
                      showFace ? 'rotate-y-180' : ''
                    } ${
                      card.isMatched
                        ? card.matchedBy === 1
                          ? 'border-blue-400 bg-blue-950/40'
                          : 'border-red-400 bg-red-950/40'
                        : 'border-[#cbd5e1]'
                    }`}
                  >
                    {/* Face Down Back */}
                    {!showFace && (
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#1e3a8a] to-[#0f172a] p-1 flex items-center justify-center backface-hidden">
                        <div className="w-full h-full rounded-lg border border-amber-400/50 flex items-center justify-center">
                          {/* Gold Filigree Diamond */}
                          <svg viewBox="0 0 24 24" className="w-4 h-4 text-amber-400/70" fill="currentColor">
                            <path d="M12 2 L22 12 L12 22 L2 12 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            <circle cx="12" cy="12" r="2.5" fill="currentColor" />
                          </svg>
                        </div>
                      </div>
                    )}

                    {/* Face Up Front */}
                    {showFace && (
                      <div className="absolute inset-0 rounded-xl bg-[#fdfcfb] border border-amber-200 flex flex-col items-center justify-center rotate-y-180 backface-hidden p-1 shadow-inner">
                        {renderCardArt(card.pairId)}
                        <span className="text-[8px] font-black text-[#475569] uppercase mt-0.5 tracking-tight truncate max-w-full">
                          {card.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Game Over Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="Matching (Memory)"
          onRestart={initGame}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};

export default Matching;
