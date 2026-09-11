/**
 * Diamond Size and Sieve Master Reference
 * Based on authoritative industry Diamond Size and Weight Chart (37 Sieve Sizes)
 */

export interface DiamondSieveRecord {
  sieveSize: string;           // e.g. "-0000", "+0000-000", "+1.5-2", "+16.5-17"
  mmSize: number;              // Round diamond diameter in mm
  caratsWeightPerPiece: number;// CTS WT/PC (Weight per piece in carats)
  piecesPerCarat: number;      // PCS (Pieces per carat)
  princessMmSize?: number;     // Princess cut equivalent size in mm
  princessMmLabel?: string;    // Display label for Princess MM
}

export const DIAMOND_SIEVE_CHART: DiamondSieveRecord[] = [
  { sieveSize: '-0000', mmSize: 0.70, caratsWeightPerPiece: 0.0026, piecesPerCarat: 380 },
  { sieveSize: '+0000-000', mmSize: 0.80, caratsWeightPerPiece: 0.0033, piecesPerCarat: 300 },
  { sieveSize: '+000-00', mmSize: 0.90, caratsWeightPerPiece: 0.0040, piecesPerCarat: 250 },
  { sieveSize: '+00-0', mmSize: 1.00, caratsWeightPerPiece: 0.0050, piecesPerCarat: 200 },
  { sieveSize: '+0-1', mmSize: 1.10, caratsWeightPerPiece: 0.0067, piecesPerCarat: 150 },
  { sieveSize: '+1-1.5', mmSize: 1.15, caratsWeightPerPiece: 0.0074, piecesPerCarat: 135 },
  { sieveSize: '+1.5-2', mmSize: 1.20, caratsWeightPerPiece: 0.0083, piecesPerCarat: 120, princessMmSize: 1.1, princessMmLabel: '1.1 MM' },
  { sieveSize: '+2-2.5', mmSize: 1.25, caratsWeightPerPiece: 0.0091, piecesPerCarat: 110, princessMmSize: 1.2, princessMmLabel: '1.2 MM' },
  { sieveSize: '+2.5-3', mmSize: 1.30, caratsWeightPerPiece: 0.0100, piecesPerCarat: 100 },
  { sieveSize: '+3-3.5', mmSize: 1.35, caratsWeightPerPiece: 0.0111, piecesPerCarat: 90, princessMmSize: 1.3, princessMmLabel: '1.3 MM' },
  { sieveSize: '+3.5-4', mmSize: 1.40, caratsWeightPerPiece: 0.0125, piecesPerCarat: 80 },
  { sieveSize: '+4-4.5', mmSize: 1.45, caratsWeightPerPiece: 0.0133, piecesPerCarat: 75, princessMmSize: 1.4, princessMmLabel: '1.4 MM' },
  { sieveSize: '+4.5-5', mmSize: 1.50, caratsWeightPerPiece: 0.0154, piecesPerCarat: 65 },
  { sieveSize: '+5-5.5', mmSize: 1.55, caratsWeightPerPiece: 0.0182, piecesPerCarat: 55, princessMmSize: 1.5, princessMmLabel: '1.5 MM' },
  { sieveSize: '+5.5-6', mmSize: 1.60, caratsWeightPerPiece: 0.0200, piecesPerCarat: 50 },
  { sieveSize: '+6-6.5', mmSize: 1.70, caratsWeightPerPiece: 0.0222, piecesPerCarat: 45, princessMmSize: 1.6, princessMmLabel: '1.6 MM' },
  { sieveSize: '+6.5-7', mmSize: 1.80, caratsWeightPerPiece: 0.0250, piecesPerCarat: 40, princessMmSize: 1.7, princessMmLabel: '1.7 MM' },
  { sieveSize: '+7-7.5', mmSize: 1.90, caratsWeightPerPiece: 0.0300, piecesPerCarat: 33, princessMmSize: 1.8, princessMmLabel: '1.8 MM' },
  { sieveSize: '+7.5-8', mmSize: 2.00, caratsWeightPerPiece: 0.0370, piecesPerCarat: 30, princessMmSize: 1.9, princessMmLabel: '1.9 MM' },
  { sieveSize: '+8-8.5', mmSize: 2.10, caratsWeightPerPiece: 0.0400, piecesPerCarat: 25, princessMmSize: 2.0, princessMmLabel: '2.0 MM' },
  { sieveSize: '+8.5-9', mmSize: 2.20, caratsWeightPerPiece: 0.0450, piecesPerCarat: 22 },
  { sieveSize: '+9-9.5', mmSize: 2.30, caratsWeightPerPiece: 0.0500, piecesPerCarat: 20, princessMmSize: 2.1, princessMmLabel: '2.1 MM' },
  { sieveSize: '+9.5-10', mmSize: 2.40, caratsWeightPerPiece: 0.0550, piecesPerCarat: 18, princessMmSize: 2.25, princessMmLabel: '2.2-2.3 MM' },
  { sieveSize: '+10-10.5', mmSize: 2.50, caratsWeightPerPiece: 0.0700, piecesPerCarat: 14, princessMmSize: 2.4, princessMmLabel: '2.4 MM' },
  { sieveSize: '+10.5-11', mmSize: 2.60, caratsWeightPerPiece: 0.0800, piecesPerCarat: 13, princessMmSize: 2.5, princessMmLabel: '2.5 MM' },
  { sieveSize: '+11-11.5', mmSize: 2.70, caratsWeightPerPiece: 0.0850, piecesPerCarat: 12, princessMmSize: 2.6, princessMmLabel: '2.6 MM' },
  { sieveSize: '+11.5-12', mmSize: 2.80, caratsWeightPerPiece: 0.0900, piecesPerCarat: 11, princessMmSize: 2.7, princessMmLabel: '2.7 MM' },
  { sieveSize: '+12-12.5', mmSize: 2.90, caratsWeightPerPiece: 0.1000, piecesPerCarat: 10, princessMmSize: 2.8, princessMmLabel: '2.8 MM' },
  { sieveSize: '+12.5-13', mmSize: 3.00, caratsWeightPerPiece: 0.1100, piecesPerCarat: 9, princessMmSize: 2.9, princessMmLabel: '2.9 MM' },
  { sieveSize: '+13-13.5', mmSize: 3.10, caratsWeightPerPiece: 0.1200, piecesPerCarat: 8, princessMmSize: 3.0, princessMmLabel: '3.0 MM' },
  { sieveSize: '+13.5-14', mmSize: 3.20, caratsWeightPerPiece: 0.1250, piecesPerCarat: 8 },
  { sieveSize: '+14-14.5', mmSize: 3.30, caratsWeightPerPiece: 0.1350, piecesPerCarat: 7 },
  { sieveSize: '+14.5-15', mmSize: 3.40, caratsWeightPerPiece: 0.1420, piecesPerCarat: 7 },
  { sieveSize: '+15-15.5', mmSize: 3.50, caratsWeightPerPiece: 0.1540, piecesPerCarat: 6 },
  { sieveSize: '+15.5-16', mmSize: 3.60, caratsWeightPerPiece: 0.1670, piecesPerCarat: 6 },
  { sieveSize: '+16-16.5', mmSize: 3.70, caratsWeightPerPiece: 0.1800, piecesPerCarat: 6 },
  { sieveSize: '+16.5-17', mmSize: 3.80, caratsWeightPerPiece: 0.2000, piecesPerCarat: 5 },
];

