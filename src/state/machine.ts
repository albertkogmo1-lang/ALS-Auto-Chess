export type Phase = 
  | 'LOBBY'
  | 'ROUND_START'
  | 'PAWN_PLACEMENT_30'
  | 'PAWN_REVEAL'
  | 'PIECE_PLACEMENT_50'
  | 'FULL_REVEAL'
  | 'COMMANDER_DRAFT_12'
  | 'AWAIT_COLOR_PICK'
  | 'AUTO_PLAY'
  | 'ROUND_RESULT'
  | 'MATCH_RESULT'
  | 'TIEBREAK';

export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
export type Color = 'w' | 'b';

export interface PlacedPiece {
  type: PieceType;
  square: string; // e.g., 'e4'
  color: Color;
}

export interface RoundResult {
  round: number;
  winner: Color | 'draw';
  reason: string;
  whiteCommanderId: string;
  blackCommanderId: string;
  evalGraph: number[];
  finalEval: number;
}

export interface MatchState {
  phase: Phase;
  round: number;
  matchSeed: string;
  seedHash: string;
  scores: { playerA: number; playerB: number };
  usedCommanders: { playerA: string[]; playerB: string[] };
  currentRoundResult: RoundResult | null;
  roundResults: RoundResult[];
  currentFen: string;
  evalHistory: number[];
  whitePlayer: 'A' | 'B'; // Who is white this round
  phaseTimer: number;
  phaseStartTime: number;
  phaseDuration: number;
  // Placement state
  whitePlacement: PlacedPiece[];
  blackPlacement: PlacedPiece[];
  // Commander picks
  whiteCommanderPick: string | null;
  blackCommanderPick: string | null;
  // Auto-play state
  autoPlayMoves: { from: string; to: string; san: string; fen: string; eval: number }[];
  autoPlayIndex: number;
  isAutoPlaying: boolean;
  // Color pick (round 5)
  colorPicker: 'A' | 'B' | null;
  // Sequential draft state (round 5)
  draftSequence: 'simultaneous' | 'sequential';
  whiteRevealedFirst: boolean;
}

export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const STANDARD_PIECES: PieceType[] = ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'r', 'r', 'n', 'n', 'b', 'b', 'q', 'k'];
export const PAWN_PIECES: PieceType[] = ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'];
export const NON_PAWN_PIECES: PieceType[] = ['r', 'r', 'n', 'n', 'b', 'b', 'q', 'k'];
