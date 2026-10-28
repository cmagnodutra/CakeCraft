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
  nav: {
    ariaLabel: 'Navegação principal',
    login: 'Entrar',
    register: 'Criar conta',
    adminCatalog: 'Catálogo',
    profile: 'Minha conta',
    logout: 'Sair',
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
      alreadyHaveAccount: 'Já tem uma conta?',
      loginLink: 'Entrar',
      // Erros de preenchimento, mostrados no campo antes de chamar a API.
      validation: {
        name: 'Informe seu nome, com pelo menos 2 letras.',
        email: 'Informe um e-mail válido.',
        password: 'A senha precisa ter pelo menos 8 caracteres.',
        passwordMax: 'A senha não pode passar de 72 bytes (cerca de 72 caracteres sem acento).',
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
        goToProfile: 'Ir para minha conta',
        backHome: 'Voltar ao início',
      },
    },
    login: {
      title: 'Entrar',
      intro: 'Entre na sua conta para montar seus bolos e acompanhar seus pedidos.',
      fields: {
        email: 'E-mail',
        password: 'Senha',
      },
      forgotPasswordLink: 'Esqueceu sua senha?',
      noAccount: 'Ainda não tem conta?',
      registerLink: 'Criar conta',
      submit: 'Entrar',
      validation: {
        email: 'Informe um e-mail válido.',
        password: 'A senha precisa ter pelo menos 8 caracteres.',
        passwordMax: 'A senha não pode passar de 72 bytes (cerca de 72 caracteres sem acento).',
      },
      errors: {
        invalidCredentials: 'E-mail ou senha incorretos.',
        invalidData: 'Confira seu e-mail e sua senha e tente novamente.',
        tooManyRequests: 'Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.',
        server: 'Algo deu errado do nosso lado. Tente novamente em instantes.',
        network: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente de novo.',
        unexpected: 'Ocorreu um erro inesperado. Tente novamente.',
      },
    },
    forgotPassword: {
      title: 'Recuperar senha',
      intro:
        'Informe o e-mail da sua conta. Se ele estiver cadastrado, enviaremos um link válido por 15 minutos para redefinir sua senha.',
      fields: {
        email: 'E-mail',
      },
      submit: 'Enviar link de recuperação',
      backToLogin: 'Voltar para o login',
      validation: {
        email: 'Informe um e-mail válido.',
      },
      errors: {
        invalidData: 'Informe um e-mail válido.',
        tooManyRequests: 'Muitas solicitações seguidas. Aguarde um instante e tente novamente.',
        server: 'Algo deu errado do nosso lado. Tente novamente em instantes.',
        network: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente de novo.',
        unexpected: 'Ocorreu um erro inesperado. Tente novamente.',
      },
      success: {
        title: 'Verifique seu e-mail',
        message: (email: string) =>
          `Se existir uma conta associada a ${email}, você receberá em instantes as instruções para criar uma nova senha.`,
        backToLogin: 'Voltar para o login',
      },
    },
    resetPassword: {
      title: 'Nova senha',
      intro:
        'Escolha uma nova senha para acessar sua conta. Suas sessões anteriores serão encerradas por segurança.',
      missingTokenTitle: 'Link inválido',
      missingTokenBody:
        'Este link de recuperação está incompleto ou inválido. Solicite um novo link para redefinir sua senha.',
      requestNewLink: 'Solicitar novo link',
      fields: {
        newPassword: 'Nova senha',
        confirmPassword: 'Confirmar nova senha',
      },
      hints: {
        newPassword: 'Mínimo de 8 caracteres.',
      },
      submit: 'Salvar nova senha',
      validation: {
        newPassword: 'A nova senha precisa ter pelo menos 8 caracteres.',
        newPasswordMax: 'A senha não pode passar de 72 bytes (cerca de 72 caracteres sem acento).',
        confirmPassword: 'A confirmação precisa ser igual à nova senha.',
      },
      errors: {
        invalidOrExpiredToken:
          'Este link expirou ou já foi utilizado. Solicite um novo link de recuperação.',
        tooManyRequests: 'Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.',
        server: 'Algo deu errado do nosso lado. Tente novamente em instantes.',
        network: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente de novo.',
        unexpected: 'Ocorreu um erro inesperado. Tente novamente.',
      },
      success: {
        title: 'Senha redefinida',
        message:
          'Sua senha foi atualizada com sucesso. Agora você já pode entrar com a nova senha.',
        goToLogin: 'Entrar na minha conta',
      },
    },
  },
  profile: {
    title: 'Minha conta',
    loadingMessage: 'Carregando dados da sua conta...',
    unauthenticatedTitle: 'Entre para acessar sua conta',
    unauthenticatedBody:
      'Sua sessão não está ativa. Entre ou crie uma conta para ver seu perfil, nível de fidelidade e preferências de privacidade.',
    goToLogin: 'Entrar',
    goToRegister: 'Criar conta',
    roles: {
      CLIENTE: 'Cliente',
      ADMIN: 'Confeitaria (Admin)',
    },
    accountSection: {
      title: 'Dados cadastrais',
      nameLabel: 'Nome',
      emailLabel: 'E-mail',
      roleLabel: 'Perfil',
    },
    gamificationSection: {
      title: 'Clube CakeCraft',
      levelBadge: (level: number) => `Nível ${level}`,
      xpSummary: (xp: number) => `${xp} XP acumulados`,
      progressDetail: (currentLevelXp: number, remainingXp: number, nextLevel: number) =>
        `${currentLevelXp} / 1000 XP — faltam ${remainingXp} XP para o Nível ${nextLevel}`,
      ruleHint:
        'Você ganha 10 XP a cada R$ 10,00 em pedidos pagos. A cada 1000 XP, sobe de nível!',
    },
    sessionSection: {
      title: 'Sessão',
      logoutButton: 'Sair desta conta',
    },
    privacySection: {
      title: 'Privacidade e LGPD',
      description:
        'Você pode solicitar a anonimização definitiva dos seus dados pessoais (nome, e-mail, telefone e endereços de entrega). O histórico contábil dos pedidos é mantido sem identificação pessoal, conforme a legislação fiscal e a LGPD.',
      requestButton: 'Excluir e anonimizar minha conta',
      confirmWarning:
        'Esta ação é irreversível: seu acesso será encerrado imediatamente e não será possível recuperar sua conta nem seus pontos de fidelidade.',
      confirmButton: 'Confirmar anonimização definitiva',
      cancelButton: 'Cancelar',
      anonymizedTitle: 'Conta anonimizada',
      anonymizedMessage: 'Seus dados pessoais foram anonimizados e sua sessão foi encerrada.',
      backHome: 'Voltar ao início',
    },
    errors: {
      anonymizeFailed: 'Não foi possível concluir a anonimização agora. Tente novamente.',
      network: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente de novo.',
    },
  },
  adminCatalog: {
    title: 'Catálogo de insumos',
    subtitle:
      'Gerencie massas, recheios e coberturas, valores por quilo, estrutura aerada (RN01) e alertas de alergênicos (RF06).',
    loadingMessage: 'Carregando catálogo administrativo...',
    unauthenticatedTitle: 'Acesso restrito à confeitaria',
    unauthenticatedBody:
      'Entre com uma conta administrativa para gerenciar o catálogo de insumos.',
    forbiddenTitle: 'Permissão insuficiente',
    forbiddenBody: 'Esta área é exclusiva para administradores da confeitaria.',
    goToLogin: 'Entrar',
    backHome: 'Voltar ao início',
    filtersLabel: 'Filtrar insumos por categoria',
    filters: {
      ALL: 'Todos',
      MASSA: 'Massas',
      RECHEIO: 'Recheios',
      COBERTURA: 'Coberturas',
    },
    types: {
      MASSA: 'Massa',
      RECHEIO: 'Recheio',
      COBERTURA: 'Cobertura',
    },
    status: {
      active: 'Ativo',
      inactive: 'Inativo',
    },
    badges: {
      aerated: 'Massa aerada (máx. 2 andares)',
      noAllergens: 'Sem alergênicos declarados',
      allergensPrefix: 'Alergênicos:',
    },
    actions: {
      newIngredient: 'Novo insumo',
      edit: 'Editar',
      deactivate: 'Inativar',
      reactivate: 'Reativar',
      cancel: 'Cancelar',
      saveNew: 'Cadastrar insumo',
      saveEdit: 'Salvar alterações',
    },
    form: {
      createTitle: 'Novo insumo',
      editTitle: 'Editar insumo',
      nameLabel: 'Nome do insumo',
      typeLabel: 'Categoria',
      pricePerKgLabel: 'Preço por quilo (R$/kg)',
      allergensLabel: 'Alergênicos (separados por vírgula)',
      allergensHint: 'Exemplo: leite, glúten, ovos, castanhas.',
      isAeratedLabel: 'Massa aerada (bloqueada em bolos com mais de 2 andares — RN01)',
    },
    validation: {
      name: 'Informe o nome do insumo (mínimo de 2 caracteres).',
      pricePerKg: 'Informe um valor por quilo válido (maior ou igual a zero).',
    },
    feedback: {
      created: (name: string) => `Insumo "${name}" cadastrado com sucesso.`,
      updated: (name: string) => `Insumo "${name}" atualizado com sucesso.`,
      deactivated: (name: string) =>
        `Insumo "${name}" inativado (histórico de pedidos preservado).`,
      reactivated: (name: string) => `Insumo "${name}" reativado no catálogo público.`,
    },
    emptyMessage: 'Nenhum insumo encontrado nesta categoria.',
    errors: {
      loadFailed: 'Não foi possível carregar o catálogo. Tente novamente.',
      saveFailed: 'Não foi possível salvar o insumo. Confira os dados e tente novamente.',
      network: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente de novo.',
    },
  },
} as const;
