import Peer, { DataConnection } from 'peerjs';

export type PeerRole = 'host' | 'guest';

export interface PeerMessage {
  type: string;
  data: any;
}

export interface PeerState {
  role: PeerRole | null;
  connected: boolean;
  roomId: string | null;
  connection: DataConnection | null;
}

let peer: Peer | null = null;
let conn: DataConnection | null = null;
let onMessageCallback: ((msg: PeerMessage) => void) | null = null;
let onConnectionCallback: (() => void) | null = null;
let onDisconnectCallback: (() => void) | null = null;

// Generate a short room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function createRoom(): Promise<string> {
  return new Promise((resolve, reject) => {
    const roomId = `roster-${generateRoomCode()}`;
    
    peer = new Peer(roomId, {
      debug: 1,
    });

    peer.on('open', (id) => {
      console.log('Host peer opened with ID:', id);
      resolve(roomId);
    });

    peer.on('connection', (connection) => {
      conn = connection;
      setupConnection(connection);
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      if (err.type === 'unavailable-id') {
        // Room ID taken, try again
        peer?.destroy();
        createRoom().then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

export function joinRoom(roomId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const guestId = `guest-${generateRoomCode()}`;
    
    peer = new Peer(guestId, {
      debug: 1,
    });

    peer.on('open', () => {
      console.log('Guest peer opened, connecting to:', roomId);
      const connection = peer!.connect(roomId, {
        reliable: true,
      });

      connection.on('open', () => {
        conn = connection;
        setupConnection(connection);
        resolve();
      });

      connection.on('error', (err) => {
        console.error('Connection error:', err);
        reject(err);
      });
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      reject(err);
    });
  });
}

function setupConnection(connection: DataConnection) {
  connection.on('data', (data) => {
    if (onMessageCallback) {
      onMessageCallback(data as PeerMessage);
    }
  });

  connection.on('close', () => {
    console.log('Connection closed');
    if (onDisconnectCallback) {
      onDisconnectCallback();
    }
  });

  connection.on('error', (err) => {
    console.error('Connection error:', err);
  });

  if (onConnectionCallback) {
    onConnectionCallback();
  }
}

export function sendMessage(msg: PeerMessage) {
  if (conn && conn.open) {
    conn.send(msg);
  } else {
    console.warn('Cannot send message: connection not open');
  }
}

export function onMessage(callback: (msg: PeerMessage) => void) {
  onMessageCallback = callback;
}

export function onConnection(callback: () => void) {
  onConnectionCallback = callback;
}

export function onDisconnect(callback: () => void) {
  onDisconnectCallback = callback;
}

export function disconnect() {
  if (conn) {
    conn.close();
    conn = null;
  }
  if (peer) {
    peer.destroy();
    peer = null;
  }
  onMessageCallback = null;
  onConnectionCallback = null;
  onDisconnectCallback = null;
}

export function isConnected(): boolean {
  return conn !== null && conn.open;
}
