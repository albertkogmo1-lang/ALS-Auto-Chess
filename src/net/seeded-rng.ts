import seedrandom from 'seedrandom';

// Generate a random 256-bit seed
export async function generateMatchSeed(): Promise<{ seed: string; hash: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const seed = Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Create hash commitment (SHA-256)
  const hash = await sha256(seed);
  
  return { seed, hash };
}

// SHA-256 hash function
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Create a seeded RNG for a specific round and phase
export function rngFor(seed: string, round: number, phase: string): () => number {
  const combinedSeed = `${seed}-${round}-${phase}`;
  return seedrandom(combinedSeed);
}

// Verify seed matches hash
export async function verifySeed(seed: string, hash: string): Promise<boolean> {
  const computedHash = await sha256(seed);
  return computedHash === hash;
}
