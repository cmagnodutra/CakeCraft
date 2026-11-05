// Regras compartilhadas entre cadastro, login e redefinicao de senha:
// espelham RegisterDto, LoginDto e ResetPasswordDto do backend.
export const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_BYTES = 72;

/**
 * Conta o tamanho exato da string em bytes UTF-8 (RFC 3629), identico a
 * Buffer.byteLength(value, 'utf8') da API e sem depender de TextEncoder global.
 */
export function utf8ByteLength(value: string): number {
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

export function isValidEmailShape(value: string): boolean {
  return EMAIL_SHAPE.test(value.trim());
}

/**
 * Valida tamanho minimo em caracteres e teto de 72 bytes UTF-8 (limite fisico
 * do bcrypt). A senha nunca e aparada: espacos fazem parte dela.
 */
export function validatePasswordStrength(
  password: string,
  messages: { min: string; max: string },
): string | undefined {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return messages.min;
  }
  if (utf8ByteLength(password) > MAX_PASSWORD_BYTES) {
    return messages.max;
  }
  return undefined;
}
