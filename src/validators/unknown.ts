import { Validator } from 'checkeasy';

export function unknown(): Validator<unknown> {
  return (value: unknown) => {
    return value;
  };
}
