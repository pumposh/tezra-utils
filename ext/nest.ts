
/**
 * Set a nested value on a record, handling both object properties and array indices.
 *
 * @param obj - The object to set the value on.
 * @param path - The path to the value to set separated by `/`.
 * @param value - The value to set the nested key to.
 * @returns The updated object.
 */
export const setNestedChildOnRecord = <T extends object>(
  obj: T,
  path: string,
  value: any,
): T => {
  const keys = path.split('/');
  const key = keys[0];

  if (keys.length === 1) {
    return { ...obj, [key as keyof T]: value };
  }

  const currentValue = obj[key as keyof T];
  const restPath = keys.slice(1).join('/');

  if (Array.isArray(currentValue)) {
    const index = parseInt(keys[1] ?? '', 10);
    const newArray = [...currentValue];
    if (keys.length === 2) {
      newArray[index] = value;
    } else {
      newArray[index] = setNestedChildOnRecord(
        (newArray[index] as object) || {},
        keys.slice(2).join('/'),
        value,
      );
    }
    return { ...obj, [key as keyof T]: newArray };
  }

  return {
    ...obj,
    [key as keyof T]: setNestedChildOnRecord(
      (currentValue as object) || {},
      restPath,
      value,
    ),
  };
};
