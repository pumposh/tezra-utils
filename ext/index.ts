/**
 * Perform `Object.keys` with proper types.
 */
export const objectKeys = <T>(obj: T): (keyof T)[] =>
  Object.keys(obj as any) as (keyof T)[];

/**
 * Perform `Array.map` on the values of an object.
 *
 * TODO: The typing of this function does not work for types that include
 * specific optional keys, such as `FlowDataFetchers<ItineraryFlowParam>`
 */
export const objectMap = <I, O, K extends string, OK extends string> (
  object: Record<K, I>,
  callback: (input: I, key: K) => O,
  keyCallback?: (key: K, input: I) => OK,
): Record<OK, O> =>
    Object.fromEntries(
      (Object.entries(object) as [K, I][])
        .map(([key, value]) => ([
          keyCallback?.(key, value) ?? key,
          callback(value, key),
        ])),
    ) as Record<OK, O>;

/**
 * Check if a value is null or undefined.
 */
export const isNullish = (
  value: any,
): value is null | undefined => value === null || value === undefined;

/**
 * Determine whether a value is not nullish
 *
 * Useful for quickly filtering out nullish values in a type predicate.
 * ex. `const nonNullish = values.filter(nullishFilter);`
 */
export const nullishFilter = <T>(
  i: T | null | undefined,
): i is T => !isNullish(i);


/**
 * Perform `Object.entries` with strongly typed keys.
 */
export const objectEntries = <K extends string, T>(
  obj: Partial<Record<K, T>>,
): [K, T][] => Object.entries(obj) as [K, T][];

/**
 * Perform `Array.filter` on the values of an object. Supports filtering types
 * with a type predicate on the callback.
 */
export function objectFilter <I, O extends I>(
  object: Record<string, I>,
  callback: (input: I) => input is O,
): Record<string, O>;
export function objectFilter <I, O extends I>(
  object: Record<string, I>,
  callback: (input: I) => boolean,
): Record<string, O>;
export function objectFilter <I, O extends I>(
  object: Record<string, I>,
  callback: (input: I) => boolean,
): Record<string, O> {
  const entries = objectEntries(object) as [string, I][];
  const filteredEntries = entries.filter(
    (entry): entry is [string, O] => {
      const value = entry[1];
      return callback(value);
    },
  );
  return Object.fromEntries(filteredEntries);
}

/**
 * Used to enforce child paths starting with actual keys of an object. Supports
 * 1st level of nesting, any subPaths are not checked.
 * 
 * Use with `function` declaration syntax due to:
 * https://github.com/microsoft/TypeScript/issues/27171
 * If const declaration is used, output is:
 * ```
 * childPath?: `baseEarnings/${string}` | `creationTimestamp/${string}` ...
 * ```
 * therefore utils would need to be updated if the keys of the object change.
 */
export type ChildPath<T>
  = `${keyof T extends string ? keyof T : string}${`/${string}` | ''}`;

/**
 * Wrap an enum to allow passing the enum value as a type-safe string. Useful
 * for accepting enums as a `PropType` in components, without requiring passing
 * the enum to the parent template when the component is used.
 *
 * Example:
 * ```
 * enum MyEnum {
 *  A = 'a',
 *  B = 'b',
 * }
 * ```
 * ⬇️
 * ```
 * WithStringUnion<MyEnum> // MyEnum | 'a' | 'b'
 * ```
 */
export declare type WithStringUnion<E extends string> = E | `${E}`;