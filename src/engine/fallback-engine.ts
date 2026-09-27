import { Chess, Move } from 'chess.js';
import { Commander } from './commanders';
import { evaluatePosition } from './heuristic';

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Piece-square tables for better evaluation
const PAWN_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5,  5, 10, 25, 25, 10,  5,  5,
  0,  0,  0, 20, 20,  0,  0,  0,
  5, -5,-10,  0,  0,-10, -5,  5,
  5, 10, 10,-20,-20, 10, 10,  5,
  0,  0,  0,  0,  0,  0,  0,  0
];

const KNIGHT_TABLE = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50
];

const PIECE_VALUES: Record<string, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000
};

function evaluateBoard(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -50000 : 50000;
  }
  if (chess.isDraw() || chess.isStalemate()) return 0;

  const board = chess.board();
  let score = 0;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const sq = board[row][col];
      if (!sq) continue;

      const val = PIECE_VALUES[sq.type] || 0;
      let positionalBonus = 0;

      // Positional bonuses
      if (sq.type === 'p') {
        const idx = sq.color === 'w' ? row * 8 + col : (7 - row) * 8 + col;
        positionalBonus = PAWN_TABLE[idx] || 0;
      } else if (sq.type === 'n') {
        const idx = sq.color === 'w' ? row * 8 + col : (7 - row) * 8 + col;
        positionalBonus = KNIGHT_TABLE[idx] || 0;
      }

      if (sq.color === 'w') {
        score += val + positionalBonus;
      } else {
        score -= val + positionalBonus;
      }
    }
  }

  // Mobility bonus (simplified)
  const moves = chess.moves().length;
  score += (chess.turn() === 'w' ? 1 : -1) * moves * 2;

  // Check bonus
  if (chess.isCheck()) {
    score += (chess.turn() === 'w' ? -30 : 30);
  }

  return score;
}

function orderMoves(chess: Chess, moves: Move[]): Move[] {
  // MVV-LVA move ordering for better alpha-beta pruning
  const captureValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  
  return moves.sort((a, b) => {
    let scoreA = 0, scoreB = 0;
    if (a.captured) scoreA += captureValues[a.captured] * 10 - captureValues[a.piece];
    if (b.captured) scoreB += captureValues[b.captured] * 10 - captureValues[b.piece];
    if (a.san.includes('+')) scoreA += 5;
    if (b.san.includes('+')) scoreB += 5;
    return scoreB - scoreA;
  });
}

function alphaBeta(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean
): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluateBoard(chess);
  }

  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) {
    return evaluateBoard(chess);
  }

  const orderedMoves = orderMoves(chess, moves);
  
  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of orderedMoves) {
      chess.move(move);
      const eval_ = alphaBeta(chess, depth - 1, alpha, beta, false);
      chess.undo();
      maxEval = Math.max(maxEval, eval_);
      alpha = Math.max(alpha, eval_);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of orderedMoves) {
      chess.move(move);
      const eval_ = alphaBeta(chess, depth - 1, alpha, beta, true);
      chess.undo();
      minEval = Math.min(minEval, eval_);
      beta = Math.min(beta, eval_);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function scoreMoveAggressively(move: Move, aggression: number): number {
  let bonus = 0;
  if (move.captured) {
    const captureValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    bonus += (captureValues[move.captured] || 0) * 30 * aggression;
  }
  if (move.san.includes('+')) bonus += 20 * aggression;
  if (move.san.includes('#')) bonus += 1000;
  return bonus;
}

export function getEngineMove(
  fen: string,
  commander: Commander,
  moveNumber: number
): { move: Move; eval: number } {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  
  if (moves.length === 0) {
    throw new Error('No legal moves');
  }

  // Blunder check - play random move
  const rng = seededRandom(moveNumber * 7919 + commander.skillLevel * 31);
  if (rng() < commander.blunderRate) {
    const randomIdx = Math.floor(rng() * moves.length);
    const blunderMove = moves[randomIdx];
    chess.move(blunderMove);
    return { move: blunderMove, eval: evaluateBoard(chess) };
  }

  // Depth scales with commander skill but capped for browser performance
  // Grandmaster(20)->3, Tactician(16)->3, Wall(14)->2, Gambler(10)->2, Novice(6)->1
  const effectiveDepth = commander.skillLevel >= 16 ? 3 : commander.skillLevel >= 10 ? 2 : 1;
  
  const isWhite = chess.turn() === 'w';
  let bestMove = moves[0];
  let bestEval = isWhite ? -Infinity : Infinity;

  // Order moves for better pruning
  const orderedMoves = orderMoves(chess, moves);

  for (const move of orderedMoves) {
    chess.move(move);
    let eval_ = alphaBeta(chess, effectiveDepth - 1, -Infinity, Infinity, !isWhite);
    
    // Apply eval noise
    const noise = (rng() - 0.5) * 2 * commander.evalNoise;
    eval_ += noise;
    
    // Apply aggression bonus
    eval_ += scoreMoveAggressively(move, commander.aggression) * (isWhite ? 1 : -1);
    
    chess.undo();

    if (isWhite) {
      if (eval_ > bestEval) {
        bestEval = eval_;
        bestMove = move;
      }
    } else {
      if (eval_ < bestEval) {
        bestEval = eval_;
        bestMove = move;
      }
    }
  }

  chess.move(bestMove);
  return { move: bestMove, eval: evaluateBoard(chess) };
}

export function evaluatePositionAtDepth(fen: string, depth: number): number {
  const chess = new Chess(fen);
  if (chess.isGameOver()) {
    return evaluateBoard(chess);
  }
  return alphaBeta(chess, Math.min(depth, 3), -Infinity, Infinity, chess.turn() === 'w');
}
