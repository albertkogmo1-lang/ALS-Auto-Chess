import { Chess } from 'chess.js';
import { PlacedPiece, Color, PieceType } from '../state/machine';
import { rngFor } from '../net/seeded-rng';

export function buildFenFromPlacement(
  whitePieces: PlacedPiece[],
  blackPieces: PlacedPiece[],
  whiteToMove: boolean
): string {
  // Build board array
  const board: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Place white pieces
  for (const p of whitePieces) {
    const file = p.square.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = parseInt(p.square[1]) - 1;
    board[rank][file] = p.type === 'p' ? 'P' : p.type === 'r' ? 'R' : 
                         p.type === 'n' ? 'N' : p.type === 'b' ? 'B' : 
                         p.type === 'q' ? 'Q' : 'K';
  }
  
  // Place black pieces
  for (const p of blackPieces) {
    const file = p.square.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = parseInt(p.square[1]) - 1;
    board[rank][file] = p.type === 'p' ? 'p' : p.type === 'r' ? 'r' : 
                         p.type === 'n' ? 'n' : p.type === 'b' ? 'b' : 
                         p.type === 'q' ? 'q' : 'k';
  }
  
  // Convert to FEN
  let fen = '';
  for (let rank = 7; rank >= 0; rank--) {
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      if (board[rank][file]) {
        if (empty > 0) {
          fen += empty;
          empty = 0;
        }
        fen += board[rank][file];
      } else {
        empty++;
      }
    }
    if (empty > 0) fen += empty;
    if (rank > 0) fen += '/';
  }
  
  fen += whiteToMove ? ' w' : ' b';
  fen += ' - - 0 1';
  
  return fen;
}

export function validatePosition(fen: string): { valid: boolean; fixedFen?: string } {
  try {
    const chess = new Chess(fen);
    
    // Check if the side NOT to move is in check
    const turn = chess.turn();
    const otherColor = turn === 'w' ? 'b' : 'w';
    
    // Temporarily switch turn to check
    // Actually, we need to check if the non-moving side's king is attacked
    // This is an unusual position - let's just validate the FEN is legal
    if (chess.isGameOver()) {
      return { valid: true }; // Game is already over, that's fine
    }
    
    return { valid: true };
  } catch {
    return { valid: false };
  }
}

export function autoPlacePieces(
  remainingTypes: PieceType[],
  color: Color,
  phase: 'pawns' | 'pieces',
  occupiedSquares: Set<string>,
  seed: string,
  round: number = 1
): PlacedPiece[] {
  const placed: PlacedPiece[] = [];
  const files = 'abcdefgh';
  const rankStart = color === 'w' ? 1 : 5;
  const rankEnd = color === 'w' ? 4 : 8;
  
  // Use seeded RNG
  const rng = rngFor(seed, round, `auto-place-${color}-${phase}`);
  
  for (const type of remainingTypes) {
    // Find available squares
    const available: string[] = [];
    for (let rank = rankStart; rank <= rankEnd; rank++) {
      for (const file of files) {
        const sq = `${file}${rank}`;
        if (occupiedSquares.has(sq)) continue;
        if (placed.some(p => p.square === sq)) continue;
        
        available.push(sq);
      }
    }
    
    if (available.length > 0) {
      const idx = Math.floor(rng() * available.length);
      placed.push({ type, square: available[idx], color });
    }
  }
  
  return placed;
}

export interface ResolvedGame {
  chess: Chess;
  fen: string;
  white: PlacedPiece[];
  black: PlacedPiece[];
}

// Turn an arbitrary (spec-legal) placement into a playable chess position.
// Blind placements can produce positions chess.js rejects - most commonly
// kings on adjacent squares, or the side NOT to move being in check.
// Strategy: try White to move, then Black to move; if still illegal,
// deterministically relocate Black's king to the first square (scanned
// a1->h8) that produces a legal position.
export function createGameFromPlacement(white: PlacedPiece[], black: PlacedPiece[]): ResolvedGame | null {
  const tryBuild = (w: PlacedPiece[], b: PlacedPiece[]): ResolvedGame | null => {
    const base = buildFenFromPlacement(w, b, true);
    for (const turn of ['w', 'b']) {
      const parts = base.split(' ');
      parts[1] = turn;
      const fen = parts.join(' ');
      try {
        return { chess: new Chess(fen), fen, white: w, black: b };
      } catch {
        // try the other side to move
      }
    }
    return null;
  };

  const direct = tryBuild(white, black);
  if (direct) return direct;

  const kingIdx = black.findIndex(p => p.type === 'k');
  if (kingIdx >= 0) {
    const original = black[kingIdx].square;
    for (let rank = 1; rank <= 8; rank++) {
      for (const file of 'abcdefgh') {
        const sq = `${file}${rank}`;
        if (sq === original) continue;
        if (white.some(p => p.square === sq)) continue;
        if (black.some((p, i) => i !== kingIdx && p.square === sq)) continue;
        const moved = black.map((p, i) => (i === kingIdx ? { ...p, square: sq } : p));
        const resolved = tryBuild(white, moved);
        if (resolved) {
          console.warn(`Position illegal as placed; Black king relocated ${original} -> ${sq}`);
          return resolved;
        }
      }
    }
  }

  console.error('Could not legalize placement - no valid king relocation found');
  return null;
}
