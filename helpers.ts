import type {
  MaybeWithComputed,
  RecordManager,
  TargetOrID,
  WithComputed,
  IdObj,
} from './recordManager.model';
import { isNullish } from './ext';

/**
 * Helpers that allows store managers to accept either a target object or its ID
 * so hypothetical values can also be plugged into the computational helpers.
 */
export const extractTarget = <T>(
  targetOrID: TargetOrID<T> | undefined,
  getter: (id: string) => T | null,
): T | undefined => {
  if (typeof targetOrID === 'string') return getter(targetOrID) ?? undefined;
  return targetOrID;
};

/**
 * Helper to extract a target object from a getter with priority to an object
 * for cases where the target is known to exist.
 */
export const extractTargetOrPriority = <T extends IdObj>(
  targetOrID: TargetOrID<T> | undefined,
  getter: (id: string) => T | null,
  priority: T,
): T => {
  if (typeof targetOrID === 'string') {
    if (targetOrID === priority.id) return priority;
    return getter(targetOrID) ?? priority;
  }
  return targetOrID ?? priority;
};

export const isItemWithComputed = <T extends IdObj, C>(
  i: MaybeWithComputed<T, C>,
): i is WithComputed<T, C> => !isNullish(i?.computed) && 'computed' in i;

export const itemWithComputedToRaw = <T extends IdObj, C>(
  _item: WithComputed<T, C> | null,
): T | null => {
  if (isNullish(_item)) return null;
  const item: MaybeWithComputed<T, C> = { ..._item };
  delete item?.computed;
  if (Object.values(item).length === 0) return null;
  return item;
};

export const isRecordManager = <T extends IdObj>(
  obj: any,
): obj is RecordManager<T> => obj.getRaw !== undefined;
