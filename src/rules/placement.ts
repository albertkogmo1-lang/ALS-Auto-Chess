import { PlacedPiece, PieceType, Color } from '../state/machine';

export function isValidPawnSquare(square: string, color: Color): boolean {
  const file = square[0];
  const rank = parseInt(square[1]);
  
  if (file < 'a' || file > 'h') return false;
  
  if (color === 'w') {
    // White pawns: ranks 2-4
    return rank >= 2 && rank <= 4;
  } else {
    // Black pawns: ranks 5-7
    return rank >= 5 && rank <= 7;
  }
}

export function isValidKingSquare(square: string, color: Color): boolean {
  const rank = parseInt(square[1]);
  
  if (color === 'w') {
    // White king: NOT on rank 4
    return rank >= 1 && rank <= 3;
  } else {
    // Black king: NOT on rank 5
    return rank >= 6 && rank <= 8;
  }
}

export function isInZone(square: string, color: Color): boolean {
  const rank = parseInt(square[1]);
  if (color === 'w') {
    return rank >= 1 && rank <= 4;
  } else {
    return rank >= 5 && rank <= 8;
  }
}

export function validatePlacement(
  pieces: PlacedPiece[],
  color: Color,
  phase: 'pawns' | 'pieces'
): { valid: boolean; error?: string } {
  const occupiedSquares = new Set<string>();
  
  for (const piece of pieces) {
    // Check zone
    if (!isInZone(piece.square, color)) {
      return { valid: false, error: `${piece.square} is outside your deployment zone` };
    }
    
    // Check duplicate squares
    if (occupiedSquares.has(piece.square)) {
      return { valid: false, error: `Duplicate placement on ${piece.square}` };
    }
    occupiedSquares.add(piece.square);
    
    // Check pawn restrictions
    if (piece.type === 'p') {
      if (!isValidPawnSquare(piece.square, color)) {
        return { valid: false, error: `Pawns cannot be placed on rank ${piece.square[1]} for ${color === 'w' ? 'White' : 'Black'}` };
      }
    }
    
    // Check king restrictions
    if (piece.type === 'k') {
      if (!isValidKingSquare(piece.square, color)) {
        return { valid: false, error: `King cannot be placed on rank ${piece.square[1]} for ${color === 'w' ? 'White' : 'Black'}` };
      }
    }
  }
  
  // Check piece counts
  if (phase === 'pawns') {
    const pawnCount = pieces.filter(p => p.type === 'p').length;
    if (pawnCount > 8) {
      return { valid: false, error: 'Too many pawns (max 8)' };
    }
  } else {
    const counts: Record<PieceType, number> = { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 };
    for (const p of pieces) counts[p.type]++;
    if (counts.r > 2) return { valid: false, error: 'Too many rooks' };
    if (counts.n > 2) return { valid: false, error: 'Too many knights' };
    if (counts.b > 2) return { valid: false, error: 'Too many bishops' };
    if (counts.q > 1) return { valid: false, error: 'Too many queens' };
    if (counts.k > 1) return { valid: false, error: 'Too many kings' };
  }
  
  return { valid: true };
}

export function getAvailableSquares(
  color: Color,
  phase: 'pawns' | 'pieces',
  occupiedSquares: Set<string>
): string[] {
  const squares: string[] = [];
  const files = 'abcdefgh';
  
  const rankStart = color === 'w' ? 1 : 5;
  const rankEnd = color === 'w' ? 4 : 8;
  
  for (let rank = rankStart; rank <= rankEnd; rank++) {
    for (const file of files) {
      const sq = `${file}${rank}`;
      if (!occupiedSquares.has(sq)) {
        if (phase === 'pawns') {
          if (isValidPawnSquare(sq, color)) {
            squares.push(sq);
          }
        } else {
          squares.push(sq);
        }
      }
    }
  }
  
  return squares;
}
