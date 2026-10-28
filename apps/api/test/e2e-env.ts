const DEFAULT_BASE_DATABASE_URL =
  'postgresql://cakecraft:cakecraft@localhost:5432/cakecraft?schema=e2e_test';
const DEFAULT_BASE_REDIS_URL = 'redis://localhost:6379/1';

/**
 * Garante que a suite E2E sempre execute em um schema isolado (`e2e_test`) do
 * PostgreSQL 16 real, preservando intactos os dados de desenvolvimento local
 * no schema `public`.
 */
export function resolveE2eDatabaseUrl(): string {
  const raw = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? DEFAULT_BASE_DATABASE_URL;
  const parsed = new URL(raw);
  parsed.searchParams.set('schema', 'e2e_test');
  return parsed.toString();
}

/**
 * Garante que a suite E2E utilize o banco logico `/1` do Redis 7 real para nao
 * limpar nem colidir com chaves de desenvolvimento local no banco `/0`.
 */
export function resolveE2eRedisUrl(): string {
  const raw = process.env.E2E_REDIS_URL ?? process.env.REDIS_URL ?? DEFAULT_BASE_REDIS_URL;
  const parsed = new URL(raw);
  parsed.pathname = '/1';
  return parsed.toString();
}
