import { messages } from '@/content/messages';
import { ApiError, NetworkError } from '@/lib/api/errors';

const texts = messages.auth.register.errors;

export interface RegisterErrorDescription {
  /** Campo ao qual o erro pertence; sem campo, e um aviso geral do formulario. */
  field?: 'email';
  message: string;
}

/**
 * Traduz o que deu errado no cadastro para o texto de tela em pt-BR.
 * Nunca repassa a mensagem da API: ela vem em ingles e sem acento, e isso
 * seria texto de desenvolvedor na frente do usuario.
 */
export function describeRegisterError(error: unknown): RegisterErrorDescription {
  if (error instanceof NetworkError) {
    return { message: texts.network };
  }

  if (error instanceof ApiError) {
    if (error.status === 409) {
      // E-mail ja cadastrado: o usuario precisa ver isso no campo e-mail.
      return { field: 'email', message: texts.emailTaken };
    }
    if (error.status === 400) {
      return { message: texts.invalidData };
    }
    if (error.status === 429) {
      return { message: texts.tooManyRequests };
    }
    if (error.status >= 500) {
      return { message: texts.server };
    }
  }

  return { message: texts.unexpected };
}
