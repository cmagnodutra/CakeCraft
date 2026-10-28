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

// Regras espelham RegisterDto do backend: nome >= 2, senha >= 8 caracteres,
// senha <= 72 bytes UTF-8 (limite fisico do bcrypt) e e-mail valido.
const MIN_NAME_LENGTH = 2;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

/**
 * Conta o tamanho exato da string em bytes UTF-8 (RFC 3629), identico a
 * Buffer.byteLength(value, 'utf8') da API e sem alocar Uint8Array.
 */
function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) {
      bytes += 1;
    } else if (codePoint <= 0x7ff) {
      bytes += 2;
    } else if (codePoint <= 0xffff) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }
  return bytes;
}

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
  } else if (utf8ByteLength(values.password) > MAX_PASSWORD_BYTES) {
    errors.password = texts.passwordMax;
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
