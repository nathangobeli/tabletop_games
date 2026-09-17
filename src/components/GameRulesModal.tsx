import React from 'react';
import type { GameId } from '../types/game';
import { RulesModal } from './RulesModal';

export interface GameRulesModalProps {
  gameId: GameId;
  onClose: () => void;
}

export const GameRulesModal: React.FC<GameRulesModalProps> = ({ gameId, onClose }) => {
  return <RulesModal gameId={gameId} onClose={onClose} />;
};

export { RulesModal };
export default GameRulesModal;