/**
 * Normalizes a sieve search string (e.g. "2-2.5", "+2-2.5", " 2 - 2.5 ")
 */
export function normalizeSieveKey(input: string): string {
  return input.replace(/\s+/g, '').replace(/^\+/, '').toLowerCase();
}

/**
 * Finds a sieve record by sieve size string
 */
export function findSieveBySize(
  sieveSize: string,
  chart: DiamondSieveRecord[] = DIAMOND_SIEVE_CHART
): DiamondSieveRecord | undefined {
  if (!sieveSize) return undefined;
  const normalized = normalizeSieveKey(sieveSize);
  return chart.find(
    (item) => normalizeSieveKey(item.sieveSize) === normalized || item.sieveSize === sieveSize
  );
}

/**
 * Finds the closest matching sieve record by mm diameter
 */
export function findSieveByMm(
  mm: number,
  chart: DiamondSieveRecord[] = DIAMOND_SIEVE_CHART
): DiamondSieveRecord | undefined {
  if (!mm || mm <= 0) return undefined;
  let closest: DiamondSieveRecord | undefined;
  let minDiff = Infinity;
  for (const item of chart) {
    const diff = Math.abs(item.mmSize - mm);
    if (diff < minDiff) {
      minDiff = diff;
      closest = item;
    }
  }
  return closest;
}

/**
 * Estimates number of pieces based on carat weight and selected sieve
 */
export function estimatePiecesFromCarats(
  sieveSize: string,
  carats: number,
  chart: DiamondSieveRecord[] = DIAMOND_SIEVE_CHART
): number {
  if (!carats || carats <= 0) return 0;
  const sieve = findSieveBySize(sieveSize, chart);
  if (!sieve) return 0;
  return Math.round(carats * sieve.piecesPerCarat);
}

/**
 * Estimates carat weight based on number of pieces and selected sieve
 */
export function estimateCaratsFromPieces(
  sieveSize: string,
  pieces: number,
  chart: DiamondSieveRecord[] = DIAMOND_SIEVE_CHART
): number {
  if (!pieces || pieces <= 0) return 0;
  const sieve = findSieveBySize(sieveSize, chart);
  if (!sieve) return 0;
  return Number((pieces * sieve.caratsWeightPerPiece).toFixed(4));
}
