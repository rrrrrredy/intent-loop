export function violationRatePercent(violations, opportunities, places = 2) {
  if (!Number.isInteger(violations) || !Number.isInteger(opportunities)) {
    throw new TypeError("Violation-rate counts must be integers");
  }
  if (violations < 0 || opportunities < 0 || violations > opportunities) {
    throw new RangeError("Violation-rate counts are inconsistent");
  }
  if (opportunities === 0) return 0;
  const factor = 10 ** places;
  return Math.round((((violations / opportunities) * 100) + Number.EPSILON) * factor) / factor;
}
