import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';

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

/**
 * UC03 - cadastro, login e emissao do par de tokens JWT (RF01).
 *
 * NOTA CONHECIDA (corrigida no commit seguinte, de proposito): register()
 * e login() ainda usam dto.email diretamente nas consultas ao Prisma, sem
 * normalizar maiusculas/minusculas. Como o Postgres compara e-mail com
 * diferenciacao de caixa por padrao, "Mariana@Example.com" e
 * "mariana@example.com" sao tratados hoje como contas diferentes -
 * permitindo cadastro duplicado da mesma pessoa por acidente. Ver o commit
 * fix(auth) logo apos este, que adiciona um teste que falha sem a correcao
 * e passa com ela.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** UC03, passo 2 - cadastro de um novo usuario (papel padrao: CLIENTE). */
  async register(dto: RegisterDto): Promise<{ user: PublicUser } & TokenPair> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Ja existe uma conta com este e-mail.');
    }

    const saltRounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
      },
    });

    const tokens = await this.issueTokenPair(user.id, user.email, user.role);
    return { user: this.toPublicUser(user), ...tokens };
  }

  /** UC03, passo 3 - valida credenciais e emite o par de tokens JWT. */
  async login(dto: LoginDto): Promise<{ user: PublicUser } & TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // 401 generico de proposito: nao revela se o problema foi o e-mail
    // (nao cadastrado) ou a senha (errada) - evita transformar a rota de
    // login num oraculo para descobrir quais e-mails existem na base.
    // Usuario anonimizado (LGPD, DELETE /usuarios/me/anonymize) tambem
    // nao consegue mais logar, mesmo com a senha antiga correta.
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
   * TODO (fora do escopo destes 3 commits - ver PROXIMOS-PASSOS): rotacao
   * real de refresh token, comparando o hash recebido com o persistido em
   * RefreshToken e revogando o antigo. Hoje nao ha rota nem chamador para
   * este metodo; o cookie de refresh apenas expira e exige login de novo.
   */
  async refresh(_refreshToken: string): Promise<TokenPair> {
    throw new Error('TODO: implementar rotacao de refresh token (ver model RefreshToken no schema.prisma).');
  }

  /**
   * TODO: depende de feature/email (ainda nao existe nesta branch) para
   * disparar o e-mail de recuperacao de senha.
   */
  async forgotPassword(_email: string): Promise<void> {
    throw new Error('TODO: implementar apos feature/email existir.');
  }

  /** TODO: valida o token de reset (ainda sem geracao/persistencia) e troca a senha. */
  async resetPassword(_token: string, _newPassword: string): Promise<void> {
    throw new Error('TODO: implementar validacao do token e troca de senha.');
  }

  private async issueTokenPair(userId: string, email: string, role: string): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId, email, role };

    // expiresIn exige o tipo StringValue da lib 'ms' (ex.: '15m', '7d'),
    // nao uma string generica. O valor vem do Joi (env.validation.ts), que
    // so garante "e uma string" - o formato exato so e validado em tempo
    // de execucao pela propria lib 'ms' dentro do jsonwebtoken. O cast
    // documenta essa fronteira em vez de esconde-la com `as any`.
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as StringValue,
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as StringValue,
    });

    // TODO: persistir o hash do refreshToken em RefreshToken - permite
    // revogacao (logout, troca de senha) e deteccao de reuso. Fora do
    // escopo destes 3 commits, ver PROXIMOS-PASSOS-BACKEND-CAKECRAFT-v2.

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
