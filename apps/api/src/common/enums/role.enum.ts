/**
 * Espelha o enum `Role` do Prisma. Mantido separado para uso em decorators
 * e guards sem acoplar esses pontos diretamente ao client do Prisma.
 */
export enum Role {
  CLIENTE = 'CLIENTE',
  ADMIN = 'ADMIN',
}
