// AI Client wrapper to communicate with the background Web Worker

import type { AIRequestMessage, AIResponseMessage } from '../workers/aiWorker';

let workerInstance: Worker | null = null;
const pendingRequests = new Map<string, (move: any) => void>();

const getWorker = (): Worker | null => {
  if (typeof window === 'undefined') return null;
  if (!workerInstance) {
    try {
      workerInstance = new Worker(new URL('../workers/aiWorker.ts', import.meta.url), {
        type: 'module',
      });

      workerInstance.onmessage = (e: MessageEvent<AIResponseMessage>) => {
        const { id, move } = e.data;
        const resolve = pendingRequests.get(id);
        if (resolve) {
          resolve(move);
          pendingRequests.delete(id);
        }
      };

      workerInstance.onerror = (err) => {
        console.error('AI Worker error:', err);
      };
    } catch (err) {
      console.warn('Web Worker creation failed, fallback needed:', err);
      return null;
    }
  }
  return workerInstance;
};

/**
 * Dispatches a move calculation to the background Web Worker and returns a Promise.
 */
export const requestAIMove = <T>(
  game: 'connect-four' | 'checkers' | 'gomoku',
  board: unknown,
  player = 2,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): Promise<T> => {
  return new Promise((resolve) => {
    const worker = getWorker();
    const id = `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    if (!worker) {
      // Fallback if workers aren't supported
      resolve(null as unknown as T);
      return;
    }

    pendingRequests.set(id, resolve);

    const message: AIRequestMessage = {
      id,
      game,
      board,
      player,
      difficulty,
    };

    worker.postMessage(message);
  });
};
