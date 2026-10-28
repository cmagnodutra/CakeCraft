import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { EmailModule } from '../email/email.module';
import { AuthCookiesService } from './auth-cookies.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersController } from './users.controller';

/**
 * JwtModule.register({}) sem opcoes: nao ha secret/expiresIn globais aqui
 * de proposito - AuthService passa esses valores explicitamente em cada
 * signAsync() (access, refresh e reset de senha usam segredos e janelas
 * independentes).
 */
@Module({
  imports: [PassportModule, JwtModule.register({}), EmailModule],
  controllers: [AuthController, UsersController],
  providers: [AuthService, AuthCookiesService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
