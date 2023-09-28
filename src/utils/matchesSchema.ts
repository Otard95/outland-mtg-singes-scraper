import { Validator } from 'checkeasy';

export function matchesSchema<T>(
  value: unknown,
  validator: Validator<T>,
  path = 'value'
): value is T {
  try {
    validator(value, path);
    return true;
  } catch (e) {
    return false;
  }
}
