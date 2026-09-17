import React, { useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import { triggerHaptic, playTapSound, playCaptureSound, playErrorBuzz } from '../utils/feedback';
import { shuffleDeck, dealCards, STANDARD_RANK_LABELS } from '../utils/deck';

type SuitSymbol = '♠' | '♥' | '♦' | '♣';

interface Card {
  id: number;
  value: number; // 1 to 13 (1=Ace, 11=Jack, 12=Queen, 13=King)
  suit: SuitSymbol;
}

const SUITS: SuitSymbol[] = ['♠', '♥', '♦', '♣'];

const getRankLabel = (val: number): string => {
  return STANDARD_RANK_LABELS[val] || String(val);
};

// Check if card A can legally be played on top of center card B (+1 or -1, with A/K wrap-around)
const isValidSpeedPlay = (cardVal: number, targetVal: number): boolean => {
  const diff = Math.abs(cardVal - targetVal);
  return diff === 1 || diff === 12;
};

export const Speed: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();

  // Generate shuffled full 52-card deck
  const generateDeck = (): Card[] => {
    const deck: Card[] = [];
    let id = 1;
    for (let v = 1; v <= 13; v++) {
      for (const suit of SUITS) {
        deck.push({ id: id++, value: v, suit });
      }
    }
    return shuffleDeck(deck);
  };

  // Initial deal:
  // P1: 5 hand, 15 draw reserve, 5 side reserve
  // P2: 5 hand, 15 draw reserve, 5 side reserve
  // Center: 2 starting active cards
  const initializeGame = () => {
    const deck = generateDeck();
    const { hands } = dealCards(deck, [5, 15, 5, 5, 15, 5, 1, 1]);
    const [p1Hand, p1Draw, p1Side, p2Hand, p2Draw, p2Side, centerLeftArr, centerRightArr] = hands;

    return {
      p1Hand,
      p1Draw,
      p1Side,
      p2Hand,
      p2Draw,
      p2Side,
      centerLeft: centerLeftArr[0],
      centerRight: centerRightArr[0],
    };
  };

  const [gameState, setGameState] = useState(initializeGame);
  const [selectedP1Card, setSelectedP1Card] = useState<Card | null>(null);
  const [selectedP2Card, setSelectedP2Card] = useState<Card | null>(null);
  const [p1StuckVote, setP1StuckVote] = useState<boolean>(false);
  const [p2StuckVote, setP2StuckVote] = useState<boolean>(false);
  const [winner, setWinner] = useState<PlayerNumber | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Simultaneous Speed! Tap your card then tap a center pile');
  const [shakeTarget, setShakeTarget] = useState<'left' | 'right' | null>(null);

  const resetGame = useCallback(() => {
    setGameState(initializeGame());
    setSelectedP1Card(null);
    setSelectedP2Card(null);
    setP1StuckVote(false);
    setP2StuckVote(false);
    setShakeTarget(null);
    setWinner(null);
    setStatusMessage('Simultaneous Speed! Tap your card then tap a center pile');
    setGameStatus('active');
  }, [setGameStatus]);

  // Play card from hand to center pile (left or right)
  const playCardToCenter = useCallback((player: PlayerNumber, card: Card, target: 'left' | 'right') => {
    if (winner !== null) return;

    setGameState((prev) => {
      const targetCard = target === 'left' ? prev.centerLeft : prev.centerRight;

      if (!isValidSpeedPlay(card.value, targetCard.value)) {
        setStatusMessage(`Invalid move! ${getRankLabel(card.value)} does not match ${getRankLabel(targetCard.value)} (±1)`);
        triggerHaptic('medium');
        playErrorBuzz();
        setShakeTarget(target);
        setTimeout(() => setShakeTarget(null), 360);
        return prev;
      }

      // Valid play!
      triggerHaptic('medium');
      playTapSound();

      let nextP1Hand = prev.p1Hand;
      let nextP1Draw = prev.p1Draw;
      let nextP2Hand = prev.p2Hand;
      let nextP2Draw = prev.p2Draw;

      if (player === 1) {
        nextP1Hand = prev.p1Hand.filter((c) => c.id !== card.id);
        setSelectedP1Card(null);
        setP1StuckVote(false);
        setP2StuckVote(false);
      } else {
        nextP2Hand = prev.p2Hand.filter((c) => c.id !== card.id);
        setSelectedP2Card(null);
        setP1StuckVote(false);
        setP2StuckVote(false);
      }

      const nextCenterLeft = target === 'left' ? card : prev.centerLeft;
      const nextCenterRight = target === 'right' ? card : prev.centerRight;

      if (nextP1Hand.length === 0 && nextP1Draw.length === 0) {
        setWinner(1);
        setStatusMessage('🎉 SPEED! Player 1 emptied their deck and wins!');
        setGameStatus('finished');
      } else if (nextP2Hand.length === 0 && nextP2Draw.length === 0) {
        setWinner(2);
        setStatusMessage('🎉 SPEED! Player 2 emptied their deck and wins!');
        setGameStatus('finished');
      }

      return {
        ...prev,
        p1Hand: nextP1Hand,
        p1Draw: nextP1Draw,
        p2Hand: nextP2Hand,
        p2Draw: nextP2Draw,
        centerLeft: nextCenterLeft,
        centerRight: nextCenterRight,
      };
    });
  }, [winner, setGameStatus]);

  // Refill hand from personal draw reserve
  const refillHand = useCallback((player: PlayerNumber) => {
    if (winner !== null) return;

    triggerHaptic('light');
    playTapSound();

    setGameState((prev) => {
      if (player === 1) {
        if (prev.p1Draw.length === 0 || prev.p1Hand.length >= 5) return prev;
        const needed = 5 - prev.p1Hand.length;
        const drawn = prev.p1Draw.slice(0, needed);
        const remainingDraw = prev.p1Draw.slice(needed);
        return {
          ...prev,
          p1Hand: [...prev.p1Hand, ...drawn],
          p1Draw: remainingDraw,
        };
      } else {
        if (prev.p2Draw.length === 0 || prev.p2Hand.length >= 5) return prev;
        const needed = 5 - prev.p2Hand.length;
        const drawn = prev.p2Draw.slice(0, needed);
        const remainingDraw = prev.p2Draw.slice(needed);
        return {
          ...prev,
          p2Hand: [...prev.p2Hand, ...drawn],
          p2Draw: remainingDraw,
        };
      }
    });
  }, [winner]);

  // Stall / Stuck Flip resolution: when both players agree they are stuck
  const handleStuckVote = useCallback((player: PlayerNumber) => {
    if (winner !== null) return;

    triggerHaptic('medium');

    if (player === 1) {
      if (p2StuckVote) {
        // Both stuck! Flip cards from side reserves
        playCaptureSound();
        flipSidePiles();
      } else {
        playTapSound();
        setP1StuckVote(true);
        setStatusMessage('Player 1 votes STUCK! Waiting for Player 2...');
      }
    } else {
      if (p1StuckVote) {
        playCaptureSound();
        flipSidePiles();
      } else {
        playTapSound();
        setP2StuckVote(true);
        setStatusMessage('Player 2 votes STUCK! Waiting for Player 1...');
      }
    }
  }, [p1StuckVote, p2StuckVote, winner]);

  const flipSidePiles = () => {
    setGameState((prev) => {
      let newCenterLeft = prev.centerLeft;
      let newCenterRight = prev.centerRight;
      let nextP1Side = [...prev.p1Side];
      let nextP2Side = [...prev.p2Side];

      if (nextP1Side.length > 0) {
        newCenterLeft = nextP1Side.pop()!;
      } else {
        // If side piles empty, generate new random center cards
        newCenterLeft = { id: Date.now() + 1, value: Math.floor(Math.random() * 13) + 1, suit: '♠' };
      }

      if (nextP2Side.length > 0) {
        newCenterRight = nextP2Side.pop()!;
      } else {
        newCenterRight = { id: Date.now() + 2, value: Math.floor(Math.random() * 13) + 1, suit: '♥' };
      }

      setP1StuckVote(false);
      setP2StuckVote(false);
      setStatusMessage('New center cards dealt! Keep playing!');

      return {
        ...prev,
        p1Side: nextP1Side,
        p2Side: nextP2Side,
        centerLeft: newCenterLeft,
        centerRight: newCenterRight,
      };
    });
  };

  // Card view helper with crisp linen cardstock texture
  const renderCard = (card: Card, isSelected = false, onSelect?: () => void) => {
    const isRed = card.suit === '♥' || card.suit === '♦';

    return (
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          onSelect?.();
        }}
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.98), rgba(248,246,240,0.94))'
        }}
        className={`w-11 h-16 sm:w-13 sm:h-18 rounded-xl border-2 flex flex-col justify-between p-1 transition-spring duration-150 relative overflow-hidden select-none touch-none ${
          isSelected
            ? 'ring-3 ring-amber-400 -translate-y-2 table-lifted scale-105 border-amber-300 z-30'
            : 'border-stone-300 hover:border-stone-400 table-flat active:scale-95'
        }`}
      >
        {/* Subtle linen weave texture overlay */}
        <div 
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.015) 0px, rgba(0,0,0,0.015) 1px, transparent 1px, transparent 3px)'
          }}
          className="absolute inset-0 pointer-events-none rounded-xl"
        />

        <div className={`text-[11px] font-black leading-none z-10 ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
          {getRankLabel(card.value)}
        </div>
        <div className={`text-base self-center leading-none z-10 ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
          {card.suit}
        </div>
        <div className={`text-[11px] font-black leading-none self-end rotate-180 z-10 ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
          {getRankLabel(card.value)}
        </div>
      </button>
    );
  };

  // Intricate Geometric SVG Card Back renderer
  const renderCardBack = (count: number, onDraw?: () => void, disabled?: boolean, isP2 = false) => {
    return (
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          if (!disabled) onDraw?.();
        }}
        disabled={disabled}
        className={`w-11 h-16 sm:w-13 sm:h-18 rounded-xl border-2 border-white p-0.5 relative table-flat transition-spring duration-150 overflow-hidden select-none touch-none ${
          !disabled ? 'hover:scale-105 active:scale-95 cursor-pointer shadow-md' : 'opacity-60 cursor-not-allowed'
        }`}
      >
        <svg viewBox="0 0 60 90" className="w-full h-full rounded-lg pointer-events-none">
          <rect width="60" height="90" rx="6" fill={isP2 ? '#991b1b' : '#1e40af'} />
          <rect x="3" y="3" width="54" height="84" rx="4" fill="none" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.8" />
          <pattern id={`backPat-${isP2 ? 'p2' : 'p1'}`} width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 4 0 L 8 4 L 4 8 L 0 4 Z" fill="none" stroke="#ffffff" strokeWidth="0.6" strokeOpacity="0.35" />
            <circle cx="4" cy="4" r="1" fill="#ffffff" fillOpacity="0.5" />
          </pattern>
          <rect x="5" y="5" width="50" height="80" rx="3" fill={`url(#backPat-${isP2 ? 'p2' : 'p1'})`} />
          <ellipse cx="30" cy="45" rx="14" ry="18" fill={isP2 ? '#7f1d1d' : '#1e3a8a'} stroke="#ffffff" strokeWidth="1" />
          <text x="30" y="48" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="900" fontFamily="sans-serif">
            {count}
          </text>
        </svg>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden select-none">
      {/* Top Header */}
      <GameHeader
        title="Speed"
        subtitle="Simultaneous Card Match"
        turn={0}
        scoreP1={`${gameState.p1Hand.length + gameState.p1Draw.length} left`}
        scoreP2={`${gameState.p2Hand.length + gameState.p2Draw.length} left`}
        p1Label="P1 Cards"
        p2Label="P2 Cards"
        onRestart={resetGame}
        statusMessage={statusMessage}
      />

      {/* Main Split-Screen Play Arena - Responsive on iPhone, iPad, PC */}
      <main className="flex-1 flex flex-col items-center justify-between p-2 sm:p-4 overflow-hidden relative touch-none">
        <div className="w-full max-w-sm sm:max-w-md md:max-w-xl h-full flex flex-col justify-between gap-2">
        {/* ========================================================================= */}
        {/* PLAYER 2 TOP HALF (Rotated 180 degrees for opposite player across table)   */}
        {/* ========================================================================= */}
        <div className="rotate-180 flex flex-col items-center justify-start gap-1 p-2 bg-player-2/10 rounded-3xl border border-player-2/30 shadow-sm">
          <div className="flex items-center justify-between w-full px-2 text-[10px] font-black uppercase text-player-2">
            <span>Player 2 (Opposite)</span>
            <span>Reserve: {gameState.p2Draw.length} cards</span>
          </div>

          {/* Player 2 Hand + Draw Pile */}
          <div className="flex items-center justify-center gap-1.5 w-full">
            {/* Draw pile card */}
            {renderCardBack(
              gameState.p2Draw.length,
              () => refillHand(2),
              gameState.p2Draw.length === 0 || gameState.p2Hand.length >= 5,
              true
            )}

            {/* Hand cards */}
            <div className="flex gap-1">
              {gameState.p2Hand.map((card) => (
                <div key={card.id}>
                  {renderCard(card, selectedP2Card?.id === card.id, () => {
                    triggerHaptic('light');
                    playTapSound();
                    setSelectedP2Card(card);
                    setStatusMessage(`Player 2 selected ${getRankLabel(card.value)}${card.suit}. Tap Pile 1 or Pile 2!`);
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CENTER SHARED ACTIVE PILES & STALL CONTROLS (Simultaneous Multi-Touch)   */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between px-3 py-2 my-auto bg-container-dark/90 rounded-3xl border border-[#424850] shadow-2xl">
          {/* Side Reserve Count P1 */}
          <div className="text-[10px] font-bold text-accent-light/70 text-center">
            <span className="block">Side Left</span>
            <span className="text-amber-400">{gameState.p1Side.length}</span>
          </div>

          {/* Left Active Pile with Independent P1 and P2 Multi-Touch Zones */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                if (selectedP2Card) {
                  playCardToCenter(2, selectedP2Card, 'left');
                } else {
                  triggerHaptic('light');
                  setStatusMessage('P2: Tap a card from your hand first!');
                }
              }}
              className="rotate-180 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-player-2/20 hover:bg-player-2/30 active:scale-95 text-player-2 border border-player-2/40 shadow-xs transition-all touch-none select-none"
            >
              P2 Drop
            </button>

            <div
              className={`relative rounded-xl overflow-hidden table-flat ${
                shakeTarget === 'left' ? 'animate-shake ring-2 ring-red-500 rounded-2xl' : ''
              }`}
            >
              {renderCard(gameState.centerLeft)}

              {/* Split touch zones on card face for instantaneous player taps */}
              <div className="absolute inset-0 flex flex-col pointer-events-auto">
                <button
                  type="button"
                  aria-label="P2 play onto Left Pile"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    if (selectedP2Card) playCardToCenter(2, selectedP2Card, 'left');
                    else {
                      triggerHaptic('light');
                      setStatusMessage('P2: Tap a card from your hand first!');
                    }
                  }}
                  className="w-full h-1/2 cursor-pointer hover:bg-player-2/15 active:bg-player-2/30 transition-colors touch-none"
                />
                <button
                  type="button"
                  aria-label="P1 play onto Left Pile"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    if (selectedP1Card) playCardToCenter(1, selectedP1Card, 'left');
                    else {
                      triggerHaptic('light');
                      setStatusMessage('P1: Tap a card from your hand first!');
                    }
                  }}
                  className="w-full h-1/2 cursor-pointer hover:bg-player-1/15 active:bg-player-1/30 transition-colors touch-none"
                />
              </div>
            </div>

            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                if (selectedP1Card) {
                  playCardToCenter(1, selectedP1Card, 'left');
                } else {
                  triggerHaptic('light');
                  setStatusMessage('P1: Tap a card from your hand first!');
                }
              }}
              className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-player-1/20 hover:bg-player-1/30 active:scale-95 text-player-1 border border-player-1/40 shadow-xs transition-all touch-none select-none"
            >
              P1 Drop
            </button>
          </div>

          {/* Central STUCK Mutual Flip Button */}
          <div className="flex flex-col items-center gap-1.5 mx-1">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                handleStuckVote(2);
              }}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all rotate-180 touch-none select-none ${
                p2StuckVote ? 'bg-player-2 text-white shadow-md' : 'bg-player-2/30 text-player-2 border border-player-2'
              }`}
            >
              {p2StuckVote ? 'P2 STUCK ✓' : 'P2 STUCK'}
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                handleStuckVote(1);
              }}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all touch-none select-none ${
                p1StuckVote ? 'bg-player-1 text-white shadow-md' : 'bg-player-1/30 text-player-1 border border-player-1'
              }`}
            >
              {p1StuckVote ? 'P1 STUCK ✓' : 'P1 STUCK'}
            </button>
          </div>

          {/* Right Active Pile with Independent P1 and P2 Multi-Touch Zones */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                if (selectedP2Card) {
                  playCardToCenter(2, selectedP2Card, 'right');
                } else {
                  triggerHaptic('light');
                  setStatusMessage('P2: Tap a card from your hand first!');
                }
              }}
              className="rotate-180 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-player-2/20 hover:bg-player-2/30 active:scale-95 text-player-2 border border-player-2/40 shadow-xs transition-all touch-none select-none"
            >
              P2 Drop
            </button>

            <div
              className={`relative rounded-xl overflow-hidden table-flat ${
                shakeTarget === 'right' ? 'animate-shake ring-2 ring-red-500 rounded-2xl' : ''
              }`}
            >
              {renderCard(gameState.centerRight)}

              {/* Split touch zones on card face for instantaneous player taps */}
              <div className="absolute inset-0 flex flex-col pointer-events-auto">
                <button
                  type="button"
                  aria-label="P2 play onto Right Pile"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    if (selectedP2Card) playCardToCenter(2, selectedP2Card, 'right');
                    else {
                      triggerHaptic('light');
                      setStatusMessage('P2: Tap a card from your hand first!');
                    }
                  }}
                  className="w-full h-1/2 cursor-pointer hover:bg-player-2/15 active:bg-player-2/30 transition-colors touch-none"
                />
                <button
                  type="button"
                  aria-label="P1 play onto Right Pile"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    if (selectedP1Card) playCardToCenter(1, selectedP1Card, 'right');
                    else {
                      triggerHaptic('light');
                      setStatusMessage('P1: Tap a card from your hand first!');
                    }
                  }}
                  className="w-full h-1/2 cursor-pointer hover:bg-player-1/15 active:bg-player-1/30 transition-colors touch-none"
                />
              </div>
            </div>

            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                if (selectedP1Card) {
                  playCardToCenter(1, selectedP1Card, 'right');
                } else {
                  triggerHaptic('light');
                  setStatusMessage('P1: Tap a card from your hand first!');
                }
              }}
              className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-player-1/20 hover:bg-player-1/30 active:scale-95 text-player-1 border border-player-1/40 shadow-xs transition-all touch-none select-none"
            >
              P1 Drop
            </button>
          </div>

          {/* Side Reserve Count P2 */}
          <div className="text-[10px] font-bold text-accent-light/70 text-center">
            <span className="block">Side Right</span>
            <span className="text-amber-400">{gameState.p2Side.length}</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PLAYER 1 BOTTOM HALF (Facing Player 1)                                    */}
        {/* ========================================================================= */}
        <div className="flex flex-col items-center justify-end gap-1 p-2 bg-player-1/10 rounded-3xl border border-player-1/30 shadow-sm">
          {/* Player 1 Hand + Draw Pile */}
          <div className="flex items-center justify-center gap-1.5 w-full">
            {/* Hand cards */}
            <div className="flex gap-1">
              {gameState.p1Hand.map((card) => (
                <div key={card.id}>
                  {renderCard(card, selectedP1Card?.id === card.id, () => {
                    triggerHaptic('light');
                    playTapSound();
                    setSelectedP1Card(card);
                    setStatusMessage(`Player 1 selected ${getRankLabel(card.value)}${card.suit}. Tap Pile 1 or Pile 2!`);
                  })}
                </div>
              ))}
            </div>

            {/* Draw pile card */}
            {renderCardBack(
              gameState.p1Draw.length,
              () => refillHand(1),
              gameState.p1Draw.length === 0 || gameState.p1Hand.length >= 5,
              false
            )}
          </div>

          <div className="flex items-center justify-between w-full px-2 text-[10px] font-black uppercase text-player-1">
            <span>Player 1 (Bottom)</span>
            <span>Reserve: {gameState.p1Draw.length} cards</span>
          </div>
        </div>
        </div>
      </main>

      {/* Footer Instructions */}
      <footer className="pb-safe px-4 py-1.5 border-t border-[#2a2e33]/10 bg-[#f3e9dc]/80 backdrop-blur-sm flex items-center justify-between text-xs font-semibold text-[#7d6753]">
        <span>Match +1 or -1 on center piles (Ace &amp; King wrap)</span>
        <span className="text-[11px] bg-accent-light px-2.5 py-0.5 rounded-full border border-[#d8c3a5]/50">
          Target: Empty Deck First
        </span>
      </footer>

      {/* Game Over Modal (Speed is real-time simultaneous so NO TurnTransitionModal) */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="Speed"
          stats={[
            {
              label: 'Cards Remaining',
              p1Value: `${gameState.p1Hand.length + gameState.p1Draw.length}`,
              p2Value: `${gameState.p2Hand.length + gameState.p2Draw.length}`,
            },
            {
              label: 'Match Result',
              p1Value: winner === 1 ? 'Emptied Deck' : 'Runner Up',
              p2Value: winner === 2 ? 'Emptied Deck' : 'Runner Up',
            },
          ]}
          onRestart={resetGame}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};
