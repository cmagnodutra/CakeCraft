/**
 * Textos da interface em pt-BR, centralizados em um unico arquivo (decisao
 * do projeto). Trocar de idioma no futuro significa criar outro arquivo com
 * a mesma forma, e nao cacar string espalhada pelos componentes.
 *
 * Aqui os textos usam acentos normalmente: sao conteudo para o usuario. Os
 * comentarios de codigo seguem em ASCII, como no resto do repositorio.
 */
export const messages = {
  brand: {
    name: 'CakeCraft',
    tagline: 'Monte seu bolo, veja o preço na hora e acompanhe a produção.',
  },
  common: {
    loading: 'Carregando',
  },
  a11y: {
    skipToContent: 'Pular para o conteúdo',
  },
  landing: {
    titleStart: 'Seu bolo, do seu jeito,',
    titleAccent: 'com o preço na hora.',
    body: 'Monte o seu bolo camada por camada, veja o valor a cada escolha e acompanhe o pedido até a retirada, sem esperar orçamento por mensagem.',
    cta: 'Criar minha conta',
  },
  auth: {
    register: {
      title: 'Criar conta',
      intro: 'Crie sua conta para montar o seu bolo, ver o preço na hora e acompanhar o pedido.',
      fields: {
        name: 'Nome',
        email: 'E-mail',
        phone: 'Telefone (opcional)',
        password: 'Senha',
      },
      hints: {
        phone: 'Com DDD, por exemplo (47) 99999-9999.',
        password: 'Mínimo de 8 caracteres.',
      },
      submit: 'Criar conta',
      // Erros de preenchimento, mostrados no campo antes de chamar a API.
      validation: {
        name: 'Informe seu nome, com pelo menos 2 letras.',
        email: 'Informe um e-mail válido.',
        password: 'A senha precisa ter pelo menos 8 caracteres.',
        phone: 'Informe o telefone com DDD, por exemplo (47) 99999-9999.',
      },
      // Erros vindos da API. A API responde em ingles e sem acento, entao o
      // usuario nunca ve a mensagem dela: cada situacao tem o texto daqui.
      errors: {
        emailTaken: 'Já existe uma conta com este e-mail.',
        invalidData: 'Não foi possível criar a conta. Confira os dados e tente de novo.',
        tooManyRequests: 'Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.',
        server: 'Algo deu errado do nosso lado. Tente novamente em instantes.',
        network: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente de novo.',
        unexpected: 'Ocorreu um erro inesperado. Tente novamente.',
      },
      success: {
        title: 'Conta criada',
        welcome: (firstName: string) => `Tudo pronto, ${firstName}. Sua conta foi criada.`,
        backHome: 'Voltar ao início',
      },
    },
  },
} as const;
