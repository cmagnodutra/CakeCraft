import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * Configuracao HTTP da API, compartilhada entre o main.ts e os testes de
 * integracao. Fica separada para os testes subirem EXATAMENTE a mesma
 * configuracao de producao (prefixo, cookies, validacao, erros e CORS) e nao
 * uma copia que pode ficar diferente sem ninguem perceber.
 */
export function configureApp(app: INestApplication, corsOrigin: string): void {
  // Todas as rotas da API ficam sob /api, deixando a raiz livre para o
  // frontend quando os dois forem servidos atras do mesmo dominio.
  app.setGlobalPrefix('api');

  // Popula req.cookies - a JwtStrategy le o access token de la
  // (req.cookies.access_token), nao do header Authorization.
  app.use(cookieParser());

  // whitelist remove campos nao declarados no DTO e forbidNonWhitelisted
  // rejeita a requisicao que os enviou, reduzindo a superficie de
  // mass assignment.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // credentials: true e o que permite o navegador enviar e receber os
  // cookies httpOnly entre origens (localhost:3000 -> localhost:3001).
  app.enableCors({ origin: corsOrigin, credentials: true });
}
