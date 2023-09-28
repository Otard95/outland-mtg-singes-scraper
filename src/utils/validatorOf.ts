import { Validator } from 'checkeasy';

export type ValidatorOf<T extends Validator<unknown>> = T extends Validator<
  infer U
>
  ? U
  : never;
