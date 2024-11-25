/**
 * Compares two iterables and returns the added and removed items.
 * The comparison is done by converting the iterables to sets and then
 * comparing the sets.
 *
 * @param a The first iterable to compare
 * @param b The second iterable to compare
 * @returns An object containing the added and removed items
 */
export function diff<T>(a: Set<T>, b: Set<T>): { added: Set<T>; removed: Set<T> } {
  const added = new Set();
  const removed = new Set();

  for (const item of a) {
    if (!b.has(item)) {
      removed.add(item);
    }
  }

  for (const item of b) {
    if (!a.has(item)) {
      added.add(item);
    }
  }

  return { added, removed } as { added: Set<T>; removed: Set<T> };
}
