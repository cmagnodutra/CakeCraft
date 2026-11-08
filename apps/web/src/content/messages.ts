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
    builder: 'Montar bolo',
    myOrders: 'Meus pedidos',
    login: 'Entrar',
    register: 'Criar conta',
    adminKanban: 'Produção',
    adminCatalog: 'Catálogo',
    adminReports: 'Relatórios',
    profile: 'Minha conta',
    logout: 'Sair',
  },
  landing: {
    eyebrow: 'Confeitaria artesanal sob medida · PIX em tempo real',
    titleStart: 'Seu bolo, do seu jeito,',
    titleAccent: 'com o preço na hora.',
    body: 'Monte o seu bolo camada por camada, veja o valor a cada escolha e acompanhe o pedido até a retirada, sem esperar orçamento por mensagem.',
    cta: 'Criar minha conta',
    builderCta: 'Montar meu bolo agora',
    highlights: [
      { value: '1 a 4 andares', label: 'Estrutura validada na hora' },
      { value: 'Zero surpresa', label: 'Preço e fatias em tempo real' },
      { value: '100% seguro', label: 'Alerta automático de alergênicos' },
    ],
    showcase: {
      badge: 'Vitrine 3D interativa',
      dragHint: 'Arraste o bolo com o mouse para girar em 360°',
      presetsAriaLabel: 'Combinações de inspiração da confeitaria',
      figureAriaLabel: (presetLabel: string, floors: number) =>
        `Modelo 3D interativo de bolo artesanal de ${floors} andares na combinação ${presetLabel}`,
      compositionLabel: 'Camadas da combinação',
      servingsLabel: 'Rendimento',
      priceLabel: 'Valor de referência',
      customizeHint:
        'Alterne os estilos acima para visualizar ou abra o montador 3D para escolher cada insumo.',
      presets: {
        rose: {
          label: 'Rosé & Frutas',
          plaque: 'Parabéns, Marina!',
          floors: 3,
          composition: 'Massa estruturada · Redução de frutas vermelhas · Chantilly rosé',
          servings: '2,8 kg (~28 fatias)',
          price: 'R$ 284,00',
        },
        pistachio: {
          label: 'Baunilha & Pistache',
          plaque: 'Celebração Especial',
          floors: 2,
          composition: 'Massa de baunilha · Creme de pistache · Cobertura acetinada',
          servings: '2,2 kg (~22 fatias)',
          price: 'R$ 228,00',
        },
        cocoa: {
          label: 'Cacau & Caramelo',
          plaque: 'Feliz Aniversário',
          floors: 3,
          composition: 'Massa de cacau · Brigadeiro belga e caramelo · Ganache intensa',
          servings: '3,1 kg (~31 fatias)',
          price: 'R$ 312,00',
        },
      },
    },
    stepsSection: {
      eyebrow: 'Como funciona',
      title: 'Do rascunho em 3D à retirada na confeitaria, tudo em minutos.',
      steps: [
        {
          number: '01',
          title: 'Monte cada andar em 3D',
          description:
            'Escolha formato, quantidade de andares, massas, até dois recheios por camada, cor da cobertura e mensagem de topo.',
        },
        {
          number: '02',
          title: 'Confira fatias, preço e pague via PIX',
          description:
            'Veja o peso total, o rendimento estimado em fatias e o valor atualizado na hora. Confirme o pedido e pague com QR Code PIX instantâneo.',
        },
        {
          number: '03',
          title: 'Acompanhe o preparo na cozinha',
          description:
            'Seu pedido entra direto na fila de produção ao vivo até ficar pronto para entrega ou retirada, somando pontos no Clube CakeCraft.',
        },
      ],
    },
    craftSection: {
      eyebrow: 'Cuidado em cada detalhe',
      title: 'Regras reais de confeitaria aplicadas enquanto você monta.',
      pillars: [
        {
          title: 'Sustentação estrutural garantida',
          description:
            'Em bolos de 3 ou 4 andares, o sistema orienta massas estruturadas automaticamente para manter firmeza e acabamento impecável.',
        },
        {
          title: 'Filtro inteligente de alergênicos',
          description:
            'Marque restrições como sem lactose, sem glúten ou sem castanhas e receba sugestões imediatas de insumos compatíveis.',
        },
        {
          title: 'Personalização com papel de arroz',
          description:
            'Adicione frase comemorativa no topo e envie sua própria arte em PNG, JPEG ou WEBP validada na hora.',
        },
        {
          title: 'Clube de fidelidade CakeCraft',
          description:
            'Acumule XP automaticamente a cada encomenda concluída e acompanhe sua evolução de nível direto no perfil.',
        },
      ],
    },
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
      ruleHint: 'Você ganha 10 XP a cada R$ 10,00 em pedidos pagos. A cada 1000 XP, sobe de nível!',
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
    unauthenticatedBody: 'Entre com uma conta administrativa para gerenciar o catálogo de insumos.',
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
  builder: {
    title: 'Montador de bolo',
    subtitle:
      'Escolha formato, andares, massas, recheios e cobertura com cálculo de preço na hora e visualização 3D interativa.',
    loadingCatalog: 'Carregando catálogo da confeitaria...',
    emptyCatalog:
      'Ainda não há insumos ativos suficientes no catálogo (massa, recheio e cobertura) para montar um bolo.',
    preview: {
      title: 'Pré-visualização 3D',
      figureLabel: (floors: number, formatLabel: string, colorHex: string) =>
        `Bolo ${formatLabel.toLowerCase()} de ${floors} ${floors === 1 ? 'andar' : 'andares'} com cobertura ${colorHex}`,
      rotateLeft: 'Girar à esquerda',
      rotateRight: 'Girar à direita',
      resetAngle: 'Centralizar',
      dragHint: 'Arraste o bolo com o mouse ou o dedo para girar livremente em 360°.',
      angleBadge: (degrees: number) => `Ângulo ${degrees}°`,
      ricePaperBadge: 'Arte em papel de arroz aplicada no topo',
    },
    structureSection: {
      title: 'Estrutura e acabamento',
      formatLabel: 'Formato do bolo',
      formats: {
        REDONDO: 'Redondo',
        QUADRADO: 'Quadrado',
        RETANGULAR: 'Retangular',
      },
      floorsLabel: 'Quantidade de andares',
      floorOption: (count: number) => (count === 1 ? '1 andar' : `${count} andares`),
      colorLabel: 'Cor da cobertura (HEX)',
      colorPickerLabel: 'Seletor visual de cor da cobertura',
      swatchesLabel: 'Tons clássicos da confeitaria',
    },
    dietarySection: {
      title: 'Restrições alimentares',
      hint: 'Marque restrições para validarmos automaticamente possíveis alergênicos nos insumos escolhidos (RF06).',
      options: {
        lactose: 'Sem lactose / leite',
        gluten: 'Sem glúten',
        ovos: 'Sem ovos',
        castanhas: 'Sem castanhas',
        amendoim: 'Sem amendoim',
        soja: 'Sem soja',
      },
      conflictTitle: 'Conflito de alergênicos detectado',
      conflictDetail: (
        floorNumber: number,
        ingredientName: string,
        restrictionLabel: string,
        substituteName?: string,
      ) =>
        substituteName
          ? `${floorNumber}º andar: "${ingredientName}" conflita com "${restrictionLabel}". Sugestão compatível: ${substituteName}.`
          : `${floorNumber}º andar: "${ingredientName}" conflita com "${restrictionLabel}". Nenhum substituto ativo sem esse alergênico nesta categoria.`,
    },
    floorsSection: {
      title: 'Camadas por andar',
      floorHeading: (floorNumber: number) =>
        floorNumber === 1 ? '1º andar (base)' : `${floorNumber}º andar`,
      weightLabel: 'Peso estimado (kg)',
      doughLabel: 'Massa',
      coverageLabel: 'Cobertura',
      fillingsLabel: 'Recheios (até 2 por andar)',
      aeratedBlockedTag: 'Indisponível acima de 2 andares (RN01)',
      aeratedAutoAdjusted:
        'Para bolos com 3 ou 4 andares, massas aeradas foram substituídas automaticamente por massas estruturadas para garantir sustentação (RN01).',
      aeratedManualError:
        'Bolos com mais de 2 andares não suportam massas aeradas por risco estrutural (RN01). Escolha uma massa estruturada.',
      fillingsCountError: 'Escolha pelo menos 1 e no máximo 2 recheios em cada andar.',
    },
    personalizationSection: {
      title: 'Personalização e entrega',
      toppingMessageLabel: 'Mensagem de topo (opcional)',
      toppingMessageHint: 'Até 120 caracteres (ex.: Parabéns, Marina!).',
      ricePaperLabel: 'Arte para papel de arroz (opcional — PNG, JPEG ou WEBP até 5 MB)',
      ricePaperUploading: 'Validando e enviando imagem...',
      ricePaperUploaded: 'Imagem validada e anexada ao pedido.',
      removeRicePaper: 'Remover imagem',
      deliveryAddressLabel: 'Endereço de entrega ou observação de retirada (opcional)',
    },
    quoteSection: {
      title: 'Orçamento em tempo real',
      calculating: 'Atualizando orçamento...',
      floorItem: (floorNumber: number, weightFormatted: string) =>
        `${floorNumber}º andar (${weightFormatted} kg)`,
      totalWeightLabel: 'Peso total e rendimento estimado',
      servingsEstimate: (weightFormatted: string, slices: number) =>
        `${weightFormatted} kg (~${slices} fatias de 100g)`,
      assemblyFee: 'Taxa base de montagem artesanal',
      total: 'Total do pedido',
      pixNotice: 'Pagamento via PIX (Asaas) com QR Code válido por 15 minutos após confirmar.',
      guestNotice:
        'Seu rascunho está salvo nesta aba. Entre ou crie sua conta para gerar o QR Code PIX e enviar o pedido.',
      loginToCheckout: 'Entrar para finalizar pedido',
      registerToCheckout: 'Criar conta',
      submitOrder: 'Finalizar pedido e gerar PIX',
      resetDraft: 'Restaurar configuração inicial',
    },
    errors: {
      catalogLoad: 'Não foi possível carregar o catálogo de insumos. Tente novamente.',
      pricingFailed: 'Não foi possível calcular o orçamento desta combinação.',
      uploadFailed: 'Imagem recusada. Envie um arquivo PNG, JPEG ou WEBP autêntico com até 5 MB.',
      orderFailed:
        'Não foi possível registrar o pedido. Revise as camadas e restrições selecionadas.',
      network: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente de novo.',
    },
  },
  myOrders: {
    title: 'Meus pedidos',
    subtitle: 'Acompanhe o pagamento via PIX e o progresso artesanal de cada encomenda na cozinha.',
    newCakeCta: 'Montar novo bolo',
    loadingMessage: 'Carregando seus pedidos...',
    unauthenticatedTitle: 'Entre para consultar seus pedidos',
    unauthenticatedBody:
      'Acesse sua conta para visualizar códigos PIX pendentes, acompanhar o preparo na cozinha ou gerenciar encomendas.',
    goToLogin: 'Entrar',
    goToBuilder: 'Montar um bolo',
    emptyTitle: 'Nenhum pedido por aqui ainda',
    emptyBody: 'Monte seu primeiro bolo sob medida e acompanhe tudo em tempo real.',
    createdBanner:
      'Pedido registrado com sucesso! Realize o pagamento via PIX em até 15 minutos para enviá-lo automaticamente à fila da cozinha.',
    orderTitle: (shortId: string) => `Pedido #${shortId}`,
    createdAt: (formattedDate: string) => `Registrado em ${formattedDate}`,
    cakeSummary: (formatLabel: string, floorsCount: number) =>
      floorsCount === 1 ? `${formatLabel} · 1 andar` : `${formatLabel} · ${floorsCount} andares`,
    toppingPrefix: 'Mensagem de topo:',
    deliveryPrefix: 'Entrega / retirada:',
    dietaryPrefix: 'Restrições declaradas:',
    ricePaperLink: 'Abrir arte do papel de arroz',
    itemsHeading: 'Insumos registrados no pedido',
    status: {
      AGUARDANDO_PAGAMENTO: 'Aguardando pagamento PIX',
      EM_ESPERA: 'Pago · Na fila da cozinha',
      EM_PRODUCAO: 'Em preparo na cozinha',
      FINALIZACAO: 'Em acabamento e confeitaria',
      PRONTO: 'Pronto para retirada / entrega',
      ENTREGUE: 'Entregue / retirado',
      CANCELADO: 'Cancelado',
    },
    paymentStatus: {
      PENDENTE: 'PIX aguardando pagamento',
      PAGO: 'Pagamento PIX confirmado',
      EXPIRADO: 'QR Code PIX expirado',
      ESTORNADO: 'Pagamento estornado',
    },
    pix: {
      title: 'Pagamento instantâneo via PIX',
      qrAlt: (shortId: string) => `QR Code PIX do pedido ${shortId}`,
      expiresAt: (formattedTime: string) => `Expira às ${formattedTime}`,
      copyPasteLabel: 'Código PIX Copia e Cola',
      copyButton: 'Copiar código PIX',
      copiedFeedback: 'Código PIX copiado para a área de transferência.',
      expiredNotice:
        'O prazo de 15 minutos deste QR Code expirou. Gere uma nova cobrança PIX ou cancele o pedido sem custo.',
      regenerateButton: 'Gerar novo código PIX',
      regeneratedFeedback: 'Novo QR Code PIX emitido com validade de 15 minutos.',
    },
    actions: {
      cancelOrder: 'Cancelar pedido',
      cancelledFeedback: 'Pedido cancelado com sucesso.',
    },
    errors: {
      loadFailed: 'Não foi possível carregar seus pedidos. Tente novamente.',
      actionFailed: 'Não foi possível concluir a operação neste pedido. Tente novamente.',
      copyFailed: 'Não foi possível copiar automaticamente. Copie o código exibido no campo.',
      network: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente de novo.',
    },
  },
  adminKanban: {
    title: 'Quadro de produção da cozinha',
    subtitle:
      'Fila em tempo real de pedidos pagos (RN03), com alertas de restrições alimentares, arte de papel de arroz e conclusão com disparo de XP (UC04 / UC02).',
    loadingMessage: 'Carregando fila de produção da cozinha...',
    unauthenticatedTitle: 'Acesso restrito à cozinha',
    unauthenticatedBody:
      'Entre com uma conta administrativa para acompanhar e movimentar o Kanban de produção.',
    forbiddenTitle: 'Permissão insuficiente',
    forbiddenBody: 'Esta área é exclusiva para a equipe administrativa da confeitaria.',
    goToLogin: 'Entrar',
    backHome: 'Voltar ao início',
    liveBadge: 'Sincronizado em tempo real',
    refreshButton: 'Atualizar fila',
    searchPlaceholder: 'Buscar por cliente, código (#id) ou frase do topo...',
    searchAriaLabel: 'Buscar pedidos na cozinha',
    modalityFilterLabel: 'Modalidade:',
    modalities: {
      ALL: 'Todos',
      DELIVERY: 'Com endereço / entrega',
      PICKUP: 'Retirada no balcão',
    },
    columns: {
      EM_ESPERA: 'Em espera',
      EM_PRODUCAO: 'Em produção',
      FINALIZACAO: 'Finalização',
      PRONTO: 'Pronto',
    },
    emptyColumn: 'Nenhum pedido nesta etapa.',
    cardTitle: (shortId: string) => `#${shortId}`,
    customerPrefix: 'Cliente:',
    dietaryAlertPrefix: 'Atenção alergênicos:',
    toppingPrefix: 'Topo:',
    deliveryPrefix: 'Entrega:',
    ricePaperLink: 'Ver arte papel de arroz',
    layerLine: (floor: number, weightKg: string, dough: string, fillings: string, cov: string) =>
      `${floor}º andar (${weightKg} kg): ${dough} · ${fillings} · ${cov}`,
    actions: {
      startProduction: 'Iniciar preparo',
      backToWaiting: 'Voltar à espera',
      moveToFinishing: 'Enviar para finalização',
      backToProduction: 'Voltar ao preparo',
      markReady: 'Marcar como pronto',
      confirmDelivered: 'Confirmar entrega',
      cancelAndRefund: 'Cancelar e estornar',
    },
    feedback: {
      moved: (shortId: string, columnLabel: string) =>
        `Pedido #${shortId} movido para "${columnLabel}".`,
      markedReady: (shortId: string) =>
        `Pedido #${shortId} marcado como pronto! Cliente notificado e pontos de XP creditados.`,
      delivered: (shortId: string) => `Entrega do pedido #${shortId} registrada com sucesso.`,
      cancelled: (shortId: string) =>
        `Pedido #${shortId} cancelado com solicitação de estorno PIX.`,
    },
    errors: {
      loadFailed: 'Não foi possível carregar o quadro de produção.',
      transitionFailed: 'Não foi possível atualizar a etapa deste pedido.',
      network: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente de novo.',
    },
  },
  adminReports: {
    title: 'Relatórios financeiros',
    subtitle:
      'Fechamento financeiro por período com receita confirmada via PIX, total de pedidos pagos, ticket médio e exportação CSV em 1 clique (UC06 / RF10).',
    loadingMessage: 'Calculando indicadores financeiros...',
    unauthenticatedTitle: 'Acesso restrito à gestão',
    unauthenticatedBody:
      'Entre com uma conta administrativa para consultar os relatórios financeiros da confeitaria.',
    forbiddenTitle: 'Permissão insuficiente',
    forbiddenBody: 'Esta área é exclusiva para administradores da confeitaria.',
    goToLogin: 'Entrar',
    backHome: 'Voltar ao início',
    filterForm: {
      fromLabel: 'Data inicial',
      toLabel: 'Data final',
      applyButton: 'Aplicar período',
      exportCsvButton: 'Exportar CSV',
      presetsLabel: 'Atalhos rápidos:',
      presets: {
        TODAY: 'Hoje',
        LAST_7_DAYS: 'Últimos 7 dias',
        LAST_30_DAYS: 'Últimos 30 dias',
        CURRENT_MONTH: 'Mês atual',
      },
    },
    kpis: {
      totalRevenue: 'Receita confirmada (PIX)',
      paidOrders: 'Pedidos pagos no período',
      averageTicket: 'Ticket médio',
    },
    table: {
      heading: 'Pedidos liquidados no período',
      empty: 'Nenhum pedido pago encontrado no intervalo selecionado.',
      colOrder: 'Pedido',
      colPaidAt: 'Pago em',
      colCustomer: 'Cliente',
      colStatus: 'Status atual',
      colFormat: 'Configuração',
      colAmount: 'Valor',
    },
    feedback: {
      csvExported: 'Relatório CSV gerado e baixado com sucesso.',
    },
    errors: {
      invalidDateRange:
        'A data inicial não pode ser maior que a data final. Ajuste o período antes de continuar.',
      loadFailed:
        'Não foi possível carregar o relatório financeiro. Verifique o intervalo de datas.',
      exportFailed: 'Não foi possível exportar o arquivo CSV agora. Tente novamente.',
      network: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente de novo.',
    },
  },
} as const;
