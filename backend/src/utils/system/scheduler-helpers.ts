/**
 * Generate jitter based on a percentage of the interval (±15%).
 * Used to spread out scraper requests and avoid pattern detection.
 */
export function getSmartJitter(interval: number): number {
  const maxJitter = Math.floor(interval * 0.15);
  return Math.floor(Math.random() * (maxJitter * 2)) - maxJitter;
}

/**
 * Check if current time is within "Quiet Hours" (1 AM - 6 AM).
 * Used to reduce scraping activity during late night hours.
 */
export function isQuietHours(): boolean {
  const hour = new Date().getHours();
  return hour >= 1 && hour <= 6;
}

/**
 * Calculates the next check time for a product with jitter and quiet hours adjustment.
 */
export function calculateNextCheckSeconds(refreshInterval: number): number {
  // 1. Calculate base jitter (±15% of interval)
  let jitter = getSmartJitter(refreshInterval);
  let nextCheckSeconds = refreshInterval + jitter;

  // 2. Apply "Quiet Hours" multiplier (1.5x delay between 1 AM and 6 AM)
  if (isQuietHours()) {
    nextCheckSeconds = Math.floor(nextCheckSeconds * 1.5);
  }

  // 3. 10% chance to "oversleep" and double the wait to break rhythm
  if (Math.random() < 0.1) {
    nextCheckSeconds *= 2;
  }

  // Ensure we don't schedule something in the past or too soon
  return Math.max(60, nextCheckSeconds);
}
