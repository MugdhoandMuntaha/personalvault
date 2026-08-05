/**
 * Shamir's Secret Sharing Scheme over Galois Field GF(2^8)
 * Standard irreducible polynomial: x^8 + x^4 + x^3 + x + 1 (0x11b)
 * 
 * Allows splitting a secret key into N shares where any K shares (threshold)
 * can reconstruct the original secret key, but K-1 shares reveal zero information.
 */

const PRIMITIVE_POLY = 0x11b; // Rijndael field polynomial
const GF_SIZE = 256;

// Precompute log and exp tables for GF(2^8) multiplication and division
const LOG_TABLE = new Uint8Array(GF_SIZE);
const EXP_TABLE = new Uint8Array(GF_SIZE);

(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    LOG_TABLE[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= PRIMITIVE_POLY;
    }
  }
  EXP_TABLE[255] = EXP_TABLE[0];
})();

function gfAdd(a: number, b: number): number {
  return a ^ b;
}

function gfSub(a: number, b: number): number {
  return a ^ b;
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[a] + LOG_TABLE[b]) % 255];
}

function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error("GF(2^8) Division by zero");
  if (a === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[a] - LOG_TABLE[b] + 255) % 255];
}

/**
 * Evaluates polynomial a_0 + a_1*x + a_2*x^2 + ... + a_{k-1}*x^{k-1} at x in GF(2^8)
 */
function evalPoly(poly: Uint8Array, x: number): number {
  let result = 0;
  for (let i = poly.length - 1; i >= 0; i--) {
    result = gfAdd(gfMul(result, x), poly[i]);
  }
  return result;
}

export interface ShamirShare {
  id: number; // x coordinate (1 to 255)
  shareHex: string; // y coordinates as hex string
}

/**
 * Splits a secret (hex string) into N shares with threshold K.
 */
export function splitSecret(secretHex: string, totalShares: number, threshold: number): ShamirShare[] {
  if (threshold < 2 || threshold > totalShares) {
    throw new Error("Threshold must be >= 2 and <= totalShares");
  }
  if (totalShares > 254) {
    throw new Error("Total shares cannot exceed 254 in GF(2^8)");
  }

  const bytes = new Uint8Array(
    secretHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
  );

  const shares: ShamirShare[] = [];
  const shareBuffers: Uint8Array[] = Array.from(
    { length: totalShares },
    () => new Uint8Array(bytes.length)
  );

  // For each byte in the secret, generate a random degree (K-1) polynomial
  for (let i = 0; i < bytes.length; i++) {
    const poly = new Uint8Array(threshold);
    poly[0] = bytes[i]; // constant term is the secret byte

    // Fill coefficients a_1 ... a_{K-1} with cryptographically random bytes
    const randCoeffs = new Uint8Array(threshold - 1);
    crypto.getRandomValues(randCoeffs);
    for (let j = 1; j < threshold; j++) {
      poly[j] = randCoeffs[j - 1];
    }

    // Evaluate polynomial for x = 1 ... totalShares
    for (let x = 1; x <= totalShares; x++) {
      shareBuffers[x - 1][i] = evalPoly(poly, x);
    }
  }

  for (let x = 1; x <= totalShares; x++) {
    const hex = Array.from(shareBuffers[x - 1])
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    shares.push({ id: x, shareHex: hex });
  }

  return shares;
}

/**
 * Reconstructs secret using Lagrange Interpolation from K or more shares.
 */
export function combineShares(shares: ShamirShare[]): string {
  if (shares.length < 2) {
    throw new Error("At least 2 shares are required for reconstruction");
  }

  const shareLength = shares[0].shareHex.length / 2;
  const secretBytes = new Uint8Array(shareLength);

  const xCoords = shares.map((s) => s.id);
  const yBuffers = shares.map(
    (s) =>
      new Uint8Array(
        s.shareHex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) || []
      )
  );

  // Lagrange interpolation at x = 0 for each byte
  for (let b = 0; b < shareLength; b++) {
    let secretByte = 0;

    for (let i = 0; i < shares.length; i++) {
      let delta = 1; // Lagrange basis polynomial L_i(0)

      for (let j = 0; j < shares.length; j++) {
        if (i !== j) {
          // L_i(0) = product( x_j / (x_j - x_i) )
          const num = xCoords[j];
          const den = gfSub(xCoords[j], xCoords[i]);
          delta = gfMul(delta, gfDiv(num, den));
        }
      }

      secretByte = gfAdd(secretByte, gfMul(yBuffers[i][b], delta));
    }

    secretBytes[b] = secretByte;
  }

  return Array.from(secretBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
