import { useState, useEffect, useCallback, useRef } from 'react';
import { multiplayer, type PeerPresenceInfo, type RemoteMessage } from '../utils/multiplayer';
import type { PlayerNumber } from '../types/game';
import type { GamePlayMode } from '../components/GameHeader';

export interface UseRemoteMultiplayerOptions {
  gameId: string;
  turn: PlayerNumber | 0;
  gameMode: GamePlayMode;
  onTurnTimeout?: () => void;
  onPeerForfeit?: () => void;
}

export interface UseRemoteMultiplayerResult {
  localPlayer: PlayerNumber;
  opponentPlayer: PlayerNumber;
  isMyTurn: boolean;
  isHost: boolean;
  isConnected: boolean;
  latency: number;
  peerPresence: PeerPresenceInfo;
  turnTimeRemaining: number;
  isAwaitingServer: boolean;
  setIsAwaitingServer: (awaiting: boolean) => void;
  resetTurnTimer: () => void;
  sendAction: (type: RemoteMessage['type'], payload?: any) => void;
}

export const useRemoteMultiplayer = ({
  gameId,
  turn,
  gameMode,
  onTurnTimeout,
  onPeerForfeit,
}: UseRemoteMultiplayerOptions): UseRemoteMultiplayerResult => {
  const isHost = multiplayer.isLocalHost();
  const localPlayer: PlayerNumber = isHost ? 1 : 2;
  const opponentPlayer: PlayerNumber = isHost ? 2 : 1;
  const isMyTurn = turn === localPlayer;

  const [isConnected, setIsConnected] = useState<boolean>(multiplayer.isConnected());
  const [latency, setLatency] = useState<number>(multiplayer.getLatency());
  const [peerPresence, setPeerPresence] = useState<PeerPresenceInfo>(multiplayer.getPresence());
  const [turnTimeRemaining, setTurnTimeRemaining] = useState<number>(45);
  const [isAwaitingServer, setIsAwaitingServer] = useState<boolean>(false);

  const lockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to connection status, latency, and presence
  useEffect(() => {
    const unbindStatus = multiplayer.onStatusChange((status) => {
      setIsConnected(status === 'connected');
    });

    const unbindLatency = multiplayer.onLatencyChange((lat) => {
      setLatency(lat);
    });

    const unbindPresence = multiplayer.onPresenceChange((presenceInfo) => {
      setPeerPresence(presenceInfo);
    });

    return () => {
      unbindStatus();
      unbindLatency();
      unbindPresence();
    };
  }, []);

  // Handle messages like peer forfeit or timeouts
  useEffect(() => {
    if (gameMode !== 'remote') return;

    return multiplayer.onMessage((msg) => {
      if (msg.type === 'TURN_TIMEOUT' && msg.payload?.reason === 'peer_forfeit_disconnect') {
        if (onPeerForfeit) {
          onPeerForfeit();
        }
      }
    });
  }, [gameMode, onPeerForfeit]);

  // Turn Timer: 45 seconds countdown during remote play
  const resetTurnTimer = useCallback(() => {
    setTurnTimeRemaining(45);
  }, []);

  useEffect(() => {
    if (gameMode !== 'remote' || !isConnected || turn === 0) {
      setTurnTimeRemaining(45);
      return;
    }

    setTurnTimeRemaining(45);

    const interval = setInterval(() => {
      setTurnTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (isMyTurn && onTurnTimeout) {
            onTurnTimeout();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameMode, isConnected, turn, isMyTurn, onTurnTimeout]);

  // Safety unlock for isAwaitingServer so UI never locks up indefinitely
  const setOptimisticLock = useCallback((awaiting: boolean) => {
    setIsAwaitingServer(awaiting);
    if (lockTimeoutRef.current) {
      clearTimeout(lockTimeoutRef.current);
      lockTimeoutRef.current = null;
    }
    if (awaiting) {
      lockTimeoutRef.current = setTimeout(() => {
        setIsAwaitingServer(false);
      }, 7000); // 7-second safety ceiling
    }
  }, []);

  // Send action helper
  const sendAction = useCallback(
    (type: RemoteMessage['type'], payload?: any) => {
      multiplayer.send({
        type,
        gameId,
        payload,
      });
    },
    [gameId]
  );

  return {
    localPlayer,
    opponentPlayer,
    isMyTurn,
    isHost,
    isConnected,
    latency,
    peerPresence,
    turnTimeRemaining,
    isAwaitingServer,
    setIsAwaitingServer: setOptimisticLock,
    resetTurnTimer,
    sendAction,
  };
};
