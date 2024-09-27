/**
 * Record manager to handle record management for different contexts.
 * It's main use case is store state management for entities which are
 * organized by ID.
 *
 * There are four key features which can make the lifecycle of your data
 * management easier:
 * 1. Entities are reactive items at a more confined depth
 * 2. Local storage persistence
 * 3. Management and expression of dynamically computed values for each record
 *
 * For initializing a simple record manager which houses any values of
 * type <T extends IdObj>, simply initialize with
 * ```
 * const manager = recordManager()({})
 * ```
 *
 * To persist records to local storage, initialize with
 * ```
 * const manager = recordManager({ persist: true, context: 'some-context' })({})
 * ```
 *
 * For each recordManager, you can optionally provide a set of computed
 * getters which will be used to compute values for each record. These will be exposed
 * in two ways:
 * 1. As "computed" values within each record
 * 2. As getters which can be used to calculate the same values for records or consider
 *    entities not housed in the given record set.
 *
 * In the first approach, all data is managed in a `reactive` object which watches for
 * changes in the functions provided in the getters.
 *
 * @pumposh
 */
import type { ByID, GenericComputed, GenericComputedValue, IdObj } from './recordManager.model';
import {
  type ChildPath,
  objectMap as _objectMap,
  isNullish,
  nullishFilter,
  objectFilter,
  objectKeys,
} from './ext';
import { reactive, watch } from 'vue';

import { isEqual } from './ext/diff';
import { ls } from './ext/persistence';
import {
  setNestedChildOnRecord,
} from './ext/nest';
import {
  isItemWithComputed,
  itemWithComputedToRaw,
} from './helpers';
import type {
  GenericGetters,
  MaybeWithComputed,
  Meta,
  PersistenceMeta,
  TargetOrID,
  WithComputed,
} from './recordManager.model';

/** Type assertion is safe but support should be also added to @caresend/utils */
const objectMap = _objectMap as unknown as <T, O>(
  obj: T,
  fn: (v: T[keyof T], key: keyof T) => O,
  keyFn?: (key: keyof T) => string,
) => Record<keyof T, O>;

/**
 * Default time to live for a persistent record in milliseconds.
 * 1 week
 */
const DEFAULT_TTL = 1000 * 60 * 60 * 24 * 7;

interface InitialState<T extends IdObj> {
  initial?: {
    [id: string]: T | null;
  }
}

/**
 * The record manager is a utility for managing records in a reactive store.
 * It provides methods for getting, setting, and unsetting records, and
 * getting and setting child records.
 *
 * @param meta - The metadata for database synchronization.
 * @param computedGetters - A set of custom functions which will be used to compute
 * values for each record automatically and cached within the record manager.
 * @param getters - A set of custom functions to compute values for each record.
 * @returns The record manager.
 */
