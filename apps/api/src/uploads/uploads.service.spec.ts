import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppEnvironment } from '../config/env.validation';
import { MAX_RICE_PAPER_BYTES, UploadsService } from './uploads.service';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const WEBP_HEADER = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
]);

describe('UploadsService (RF05 - papel de arroz seguro)', () => {
  let tempDir: string;
  let service: UploadsService;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cakecraft-uploads-test-'));
    const config = {
      get: jest.fn((key: string) => (key === 'UPLOAD_DIR' ? tempDir : undefined)),
    } as unknown as ConfigService<Partial<AppEnvironment>>;
    service = new UploadsService(config);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('aceita PNG, JPEG e WEBP validando magic bytes reais, renomeia com UUID e permite leitura segura', async () => {
    const png = await service.saveRicePaperImage({
      buffer: PNG_HEADER,
      size: PNG_HEADER.length,
      originalname: '../../malicioso.png',
    });
    expect(png.url).toMatch(/^\/api\/uploads\/rice-paper\/[0-9a-f-]{36}\.png$/);
    expect(png.mimeType).toBe('image/png');

    const filename = png.url.split('/').pop()!;
    const resolved = await service.readRicePaperImage(filename);
    expect(resolved.mimeType).toBe('image/png');
    expect(resolved.buffer.equals(PNG_HEADER)).toBe(true);

    const jpg = await service.saveRicePaperImage({
      buffer: JPEG_HEADER,
      size: JPEG_HEADER.length,
      originalname: 'foto.jpeg',
    });
    expect(jpg.url).toMatch(/\.jpg$/);
    expect(jpg.mimeType).toBe('image/jpeg');

    const webp = await service.saveRicePaperImage({
      buffer: WEBP_HEADER,
      size: WEBP_HEADER.length,
      originalname: 'arte.webp',
    });
    expect(webp.url).toMatch(/\.webp$/);
    expect(webp.mimeType).toBe('image/webp');
  });

  it('rejeita arquivo ausente, acima de 5 MB ou com conteudo disfarcado (ex.: SVG/script com extensao .png)', async () => {
    await expect(service.saveRicePaperImage(undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    await expect(
      service.saveRicePaperImage({
        buffer: PNG_HEADER,
        size: MAX_RICE_PAPER_BYTES + 1,
        originalname: 'enorme.png',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const fakeSvgAsPng = Buffer.from('<svg onload="alert(1)"></svg>', 'utf8');
    await expect(
      service.saveRicePaperImage({
        buffer: fakeSvgAsPng,
        size: fakeSvgAsPng.length,
        originalname: 'xss.png',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bloqueia tentativa de Path Traversal na leitura e responde 404 para UUID inexistente', async () => {
    await expect(service.readRicePaperImage('../.env')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.readRicePaperImage('00000000-0000-0000-0000-000000000000.png'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
