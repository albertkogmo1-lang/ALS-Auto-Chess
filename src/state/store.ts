import { create } from 'zustand';
import { MatchState, Phase, PlacedPiece, Color, RoundResult } from './machine';
import { COMMANDERS } from '../engine/commanders';

function generateSeed(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashSeed(seed: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(seed);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface GameStore extends MatchState {
  timerKey: number;
  setState: (partial: Partial<MatchState>) => void;
  startMatch: () => Promise<void>;
  setPhase: (phase: Phase) => void;
  setPlacement: (color: Color, pieces: PlacedPiece[]) => void;
  setCommanderPick: (color: Color, commanderId: string) => void;
  setAutoPlayMoves: (moves: { from: string; to: string; san: string; fen: string; eval: number }[]) => void;
  setAutoPlayIndex: (index: number) => void;
  setIsAutoPlaying: (playing: boolean) => void;
  addRoundResult: (result: RoundResult) => void;
  nextRound: () => void;
  setEvalHistory: (history: number[]) => void;
  addEvalPoint: (eval_: number) => void;
  startTimer: (duration: number) => void;
  setWhitePlayer: (player: 'A' | 'B') => void;
  setColorPicker: (player: 'A' | 'B' | null) => void;
  setDraftSequence: (seq: 'simultaneous' | 'sequential') => void;
  setWhiteRevealedFirst: (val: boolean) => void;
  setCurrentFen: (fen: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  setState: (partial) => set(partial),
  timerKey: 0,
  phase: 'LOBBY',
  round: 0,
  matchSeed: '',
  seedHash: '',
  scores: { playerA: 0, playerB: 0 },
  usedCommanders: { playerA: [], playerB: [] },
  currentRoundResult: null,
  roundResults: [],
  currentFen: '',
  evalHistory: [],
  whitePlayer: 'A',
  phaseTimer: 0,
  phaseStartTime: 0,
  phaseDuration: 0,
  whitePlacement: [],
  blackPlacement: [],
  whiteCommanderPick: null,
  blackCommanderPick: null,
  autoPlayMoves: [],
  autoPlayIndex: 0,
  isAutoPlaying: false,
  colorPicker: null,
  draftSequence: 'simultaneous',
  whiteRevealedFirst: false,

  startMatch: async () => {
    const seed = generateSeed();
    const hash = await hashSeed(seed);
    set({
      phase: 'ROUND_START',
      round: 1,
      matchSeed: seed,
      seedHash: hash,
      scores: { playerA: 0, playerB: 0 },
      usedCommanders: { playerA: [], playerB: [] },
      roundResults: [],
      whitePlayer: 'A',
    });
  },

  setPhase: (phase) => set({ phase }),
  
  setPlacement: (color, pieces) => {
    if (color === 'w') set({ whitePlacement: pieces });
    else set({ blackPlacement: pieces });
  },

  setCommanderPick: (color, commanderId) => {
    if (color === 'w') set({ whiteCommanderPick: commanderId });
    else set({ blackCommanderPick: commanderId });
  },

  setAutoPlayMoves: (moves) => set({ autoPlayMoves: moves }),
  setAutoPlayIndex: (index) => set({ autoPlayIndex: index }),
  setIsAutoPlaying: (playing) => set({ isAutoPlaying: playing }),
  
  addRoundResult: (result) => {
    const state = get();
    const newResults = [...state.roundResults, result];
    const newScores = { ...state.scores };
    if (result.winner === 'w') {
      if (state.whitePlayer === 'A') newScores.playerA += 1;
      else newScores.playerB += 1;
    } else if (result.winner === 'b') {
      if (state.whitePlayer === 'B') newScores.playerA += 1;
      else newScores.playerB += 1;
    } else {
      newScores.playerA += 0.5;
      newScores.playerB += 0.5;
    }
    set({ 
      roundResults: newResults, 
      scores: newScores,
      currentRoundResult: result 
    });
  },

  nextRound: () => {
    const state = get();
    if (state.round >= 5) {
      if (state.scores.playerA === state.scores.playerB) {
        set({ phase: 'TIEBREAK' });
      } else {
        set({ phase: 'MATCH_RESULT' });
      }
    } else {
      const nextRound = state.round + 1;
      let whitePlayer: 'A' | 'B';
      if (nextRound <= 4) {
        whitePlayer = nextRound % 2 === 1 ? 'A' : 'B';
      } else {
        whitePlayer = state.whitePlayer;
      }
      
      const draftSequence = nextRound === 5 ? 'sequential' : 'simultaneous';
      
      set({
        round: nextRound,
        phase: 'ROUND_START',
        whitePlayer,
        draftSequence,
        whitePlacement: [],
        blackPlacement: [],
        whiteCommanderPick: null,
        blackCommanderPick: null,
        autoPlayMoves: [],
        autoPlayIndex: 0,
        isAutoPlaying: false,
        currentFen: '',
        evalHistory: [],
        currentRoundResult: null,
        colorPicker: null,
        whiteRevealedFirst: false,
      });
    }
  },

  setEvalHistory: (history) => set({ evalHistory: history }),
  addEvalPoint: (eval_) => set(state => ({ evalHistory: [...state.evalHistory, eval_] })),
  
  startTimer: (duration) => set({ 
    phaseDuration: duration, 
    phaseStartTime: Date.now(),
    timerKey: get().timerKey + 1 
  }),
  
  setWhitePlayer: (player) => set({ whitePlayer: player }),
  setColorPicker: (player) => set({ colorPicker: player }),
  setDraftSequence: (seq) => set({ draftSequence: seq }),
  setWhiteRevealedFirst: (val) => set({ whiteRevealedFirst: val }),
  setCurrentFen: (fen) => set({ currentFen: fen }),
}));
