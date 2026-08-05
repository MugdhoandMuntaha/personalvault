/**
 * Breach Monitoring & Password Health Engine
 * Incorporates k-Anonymity HaveIBeenPwned API (HIBP) Range Checks.
 * 
 * Never sends cleartext passwords or full hashes across the network.
 * Only the first 5 hex characters of the SHA-1 hash are sent.
 */

export interface PasswordHealthReport {
  score: number; // 0 to 100
  rating: "VERY_WEAK" | "WEAK" | "GOOD" | "STRONG" | "EXCELLENT";
  entropyBits: number;
  isBreached: boolean;
  breachCount: number;
  suggestions: string[];
}

/**
 * Computes SHA-1 hash of string using Web Crypto API.
 */
async function sha1Hex(str: string): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/**
 * Checks if password appears in HaveIBeenPwned breached database via k-Anonymity range check.
 */
export async function checkPasswordBreach(password: string): Promise<{
  isBreached: boolean;
  breachCount: number;
}> {
  if (!password) return { isBreached: false, breachCount: 0 };

  try {
    const fullHash = await sha1Hex(password);
    const prefix = fullHash.substring(0, 5);
    const suffix = fullHash.substring(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      cache: "no-store",
    });

    if (!res.ok) {
      return { isBreached: false, breachCount: 0 };
    }

    const text = await res.text();
    const lines = text.split("\n");

    for (const line of lines) {
      const [lineSuffix, countStr] = line.trim().split(":");
      if (lineSuffix === suffix) {
        const breachCount = parseInt(countStr, 10) || 0;
        return { isBreached: true, breachCount };
      }
    }

    return { isBreached: false, breachCount: 0 };
  } catch (err) {
    console.warn("HIBP k-anonymity check failed or offline:", err);
    return { isBreached: false, breachCount: 0 };
  }
}

/**
 * Evaluates comprehensive password health and calculates entropy bits.
 */
export function analyzePasswordHealth(password: string, breachCount: number = 0): PasswordHealthReport {
  if (!password) {
    return {
      score: 0,
      rating: "VERY_WEAK",
      entropyBits: 0,
      isBreached: false,
      breachCount: 0,
      suggestions: ["Password cannot be empty."],
    };
  }

  let charsetSize = 0;
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/\d/.test(password)) charsetSize += 10;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) charsetSize += 32;

  const entropyBits = Math.round(password.length * (Math.log2(charsetSize || 1)));
  const suggestions: string[] = [];

  let score = Math.min(100, Math.round((entropyBits / 80) * 100));

  if (password.length < 12) {
    suggestions.push("Increase password length to at least 12-16 characters.");
    score -= 20;
  }
  if (!/[A-Z]/.test(password)) {
    suggestions.push("Add uppercase letters (A-Z).");
  }
  if (!/\d/.test(password)) {
    suggestions.push("Add numerical digits (0-9).");
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    suggestions.push("Add special symbols (!@#$%).");
  }

  if (breachCount > 0) {
    score = Math.min(score, 15);
    suggestions.unshift(`CRITICAL: Password found in ${breachCount.toLocaleString()} known data breaches! Rotate immediately.`);
  }

  score = Math.max(0, Math.min(100, score));

  let rating: "VERY_WEAK" | "WEAK" | "GOOD" | "STRONG" | "EXCELLENT" = "GOOD";
  if (score < 25) rating = "VERY_WEAK";
  else if (score < 50) rating = "WEAK";
  else if (score < 75) rating = "GOOD";
  else if (score < 90) rating = "STRONG";
  else rating = "EXCELLENT";

  return {
    score,
    rating,
    entropyBits,
    isBreached: breachCount > 0,
    breachCount,
    suggestions,
  };
}
