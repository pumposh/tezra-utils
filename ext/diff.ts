import { isNullish } from './index';

/**
 * Diff two objects deeply, returning a list of all the differences.
 *
 * @param obj1 - The first object to compare.
 * @param obj2 - The second object to compare.
 * @param path - The current path of the comparison.
 * @param acc - The accumulator for the differences.
 * @returns The differences between the two objects.
 */
export const diffObjectsDeep = (
  _prev: any,
  _next: any,
  path: string[] = [],
  allowNullish = false,
  acc: Record<string, any> = {},
): Record<string, any> => {
  const prev = _prev ?? {};
  const next = _next ?? {};
  const result: Record<string, any> = {};

  const validate = (val: any) => {
    if (allowNullish && isNullish(val)) return null;
    return val;
  };

  // Get all unique keys from both objects
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);

  keys.forEach((key) => {
    const newPath = [...path, key];
    const value1 = validate(prev[key]);
    const value2 = validate(next[key]);

    if (
      typeof value1 === 'object'
      && value1 !== null
      && typeof value2 === 'object'
      && value2 !== null
    ) {
      // Recursive diff for nested objects
      const nestedDiff = diffObjectsDeep(value1, value2, newPath, allowNullish, acc);
      if (Object.keys(nestedDiff).length > 0) {
        // Only add if there are differences
        result[newPath.join('/')] = nestedDiff;
      }
    } else if (value1 !== value2) {
      // Direct comparison for non-objects or nulls
      result[newPath.join('/')] = { next: value2, prev: value1 };
      acc[newPath.join('/')] = { next: value2, prev: value1 };
    }
  });

  if (path.length === 0) {
    return acc;
  }
  return result;
};

/**
 * Diff two objects shallowly, returning a list of all the keys that have changed.
 *
 * @param obj1 - The first object to compare.
 * @param obj2 - The second object to compare.
 * @returns The keys that have changed.
 */
export const diffObjectsShallow = (_prev: any, _next: any) => {
  const prev = _prev ?? {};
  const next = _next ?? {};
  const diffs = diffObjectsDeep(prev, next);
  const highestDiffs = new Set<string>();
  Object.keys(diffs).forEach((key) => {
    const highestParent = key.split('/')[0];
    if (highestParent) highestDiffs.add(highestParent);
  });
  return Array.from(highestDiffs);
};

export const isEqual = <T, S>(a: T, b: S) => {
  if (typeof a !== typeof b) return false;
  if (isNullish(a) && isNullish(b)) return true;
  if (!isNullish(a) && isNullish(b)) return false;
  if (isNullish(a) && !isNullish(b)) return false;
  if (typeof a === 'object' && typeof b === 'object') {
    return Object.keys(diffObjectsDeep(a, b)).length === 0;
  }
  if (typeof a === typeof b) return (a === b as any);
  return false;
};
