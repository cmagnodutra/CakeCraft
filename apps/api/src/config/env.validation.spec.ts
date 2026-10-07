import { envValidationSchema } from './env.validation';

/**
 * A validacao de ambiente e a primeira linha de defesa contra o classico
 * "funciona na minha maquina": estes testes garantem que a aplicacao se
 * recusa a subir mal configurada.
 */
describe('envValidationSchema', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://cakecraft:cakecraft@localhost:5432/cakecraft',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'segredo-de-teste-com-mais-de-16-chars',
    JWT_REFRESH_SECRET: 'outro-segredo-de-teste-tambem-longo',
  };

  it('aplica os valores padrao quando as variaveis opcionais nao sao informadas', () => {
    const { error, value } = envValidationSchema.validate(validEnv);

    expect(error).toBeUndefined();
    expect(value.NODE_ENV).toBe('development');
    expect(value.PORT).toBe(3001);
    expect(value.CORS_ORIGIN).toBe('http://localhost:3000');
    expect(value.JWT_ACCESS_EXPIRES_IN).toBe('15m');
    expect(value.JWT_REFRESH_EXPIRES_IN).toBe('7d');
    expect(value.BCRYPT_SALT_ROUNDS).toBe(12);
  });

  it('converte PORT de texto para numero', () => {
    const { error, value } = envValidationSchema.validate({
      ...validEnv,
      PORT: '8080',
    });

    expect(error).toBeUndefined();
    expect(value.PORT).toBe(8080);
    expect(typeof value.PORT).toBe('number');
  });

  it('rejeita a ausencia de DATABASE_URL', () => {
    const { error } = envValidationSchema.validate({
      REDIS_URL: validEnv.REDIS_URL,
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('DATABASE_URL');
  });

  it('rejeita DATABASE_URL com protocolo de outro banco', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      DATABASE_URL: 'mysql://cakecraft@localhost:3306/cakecraft',
    });

    expect(error?.message).toContain('postgresql://');
  });

  it('rejeita REDIS_URL fora do protocolo redis', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      REDIS_URL: 'http://localhost:6379',
    });

    expect(error?.message).toContain('redis://');
  });

  it('rejeita PORT fora da faixa valida de portas', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      PORT: '99999',
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('PORT');
  });

  it('rejeita NODE_ENV fora dos ambientes previstos', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      NODE_ENV: 'homologacao',
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('NODE_ENV');
  });

  it('rejeita a ausencia de JWT_ACCESS_SECRET', () => {
    const { JWT_ACCESS_SECRET, ...envSemAccessSecret } = validEnv;
    const { error } = envValidationSchema.validate(envSemAccessSecret);

    expect(error).toBeDefined();
    expect(error?.message).toContain('JWT_ACCESS_SECRET');
  });

  it('rejeita segredo de JWT curto demais (risco de forca bruta)', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      JWT_ACCESS_SECRET: 'curto',
    });

    expect(error).toBeDefined();
  });

  it('rejeita BCRYPT_SALT_ROUNDS fora da faixa segura', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      BCRYPT_SALT_ROUNDS: 5,
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('BCRYPT_SALT_ROUNDS');
  });
});
