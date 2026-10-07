import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  path: string;
  timestamp: string;
}

/**
 * Padroniza o corpo de erro de toda a API e evita vazar detalhes internos
 * (stack trace, mensagem de driver de banco) em respostas de producao:
 * qualquer excecao que nao seja HttpException vira um 500 generico, e o
 * detalhe real vai apenas para o log do servidor.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = isHttpException ? this.extractMessage(exception) : 'Erro interno do servidor.';

    if (!isHttpException) {
      this.logger.error(
        `Excecao nao tratada em ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiErrorResponse = {
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }

  /**
   * HttpException carrega a mensagem como string ou como objeto (caso do
   * ValidationPipe, que devolve um array de erros de validacao).
   */
  private extractMessage(exception: HttpException): string | string[] {
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return payload;
    }

    const message = (payload as { message?: string | string[] }).message;
    return message ?? exception.message;
  }
}
