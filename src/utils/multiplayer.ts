// WebRTC PeerJS-based P2P Remote Multiplayer Engine

import Peer, { type DataConnection } from 'peerjs';

export interface RemoteMessage {
  type: 'JOIN_ACK' | 'MOVE' | 'RESTART' | 'UNDO' | 'EMOJI';
  gameId?: string;
  payload?: any;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'waiting' | 'connected' | 'error';

class MultiplayerManager {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private isHost: boolean = false;
  private roomCode: string = '';

  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private messageListeners: Set<(msg: RemoteMessage) => void> = new Set();
  private currentStatus: ConnectionStatus = 'disconnected';

  public getStatus(): ConnectionStatus {
    return this.currentStatus;
  }

  public getRoomCode(): string {
    return this.roomCode;
  }

  public isLocalHost(): boolean {
    return this.isHost;
  }

  public isConnected(): boolean {
    return this.currentStatus === 'connected' && this.connection !== null;
  }

  public onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.currentStatus);
    return () => this.statusListeners.delete(listener);
  }

  public onMessage(listener: (msg: RemoteMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  private setStatus(status: ConnectionStatus) {
    this.currentStatus = status;
    this.statusListeners.forEach((l) => l(status));
  }

  /**
   * Host a new room with a random 4-digit code (e.g. "4921")
   */
  public hostRoom(): Promise<string> {
    this.disconnect();
    this.isHost = true;
    this.setStatus('connecting');

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    this.roomCode = code;
    const peerId = `tabletop-${code}`;

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer(peerId, {
          debug: 1,
        });

        this.peer.on('open', () => {
          this.setStatus('waiting');
          resolve(code);
        });

        this.peer.on('connection', (conn) => {
          this.setupConnection(conn);
        });

        this.peer.on('error', (err) => {
          console.error('Peer host error:', err);
          this.setStatus('error');
          reject(err);
        });
      } catch (err) {
        this.setStatus('error');
        reject(err);
      }
    });
  }

  /**
   * Join an existing room with a 4-digit code
   */
  public joinRoom(code: string): Promise<void> {
    this.disconnect();
    this.isHost = false;
    this.roomCode = code;
    this.setStatus('connecting');

    const hostPeerId = `tabletop-${code.trim()}`;

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer();

        this.peer.on('open', () => {
          if (!this.peer) return;
          const conn = this.peer.connect(hostPeerId, { reliable: true });
          this.setupConnection(conn);

          conn.on('open', () => {
            resolve();
          });
        });

        this.peer.on('error', (err) => {
          console.error('Peer join error:', err);
          this.setStatus('error');
          reject(err);
        });
      } catch (err) {
        this.setStatus('error');
        reject(err);
      }
    });
  }

  private setupConnection(conn: DataConnection) {
    this.connection = conn;

    conn.on('open', () => {
      this.setStatus('connected');
      if (this.isHost) {
        this.send({ type: 'JOIN_ACK', payload: { host: true } });
      }
    });

    conn.on('data', (data) => {
      const msg = data as RemoteMessage;
      this.messageListeners.forEach((l) => l(msg));
    });

    conn.on('close', () => {
      this.setStatus('disconnected');
      this.connection = null;
    });

    conn.on('error', (err) => {
      console.error('DataConnection error:', err);
      this.setStatus('error');
    });
  }

  /**
   * Send a message to the connected peer
   */
  public send(msg: RemoteMessage) {
    if (this.connection && this.connection.open) {
      this.connection.send(msg);
    }
  }

  /**
   * Terminate active connections and destroy peer instance
   */
  public disconnect() {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.setStatus('disconnected');
    this.roomCode = '';
  }
}

export const multiplayer = new MultiplayerManager();
