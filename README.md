# ♟ Roster Draft Autochess

A 5-round chess variant web game combining blind army placement with commander drafting. Built with React, TypeScript, Vite, and Tailwind CSS.

## 🎮 Game Concept

Two players compete in a 5-round chess match where strategy happens in two layers:

1. **Blind Placement** — Each player secretly places their 16 pieces in their half of the board, without seeing the opponent's setup
2. **Commander Draft** — Each round, players draft one of 5 unique AI "Commanders" (single-use per match) to pilot their army in auto-play

You can have the better position and still lose if you send in the wrong Commander!

## 🏃 How to Run

### Quick Start (Development)
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Production Build
```bash
npm run build
# Serve the dist/ folder with any static file server
```

## 🎯 How to Play Locally

1. Open the app in a browser
2. Click "Start Match"
3. **This is a hot-seat game** — two players share the same device
4. Screen obscuring ensures blind placement (pass & play style)

### Game Flow Per Round:
1. **Pawn Placement (30s each)** — Place 8 pawns in your zone (ranks 2-4 for White, 5-7 for Black)
2. **Pawn Reveal** — Both sides' pawns are revealed simultaneously
3. **Piece Placement (50s each)** — Place remaining 8 pieces (rooks, knights, bishops, queen, king)
4. **Full Reveal** — Complete starting position shown to both players
5. **Commander Draft (12s)** — Each player picks a Commander from their remaining roster
6. **Auto-Play** — Commanders battle! Players spectate as pieces move automatically
7. **Round Result** — Winner scored, eval graph shown

### Placement Rules:
- Pawns: White on ranks 2-4, Black on ranks 5-7 (never on rank 1 or 8)
- Kings: White king NOT on rank 4, Black king NOT on rank 5
- All pieces must be in your deployment zone (White: ranks 1-4, Black: ranks 5-8)
- Timer expiry auto-places remaining pieces randomly

### Commanders (single-use per match):
| Commander | Depth | Blunder% | Aggression | Style |
|-----------|-------|----------|------------|-------|
| ♚ The Grandmaster | 18 | 0% | 50% | Perfect calculation |
| ⚔ The Tactician | 14 | 2% | 80% | Aggressive combinations |
| 🛡 The Wall | 12 | 1% | 20% | Impenetrable defense |
| 🎲 The Gambler | 8 | 12% | 90% | All-in chaos |
| 🌱 The Novice | 4 | 20% | 50% | Hopeful but flawed |

### Round 5 Special Rules:
- Trailing player chooses their color
- Commander draft is sequential (White reveals first)

### Match Tiebreak:
- If tied after 5 rounds → Sudden Death round (reuse best Commander)

## 🏗 Architecture

```
src/
├── App.tsx                    # Main game orchestrator
├── state/
│   ├── machine.ts            # Game state types & phases
│   └── store.ts              # Zustand state management
├── engine/
│   ├── commanders.ts         # Commander definitions & stats
│   ├── heuristic.ts          # Position evaluation (material + mobility)
│   └── fallback-engine.ts    # Alpha-beta engine (depth 2-4)
├── rules/
│   ├── placement.ts          # Placement validation rules
│   ├── validation.ts         # FEN building & position validation
│   └── adjudication.ts       # End-of-round adjudication
└── components/
    ├── Board.tsx              # 8×8 chess board with interaction
    ├── PieceTray.tsx          # Draggable piece selection tray
    ├── PhaseTimer.tsx         # Countdown timer bar
    ├── EvalBar.tsx            # Vertical evaluation bar
    ├── CommanderRoster.tsx    # Commander cards with stats
    ├── RoundTracker.tsx       # Match score & round history
    └── RoundRecap.tsx         # Post-round summary modal
```

## 🔧 Tech Stack

- **React 18** + **TypeScript** — UI framework
- **Vite** — Build tool
- **Tailwind CSS 4** — Styling
- **Zustand** — State management
- **chess.js** — Move legality & game state
- **Custom Alpha-Beta Engine** — Fallback AI (no external WASM dependency)

## 📋 Known Stubs / Next Steps

- **Engine Depth**: The fallback engine caps at depth 4 for browser performance. A full Stockfish WASM integration would provide depth 18+ play.
- **Online Multiplayer**: Currently hot-seat only. WebSocket server for true online play would need separate deployment.
- **Seeded RNG**: Uses a simplified LCG. A production version would use a cryptographically secure seeded PRNG.
- **Move Animations**: Pieces teleport rather than animate. CSS transitions or a library like `react-spring` would smooth this.
- **Sound Effects**: No audio feedback for moves, captures, or check.
- **Opening Book**: The engine has no opening knowledge — it plays purely from evaluation.
- **Mobile Optimization**: The layout works on mobile but could benefit from a dedicated mobile layout.
- **Puzzle Mode**: Could add tactical puzzles generated from random placements.

## 📜 License

MIT — Use freely.
