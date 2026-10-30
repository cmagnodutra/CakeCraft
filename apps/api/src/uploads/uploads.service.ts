import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppEnvironment } from '../config/env.validation';

export const MAX_RICE_PAPER_BYTES = 5 * 1024 * 1024;

const SAFE_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/;

export interface UploadedFilePayload {
  buffer: Buffer;
  size: number;
  originalname: string;
}

export interface SavedRicePaperResult {
  url: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  sizeBytes: number;
}

export interface ReadRicePaperResult {
  buffer: Buffer;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
}

interface DetectedFormat {
  ext: 'png' | 'jpg' | 'webp';
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
}

/**
 * Armazenamento seguro de imagens de papel de arroz (RF05 / Secao 6 do RFC).
 *
 * Defesas contra vulnerabilidades de File Upload (OWASP):
 * 1. Inspeciona os magic bytes reais do arquivo (rejeita SVG/HTML/scripts
 *    renomeados como .png);
 * 2. Limita o tamanho em 5 MB;
 * 3. Descarta completamente `originalname` e grava apenas `<uuid>.<ext>`;
 * 4. Valida regex estrito na leitura para bloquear Path Traversal (`../`).
 */
@Injectable()
export class UploadsService {
  private readonly ricePaperDir: string;

  constructor(config: ConfigService<Partial<AppEnvironment>>) {
    const baseDir = config.get('UPLOAD_DIR', { infer: true }) ?? 'uploads';
    this.ricePaperDir = resolve(baseDir, 'rice-paper');
  }

  async saveRicePaperImage(file: UploadedFilePayload | undefined): Promise<SavedRicePaperResult> {
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw new BadRequestException('Envie um arquivo de imagem PNG, JPEG ou WEBP.');
    }

    if (file.size > MAX_RICE_PAPER_BYTES || file.buffer.length > MAX_RICE_PAPER_BYTES) {
      throw new BadRequestException('A imagem excede o tamanho maximo permitido de 5 MB.');
    }

    const detected = detectImageMagicBytes(file.buffer);
    if (!detected) {
      throw new BadRequestException(
        'Formato de imagem invalido. Envie apenas PNG, JPEG ou WEBP autentico.',
      );
    }

    await mkdir(this.ricePaperDir, { recursive: true });
    const filename = `${randomUUID()}.${detected.ext}`;
    const destination = join(this.ricePaperDir, filename);

    await writeFile(destination, file.buffer);

    return {
      url: `/api/uploads/rice-paper/${filename}`,
      mimeType: detected.mimeType,
      sizeBytes: file.buffer.length,
    };
  }

  async readRicePaperImage(filename: string): Promise<ReadRicePaperResult> {
    if (!SAFE_FILENAME_PATTERN.test(filename)) {
      throw new BadRequestException('Nome de arquivo invalido.');
    }

    const ext = filename.split('.').pop() as 'png' | 'jpg' | 'webp';
    const mimeType =
      ext === 'png' ? 'image/png' : ext === 'jpg' ? 'image/jpeg' : 'image/webp';
    const fullPath = join(this.ricePaperDir, filename);

    try {
      const buffer = await readFile(fullPath);
      return { buffer, mimeType };
    } catch {
      throw new NotFoundException('Imagem nao encontrada.');
    }
  }
}

function detectImageMagicBytes(buffer: Buffer): DetectedFormat | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: 'png', mimeType: 'image/png' };
  }

  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mimeType: 'image/jpeg' };
  }

  // WEBP: "RIFF" <4 bytes> "WEBP"
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp', mimeType: 'image/webp' };
  }

  return null;
}
