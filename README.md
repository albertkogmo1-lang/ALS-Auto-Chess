# ♟ Roster Draft Autochess

A 5-round chess variant web game combining blind army placement with commander drafting. Built with React, TypeScript, Vite, Tailwind CSS, and PeerJS for peer-to-peer networking.

## 🎮 Game Concept

Two players compete online in a 5-round chess match where strategy happens in two layers:

1. **Blind Placement** — Each player secretly places their 16 pieces in their half of the board, without seeing the opponent's setup
2. **Commander Draft** — Each round, players draft one of 5 unique AI "Commanders" (single-use per match) to pilot their army in auto-play

You can have the better position and still lose if you send in the wrong Commander!

## 🌐 Online Multiplayer

This is a **true online multiplayer game** using WebRTC peer-to-peer connections:

- **No server required** — Players connect directly to each other
- **One player creates a room** and gets a 6-character code
- **The other player joins** using that code
- **All game state syncs in real-time** between both browsers

### How to Play Online

1. **Player 1 (Host):**
   - Open the game in your browser
   - Click "Create Room"
   - Share the room code with your opponent

2. **Player 2 (Guest):**
   - Open the game in your browser
   - Enter the room code
   - Click "Join"

3. **Start the Match:**
   - Host clicks "Start Match" when both players are connected
   - Host plays as White, Guest plays as Black
   - Colors alternate each round (except Round 5)

## 🏃 How to Run

### Quick Start (Development)
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:5173` in two browser tabs or share the URL with a friend!

### Production Build
```bash
npm run build
# Serve the dist/ folder with any static file server
```

## 🎯 Game Flow

### Per Round:
1. **Pawn Placement (30s)** — Place 8 pawns in your zone (ranks 2-4 for White, 5-7 for Black)
2. **Pawn Reveal** — Both sides' pawns are revealed simultaneously
3. **Piece Placement (50s)** — Place remaining 8 pieces (rooks, knights, bishops, queen, king)
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
├── App.tsx                    # Main game orchestrator with online multiplayer
├── net/
│   └── peer.ts               # PeerJS WebRTC connection wrapper
├── state/
│   ├── machine.ts            # Game state types & phases
│   └── store.ts              # Zustand state management
├── engine/
│   ├── commanders.ts         # Commander definitions & stats
│   ├── heuristic.ts          # Position evaluation (material + mobility)
│   └── fallback-engine.ts    # Alpha-beta engine (depth 1-3)
├── rules/
│   ├── placement.ts          # Placement validation rules
│   ├── validation.ts         # FEN building & position validation
│   └── adjudication.ts       # End-of-round adjudication
└── components/
    ├── Board.tsx              # 8×8 chess board with interaction
    ├── PieceTray.tsx          # Piece selection tray
    ├── PhaseTimer.tsx         # Countdown timer bar
    ├── EvalBar.tsx            # Vertical evaluation bar
    ├── CommanderRoster.tsx    # Commander cards with stats
    ├── RoundTracker.tsx       # Match score & round history
    └── RoundRecap.tsx         # Post-round summary modal
```

### Networking Flow

**Host (Authority):**
- Creates PeerJS peer with room ID
- Owns timers, RNG seed, reveals
- Runs the engine for auto-play
- Sends state updates to guest

**Guest:**
- Connects to host's peer ID
- Sends placements and commander picks
- Receives state updates and moves
- Renders the same game from their perspective

**Message Types:**
- `request-state` — Guest requests initial state
- `game-state` — Full state sync
- `placement` — Player's piece placement
- `commander-pick` — Commander selection
- `phase-change` — Timer/phase updates
- `reveal` — Position reveal
- `move` — Auto-play move
- `round-result` — Round outcome
- `match-result` — Match outcome

## 🔧 Tech Stack

- **React 18** + **TypeScript** — UI framework
- **Vite** — Build tool
- **Tailwind CSS 4** — Styling
- **Zustand** — State management
- **chess.js** — Move legality & game state
- **PeerJS** — WebRTC peer-to-peer networking
- **Custom Alpha-Beta Engine** — Fallback AI (no external WASM dependency)

## 📋 Known Stubs / Next Steps

- **Engine Depth**: The fallback engine caps at depth 3 for browser performance. A full Stockfish WASM integration would provide depth 18+ play.
- **Server Authority**: Currently the host acts as authority. A dedicated server would prevent host cheating.
- **Seeded RNG**: Uses a simplified approach. A production version would use a cryptographically secure seeded PRNG committed via hash.
- **Move Animations**: Pieces teleport rather than animate. CSS transitions would smooth this.
- **Sound Effects**: No audio feedback for moves, captures, or check.
- **Opening Book**: The engine has no opening knowledge — it plays purely from evaluation.
- **Mobile Optimization**: The layout works on mobile but could benefit from a dedicated mobile layout.
- **Reconnection**: If a peer disconnects, the match ends. Reconnection logic would improve reliability.
- **Spectator Mode**: Allow third parties to watch matches in progress.

## 🎓 How It Works

### Blind Placement
Each player places pieces on their own board without seeing the opponent's. The host triggers reveals at timer expiry, ensuring fairness.

### Commander Draft
Both players simultaneously pick from their remaining roster. The host checks if both have picked, then starts auto-play.

### Auto-Play
The host generates moves using the alpha-beta engine with commander-specific parameters (depth, blunder rate, aggression). Moves are streamed to the guest in real-time.

### Color Fairness
- Rounds 1-4: Colors alternate (Host: W-B-W-B, Guest: B-W-B-W)
- Round 5: Trailing player chooses color; sequential draft to offset first-move advantage

## 📜 License

MIT — Use freely.

## 🙏 Credits

Built with [PeerJS](https://peerjs.com/) for peer-to-peer WebRTC connections.