export const recordManager = <T extends IdObj>(meta?: Meta & InitialState<T>) => {
  type Getters<G> = GenericGetters<G, T>;

  return <C extends object, G extends object>(computedGetters: Getters<C>, getters?: Getters<G>) => {
    /** Initialize the record of items with computed values */
    const recordWithComputeds = meta?.persist
      ? ls.reactive<ByID<WithComputed<T, C> | null>>(meta.context, {})
      : reactive<ByID<WithComputed<T, C> | null>>({});

    /** Initialize the record of items without computed values */
    const recordRaw = reactive<ByID<T | null>>(meta?.initial ?? {});
    const recordRawGetter = (id: string): T | null => recordRaw[id] ?? null;

    /**
     * Set a record in the store and set with default computed values
     */
    const setRecordItem = (id: string, value: MaybeWithComputed<T, C> | null) => {
      if (value === null) {
        recordWithComputeds[id] = null;
        recordRaw[id] = null;
        return;
      }

      const raw = isItemWithComputed(value)
        ? itemWithComputedToRaw(value)
        : value;
      recordRaw[id] = raw;

      if (raw === null) {
        recordWithComputeds[id] = null;
        return;
      }

      const withComputed = {
        ...raw,
        computed: initComputeds(id, raw),
      };
      recordWithComputeds[id] = withComputed;

      if (meta?.persist) {
        cacheMeta[id] = {
          expires: Date.now() + (meta.ttl || DEFAULT_TTL),
        };
      }
    };

    /** If computed records have persisted, ensure raw records are updated */
    objectMap(recordWithComputeds, (item, id) => {
      const raw = itemWithComputedToRaw(item);
      const existing = recordRaw[id];
      if (isEqual(raw, existing)) return;
      recordRaw[id] = raw;
    });

    /**
     * Initialize an object of cache metadata organized by recordID for when utilizing persistence.
     * This will manage clean up records which have passed their expiration date.
     */
    const cacheMeta = meta?.persist
      ? ls.reactive<ByID<PersistenceMeta | null>>(`${meta.context}[cache-meta]`, {})
      : reactive<ByID<PersistenceMeta | null>>({});

    /**
     * Clean up the cache meta object on initialization to remove expired records.
     */
    const cleanUpCache = () => {
      Object.entries(cacheMeta).forEach(([id, recordCacheMeta]) => {
        if (!recordCacheMeta) return;
        if (recordCacheMeta.expires < Date.now()) {
          delete recordRaw[id];
          delete recordWithComputeds[id];
          delete cacheMeta[id];
          recordRaw[id] = null;
          recordWithComputeds[id] = null;
          cacheMeta[id] = null;
        }
      });
    };

    cleanUpCache();

    const watches = new Map<string, Partial<Record<keyof C, typeof watch>>>();

    /** Watch for changes in the computed values for a record */
    const watchGetter = (id: string, k: keyof C) => {
      const result = ref<any>(null);

      const existingWatcher = watches.get(id)?.[k];
      if (existingWatcher) {
        result.value = recordWithComputeds[id]?.computed?.[k];
        return result;
      }

      const watchFn = watch(() => computedGetters[k]?.(recordRawGetter)(id), (newVal, _oldVal) => {
        const oldVal = recordWithComputeds[id]?.computed?.[k];

        if (isEqual(oldVal, newVal)) return;

        result.value = newVal;
        recordWithComputeds[id] = {
          ...recordWithComputeds[id],
          computed: {
            ...recordWithComputeds[id]?.computed,
            [k]: newVal,
          },
        } as WithComputed<T, C>;
      }, { deep: true, immediate: true });
      watches.set(id, {
        ...watches.get(id),
        [k]: watchFn,
      });

      return result;
    };

    /** Initialize the computed values for each record */
    const initComputeds = (id: string, item: T | null) =>
      objectMap(
        computedGetters,
        (fn, fnName) => {
          if (isNullish(item)) return null;
          if (!watches.get(id)?.[fnName]) return watchGetter(id, fnName).value;
          if (watches.get(id)?.[fnName]) return recordWithComputeds[id]?.computed?.[fnName];
          return fn(recordRawGetter)(id);
        }
      );

    /**
     * If a computed getter is called with no extraneous arguments, return the value
     * last computed for this record.
     */
    const cacheMappedComputedGetters = objectMap(
      computedGetters,
      (fn, name) => (
        maybeID: TargetOrID<T>,
        ...args: any[]
      ) => {
        if (isNullish(maybeID)) return fn(recordRawGetter)(maybeID, ...args);
        const id = typeof maybeID === 'string' ? maybeID : maybeID.id;
        const watcher = watches.get(id)?.[name];
        let cached = recordWithComputeds[id]?.computed?.[name];
        if (!watcher) {
          const result = watchGetter(id, name);
          cached = result.value ?? cached;
        }
        if (args.length === 0 && cached) return cached;
        const computed = fn(recordRawGetter)(id, ...args);
        return computed;
      },
    ) as GenericComputedValue<C, T>;

    const watchComputedGetters = (id: string) => {
      objectKeys(computedGetters).map((k) => {
        watchGetter(id, k);
      });
    };

    /** Set a record in the store and initialize the computed values if applicable */
    const setAndWatchGetters = (id: string, item: MaybeWithComputed<T, C> | null) => {
      const isCurrentlyWatching = watches.has(id);
      if (Object.keys(computedGetters).length === 0 || isNullish(item) || isCurrentlyWatching) {
        setRecordItem(id, item);
        return;
      }

      /** Initialize the computed values for the record */
      const itemComputed = initComputeds(id, item);

      /**
       * If the computed values are the same as the last computed values,
       * set and skip initialization of computed values.
       */
      if (isEqual(itemComputed, recordWithComputeds[id]?.computed)) {
        setRecordItem(id, item);
        return;
      }

      setRecordItem(id, {
        ...item,
        computed: itemComputed,
      });

      watchComputedGetters(id);
    };

    if (meta?.initial) {
      Object.entries(meta.initial).forEach(([id, item]) => {
        setAndWatchGetters(id, item);
      });
    }

    /** Set up the manager object for external use */
    const manager = {
      forEach: (callback: (item: T) => void) => {
        Object.values(recordWithComputeds).forEach((item) => {
          if (isNullish(item)) return;
          callback(item);
        });
      },

      /**
       * Filter the record set with computed values.
       * @param filter - The filter function to apply to the record set.
       * @returns The filtered record set.
       */
      filter: (filter: (item: WithComputed<T, C>) => boolean) =>
        objectFilter(recordWithComputeds, (item) => !isNullish(item) && filter(item)),

      /**
       * Filter the record set raw, i.e. without computed values.
       * @param filter - The filter function to apply to the record set.
       * @returns The filtered record set.
       */
      filterRaw: (filter: (item: T | null) => boolean) =>
        objectFilter(recordRaw, filter),

      /**
       * Get a record from the store joined with computed values.
       * @param id - The id of the record to get.
       * @returns The record, or null if it does not exist.
       */
      get: (id: string) => {
        const item = recordWithComputeds[id];
        if (isNullish(item)) setRecordItem(id, null);
        return recordWithComputeds[id] as WithComputed<T, C> | null;
      },

      /**
       * Get a record from the store raw, i.e. without computed values.
       * @param id - The id of the record to get, or a filter function to get
       * records that match the filter.
       * @returns The record, or null if it does not exist.
       */
      getRaw: (id: string) => {
        const item = recordRaw[id];
        if (isNullish(item)) setRecordItem(id, null);
        return recordRaw[id] as T | null;
      },

      /**
       * Get a raw clone of a record.
       * @param id - The id of the record to get.
       * @returns The raw clone of the record, or null if it does not exist.
       */
      getRawClone: (id: string) => {
        const item = recordRaw[id];
        return structuredClone(item) ?? null;
      },

      /**
       * Get a child of a record from the store.
       * @param id - The id of the record to get the child from.
       * @param key - The key of the child record to get.
       * @returns The child record, or null if it does not exist.
       */
      getChildOf: <K extends keyof T>(id: string, key: K): T[K] | undefined =>
        manager.get(id)?.[key],

      getters: {
        ...cacheMappedComputedGetters,
        ...getters,
      } as GenericComputed<C, T> & Getters<G>,

      /**
       * Get length of the record set.
       * @returns The length of the record set.
       */
      length: computed(
        () => Object.values(recordWithComputeds).filter(nullishFilter).length,
      ),

      /**
       * Log the record set.
       */
      log: () => {
        console.table(objectMap(recordWithComputeds, (r) => r));
        console.table(objectMap(recordRaw, (r) => r));
      },

      /**
       * Overwrite the entire record set.
       * @param items - The new records to set.
       */
      overwrite: (items: ByID<T>) => {
        manager.reset();
        manager.update(items);
      },

      /**
       * Set a record in the store.
       * @param item - The record to set.
       */
      set: (_item: T) => {
        /** If at runtime, the item may have computed values which we want to ignore */
        const item = isItemWithComputed(_item) ? itemWithComputedToRaw(_item) : _item;

        if (isNullish(item)) return;

        setAndWatchGetters(item.id, item);
      },

      /**
       * Set a child item of a record in the store.
       * @param id - The id of the record to set the child on.
       * @param key - The key of the child record to set.
       * @param value - The value of the child record to set.
       */
      setChildOf: <K extends ChildPath<T>>(
        id: string,
        key: K,
        value: K extends keyof T ? T[K] : any,
      ) => {
        /** Determine if the key can directly be indexed on the record */
        const keyIsDirectKey = (k: K | keyof T): k is keyof T =>
          !String(k)?.includes('/');

        if (!recordWithComputeds[id]) return;

        let explicit = itemWithComputedToRaw<T, C>(recordWithComputeds[id]!);

        if (keyIsDirectKey(key) && explicit) {
          explicit[key] = value;
        } else if (explicit) {
          explicit = setNestedChildOnRecord(explicit, key, value);
        }

        if (explicit) manager.set(explicit);
      },

      /**
       * Unset a record from the store.
       * @param id - The id of the record to unset.
       */
      unset: (id: string) => {
        recordWithComputeds[id] = null;
        recordRaw[id] = null;
        cacheMeta[id] = null;
        delete recordWithComputeds[id];
        delete recordRaw[id];
        delete cacheMeta[id];
      },

      /**
       * Reset the entire record set.
       */
      reset: () => {
        Object.keys(recordWithComputeds).forEach((id) => {
          manager.unset(id);
        });

        if (meta?.persist) {
          localStorage.removeItem(meta.context);
        }
      },

      resetComputed: () => {
        Object.keys(recordWithComputeds).forEach((id) => {
          watchComputedGetters(id);
        });
      },

      /**
       * Update the record set with new records.
       * @param items - The new records to update.
       */
      update: (items: ByID<T>) => {
        Object.values(items).forEach((item) => {
          manager.set(item);
        });
      },
    };

    return manager;
  };
};
