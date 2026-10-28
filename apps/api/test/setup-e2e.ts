import { resolveE2eDatabaseUrl, resolveE2eRedisUrl } from './e2e-env';

/**
 * Variaveis de ambiente da suite E2E.
 * Sobrescreve DATABASE_URL com o schema `e2e_test` do PostgreSQL 16 real e
 * REDIS_URL com o banco `/1` do Redis 7 real antes que o ConfigModule seja
 * carregado pelo AppModule, e reduz BCRYPT_SALT_ROUNDS para o minimo permitido
 * pelo schema Joi (10) para manter a suite rapida.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = resolveE2eDatabaseUrl();
process.env.REDIS_URL = resolveE2eRedisUrl();
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'segredo-de-teste-e2e-com-16-mais';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'outro-segredo-de-teste-e2e-longo';
process.env.BCRYPT_SALT_ROUNDS = '10';
process.env.SMTP_HOST = process.env.SMTP_HOST ?? 'smtp-relay.brevo.com';
process.env.SMTP_USER = process.env.SMTP_USER ?? 'usuario-smtp-de-teste';
process.env.SMTP_PASSWORD = process.env.SMTP_PASSWORD ?? 'chave-smtp-de-teste';
process.env.SMTP_FROM = process.env.SMTP_FROM ?? 'CakeCraft <no-reply@cakecraft.dev>';
process.env.THROTTLE_TTL_MS = '60000';
process.env.THROTTLE_LIMIT = '120';
