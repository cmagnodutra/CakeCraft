import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health responde 200 com o status do servico', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('cakecraft-api');
  });

  it('GET em rota inexistente responde 404 no formato de erro padronizado', async () => {
    const response = await request(app.getHttpServer()).get('/api/rota-inexistente').expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      path: '/api/rota-inexistente',
    });
    expect(typeof response.body.timestamp).toBe('string');
  });
});
