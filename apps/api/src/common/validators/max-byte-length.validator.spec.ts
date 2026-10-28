import { validate } from 'class-validator';

import {
  BCRYPT_MAX_PASSWORD_BYTES,
  MaxByteLength,
  utf8ByteLength,
} from './max-byte-length.validator';

class PasswordSampleDto {
  @MaxByteLength(BCRYPT_MAX_PASSWORD_BYTES)
  password!: unknown;
}

class CustomMessageSampleDto {
  @MaxByteLength(8, { message: 'excedeu 8 bytes' })
  field!: string;
}

describe('MaxByteLength', () => {
  it('mede bytes UTF-8 reais para ASCII e caracteres multibyte', () => {
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('\u00e1\u00e7\u00e3')).toBe(6);
  });

  it('aceita exatamente 72 bytes ASCII e 36 caracteres acentuados (72 bytes UTF-8)', async () => {
    const ascii = Object.assign(new PasswordSampleDto(), { password: 'a'.repeat(72) });
    const accented = Object.assign(new PasswordSampleDto(), { password: '\u00e1'.repeat(36) });

    expect(await validate(ascii)).toHaveLength(0);
    expect(await validate(accented)).toHaveLength(0);
  });

  it('rejeita 73 bytes ASCII e 37 caracteres acentuados (74 bytes UTF-8)', async () => {
    const ascii = Object.assign(new PasswordSampleDto(), { password: 'a'.repeat(73) });
    const accented = Object.assign(new PasswordSampleDto(), { password: '\u00e1'.repeat(37) });

    const asciiErrors = await validate(ascii);
    const accentedErrors = await validate(accented);

    expect(asciiErrors[0]?.constraints?.maxByteLength).toBe(
      'password must not exceed 72 UTF-8 bytes',
    );
    expect(accentedErrors[0]?.constraints?.maxByteLength).toBe(
      'password must not exceed 72 UTF-8 bytes',
    );
  });

  it('falha fechado quando o valor nao e string', async () => {
    const dto = Object.assign(new PasswordSampleDto(), { password: 12345678 });
    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
  });

  it('respeita mensagem customizada via ValidationOptions', async () => {
    const dto = Object.assign(new CustomMessageSampleDto(), { field: '123456789' });
    const errors = await validate(dto);

    expect(errors[0]?.constraints?.maxByteLength).toBe('excedeu 8 bytes');
  });
});
