const DEFAULT_BASE_DATABASE_URL =
  'postgresql://cakecraft:cakecraft@localhost:5432/cakecraft?schema=e2e_test';

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
