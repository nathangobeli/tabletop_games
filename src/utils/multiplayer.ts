// WebRTC PeerJS-based P2P Remote Multiplayer Engine

import Peer, { type DataConnection } from 'peerjs';

export interface RemoteMessage {
  type:
    | 'JOIN_ACK'
    | 'MOVE'
    | 'RESTART'
    | 'UNDO'
    | 'EMOJI'
    | 'FLEET_READY'
    | 'FIRE'
    | 'FIRE_RESULT'
    | 'GAME_OVER_REVEAL'
    | 'HEARTBEAT_PING'
    | 'HEARTBEAT_PONG'
    | 'PING_REPORT'
    | 'PEER_PRESENCE'
    | 'TURN_TIMEOUT'
    | 'CARD_ACTION'
    | 'MAHJONG_ACTION'
    | 'CRIBBAGE_ACTION'
    | 'SYNC_STATE';
  gameId?: string;
  payload?: any;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'waiting' | 'connected' | 'error';

export type PeerPresence = 'active' | 'backgrounded' | 'reconnecting' | 'disconnected';

export interface PeerPresenceInfo {
  presence: PeerPresence;
  secondsLeft?: number;
}

// Metered STUN & TURN Relay Server Configuration for mobile NAT traversal
export const METERED_ICE_SERVERS: RTCIceServer[] = [
  {
    urls: 'stun:stun.relay.metered.ca:80',
  },
  {
    urls: 'turn:global.relay.metered.ca:80',
    username: '312037a53f5880d60e7543d6',
    credential: 'Vl0UqXN6Jv9g15m6',
  },
  {
    urls: 'turn:global.relay.metered.ca:80?transport=tcp',
    username: '312037a53f5880d60e7543d6',
    credential: 'Vl0UqXN6Jv9g15m6',
  },
  {
    urls: 'turn:global.relay.metered.ca:443',
    username: '312037a53f5880d60e7543d6',
    credential: 'Vl0UqXN6Jv9g15m6',
  },
  {
    urls: 'turns:global.relay.metered.ca:443?transport=tcp',
    username: '312037a53f5880d60e7543d6',
    credential: 'Vl0UqXN6Jv9g15m6',
  },
];

class MultiplayerManager {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private isHost: boolean = false;
  private roomCode: string = '';

  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private messageListeners: Set<(msg: RemoteMessage) => void> = new Set();
  private latencyListeners: Set<(latency: number) => void> = new Set();
  private presenceListeners: Set<(info: PeerPresenceInfo) => void> = new Set();

  private currentStatus: ConnectionStatus = 'disconnected';
  private currentLatency: number = 45; // Default ms
  private currentPresence: PeerPresenceInfo = { presence: 'disconnected' };

  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private graceTimer: ReturnType<typeof setInterval> | null = null;
  private graceSecondsLeft: number = 20;

