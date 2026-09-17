// Backward compatibility alias re-exporting from unified cards.ts
export * from './cards';

// Backward compatibility types & aliases
export type StandardSuit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type { PlayingCard as StandardPlayingCard } from './cards';
export { createStandardDeck as createStandard52Deck } from './cards';
