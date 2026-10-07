import Joi from 'joi';

/**
 * Contrato das variaveis de ambiente da API.
 *
 * A validacao acontece no boot da aplicacao: se faltar variavel obrigatoria
 * ou o valor estiver fora do formato esperado, o processo falha
 * imediatamente com uma mensagem clara, em vez de subir "meio configurado"
 * e quebrar so quando alguem chamar a rota afetada.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  PORT: Joi.number().port().default(3001),

  /** Origem permitida pelo CORS: o frontend Next.js em desenvolvimento. */
  CORS_ORIGIN: Joi.string().uri().default('http://localhost:3000'),

  /** Conexao com o Postgres (formato esperado pelo driver e pelo Prisma). */
  DATABASE_URL: Joi.string()
    .pattern(/^postgresql:\/\//)
    .required()
    .messages({
      'string.pattern.base': 'DATABASE_URL deve comecar com postgresql://',
    }),

  /** Conexao com o Redis (cache de catalogo e Pub/Sub de eventos). */
  REDIS_URL: Joi.string()
    .pattern(/^redis:\/\//)
    .required()
    .messages({
      'string.pattern.base': 'REDIS_URL deve comecar com redis://',
    }),

  /** RF01/RNF04 - autenticacao JWT (access curto + refresh longo) e Bcrypt. */
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  BCRYPT_SALT_ROUNDS: Joi.number().integer().min(10).max(14).default(12),
})
  // Reporta todos os problemas de configuracao de uma vez, em vez de fazer
  // o desenvolvedor descobrir um por vez a cada tentativa de boot.
  .options({ abortEarly: false });

/** Formato tipado das variaveis ja validadas e com defaults aplicados. */
export interface AppEnvironment {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  CORS_ORIGIN: string;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;
  BCRYPT_SALT_ROUNDS: number;
}
