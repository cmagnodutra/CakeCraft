import { Body, Controller, Get, INestApplication, Post, Req } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import type { Request } from 'express';
import request from 'supertest';

import { configureApp } from './app.setup';

class EchoDto {
  @IsString()
  name!: string;
}

/** Controller minimo, so para observar o que a configuracao faz com a requisicao. */
@Controller('ping')
class PingController {
  @Get()
  ping(@Req() req: Request): { cookies: unknown } {
    return { cookies: req.cookies };
  }

  @Post()
  echo(@Body() dto: EchoDto): EchoDto {
    return dto;
  }
}

describe('configureApp (configuracao HTTP compartilhada pelo main.ts)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [PingController] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, 'http://localhost:3000');
    await app.init();
  });

  afterAll(() => app.close());

  it('todas as rotas ficam sob o prefixo /api', async () => {
    await request(server()).get('/api/ping').expect(200);
    await request(server()).get('/ping').expect(404);
  });

  it('popula req.cookies (a JwtStrategy le o access token de la, nao do header Authorization)', async () => {
    const res = await request(server()).get('/api/ping').set('Cookie', ['a=1; b=dois']).expect(200);

    expect((res.body as { cookies: unknown }).cookies).toEqual({ a: '1', b: 'dois' });
  });

  describe('ValidationPipe', () => {
    it('aceita o corpo valido', async () => {
      const res = await request(server()).post('/api/ping').send({ name: 'Ana' }).expect(201);

      expect(res.body).toEqual({ name: 'Ana' });
    });

    it('recusa campo nao declarado (forbidNonWhitelisted): protege contra mass assignment', async () => {
      const res = await request(server())
        .post('/api/ping')
        .send({ name: 'Ana', role: 'ADMIN' })
        .expect(400);

      expect(JSON.stringify((res.body as { message: unknown }).message)).toContain('role');
    });
  });

  it('erros saem no formato do contrato: statusCode, message, path e timestamp', async () => {
    const res = await request(server()).post('/api/ping').send({}).expect(400);

    expect(Object.keys(res.body as object).sort()).toEqual([
      'message',
      'path',
      'statusCode',
      'timestamp',
    ]);
    expect(res.body).toMatchObject({ statusCode: 400, path: '/api/ping' });
  });

  describe('CORS', () => {
    const preflight = (origin: string) =>
      request(server())
        .options('/api/ping')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST');

    it('libera a origem configurada, com credenciais (e o que permite os cookies httpOnly)', async () => {
      const res = await preflight('http://localhost:3000').expect(204);

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('nunca devolve uma origem desconhecida como se fosse permitida', async () => {
      const res = await preflight('http://127.0.0.1:3000');

      // Com origem fixa, a API responde SEMPRE a origem configurada; quem
      // bloqueia e o navegador, ao ver que ela nao e a da pagina (por isso
      // 127.0.0.1 falha mesmo com a API no ar).
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-origin']).not.toBe('http://127.0.0.1:3000');
    });

    it('nao usa curinga: com credenciais o navegador recusaria "*" de qualquer jeito', async () => {
      const res = await preflight('http://localhost:3000');

      expect(res.headers['access-control-allow-origin']).not.toBe('*');
    });
  });
});
