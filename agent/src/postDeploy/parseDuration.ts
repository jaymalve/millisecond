const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/**
 * Parses the compact durations used in the CI config (`"5m"`, `"10m"`,
 * `"1h"`) into milliseconds — used directly for step.sleep()'s numeric-ms
 * form instead of relying on Workflows' own duration-string parser,
 * which expects English phrases ("5 minutes") rather than this shorthand.
 */
export function parseDuration(input: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(input.trim());
  if (!match) throw new Error(`Invalid duration "${input}" — expected e.g. "5m", "10m", "1h"`);
  const [, amount, unit] = match;
  return Number(amount) * UNIT_MS[unit];
}
