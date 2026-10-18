import { messages } from '@/content/messages';
import type { RegisterInput } from '@/lib/api/auth';

/** Valores como o usuario digitou nos campos (tudo texto). */
export interface RegisterValues {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export type RegisterErrors = Partial<Record<keyof RegisterValues, string>>;

const texts = messages.auth.register.validation;

// Mesmo criterio de "forma de e-mail" do formulario: algo@dominio.tld, sem
// espacos nem @ repetido. A API valida com class-validator (mais estrito);
// o que passar aqui e o servidor recusar cai no erro geral (400).
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Regras espelham RegisterDto do backend: nome >= 2, senha >= 8 (contados
// como o class-validator conta, em unidades de string) e e-mail valido.
const MIN_NAME_LENGTH = 2;
const MIN_PASSWORD_LENGTH = 8;

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

  if (!EMAIL_SHAPE.test(values.email.trim())) {
    errors.email = texts.email;
  }

  // A senha NAO e aparada: espacos fazem parte dela.
  if (values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = texts.password;
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
