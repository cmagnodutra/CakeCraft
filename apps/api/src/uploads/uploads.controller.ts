import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  MAX_RICE_PAPER_BYTES,
  SavedRicePaperResult,
  UploadedFilePayload,
  UploadsService,
} from './uploads.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('rice-paper')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_RICE_PAPER_BYTES },
    }),
  )
  uploadRicePaper(
    @UploadedFile() file: UploadedFilePayload | undefined,
  ): Promise<SavedRicePaperResult> {
    return this.uploadsService.saveRicePaperImage(file);
  }

  @Get('rice-paper/:filename')
  async getRicePaper(
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, mimeType } = await this.uploadsService.readRicePaperImage(filename);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.status(HttpStatus.OK).send(buffer);
  }
}
