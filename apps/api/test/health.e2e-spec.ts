import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createE2eApp } from './e2e-app.helper';

describe('Health (e2e - PostgreSQL real)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  beforeAll(async () => {
    ({ app } = await createE2eApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health responde 200 com o status do servico', async () => {
    const response = await request(server()).get('/api/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('cakecraft-api');
  });

  it('GET em rota inexistente responde 404 no formato de erro padronizado pelo AllExceptionsFilter', async () => {
    const response = await request(server()).get('/api/rota-inexistente').expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      path: '/api/rota-inexistente',
    });
    expect(typeof response.body.timestamp).toBe('string');
  });
});