  constructor() {
    // Listen for local browser visibility changes to inform peer
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (this.isConnected()) {
          const presence: PeerPresence = document.hidden ? 'backgrounded' : 'active';
          this.send({
            type: 'PEER_PRESENCE',
            payload: { presence },
          });
        }
      });
    }
  }

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

  public getLatency(): number {
    return this.currentLatency;
  }

  public getPresence(): PeerPresenceInfo {
    return this.currentPresence;
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

  public onLatencyChange(listener: (latency: number) => void): () => void {
    this.latencyListeners.add(listener);
    listener(this.currentLatency);
    return () => this.latencyListeners.delete(listener);
  }

  public onPresenceChange(listener: (info: PeerPresenceInfo) => void): () => void {
    this.presenceListeners.add(listener);
    listener(this.currentPresence);
    return () => this.presenceListeners.delete(listener);
  }

  private setStatus(status: ConnectionStatus) {
    this.currentStatus = status;
    this.statusListeners.forEach((l) => l(status));
  }

  private setLatency(lat: number) {
    this.currentLatency = lat;
    this.latencyListeners.forEach((l) => l(lat));
  }

  private setPresence(info: PeerPresenceInfo) {
    this.currentPresence = info;
    this.presenceListeners.forEach((l) => l(info));
  }

  /**
   * Start 20-second reconnection grace period countdown
   */
  private startGracePeriod(reason: 'backgrounded' | 'network') {
    this.stopGracePeriod();
    this.graceSecondsLeft = 20;
    this.setPresence({ presence: 'reconnecting', secondsLeft: 20 });

    this.graceTimer = setInterval(() => {
      this.graceSecondsLeft -= 1;
      if (this.graceSecondsLeft <= 0) {
        this.stopGracePeriod();
        this.setPresence({ presence: 'disconnected', secondsLeft: 0 });
        // Emit forfeit alert to remaining player
        this.messageListeners.forEach((l) =>
          l({
            type: 'TURN_TIMEOUT',
            payload: { reason: 'peer_forfeit_disconnect' },
          })
        );
      } else {
        this.setPresence({
          presence: 'reconnecting',
          secondsLeft: this.graceSecondsLeft,
        });
      }
    }, 1000);
  }

  private stopGracePeriod() {
    if (this.graceTimer) {
      clearInterval(this.graceTimer);
      this.graceTimer = null;
    }
  }

  /**
   * Periodic lightweight heartbeat ping loop (every 3s)
   */
  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        if (this.isHost) {
          this.send({
            type: 'HEARTBEAT_PING',
            payload: { timestamp: Date.now() },
          });
        }
      }
    }, 3000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
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
          config: {
            iceServers: METERED_ICE_SERVERS,
          },
        });

        this.peer.on('open', () => {
          this.setStatus('waiting');
          resolve(code);
        });

        this.peer.on('connection', (conn) => {
          this.setupConnection(conn);
        });

        this.peer.on('error', (err: any) => {
          console.error('Peer host error:', err);
          this.setStatus('error');
          const msg =
            err?.type === 'unavailable-id'
              ? 'Room code was already in use. Please try creating a room again.'
              : err?.message || 'Failed to initialize host room';
          reject(new Error(msg));
        });
      } catch (err: any) {
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
    const trimmedCode = code.trim();
    this.roomCode = trimmedCode;
    this.setStatus('connecting');

    const hostPeerId = `tabletop-${trimmedCode}`;

    return new Promise((resolve, reject) => {
      let isResolved = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
      };

      try {
        this.peer = new Peer({
          debug: 1,
          config: {
            iceServers: METERED_ICE_SERVERS,
          },
        });

        // 15-second timeout if host cannot be reached
        timeoutHandle = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            this.setStatus('error');
            this.disconnect();
            reject(
              new Error(
                'Connection timed out. Ensure the host is still waiting and try again.'
              )
            );
          }
        }, 15000);

        this.peer.on('open', () => {
          if (!this.peer) return;
          const conn = this.peer.connect(hostPeerId, { reliable: true });
          this.setupConnection(conn);

          conn.on('open', () => {
            if (!isResolved) {
              isResolved = true;
              cleanup();
              resolve();
            }
          });

          conn.on('error', (err: any) => {
            console.error('Peer data connection error:', err);
            if (!isResolved) {
              isResolved = true;
              cleanup();
              this.setStatus('error');
              reject(new Error(err?.message || 'Connection to host failed.'));
            }
          });
        });

        this.peer.on('error', (err: any) => {
          console.error('Peer join error:', err);
          if (!isResolved) {
            isResolved = true;
            cleanup();
            this.setStatus('error');
            const msg =
              err?.type === 'peer-unavailable'
                ? `Room code ${trimmedCode} not found. Make sure the host has created the room.`
                : err?.message || 'Failed to connect to room';
            reject(new Error(msg));
          }
        });
      } catch (err: any) {
        cleanup();
        this.setStatus('error');
        reject(err);
      }
    });
  }

  private setupConnection(conn: DataConnection) {
    this.connection = conn;

    conn.on('open', () => {
      this.setStatus('connected');
      this.setPresence({ presence: 'active' });
      this.stopGracePeriod();
      this.startHeartbeat();

      if (this.isHost) {
        this.send({ type: 'JOIN_ACK', payload: { host: true } });
      }
    });

    conn.on('data', (data) => {
      const msg = data as RemoteMessage;

      // Handle internal heartbeat ping/pong
      if (msg.type === 'HEARTBEAT_PING') {
        const sendTs = msg.payload?.timestamp || Date.now();
        this.send({
          type: 'HEARTBEAT_PONG',
          payload: { timestamp: sendTs },
        });
        return;
      }

      if (msg.type === 'HEARTBEAT_PONG') {
        const start = msg.payload?.timestamp;
        if (start) {
          const rtt = Math.max(10, Date.now() - start);
          const computedLatency = Math.max(8, Math.round(rtt / 2));
          this.setLatency(computedLatency);
          // Broadcast to guest so both see identical latency
          this.send({
            type: 'PING_REPORT',
            payload: { latency: computedLatency },
          });
        }
        return;
      }

      if (msg.type === 'PING_REPORT') {
        if (msg.payload?.latency) {
          this.setLatency(msg.payload.latency);
        }
        return;
      }

      if (msg.type === 'PEER_PRESENCE') {
        const p = msg.payload?.presence as PeerPresence;
        if (p === 'backgrounded') {
          this.startGracePeriod('backgrounded');
        } else if (p === 'active') {
          this.stopGracePeriod();
          this.setPresence({ presence: 'active' });
        }
        return;
      }

      // Dispatch to application listeners
      this.messageListeners.forEach((l) => l(msg));
    });

    conn.on('close', () => {
      this.stopHeartbeat();
      // If we were connected, initiate the 20-second grace period before full disconnect
      if (this.currentStatus === 'connected') {
        this.startGracePeriod('network');
      }
      this.setStatus('disconnected');
      this.connection = null;
    });

    conn.on('error', (err) => {
      console.error('DataConnection error:', err);
      this.stopHeartbeat();
      this.startGracePeriod('network');
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
    this.stopHeartbeat();
    this.stopGracePeriod();

    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.setStatus('disconnected');
    this.setPresence({ presence: 'disconnected' });
    this.roomCode = '';
  }
}

export const multiplayer = new MultiplayerManager();
