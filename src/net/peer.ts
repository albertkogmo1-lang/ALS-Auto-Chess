import Peer, { DataConnection } from 'peerjs';

export type PeerRole = 'host' | 'guest';

export interface PeerMessage {
  type: string;
  data: any;
}

let peer: Peer | null = null;
let conn: DataConnection | null = null;
let onMessageCallback: ((msg: PeerMessage) => void) | null = null;
let onConnectionCallback: (() => void) | null = null;
let onDisconnectCallback: (() => void) | null = null;
let onErrorCallback: ((err: string) => void) | null = null;

// Generate a short room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// PeerJS configuration with reliable ICE servers
const PEER_CONFIG = {
  debug: 1,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
    ]
  }
};

export function createRoom(): Promise<string> {
  return new Promise((resolve, reject) => {
    const roomCode = generateRoomCode();
    const peerId = `rda-host-${roomCode}-${Date.now().toString(36)}`;
    
    console.log('Creating room with peer ID:', peerId);
    
    try {
      peer = new Peer(peerId, PEER_CONFIG);
    } catch (err) {
      reject(new Error('Failed to initialize PeerJS'));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout. Please check your internet and try again.'));
      peer?.destroy();
    }, 15000);

    peer.on('open', (id) => {
      clearTimeout(timeout);
      console.log('Host peer opened:', id);
      resolve(roomCode);
    });

    peer.on('connection', (connection) => {
      console.log('Guest connected!');
      conn = connection;
      setupConnection(connection);
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err.type, err.message);
      clearTimeout(timeout);
      
      if (err.type === 'unavailable-id') {
        // ID taken, retry with new one
        peer?.destroy();
        createRoom().then(resolve).catch(reject);
      } else if (err.type === 'network' || err.type === 'server-error') {
        reject(new Error('Network error. The signaling server may be temporarily unavailable. Please try again in a moment.'));
      } else if (err.type === 'peer-unavailable') {
        reject(new Error('Room not found. Check the code and try again.'));
      } else {
        reject(new Error(`Connection failed: ${err.message || err.type}`));
      }
    });

    peer.on('disconnected', () => {
      console.log('Peer disconnected, attempting reconnect...');
      try {
        peer?.reconnect();
      } catch {}
    });
  });
}

export function joinRoom(roomCode: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const guestId = `rda-guest-${generateRoomCode()}-${Date.now().toString(36)}`;
    
    console.log('Joining room:', roomCode, 'as', guestId);
    
    try {
      peer = new Peer(guestId, PEER_CONFIG);
    } catch (err) {
      reject(new Error('Failed to initialize PeerJS'));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout. The host may have left or the code is wrong.'));
      peer?.destroy();
    }, 15000);

    peer.on('open', () => {
      console.log('Guest peer opened, searching for host...');
      
      // Try to find the host - the peer ID starts with rda-host-{code}
      // We need to search for matching peers
      // Since we can't list peers, we try connecting with timestamp variants
      const tryConnect = (attempt: number) => {
        if (attempt > 20) {
          clearTimeout(timeout);
          reject(new Error('Could not find the host room. Make sure the code is correct and the host is waiting.'));
          return;
        }
        
        // Try different timestamp suffixes (host created within last ~10 minutes)
        const now = Date.now();
        const timestamps: string[] = [];
        for (let i = 0; i < 5; i++) {
          timestamps.push((now - i * 60000).toString(36));
        }
        
        let found = false;
        for (const ts of timestamps) {
          const hostPeerId = `rda-host-${roomCode}-${ts}`;
          console.log(`Attempt ${attempt}: trying ${hostPeerId}`);
          
          const connection = peer!.connect(hostPeerId, {
            reliable: true,
            serialization: 'json',
          });

          connection.on('open', () => {
            clearTimeout(timeout);
            console.log('Connected to host!');
            conn = connection;
            setupConnection(connection);
            resolve();
          });

          connection.on('error', (err) => {
            // This peer ID didn't work, try next
            console.log(`Failed: ${hostPeerId}`);
          });
        }
        
        // Retry after a delay
        setTimeout(() => tryConnect(attempt + 1), 1500);
      };
      
      tryConnect(0);
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err.type, err.message);
      clearTimeout(timeout);
      
      if (err.type === 'network' || err.type === 'server-error') {
        reject(new Error('Network error. Please check your internet connection.'));
      } else if (err.type === 'peer-unavailable') {
        reject(new Error('Room not found. The host may not be waiting anymore.'));
      } else {
        reject(new Error(`Connection failed: ${err.message || err.type}`));
      }
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
    conn = null;
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
    try {
      conn.send(msg);
    } catch (err) {
      console.error('Send failed:', err);
    }
  } else {
    console.warn('Cannot send: connection not open');
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

export function onError(callback: (err: string) => void) {
  onErrorCallback = callback;
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
  onErrorCallback = null;
}

export function isConnected(): boolean {
  return conn !== null && conn.open;
}
