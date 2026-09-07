/**
 * Gap detection algorithm and account code utilities.
 */

/**
 * Calculates free/available account codes given a list of existing used customer codes.
 * Finds all integer gaps between used codes, gaps before min(usedCodes), and sequential numbers above max(usedCodes).
 *
 * @param usedCodes Array of currently used customer codes (integers)
 * @param currentCode Optional customer code of the customer being edited (must remain available)
 * @param limit Maximum number of options to return in dropdown (default: 200)
 * @returns Sorted array of available integer account codes
 */
export function getAvailableAccountCodes(
  usedCodes: number[],
  currentCode?: number,
  limit = 200,
): number[] {
  const usedSet = new Set(
    usedCodes
      .map((c) => Number(c))
      .filter((c) => Number.isInteger(c) && c > 0),
  );

  // If editing, current customer's code is not treated as duplicate of itself
  if (currentCode !== undefined && Number.isInteger(currentCode) && currentCode > 0) {
    usedSet.delete(currentCode);
  }

  const availableSet = new Set<number>();

  if (currentCode !== undefined && Number.isInteger(currentCode) && currentCode > 0) {
    availableSet.add(currentCode);
  }

  const sortedUsed = Array.from(usedSet).sort((a, b) => a - b);

  if (sortedUsed.length === 0) {
    for (let c = 1; c <= limit; c += 1) {
      availableSet.add(c);
    }
    return Array.from(availableSet).sort((a, b) => a - b);
  }

  const minUsed = sortedUsed[0];
  const maxUsed = sortedUsed[sortedUsed.length - 1];

  // 1. Prioritize gaps between minUsed and maxUsed (e.g. 53, 55, 56 between 52, 54, 57)
  for (let code = minUsed + 1; code < maxUsed; code += 1) {
    if (!usedSet.has(code)) {
      availableSet.add(code);
      if (availableSet.size >= limit) break;
    }
  }

  // 2. Add gaps below minUsed (1..minUsed - 1)
  for (let code = 1; code < minUsed; code += 1) {
    if (!usedSet.has(code)) {
      availableSet.add(code);
      if (availableSet.size >= limit) break;
    }
  }

  // 3. Add numbers above maxUsed
  let nextCode = maxUsed + 1;
  while (availableSet.size < limit) {
    if (!usedSet.has(nextCode)) {
      availableSet.add(nextCode);
    }
    nextCode += 1;
  }

  return Array.from(availableSet).sort((a, b) => a - b);
}

/**
 * Generates the next automatic customer code.
 * Calculates the smallest available integer gap >= 1, or max(used) + 1.
 */
export function getNextAutoCustomerCode(usedCodes: number[]): number {
  const usedSet = new Set(
    usedCodes
      .map((c) => Number(c))
      .filter((c) => Number.isInteger(c) && c > 0),
  );

  let candidate = 1;
  while (usedSet.has(candidate)) {
    candidate += 1;
  }
  return candidate;
}
