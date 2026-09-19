import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Wrapper injetavel do PrismaClient. Conecta no boot da aplicacao e
 * desconecta de forma limpa no shutdown (ver app.enableShutdownHooks() em
 * main.ts, que dispara onModuleDestroy ao receber SIGTERM do 'docker stop').
 *
 * Nao ha teste automatizado para esta classe: ela e so um wrapper de ciclo
 * de vida sobre uma biblioteca externa. Testa-la exigiria um Postgres real
 * so para validar chamadas de $connect/$disconnect, o que agrega pouco - a
 * cobertura de verdade vem dos servicos de dominio que a consomem
 * (ex.: PricingService), testados com o client mockado.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conexao com o banco de dados estabelecida');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
