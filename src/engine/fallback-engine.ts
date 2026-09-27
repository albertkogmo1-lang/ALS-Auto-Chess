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

function minimax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean
): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluatePosition(chess);
  }

  const moves = chess.moves({ verbose: true });
  
  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const eval_ = minimax(chess, depth - 1, alpha, beta, false);
      chess.undo();
      maxEval = Math.max(maxEval, eval_);
      alpha = Math.max(alpha, eval_);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      chess.move(move);
      const eval_ = minimax(chess, depth - 1, alpha, beta, true);
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
    bonus += (captureValues[move.captured] || 0) * 50 * aggression;
  }
  if (move.san.includes('+')) {
    bonus += 30 * aggression;
  }
  if (move.san.includes('#')) {
    bonus += 1000;
  }
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

  // Blunder check
  const rng = seededRandom(moveNumber * 7919 + commander.skillLevel * 31);
  if (rng() < commander.blunderRate) {
    const randomIdx = Math.floor(rng() * moves.length);
    const blunderMove = moves[randomIdx];
    chess.move(blunderMove);
    return { move: blunderMove, eval: evaluatePosition(chess) };
  }

  // Determine effective depth based on commander
  const effectiveDepth = Math.min(commander.depth, 4); // Cap at 4 for browser performance
  
  const isWhite = chess.turn() === 'w';
  let bestMove = moves[0];
  let bestEval = isWhite ? -Infinity : Infinity;

  for (const move of moves) {
    chess.move(move);
    let eval_ = minimax(chess, effectiveDepth - 1, -Infinity, Infinity, !isWhite);
    
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
  return { move: bestMove, eval: evaluatePosition(chess) };
}

export function evaluatePositionAtDepth(fen: string, depth: number): number {
  const chess = new Chess(fen);
  if (chess.isGameOver()) {
    return evaluatePosition(chess);
  }
  return minimax(chess, Math.min(depth, 4), -Infinity, Infinity, chess.turn() === 'w');
}
