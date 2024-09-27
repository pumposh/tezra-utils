/**
 * This is a persistence system to support vue reactive elements and synchronize them with local storage
 *
 * @pumposh
 */

import { isNullish, nullishFilter, objectFilter } from './index';
import {
  type Ref,
  type UnwrapRef,
  isRef,
  reactive,
  ref,
  watch,
} from 'vue';

function getKey(key: string) {
  return `persist--${key}`;
}

/** Used to convert Map and Set objects to a format that can be stored in local storage */
function replacer(_key: string, value: any): any {
  if (value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()),
    };
  } if (value instanceof Set) {
    return {
      dataType: 'Set',
      value: Array.from(value),
    };
  }
  return value;
}

/** Used to convert Map and Set objects to a format that can be stored in local storage */
function reviver(_key: string, value: any): any {
  if (typeof value === 'object' && value !== null) {
    if (value.dataType === 'Map') {
      return new Map(value.value);
    }
    if (value.dataType === 'Set') {
      return new Set(value.value);
    }
  }
  return value;
}

export const forceParse = (data: string): unknown => {
  try {
    return JSON.parse(data, reviver);
  } catch {
    return data;
  }
};

/**
 * Used to initialize a vue reactive element and synchronize any changes with local storage
 * @param key - The key to use for local storage
 * @param value - The vue reactive element to watch
 * @param includeNullish - Whether to include nullish values in the local storage
 */
const initWatch = <T>(key: string, value: Ref<T> | T, includeNullish?: boolean) => {
  const predicate = isRef(value)
    ? value
    : () => value;
  watch(
    predicate,
    (newValue) => {
      if (isRef(value)) {
        if (Array.isArray(newValue) || typeof newValue === 'object') {
          localStorage.setItem(key, JSON.stringify(newValue, replacer));
        } else if (!isNullish(newValue)) {
          localStorage.setItem(key, `${newValue}`);
        }
      } else {
        const valueToStore = includeNullish
          ? newValue
          : objectFilter(newValue ?? {}, nullishFilter);
        if (Object.keys(valueToStore as object).length > 0) {
          localStorage.setItem(key, JSON.stringify(valueToStore, replacer));
        } else {
          localStorage.removeItem(key);
        }
      }
    },
    {
      deep: true,
      immediate: true,
    },
  );
};

export const ls = {
  ref<T = any>(
    key: string,
    defaultValue: T,
  ) {
    const cachedValue = localStorage.getItem(getKey(key));
    const parsedValue = cachedValue
      ? forceParse(cachedValue) as UnwrapRef<T>
      : defaultValue;
    const value = ref(parsedValue ?? defaultValue);
    initWatch(getKey(key), value);
    return value;
  },
  reactive<T extends object>(
    key: string,
    defaultValue: T,
    includeNullish?: boolean,
  ) {
    const cachedValue = localStorage.getItem(getKey(key));
    const parsedValue = cachedValue
      ? forceParse(cachedValue) as T
      : defaultValue;
    const value = reactive(parsedValue);
    initWatch(getKey(key), value, includeNullish);
    return value;
  },
};
