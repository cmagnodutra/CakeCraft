import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';

import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Formato do usuario devolvido pela API - nunca inclui passwordHash. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: string;
  xp: number;
  level: number;
}

interface RefreshJwtPayload extends JwtPayload {
  jti?: string;
  exp?: number;
}

interface PasswordResetJwtPayload {
  sub: string;
  purpose: 'password-reset';
}

const PASSWORD_RESET_EXPIRES_IN: StringValue = '30m';
const DEFAULT_REFRESH_FALLBACK_SECONDS = 7 * 24 * 60 * 60;

/**
 * UC03 - cadastro, login, rotacao/revogacao de refresh token, recuperacao
 * de senha por e-mail (RF01) e anonimizacao de conta (LGPD - Secao 6.1).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  /** UC03, passo 2 - cadastro de um novo usuario (papel padrao: CLIENTE). */
  async register(dto: RegisterDto): Promise<{ user: PublicUser } & TokenPair> {
    const email = this.normalizeEmail(dto.email);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Ja existe uma conta com este e-mail.');
    }

    const saltRounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        phone: dto.phone,
        passwordHash,
      },
    });

    const tokens = await this.issueTokenPair(user.id, user.email, user.role);
    return { user: this.toPublicUser(user), ...tokens };
  }

  /** UC03, passo 3 - valida credenciais e emite o par de tokens JWT. */
  async login(dto: LoginDto): Promise<{ user: PublicUser } & TokenPair> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || user.anonymizedAt) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const tokens = await this.issueTokenPair(user.id, user.email, user.role);
    return { user: this.toPublicUser(user), ...tokens };
  }

  /**
   * Rotaciona o refresh token persistido:
   * - Verifica assinatura e validade com JWT_REFRESH_SECRET;
   * - Se o token ja estiver revogado no banco, detecta reuso (possivel roubo)
   *   e revoga todas as sessoes ativas daquele usuario;
   * - Caso valido, revoga o registro usado e emite um novo par persistido.
   */
  async refresh(rawRefreshToken: string | undefined): Promise<{ user: PublicUser } & TokenPair> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token ausente.');
    }

    let payload: RefreshJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshJwtPayload>(rawRefreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalido ou expirado.');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId: payload.sub, tokenHash },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token desconhecido.');
    }

    if (stored.revokedAt !== null) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Reuso de refresh token detectado; sessoes revogadas.');
    }

    if (stored.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token expirado.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.anonymizedAt) {
      throw new UnauthorizedException('Sessao invalida.');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokenPair(user.id, user.email, user.role);
    return { user: this.toPublicUser(user), ...tokens };
  }

  /**
   * Revoga os refresh tokens ativos do usuario identificado pelo cookie
   * access_token (mesmo expirado, desde que autentico). Falhas de assinatura
   * sao ignoradas para manter POST /api/auth/logout sempre idempotente (204).
   */
  async revokeSessionsFromAccessToken(rawAccessToken: string | undefined): Promise<void> {
    if (!rawAccessToken) {
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(rawAccessToken, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        ignoreExpiration: true,
      });
      if (payload?.sub) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: payload.sub, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      // Token malformado ou assinado com outro segredo: nada a revogar.
    }
  }

  /**
   * UC03, passo 4 - solicita recuperacao de senha por e-mail (RF01).
   * Responde silenciosamente quando o e-mail nao existe ou foi anonimizado
   * para evitar enumeracao de contas.
   */
  async forgotPassword(rawEmail: string): Promise<void> {
    const email = this.normalizeEmail(rawEmail);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || user.anonymizedAt) {
      return;
    }

    const resetSecret = this.derivePasswordResetSecret(user.id, user.passwordHash);
    const payload: PasswordResetJwtPayload = {
      sub: user.id,
      purpose: 'password-reset',
    };

    const resetToken = await this.jwt.signAsync(payload, {
      secret: resetSecret,
      expiresIn: PASSWORD_RESET_EXPIRES_IN,
    });

    await this.emailService.sendPasswordResetEmail(user.email, resetToken);
  }

  /**
   * Valida o token de recuperacao (uso unico derivado do passwordHash atual),
   * grava a nova senha e revoga todos os refresh tokens ativos do usuario.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const decoded: unknown = this.jwt.decode(token);
    if (!isPasswordResetPayload(decoded)) {
      throw new BadRequestException('Token de recuperacao invalido ou expirado.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user || user.anonymizedAt) {
      throw new BadRequestException('Token de recuperacao invalido ou expirado.');
    }

    const expectedSecret = this.derivePasswordResetSecret(user.id, user.passwordHash);
    try {
      await this.jwt.verifyAsync<PasswordResetJwtPayload>(token, { secret: expectedSecret });
    } catch {
      throw new BadRequestException('Token de recuperacao invalido ou expirado.');
    }

    const saltRounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  /**
   * Secao 6.1 do RFC (LGPD): anonimiza dados pessoais identificaveis do
   * usuario autenticado, limpa enderecos de entrega e revoga suas sessoes,
   * preservando apenas os registros financeiros agregados da confeitaria.
   */
  async anonymizeAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.anonymizedAt) {
      throw new UnauthorizedException('Sessao invalida.');
    }

    const saltRounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 12);
    const discardedSecret = randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(discardedSecret, saltRounds);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          name: 'Usuario Anonimizado',
          email: `anonimizado-${userId}@anon.cakecraft.local`,
          phone: null,
          dietaryRestrictions: [],
          dietaryConsentAt: null,
          passwordHash,
          anonymizedAt: now,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.order.updateMany({
        where: { userId },
        data: { deliveryAddress: null },
      }),
    ]);
  }

  /**
   * Sessao atual: devolve o usuario a partir do id que a JwtStrategy colocou
   * no request, consultando o banco para refletir XP/nivel atualizados e
   * invalidar tokens de contas apagadas ou anonimizadas (LGPD).
   */
  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.anonymizedAt) {
      throw new UnauthorizedException('Sessao invalida.');
    }

    return this.toPublicUser(user);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private derivePasswordResetSecret(userId: string, currentPasswordHash: string): string {
    const accessSecret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    return createHmac('sha256', accessSecret).update(`${userId}:${currentPasswordHash}`).digest('hex');
  }

  private async issueTokenPair(userId: string, email: string, role: string): Promise<TokenPair> {
    const accessPayload: JwtPayload = { sub: userId, email, role };
    const refreshPayload: RefreshJwtPayload = { sub: userId, email, role, jti: randomUUID() };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as StringValue,
    });

    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as StringValue,
    });

    const decodedRefresh: unknown = this.jwt.decode(refreshToken);
    const expSeconds =
      typeof decodedRefresh === 'object' &&
      decodedRefresh !== null &&
      'exp' in decodedRefresh &&
      typeof (decodedRefresh as { exp?: unknown }).exp === 'number'
        ? (decodedRefresh as { exp: number }).exp
        : Math.floor(Date.now() / 1000) + DEFAULT_REFRESH_FALLBACK_SECONDS;

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(expSeconds * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  private toPublicUser(user: {
    id: string;
    name: string;
    email: string;
    role: string;
    xp: number;
    level: number;
  }): PublicUser {
    const { id, name, email, role, xp, level } = user;
    return { id, name, email, role, xp, level };
  }
}

function isPasswordResetPayload(value: unknown): value is PasswordResetJwtPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'sub' in value &&
    typeof (value as { sub?: unknown }).sub === 'string' &&
    'purpose' in value &&
    (value as { purpose?: unknown }).purpose === 'password-reset'
  );
}
