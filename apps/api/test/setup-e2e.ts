/**
 * Variaveis minimas para os testes e2e subirem a aplicacao completa.
 * Usa os mesmos valores do docker-compose de desenvolvimento, e respeita
 * variaveis ja definidas no ambiente (que e como o CI injeta as suas).
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://cakecraft:cakecraft@localhost:5432/cakecraft?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'segredo-de-teste-e2e-com-16-mais';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'outro-segredo-de-teste-e2e-longo';
