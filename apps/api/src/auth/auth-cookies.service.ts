import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import { AppEnvironment } from '../config/env.validation';
import { TokenPair } from './auth.service';

/**
 * O cookie de refresh so e enviado pelo navegador de volta para esta rota
 * (via 'path'), reduzindo a janela de exposicao do token de vida longa.
 */
export const REFRESH_TOKEN_COOKIE_PATH = '/api/auth/refresh';
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/**
 * Ponto unico de emissao, leitura e limpeza dos cookies httpOnly de sessao.
 * Compartilhado entre AuthController e UsersController (anonimizacao LGPD)
 * para garantir que set e clearCookie usem SEMPRE os mesmos atributos.
 */
@Injectable()
export class AuthCookiesService {
  constructor(private readonly config: ConfigService<AppEnvironment, true>) {}

  setAuthCookies(res: Response, tokens: TokenPair): void {
    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, this.cookieOptions('access'));
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, this.cookieOptions('refresh'));
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, this.cookieOptions('access'));
    res.clearCookie(REFRESH_TOKEN_COOKIE, this.cookieOptions('refresh'));
  }

  extractAccessToken(req: Request | undefined): string | undefined {
    const cookies = req?.cookies as Record<string, unknown> | undefined;
    const raw = cookies?.[ACCESS_TOKEN_COOKIE];
    return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
  }

  extractRefreshToken(req: Request | undefined): string | undefined {
    const cookies = req?.cookies as Record<string, unknown> | undefined;
    const raw = cookies?.[REFRESH_TOKEN_COOKIE];
    return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
  }

  private cookieOptions(kind: 'access' | 'refresh') {
    const isProduction = this.config.get('NODE_ENV', { infer: true }) === 'production';
    const base = { httpOnly: true, sameSite: 'lax' as const, secure: isProduction };

    return kind === 'refresh' ? { ...base, path: REFRESH_TOKEN_COOKIE_PATH } : base;
  }
}
