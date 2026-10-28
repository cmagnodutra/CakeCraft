import { messages } from '@/content/messages';
import type { RegisterInput } from '@/lib/api/auth';

import { isValidEmailShape, validatePasswordStrength } from './password-rules';

/** Valores como o usuario digitou nos campos (tudo texto). */
export interface RegisterValues {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export type RegisterErrors = Partial<Record<keyof RegisterValues, string>>;

const texts = messages.auth.register.validation;

const MIN_NAME_LENGTH = 2;

// Telefone brasileiro com DDD: 10 (fixo) ou 11 (celular) digitos.
const PHONE_DIGITS = [10, 11];

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function validateRegister(values: RegisterValues): RegisterErrors {
  const errors: RegisterErrors = {};

  if (values.name.trim().length < MIN_NAME_LENGTH) {
    errors.name = texts.name;
  }

  if (!isValidEmailShape(values.email)) {
    errors.email = texts.email;
  }

  const passwordError = validatePasswordStrength(values.password, {
    min: texts.password,
    max: texts.passwordMax,
  });
  if (passwordError) {
    errors.password = passwordError;
  }

  const phone = values.phone.trim();
  if (phone !== '' && !PHONE_DIGITS.includes(onlyDigits(phone).length)) {
    errors.phone = texts.phone;
  }

  return errors;
}

/**
 * Monta o corpo exato que a API aceita. Telefone vai so com digitos e, se
 * vazio, a chave nem existe: a API recusa campo nao declarado.
 */
export function toRegisterPayload(values: RegisterValues): RegisterInput {
  const payload: RegisterInput = {
    name: values.name.trim(),
    email: values.email.trim(),
    password: values.password,
  };

  const phone = onlyDigits(values.phone.trim());
  if (phone !== '') {
    payload.phone = phone;
  }

  return payload;
}
