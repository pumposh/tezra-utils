import { recordManager } from './recordManager';

export type IdObj = { id: string };

export type ByID<T> = Record<string, T>;

export type TargetOrID<T> = T | string;

export type Getter<T> = (id: string) => T | null;

export type GenericGetter<T extends IdObj> = (
  itemGetter: Getter<T>
) => (
  e: TargetOrID<T>,
  ...args: any[]
) => any;
export type IDStrictGenericGetter = (
  itemGetter: Getter<any>
) => (
  id: string,
  ...args: any[]
) => any;
export type GenericGetters<G, T extends IdObj> = {
  [K in keyof G]: G[K] extends GenericGetter<T>
    ? G[K]
    : G[K] extends IDStrictGenericGetter
    ? G[K]
    : never;
};

export type GenericComputed<G, T extends IdObj> = {
  [K in keyof G]: G[K] extends GenericGetter<T>
    ? ReturnType<G[K]>
    : G[K] extends IDStrictGenericGetter
    ? ReturnType<G[K]>
    : never;
};

export type GenericComputedValue<G, T extends IdObj> = {
  [K in keyof G]: G[K] extends GenericGetter<T>
    ? ReturnType<ReturnType<G[K]>>
    : G[K] extends IDStrictGenericGetter
    ? ReturnType<ReturnType<G[K]>>
    : never;
};
type ItemComputed<T extends IdObj, G> = {
  computed: GenericComputedValue<G, T>;
};
export type WithComputed<T extends IdObj, G> = T & ItemComputed<T, G>;
export type MaybeWithComputed<T extends IdObj, G> = T & Partial<ItemComputed<T, G>>;

export type PersistenceMeta = {
  expires: number;
}

export enum GetElement {
  RAW = 'raw',
  COMPUTED = 'computed',
}

export interface Meta {
  context: string;
  persist?: boolean;
  /** Time to live in milliseconds */
  ttl?: number;
}

type ChildPath<T> = `${keyof T extends string ? string & keyof T : string}`
| `${keyof T extends string ? string & keyof T : string}/${string}`
| undefined

export type PathGetter<T> = (root: string, childPath?: ChildPath<T>) => string;

const genericRMGetter = <T extends IdObj>() => recordManager<T>;

type RMFunc<T extends IdObj> = ReturnType<typeof genericRMGetter<T>>;

interface RecordManagerType<T extends IdObj = any> extends ReturnType<
  ReturnType<RMFunc<T>>
> {}

export interface RecordManager<T extends IdObj = any, G extends object = any> extends
  RecordManagerType<T> {
    getters: G;
  }
