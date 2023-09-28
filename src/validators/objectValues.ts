import { string, Validator, ValidationError } from 'checkeasy';

export function objectValues<T, K extends string | number | symbol>(
  valueValidator: Validator<T>,
  keyValidator: Validator<K> = string() as Validator<K>
): Validator<Record<K, T>> {
  return (value: unknown, path: string) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ValidationError(`Expected an object at ${path}`);
    }

    const object = value as Record<string, unknown>;
    const keys = Object.keys(object);
    const result: Record<K, T> = {} as Record<K, T>;

    for (const key of keys) {
      const newKey = keyValidator(key, `${path}.${key}`);
      const val = object[key];
      result[newKey] = valueValidator(val, `${path}.${key}`);
    }

    return result;
  };
}
