export interface Commander {
  id: string;
  name: string;
  skillLevel: number;
  depth: number;
  moveTime: number;
  blunderRate: number;
  aggression: number;
  evalNoise: number;
  flavor: string;
  icon: string;
}

export const COMMANDERS: Commander[] = [
  {
    id: 'grandmaster',
    name: 'The Grandmaster',
    skillLevel: 20,
    depth: 18,
    moveTime: 1500,
    blunderRate: 0,
    aggression: 0.5,
    evalNoise: 0,
    flavor: 'A calculating machine. Never blunders, never falters. Every move is precise, every plan inevitable.',
    icon: '♚'
  },
  {
    id: 'tactician',
    name: 'The Tactician',
    skillLevel: 16,
    depth: 14,
    moveTime: 1000,
    blunderRate: 0.02,
    aggression: 0.8,
    evalNoise: 15,
    flavor: 'Lives for the combination. Sacrifices material for initiative, thrives in chaos.',
    icon: '⚔'
  },
  {
    id: 'wall',
    name: 'The Wall',
    skillLevel: 14,
    depth: 12,
    moveTime: 1200,
    blunderRate: 0.01,
    aggression: 0.2,
    evalNoise: 5,
    flavor: 'Impenetrable defense. Builds fortresses, trades queens, grinds you down in the endgame.',
    icon: '🛡'
  },
  {
    id: 'gambler',
    name: 'The Gambler',
    skillLevel: 10,
    depth: 8,
    moveTime: 600,
    blunderRate: 0.12,
    aggression: 0.9,
    evalNoise: 40,
    flavor: 'All-in or nothing. Pushes pawns, opens lines, and prays to the chess gods.',
    icon: '🎲'
  },
  {
    id: 'novice',
    name: 'The Novice',
    skillLevel: 6,
    depth: 4,
    moveTime: 400,
    blunderRate: 0.20,
    aggression: 0.5,
    evalNoise: 80,
    flavor: 'Still learning the diagonals. Makes moves with hope, not calculation. Sometimes luck favors the bold.',
    icon: '🌱'
  }
];

export function getCommanderById(id: string): Commander | undefined {
  return COMMANDERS.find(c => c.id === id);
}
