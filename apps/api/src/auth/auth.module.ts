import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * JwtModule.register({}) sem opcoes: nao ha secret/expiresIn globais aqui
 * de proposito - AuthService.issueTokenPair() passa esses valores
 * explicitamente em cada signAsync() (um secret pro access token, outro
 * pro refresh, com tempos de vida diferentes). O modulo so precisa expor
 * JwtService para injecao.
 */
@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
