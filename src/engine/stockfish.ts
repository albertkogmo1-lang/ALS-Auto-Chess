import { Commander } from './commanders';

// Stockfish engine wrapper for browser environment
// Currently disabled - falls back to custom engine
// TODO: Integrate Stockfish WASM from CDN or local build

let stockfishWorker: Worker | null = null;
let messageHandlers: ((line: string) => void)[] = [];

export async function initEngine(): Promise<void> {
  // Stockfish integration disabled for now
  // The fallback engine will be used instead
  console.log('Stockfish engine disabled, using fallback engine');
  stockfishWorker = null;
}

function postMessage(msg: string): void {
  if (stockfishWorker) {
    stockfishWorker.postMessage(msg);
  }
}

function waitForMessage(expected: string): Promise<void> {
  return new Promise((resolve) => {
    const handler = (line: string) => {
      if (line.includes(expected)) {
        removeMessageListener(handler);
        resolve();
      }
    };
    addMessageListener(handler);
  });
}

function addMessageListener(handler: (line: string) => void): void {
  messageHandlers.push(handler);
}

function removeMessageListener(handler: (line: string) => void): void {
  messageHandlers = messageHandlers.filter(h => h !== handler);
}

export function isStockfishAvailable(): boolean {
  return stockfishWorker !== null;
}

export function getMoveForCommander(
  fen: string,
  commander: Commander
): Promise<string> {
  return new Promise((resolve) => {
    if (!stockfishWorker) {
      throw new Error('Stockfish not initialized');
    }
    
    const handler = (line: string) => {
      if (line.startsWith('bestmove')) {
        removeMessageListener(handler);
        const parts = line.split(' ');
        resolve(parts[1]); // e.g., "bestmove e2e4"
      }
    };
    
    addMessageListener(handler);
    
    // Set skill level
    postMessage(`setoption name Skill Level value ${commander.skillLevel}`);
    
    // Set position
    postMessage(`position fen ${fen}`);
    
    // Search with commander's depth and time
    postMessage(`go depth ${commander.depth} movetime ${commander.moveTime}`);
  });
}

export function getEval(fen: string, depth: number = 20): Promise<number> {
  return new Promise((resolve) => {
    if (!stockfishWorker) {
      throw new Error('Stockfish not initialized');
    }
    
    let lastCp = 0;
    
    const handler = (line: string) => {
      if (line.includes('score cp')) {
        const match = line.match(/score cp (-?\d+)/);
        if (match) {
          lastCp = parseInt(match[1]);
        }
      } else if (line.includes('score mate')) {
        const match = line.match(/score mate (-?\d+)/);
        if (match) {
          const mate = parseInt(match[1]);
          lastCp = mate > 0 ? 10000 : -10000;
        }
      }
      
      if (line.startsWith('bestmove')) {
        removeMessageListener(handler);
        resolve(lastCp);
      }
    };
    
    addMessageListener(handler);
    
    postMessage(`position fen ${fen}`);
    postMessage(`go depth ${depth}`);
  });
}

export function stopEngine(): void {
  if (stockfishWorker) {
    stockfishWorker.terminate();
    stockfishWorker = null;
    messageHandlers = [];
  }
}
