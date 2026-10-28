import { ConfigService } from '@nestjs/config';

import { AppEnvironment } from '../config/env.validation';
import { RedisService } from './redis.service';

const getMock = jest.fn();
const setMock = jest.fn();
const delMock = jest.fn();
const flushdbMock = jest.fn();
const quitMock = jest.fn();
const disconnectMock = jest.fn();
const onMock = jest.fn();
let clientStatus = 'ready';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get status() {
      return clientStatus;
    },
    get: getMock,
    set: setMock,
    del: delMock,
    flushdb: flushdbMock,
    quit: quitMock,
    disconnect: disconnectMock,
    on: onMock,
  }));
});

function makeConfig(redisUrl?: string): ConfigService<Partial<AppEnvironment>> {
  return {
    get: jest.fn((key: string) => (key === 'REDIS_URL' ? redisUrl : undefined)),
  } as unknown as ConfigService<Partial<AppEnvironment>>;
}

describe('RedisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clientStatus = 'ready';
  });

  describe('modo desabilitado (sem REDIS_URL em testes isolados)', () => {
    it('opera como no-op seguro sem abrir conexao TCP', async () => {
      const service = new RedisService(makeConfig(undefined));

      expect(service.isEnabled()).toBe(false);
      await expect(service.getJson('chave')).resolves.toBeNull();
      await expect(service.setJson('chave', { ok: true }, 60)).resolves.toBeUndefined();
      await expect(service.del('chave')).resolves.toBeUndefined();
      await expect(service.flushDb()).resolves.toBeUndefined();
      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
      expect(getMock).not.toHaveBeenCalled();
    });
  });

  describe('modo conectado ao Redis', () => {
    it('le e grava JSON com TTL em segundos e remove chaves', async () => {
      const service = new RedisService(makeConfig('redis://localhost:6379'));
      getMock.mockResolvedValueOnce(JSON.stringify([{ id: '1', name: 'Chantilly' }]));
      setMock.mockResolvedValueOnce('OK');
      delMock.mockResolvedValueOnce(1);
      flushdbMock.mockResolvedValueOnce('OK');

      expect(service.isEnabled()).toBe(true);
      await expect(service.getJson('catalog:active:v1')).resolves.toEqual([
        { id: '1', name: 'Chantilly' },
      ]);

      await service.setJson('catalog:active:v1', [{ id: '1' }], 300);
      expect(setMock).toHaveBeenCalledWith('catalog:active:v1', '[{"id":"1"}]', 'EX', 300);

      await service.del('catalog:active:v1');
      expect(delMock).toHaveBeenCalledWith('catalog:active:v1');

      await service.flushDb();
      expect(flushdbMock).toHaveBeenCalledTimes(1);
    });

    it('retorna null quando a chave nao existe no Redis', async () => {
      const service = new RedisService(makeConfig('redis://localhost:6379'));
      getMock.mockResolvedValueOnce(null);

      await expect(service.getJson('ausente')).resolves.toBeNull();
    });

    it('degrada graciosamente (sem quebrar a requisicao) se o Redis cair ou devolver JSON corrompido', async () => {
      const service = new RedisService(makeConfig('redis://localhost:6379'));
      getMock.mockResolvedValueOnce('{json-quebrado');
      await expect(service.getJson('corrompido')).resolves.toBeNull();

      getMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      setMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      delMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      flushdbMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(service.getJson('chave')).resolves.toBeNull();
      await expect(service.setJson('chave', { a: 1 }, 60)).resolves.toBeUndefined();
      await expect(service.del('chave')).resolves.toBeUndefined();
      await expect(service.flushDb()).resolves.toBeUndefined();
    });

    it('encerra a conexao com quit() quando aberta ou disconnect() quando lazyConnect ainda nao conectou', async () => {
      const activeService = new RedisService(makeConfig('redis://localhost:6379'));
      quitMock.mockResolvedValueOnce('OK');
      await activeService.onModuleDestroy();
      expect(quitMock).toHaveBeenCalledTimes(1);

      clientStatus = 'wait';
      const idleService = new RedisService(makeConfig('redis://localhost:6379'));
      await idleService.onModuleDestroy();
      expect(disconnectMock).toHaveBeenCalledTimes(1);
    });
  });
});
