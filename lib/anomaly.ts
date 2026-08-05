/**
 * Client-Side Access Pattern Anomaly & Intrusion Detection System (IDS)
 * 
 * Machine-Learning inspired heuristic engine that monitors vault unlock timing,
 * velocity, device fingerprints, and failure frequency to calculate real-time threat risk.
 */

export interface AccessAttempt {
  timestamp: number; // Date.now()
  hourOfDay: number; // 0-23
  dayOfWeek: number; // 0-6
  success: boolean;
  userAgent: string;
  screenResolution: string;
  timeZone: string;
}

export interface AnomalyReport {
  riskScore: number; // 0 (Safe) to 100 (High Threat)
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  detectedAnomalies: string[];
  recommendation: string;
}

const LOCAL_STORAGE_HISTORY_KEY = "personal_vault_access_history_v1";

/**
 * Retrieves past unlock access history.
 */
export function getAccessHistory(): AccessAttempt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Records a new unlock access attempt.
 */
export function recordAccessAttempt(success: boolean): AccessAttempt {
  const now = new Date();
  const attempt: AccessAttempt = {
    timestamp: Date.now(),
    hourOfDay: now.getHours(),
    dayOfWeek: now.getDay(),
    success,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Unknown",
    screenResolution: typeof window !== "undefined" ? `${window.screen.width}x${window.screen.height}` : "Unknown",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  };

  if (typeof window !== "undefined") {
    const history = getAccessHistory();
    history.push(attempt);
    // Keep last 50 attempts
    if (history.length > 50) history.shift();
    localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(history));
  }

  return attempt;
}

/**
 * Evaluates current access attempt against historic baseline to calculate anomaly score.
 */
export function evaluateAccessAnomaly(currentAttempt: AccessAttempt): AnomalyReport {
  const history = getAccessHistory();
  const detectedAnomalies: string[] = [];
  let riskScore = 0;

  if (history.length < 3) {
    return {
      riskScore: 0,
      riskLevel: "LOW",
      detectedAnomalies: ["Baseline history warming up (fewer than 3 recorded sessions)."],
      recommendation: "Normal operation. System building baseline security profile.",
    };
  }

  // 1. Rapid unlock velocity / brute-force attempt check (last 5 mins)
  const recentFails = history.filter(
    (a) => !a.success && Date.now() - a.timestamp < 300000
  ).length;

  if (recentFails >= 3) {
    riskScore += 45;
    detectedAnomalies.push(`Multiple password verification failures (${recentFails} failed attempts in 5 mins).`);
  }

  // 2. Unusual Hour of Day check (outside 90% of past unlock hours)
  const pastHours = history.filter((a) => a.success).map((a) => a.hourOfDay);
  if (pastHours.length > 5) {
    const isUnusualHour = !pastHours.some((h) => Math.abs(h - currentAttempt.hourOfDay) <= 2);
    if (isUnusualHour) {
      riskScore += 25;
      detectedAnomalies.push(`Unusual login time detected (${currentAttempt.hourOfDay}:00 hrs differs from primary usage window).`);
    }
  }

  // 3. User Agent / Browser Fingerprint Change check
  const pastUserAgents = new Set(history.map((a) => a.userAgent));
  if (!pastUserAgents.has(currentAttempt.userAgent)) {
    riskScore += 20;
    detectedAnomalies.push("New browser or device user-agent fingerprint detected.");
  }

  // 4. Screen resolution mismatch
  const pastRes = new Set(history.map((a) => a.screenResolution));
  if (!pastRes.has(currentAttempt.screenResolution)) {
    riskScore += 10;
    detectedAnomalies.push("Display resolution / viewport environment shift detected.");
  }

  // Determine Risk Level
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
  let recommendation = "Environment secure. No suspicious activity detected.";

  if (riskScore >= 70) {
    riskLevel = "CRITICAL";
    recommendation = "High anomaly risk! Verify device integrity and check hardware key security.";
  } else if (riskScore >= 40) {
    riskLevel = "HIGH";
    recommendation = "Suspicious access pattern detected. Review audit logs for unexpected attempts.";
  } else if (riskScore >= 20) {
    riskLevel = "MEDIUM";
    recommendation = "Minor environment delta detected (new device or unusual time).";
  }

  return {
    riskScore: Math.min(riskScore, 100),
    riskLevel,
    detectedAnomalies: detectedAnomalies.length > 0 ? detectedAnomalies : ["All behavioral signals match baseline."],
    recommendation,
  };
}
