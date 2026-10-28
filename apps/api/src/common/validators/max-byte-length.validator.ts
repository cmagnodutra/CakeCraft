import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

/**
 * Limite arquitetural do algoritmo Blowfish/bcrypt: qualquer byte alem do 72o
 * em UTF-8 e truncado silenciosamente ao gerar ou comparar hashes.
 */
export const BCRYPT_MAX_PASSWORD_BYTES = 72;

export function utf8ByteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

/**
 * Valida que uma string codificada em UTF-8 nao exceda `maxBytes` bytes.
 * Diferente de @MaxLength, que mede unidades UTF-16 (onde letras acentuadas
 * contam como 1 mas ocupam 2 bytes no bcrypt), este decorator mede os bytes
 * reais que o bcrypt consome.
 */
export function MaxByteLength(maxBytes: number, validationOptions?: ValidationOptions) {
  return function (target: object, propertyName: string): void {
    registerDecorator({
      name: 'maxByteLength',
      target: target.constructor,
      propertyName,
      constraints: [maxBytes],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const [limit] = args.constraints as [number];
          return typeof value === 'string' && utf8ByteLength(value) <= limit;
        },
        defaultMessage(args: ValidationArguments): string {
          const [limit] = args.constraints as [number];
          return `${args.property} must not exceed ${limit} UTF-8 bytes`;
        },
      },
    });
  };
}
