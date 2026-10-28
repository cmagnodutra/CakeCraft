RFC-001

# CakeCraft

## Plataforma Web de Confeitaria Customizada

Request for Comments — Projeto de Portfólio

## Engenharia de Software – Católica SC

Carlos Magno Dutra da Silva Filho Junho / 2026 · Versão 1.4


## Sumário

[Sumário ..................................................................................................................................... 2](#page-0)

[Identificação .............................................................................................................................. 4](#page-0)

[1. Visão do Produto e Impacto (O Problema)................................................................................ 5](#page-0)

[1.1 Contexto e Problema ......................................................................................................... 5](#page-0)

[1.2 Origem da Demanda e Evidências ...................................................................................... 5](#page-0)

[Demanda Externa ................................................................................................................ 5](#page-0)

[Pesquisa com Usuários ....................................................................................................... 5](#page-0)

[Evidência de Interesse ......................................................................................................... 6](#page-0)

[1.3 Análise de Soluções Existentes (Benchmark)...................................................................... 6](#page-0)

[Comparação ........................................................................................................................ 7](#page-0)

[Diferencial do Projeto .......................................................................................................... 7](#page-0)

[1.4 Público-Alvo ...................................................................................................................... 7](#page-0)

[1.5 Objetivos do Projeto .......................................................................................................... 8](#page-0)

[Objetivo Geral ..................................................................................................................... 8](#page-0)

[Objetivos Específicos .......................................................................................................... 8](#page-0)

[1.6 Métricas de Sucesso (KPIs) ................................................................................................ 8](#page-0)

[2. Engenharia de Requisitos ....................................................................................................... 9](#page-0)

[2.1 Personas ........................................................................................................................... 9](#page-0)

[2.2 Casos de Uso Principais .................................................................................................... 9](#page-0)

[Detalhamento dos Casos de Uso Principais ........................................................................ 10](#page-0)

[2.3 Requisitos Funcionais (RF) .............................................................................................. 11](#page-0)

[2.4 Requisitos Não Funcionais (RNF) ..................................................................................... 12](#page-0)

[2.5 Regras de Negócio ........................................................................................................... 12](#page-0)

[2.6 Fora do Escopo ................................................................................................................ 12](#page-0)

[3. Fluxos e Comportamento do Sistema .................................................................................... 13](#page-0)

[3.1 Fluxo Principal do Usuário .............................................................................................. 13](#page-0)

[3.2 Fluxos Alternativos.......................................................................................................... 14](#page-0)

[4. Mockups e Experiência do Usuário (UX) ................................................................................ 16](#page-0)

[4.1 Fluxo de Navegação ......................................................................................................... 16](#page-0)

[4.2 Wireframes ou Mockups das Telas .................................................................................. 17](#page-0)

[4.3 Fluxo de Interação do Usuário ......................................................................................... 19](#page-0)

[4.4 Feedback Inicial de Usuários (Opcional) .......................................................................... 20](#page-0)

[5. Arquitetura do Sistema ......................................................................................................... 20](#page-0)

[5.1 Diagrama C4 ................................................................................................................... 20](#page-0)

[Nível 1 — Diagrama de Contexto ........................................................................................ 20](#page-0)

[Nível 2 — Diagrama de Containers ..................................................................................... 21](#page-0)

[Nível 3 — Diagrama de Componentes ................................................................................. 21](#page-0)

[5.2 Modelo de Dados ............................................................................................................. 22](#page-0)


5.3 Principais Componentes .................................................................................................. 22 5.4 Stack Tecnológica ........................................................................................................... 23 6. Segurança e Privacidade ....................................................................................................... 24 6.1 Privacidade e LGPD ......................................................................................................... 24 7. Planejamento do Projeto ....................................................................................................... 25 Detalhamento por Ciclo ..................................................................................................... 25 8. Referências .......................................................................................................................... 26 9. Apêndices ............................................................................................................................ 27 Apêndice A — Matriz SWOT .................................................................................................. 27 Apêndice B — Estratégia de Qualidade e Testes (TDD) ........................................................... 27 10. Parecer do Comitê de Avaliação .......................................................................................... 28 Avaliador 1 ........................................................................................................................ 28 Avaliador 2 ........................................................................................................................ 28 [URL 🔗](#page-0)

Avaliador 3 ............................................................................. Erro! Indicador não definido.


## Identificação

| Campo | Informação |
| --- | --- |
| Título do Projeto | CakeCraft — Plataforma Web B2C para Montagem de Bolos Customizados |
| Linha de Projeto (Direction) | Web / E-commerce B2C e Gestão de Pedidos |
| Autor | Carlos Magno Dutra da Silva Filho |
| Disciplina | Engenharia de Software (PAC VII) |
| Data da Proposta | Junho / 2026 |
| Versão | 1.4 — Adequação Estrutural ao Modelo Oficial de RFC |


## 1. Visão do Produto e Impacto (O Problema)

Esta seção responde à pergunta fundamental que antecede qualquer decisão técnica: o CakeCraft resolve um problema real de mercado ou trata-se apenas de um exercício técnico? As evidências apresentadas a seguir demonstram que a dor identificada é real, mensurável e validada diretamente com os dois lados do ecossistema — confeitarias artesanais (oferta) e clientes finais (demanda).

## 1.1 Contexto e Problema

O mercado de confeitaria artesanal e sob encomenda, especialmente no setor de eventos e celebrações, sofre com um gargalo operacional crônico: a comunicação não estruturada. Atualmente, o processo de captação de pedidos na esmagadora maioria das confeitarias de médio porte ocorre via aplicativos de mensagens instantâneas, sem qualquer camada de estruturação de dados entre o desejo do cliente e a produção.

Neste cenário, o cliente inicia o contato descrevendo um desejo abstrato. O confeiteiro, muitas vezes atuando também como gestor e atendente, precisa realizar um processo manual de "entrevista" com o cliente para extrair informações básicas — sabor, tamanho, formato, restrições alimentares — e, em seguida, calcular o orçamento à mão. É exatamente essa solução atual (chat + cálculo manual + planilha paralela) que apresenta as limitações descritas a seguir. Os principais impactos negativos desta abordagem incluem:

- Sobrecarga Operacional: a equipe perde horas semanais apenas calculando orçamentos manuais baseados em frações de quilo e custos flutuantes de insumos.

- Risco de Erro Humano (Refação): pedidos anotados em cadernos ou planilhas descentralizadas frequentemente perdem detalhes cruciais, resultando na perda do produto e dano à reputação.

- Atrito na Conversão (Drop-off): a demora entre a solicitação do cliente e o envio do orçamento final faz com que muitos consumidores desistam da compra.

## 1.2 Origem da Demanda e Evidências

A necessidade da plataforma CakeCraft foi validada por meio de evidência primária, coletada diretamente com o público que vivencia o problema, conforme detalhado nas três frentes a seguir.

## Demanda Externa

O projeto CakeCraft não decorre de uma encomenda formal por parte de uma empresa, ONG ou órgão público específico. Sua origem é orgânica: nasceu da observação direta, pelo autor, do gargalo operacional enfrentado por confeitarias artesanais da região de Joinville/SC durante o atendimento via aplicativos de mensagens. Por essa razão, a validação da demanda apoia-se integralmente em evidência primária — a pesquisa de mercado descrita a seguir — e não em uma solicitação institucional pré-existente.

## Pesquisa com Usuários

Em maio de 2026, foi conduzida uma pesquisa de mercado estruturada no polo comercial de Joinville, SC, totalizando 57 respondentes: 12 confeitarias artesanais de médio porte (público B2B) e 45 clientes recorrentes do nicho de bolos personalizados (público B2C). A coleta combinou questionários estruturados com os confeiteiros e entrevistas rápidas com clientes no momento da retirada de encomendas.

## Evidências quantitativas levantadas:


- Dores das confeitarias (B2B): 83% dos confeiteiros relataram já ter tido prejuízo por conta de detalhes de pedidos perdidos no histórico do WhatsApp. Além disso, a precificação manual consome em média 12 horas semanais da gestão.

- Dores dos consumidores (B2C): 71% dos clientes entrevistados afirmaram que a demora para receber um orçamento (frequentemente superior a 4 horas) é o principal fator de desistência na encomenda de bolos customizados. 90% expressaram interesse em uma ferramenta onde pudessem "montar" o produto visualmente e ver o preço final na hora.

Padrão observado: em ambos os lados do mercado, a causa-raiz é a mesma — ausência de uma camada de estruturação de dados entre o desejo do cliente e a produção. Essa convergência de dores entre oferta e demanda reforça que o problema não é pontual, mas sistêmico ao modelo de atendimento via chat. Estas evidências comprovam que a digitalização do atendimento de produtos customizados por peso não é apenas um luxo, mas uma necessidade latente para

redução de custos e aumento de vendas.

## Evidência de Interesse

Para além das métricas de dor, a pesquisa de campo capturou sinais diretos de interesse na solução proposta:

- 7 das 12 confeitarias entrevistadas (58%) se voluntariaram para atuar como operação piloto assim que uma versão MVP estiver disponível, fornecendo contato direto para testes.

- Aproximadamente 10 dos 20 clientes B2C entrevistados (89%) — alinhado ao índice de 90% de interesse na ferramenta — solicitaram ser adicionados a uma lista de espera informal para acesso antecipado à plataforma.

- 1.3 Análise de Soluções Existentes (Benchmark)

Para posicionar a CakeCraft adequadamente, foram investigadas três soluções existentes que as confeitarias hoje tentam adaptar para suas rotinas de atendimento e produção.

## iFood / Rappi

## Link: ifood.com.br · rappi.com.br

## Público-alvo: consumidores finais de delivery de comida em geral, sem foco em produtos customizados.

## Funcionalidades principais: catálogo estático de produtos prontos, logística própria de entrega e processamento de pagamento integrado.

## Limitações: não suporta customização complexa multicamadas (ex.: escolher a cor do bolo por HEX); cobra taxas de intermediação de até 27%, o que inviabiliza produtos de ticket médio-alto como bolos personalizados.

## Goomer (Cardápio Digital)

Link: goomer.com.br

## Público-alvo: pequenos e médios estabelecimentos de alimentação que precisam de um cardápio digital simples.

## Funcionalidades principais: apresentação de menu B2C via link compartilhável e envio de pedido estruturado via WhatsApp.

## Limitações: não possui motor de cálculo dinâmico baseado em peso ou volumetria estrutural; não oferece Kanban interno de produção para a cozinha.

## WhatsApp Business + Planilhas (Excel/Sheets)


Link: business.whatsapp.com

Público-alvo: pequenos negócios sem software dedicado — perfil da maioria das confeitarias

pesquisadas.

Funcionalidades principais: contato direto com o cliente, respostas rápidas genéricas e controle financeiro paralelo em planilha.

Limitações: totalmente dependente de esforço humano síncrono; elevada taxa de erro na

transferência manual de informações do chat para a planilha de produção.

## Comparação

| Solução | Pontos Fortes | Limitações |
| --- | --- | --- |
| iFood / Rappi | Logística robusta e processamento de pagamento maduro. | Sem customização multicamadas; taxas de intermediação de até 27%. |
| Goomer (Cardápio Digital) | Cardápio digital simples e rápido de implantar. | Sem cálculo dinâmico por peso; sem Kanban de produção. |
| WhatsApp Business + Excel | Custo zero e contato direto/pessoal com o cliente. | Processo manual, síncrono e sujeito a erro humano. |
| CakeCraft (Proposta) | Construtor visual do bolo, preço instantâneo por kg/cm³, Kanban e gamificação integrados. | Curva de aprendizado inicial no construtor por andares. |

## Diferencial do Projeto

Nenhuma das soluções analisadas cobre a jornada completa entre o desejo de customização do cliente e a produção física do bolo na cozinha. Soluções de delivery genéricas (iFood/Rappi) tratam o produto como item de catálogo fixo; ferramentas de cardápio digital (Goomer) estruturam a apresentação, mas não o cálculo de preço variável por insumo; e a combinação WhatsApp + planilha, predominante no setor, depende inteiramente de esforço manual síncrono.

A lacuna identificada está exatamente na ausência de um motor de precificação dinâmica por volumetria/peso combinado a um fluxo de produção em tempo real (Kanban). O nicho específico que a CakeCraft pretende atender é o de confeitarias artesanais de médio porte que vendem produtos customizados por peso e precisam reduzir o atrito entre orçamento e produção — automatizando o atendimento, a precificação e a fila de produção através de três pilares: (1) um Cake Builder dinâmico com preço calculado em tempo real; (2) um motor de gamificação para retenção de clientes; e (3) um design system High-Key minimalista focado em clareza e conversão.

## 1.4 Público-Alvo

O ecossistema atende a duas frentes distintas (plataforma bilateral):

- Público B2B (Backoffice): empreendedores e donos de confeitarias de pequeno e médio porte, que possuem demanda constante de eventos, mas não dispõem de infraestrutura de TI ou ERP especializado em customização.

- Público B2C (Frontend): indivíduos entre 20 e 45 anos, organizadores de eventos sociais (casamentos, aniversários, mesversários) e entusiastas que valorizam personalização, clareza no preço e agilidade no atendimento digital.

Nível de conhecimento técnico esperado: para o público B2C, assume-se apenas familiaridade básica com aplicativos de e-commerce e pagamento via PIX, sem necessidade de conhecimento técnico adicional — a interface do Cake Builder foi desenhada para guiar o usuário passo a passo. Para o público B2B, assume-se conforto mínimo com painéis administrativos web, mas


nenhuma experiência prévia em ERPs complexos é exigida; o Kanban foi desenhado para ser operável por equipes de cozinha sem treinamento técnico formal.

## 1.5 Objetivos do Projeto

## Objetivo Geral

Desenvolver e validar uma plataforma Web SaaS focada no mercado de confeitaria, capaz de automatizar o processo de personalização de produtos, precificação dinâmica e gestão da fila de produção, integrando gamificação para retenção de clientes.

## Objetivos Específicos

- Construir um "Cake Builder" interativo que calcule preços em tempo real com base na volumetria e custo unitário dos ingredientes.

- Implementar um Kanban Board integrado via WebSockets para atualização do status de produção em tempo real nas cozinhas parceiras.

Desenvolver um motor de regras focado em compatibilidade estrutural de alimentos (ex.: validação de densidade de massa para bolos de múltiplos andares).

- Integrar um gateway de pagamentos via API para recebimentos instantâneos por PIX.

## 1.6 Métricas de Sucesso (KPIs)

| Indicador de Sucesso (KPI) | Meta / Limiar Estabelecido |
| --- | --- |
| Tempo médio de fechamento de orçamento (Cliente) Redução de horas para < 3 minutos através do | construtor dinâmico. |
| Taxa de Refação de Pedidos por Erro de Especificação | Redução para < 1% no total de pedidos mensais processados via sistema. |
| Adoção do Kanban na Cozinha (Engajamento) | 100% de uso diário pelos confeiteiros das operações cadastradas. |
| Tempo de Resposta do Preço Dinâmico | < 500ms a cada alteração de camada/ingrediente. |


## 2. Engenharia de Requisitos

Esta seção define, de forma objetiva e verificável, o que o sistema CakeCraft fará — evitando

descrições vagas e ambíguas.

## 2.1 Personas

## Persona 1 — Mariana "A Planejadora" (Cliente Final B2C)

28 anos. Odeia ter que implorar por orçamentos no WhatsApp. Expectativa: montar o bolo sozinha, ver o preço na hora e pagar via PIX.

## Persona 2 — Chef Roberto "O Executor" (Dono da Confeitaria)

45 anos. Dor principal: perde insumos porque anota pedidos correndo. Expectativa: um painel limpo na cozinha mostrando exatamente o que produzir.

## Persona 3 — Carlos "O Entregador" (Logística de Terceiros)

32 anos. Dor principal: chegar no cliente e descobrir dimensões incorretas de caixa. Expectativa: ordem de serviço com dimensões exatas.

## Persona 4 — Juliana "A Administradora" (Gestão)

38 anos. Dor principal: fechamento financeiro demorado. Expectativa: relatórios gerados em 1 clique mostrando o ticket médio do mês.

## 2.2 Casos de Uso Principais

Os principais fluxos do sistema CakeCraft são:

- Cadastro e autenticação de usuários (Cliente e Administrador).

- Montagem visual do bolo (Cake Builder).

- Cálculo dinâmico de preço.

- Checkout e pagamento via PIX.

- Acompanhamento do status do pedido (Cliente).

- Gestão do Kanban de produção (Confeitaria).

- Gestão do catálogo de ingredientes e preços (Administrador).

- Geração de relatórios financeiros (Administrador).

- Progressão de XP e recompensas de fidelidade (Sistema).


## Detalhamento dos Casos de Uso Principais

## UC01 — Montagem de Bolo Customizado

Ator: Cliente.

## Fluxo:

- 1. Acessa a rota /builder. 2. Seleciona formato e andares. 3. O preço base é calculado via API. 4. Navega pelas abas Massa, Recheio e Decoração. 5. Define restrições e mensagem do topo. 6. Revisa carrinho e finaliza pagamento via PIX.

## UC02 — Progressão de Nível (Level Up) e Recompensas

Ator: Sistema Background.


1. Admin conclui pedido no Kanban. 2. Evento dispara cálculo de XP. 3. XP é persistido no perfil do usuário. 4. Se cruzar a linha de 1000 XP, o sistema sobe o nível do usuário e dispara e-mail com recompensa/badge de fidelidade.

## UC03 — Cadastro e Autenticação

Ator: Cliente / Administrador.

- 1. Usuário acessa a tela de login. 2. Opta por cadastro (novo) ou login (existente). 3. Sistema valida credenciais via JWT. 4. Em caso de esquecimento de senha, usuário aciona o fluxo de recuperação por e-mail. 5. Sistema redireciona conforme o papel (CLIENTE → Cake Builder; ADMIN → Dashboard).

## UC04 — Gestão do Kanban de Produção

Ator: Confeiteiro/Administrador.

1. Admin acessa o Kitchen Board. 2. Visualiza pedidos pagos organizados nas colunas Em Espera, Em Produção e Finalização. 3. Move o card do pedido entre colunas conforme avança a produção. 4. Ao marcar como "Pronto", o sistema dispara notificação ao cliente e evento de gamificação.

## UC05 — Gestão de Catálogo de Ingredientes

Ator: Administrador.

1. Admin acessa o módulo de Catálogo. 2. Cadastra, edita ou inativa itens (massas, recheios, coberturas) e seus preços por kg. 3. O sistema recalcula automaticamente os preços exibidos no Cake Builder para novos pedidos a partir da próxima requisição.

## UC06 — Geração de Relatório Financeiro

Ator: Administrador.

1. Admin acessa o módulo de Relatórios. 2. Seleciona o período desejado. 3. Sistema agrega os pedidos pagos no intervalo. 4. Admin exporta o relatório em CSV com um clique.

## 2.3 Requisitos Funcionais (RF)

| ID | Descrição do Requisito | Prioridade |
| --- | --- | --- |
| RF01 | O sistema deve possuir autenticação com JWT e recuperação de senha. | Alta |
| RF02 | O Cake Builder deve permitir escolha: Andares > Massa > Recheio > Cobertura. | Alta |
| RF03 | O sistema deve calcular o preço total em tempo real consultando o banco. | Alta |
| RF04 | Deve existir um seletor de paleta de cores (HEX) para a cobertura do bolo. | Alta |
| RF05 | Permitir o upload de uma imagem para impressão em papel de arroz. | Média |
| RF06 | O cliente deve poder selecionar flags de restrição alimentar. | Alta |
| RF07 | Integração com gateway de pagamento via API para processar PIX. | Alta |
| RF08 | O painel admin deve exibir um Kanban Board de Produção. | Alta |
| RF09 | Motor de XP: o sistema deve conceder pontos de experiência proporcionais ao gasto. | Média |
| RF10 | O sistema deve gerar relatórios financeiros exportáveis em CSV. | Alta |


## 2.4 Requisitos Não Funcionais (RNF)

| ID | Descrição do Requisito | Categoria |
| --- | --- | --- |
| RNF01 | O tempo de atualização de preço no construtor não deve exceder 500ms. | Performance |
| RNF02 | O front-end deve ser otimizado para dispositivos móveis (Mobile First). | Usabilidade |
| RNF03 | O design system deve respeitar as diretrizes de contraste da WCAG 2.1. | Acessibilidade |
| RNF04 | Senhas devem ser criptografadas utilizando Bcrypt (fator 12). | Segurança |
| RNF05 | A API RESTful deve utilizar Rate Limiting para prevenir abusos. | Segurança |
| RNF06 | O banco de dados deve utilizar transações ACID estritas para pagamentos. | Confiabilidade |
| RNF07 | O sistema deve garantir disponibilidade mínima de 99,5% mensal nos módulos de Checkout e Pagamento. | Disponibilidade |
| RNF08 | A arquitetura deve suportar ao menos 200 usuários simultâneos no Cake Builder sem degradação perceptível. | Escalabilidade |

## 2.5 Regras de Negócio

- RN01 — Integridade Estrutural: o sistema deve bloquear a seleção de massas aeradas (ex.: Pão de Ló macio) se o bolo configurado possuir mais de 2 andares, alertando o usuário sobre o risco de desabamento.

- RN02 — Cálculo Volumétrico de Preço: o valor não é estático. O preço final do bolo = (Soma do Preço por Kg de cada insumo selecionado × Peso Estimado por Andar) + Taxa Base de Montagem.

- RN03 — Trava de Produção: um pedido só ingressa na coluna "Em Preparo" do Kanban da cozinha após o webhook de confirmação de pagamento do gateway retornar o status "PAGO". Pedidos pendentes ficam em uma fila invisível para a cozinha.

- RN04 — Conversão de XP: para cada R\$ 10,00 gastos na plataforma, o usuário ganha 10 pontos de XP. Os níveis de fidelidade escalam a cada 1000 XP acumulados.

## 2.6 Fora do Escopo

Para garantir a entrega técnica durante a disciplina, as seguintes funcionalidades não serão desenvolvidas nesta versão:

- Gestão de Frota e Logística: o sistema não fará roteirização ou rastreamento via GPS de motoboys.

- Módulo de Compras (Suprimentos): o sistema gerará relatórios do que foi gasto, mas não se conectará com APIs de fornecedores (atacadistas) para reposição automática de estoque.

- Folha de Pagamento: não haverá gestão financeira de salários dos funcionários da confeitaria.

- Aplicativos Nativos: não haverá versão nas lojas App Store ou Google Play; a solução será estritamente baseada na Web (PWA/SPA).


## 3. Fluxos e Comportamento do Sistema

Esta seção demonstra, em nível de comportamento, como o CakeCraft reage às ações do usuário e aos eventos assíncronos do backend.

## 3.1 Fluxo Principal do Usuário

Dois fluxos compõem o comportamento principal do sistema: o fluxo de atividades do cliente (frontend) e o fluxo de sequência de integração do backend.


## DIAGRAMA DE ATIVIDADES


DIAGRAMA DE SEQUÊNCIA — INTEGRAÇÃO BACKEND DE PEDIDO E PAGAMENTO

## 3.2 Fluxos Alternativos

Além do caminho feliz descrito acima, os seguintes cenários alternativos e de exceção foram mapeados:

- Falha ou expiração do pagamento PIX: se o QR Code não for pago dentro de 15 minutos, o sistema expira a cobrança automaticamente, libera o estoque reservado e retorna o usuário à tela de Checkout com a opção de gerar um novo código.

- Cancelamento pelo cliente antes do pagamento: enquanto o pedido estiver no status "Aguardando Pagamento", o cliente pode cancelar livremente pela tela de Acompanhamento; nenhuma cobrança é gerada e o carrinho é limpo.

- Cancelamento pela confeitaria por indisponibilidade de insumo: caso um item do catálogo seja marcado como inativo (RF09) após a confirmação do pedido mas antes do início da produção, o Administrador pode cancelar o pedido pelo Kanban; o sistema aciona o estorno via gateway de pagamento e notifica o cliente por e-mail.

- Bloqueio por validação estrutural (RN01): se o cliente tentar forçar, via manipulação de requisição, uma combinação estruturalmente inválida (ex.: massa aerada em bolo de 3 andares), a API rejeita a requisição com erro 422 antes de permitir o avanço para o checkout, mesmo que a validação de frontend tenha sido contornada.

- Expiração de sessão durante o Cake Builder: se o token JWT expirar enquanto o cliente está montando o bolo, o sistema preserva a configuração atual em estado local (rascunho), solicita reautenticação silenciosa via refresh token e, em caso de falha, redireciona ao login mantendo o rascunho salvo por 24 horas.

- Conflito de restrição alimentar: se o cliente declarar uma restrição alimentar (ex.: alergia a glúten) incompatível com um insumo já selecionado, o sistema exibe um alerta bloqueante antes de permitir avanço de etapa, sugerindo substitutos compatíveis do catálogo.


## 4. Mockups e Experiência do Usuário (UX)

O CakeCraft adota um Design System próprio, batizado internamente de "High-Key": uma estética minimalista em Light Mode, predominantemente branca e em tons de cinza claríssimo, com elementos de chamada para ação (CTAs) em preto sólido e tipografia branca em negrito. O objetivo é transmitir sofisticação e clareza visual, evitando poluição de cores que compita com as fotos dos bolos — o produto visual é sempre o protagonista da interface, nunca o chrome da aplicação.

## 4.1 Fluxo de Navegação

FLUXO DE NAVEGAÇÃO — ADMINISTRADOR


## 4.2 Wireframes ou Mockups das Telas

A seguir, as cinco telas centrais do produto são descritas em formato de mockup, cada uma seguida de sua funcionalidade e das ações principais disponíveis ao usuário.

*Tela 1 — Landing Page (Inicial)*


Funcionalidade: apresentar a proposta de valor do CakeCraft e direcionar o visitante para o cadastro ou para o Cake Builder.

Ações principais do usuário: clicar em "Começar a Montar" (entra direto no Builder em modo visitante); clicar em "Entrar"/"Criar Conta" (abre modal de autenticação).

*Tela 2 — Cake Builder (Montagem de Bolo)*

Funcionalidade: permitir a montagem visual e modular do bolo, com cálculo de preço em tempo real a cada seleção (RF03), respeitando as regras de integridade estrutural (RN01).

Ações principais do usuário: selecionar massa por andar; marcar até dois recheios; visualizar o impacto no preço e no render 3D instantaneamente; avançar ou retroceder entre as quatro etapas do builder.


*Tela 3 — Kitchen Board / Kanban Administrativo*

Funcionalidade: dar visibilidade em tempo real à fila de produção da confeitaria (RF08), sincronizada via WebSockets, e permitir a movimentação dos pedidos entre os estágios de produção.

Ações principais do usuário: mover cartões entre colunas (clique em botão ou arrastar); visualizar alertas de restrição alimentar antes de iniciar o preparo; marcar pedidos como prontos, disparando a notificação ao cliente.

## 4.3 Fluxo de Interação do Usuário

Passo a passo do fluxo principal de interação, do primeiro acesso até a conclusão do pedido:

- 1. O usuário acessa a Landing Page do CakeCraft.

- 2. Cria uma conta ou realiza login (autenticação JWT).

- 3. Percorre as quatro etapas do Cake Builder: Andares, Massa, Recheio e Cobertura.

- 4. Acompanha o preço sendo recalculado em tempo real a cada seleção.

- 5. Finaliza o checkout e realiza o pagamento via PIX (QR Code ou copia-e-cola).

- 6. Acompanha o status do pedido em tempo real na tela de Acompanhamento.

- 7. Recebe o bolo e ganha pontos de XP, podendo subir de nível de fidelidade.


## 4.4 Feedback Inicial de Usuários (Opcional)

Até o momento desta versão do RFC, não foram conduzidos testes formais de usabilidade com protótipo navegável. Como validação indireta de interesse, destaca-se que 90% dos 45 clientes B2C entrevistados durante a pesquisa de mercado (Seção 1.2) declararam interesse em uma ferramenta de montagem visual com retorno instantâneo de preço — o que reforça a direção de produto adotada para o Cake Builder.5. Arquitetura do Sistema

Esta seção demonstra como o CakeCraft será construído tecnicamente, partindo de uma visão macro de contexto (C4 Nível 1) até o detalhamento dos componentes internos da API (C4 Nível 3), seguida do modelo de dados e da stack tecnológica adotada.

## 5.1 Diagrama C4

*Nível 1 — Diagrama de Contexto*


## Nível 2 — Diagrama de Containers

## C4 NÍVEL 2 — CONTAINERS

## Nível 3 — Diagrama de Componentes

## C4 NÍVEL 3 — COMPONENTES INTERNOS DA API CORE


## 5.2 Modelo de Dados

## 5.3 Principais Componentes

- API Core (NestJS): ponto único de entrada para toda a lógica de negócio, orquestrando os demais módulos.

- Módulo de Autenticação: emissão/validação de JWT, hashing de senhas com Bcrypt e controle de acesso baseado em papel (RBAC).

- Motor de Precificação (PricingService): calcula o preço do bolo em tempo real a partir do peso por andar e do preço por kg de cada insumo (RN02).


- Módulo de Pedidos: gerencia o ciclo de vida do pedido, da criação à entrega, e persiste Pedido, ConfiguracaoBolo e ItemPedido.

- Módulo de Pagamento: integra com o gateway PIX, gera cobranças e processa webhooks de confirmação (RN03).

- Módulo de Gamificação: calcula XP, atualiza níveis de fidelidade e dispara recompensas (RN04).

- Gateway WebSocket (KanbanGateway): propaga atualizações em tempo real para o Kitchen Board e para a tela de Acompanhamento do cliente.

- Camada de Persistência (Prisma ORM + PostgreSQL): abstração de acesso ao banco relacional com migrações versionadas.

- Camada de Cache/Mensageria (Redis): Pub/Sub de eventos de domínio e cache de leitura para o catálogo de ingredientes.

## 5.4 Stack Tecnológica

- React 18 + Next.js + TypeScript: escolhido pela renderização híbrida (SSR/CSR), essencial para que a Landing Page tenha bom SEO, enquanto o Cake Builder se beneficia de interatividade client-side rica; TypeScript reduz erros de tipagem na manipulação do estado complexo do builder.

- Tailwind CSS: acelera a implementação do Design System "High-Key" através de classes utilitárias consistentes, evitando divergência visual entre desenvolvedores em um projeto de portfólio individual.

- Node.js + NestJS: escolhido pela arquitetura modular nativa (módulos, providers, guards), que mapeia diretamente para os módulos descritos no C4 Nível 3, além da excelente capacidade de lidar com I/O de alto volume típico de um backend orientado a eventos.

- PostgreSQL 16 + Prisma ORM: banco relacional escolhido pela necessidade de garantias ACID em transações financeiras (RN02, RNF06); Prisma oferece migrações tipadas e reduz erros de query manual.

- Redis (Pub/Sub): escolhido para desacoplar os módulos de Pagamento, Gamificação e Notificações entre si, permitindo que o webhook de pagamento dispare múltiplos efeitos colaterais sem acoplamento direto de código.

- Socket.io: escolhido pela maturidade e fallback automático de transporte, garantindo que o Kanban em tempo real (RF08) funcione mesmo em redes corporativas restritivas das confeitarias parceiras.

- JWT + Bcrypt: padrão de mercado para autenticação stateless e hashing seguro de senhas (RNF04), evitando a necessidade de sessão persistida no servidor.

- Gateway de Pagamento PIX (ex.: Mercado Pago/Stripe Brasil): escolhido por já oferecer geração de QR Code dinâmico e webhooks de confirmação prontos, evitando a necessidade de homologação direta junto ao Banco Central para um projeto de portfólio.

- Jest + Supertest: escolhidos para suportar a estratégia de testes (Apêndice B), cobrindo testes unitários do motor de precificação/XP e testes de integração das rotas REST.


## 6. Segurança e Privacidade

O CakeCraft adota como referência básica de segurança o OWASP Top 10, mapeando mitigações concretas para as categorias de risco mais relevantes ao seu contexto de e-commerce com dados de pagamento:

- Injection (Injeção): uso exclusivo de queries parametrizadas via Prisma ORM, eliminando a construção manual de SQL e o risco de SQL Injection.

- Broken Authentication (Quebra de Autenticação): tokens JWT de curta duração com mecanismo de refresh token, senhas hasheadas com Bcrypt fator de custo 12 (RNF04).

- Sensitive Data Exposure (Exposição de Dados Sensíveis): dados de pagamento nunca são armazenados diretamente — apenas tokens/referências fornecidos pelo gateway PIX são persistidos; toda comunicação ocorre via HTTPS/TLS.

- Broken Access Control (Quebra de Controle de Acesso): controle de acesso baseado em papéis (RBAC) implementado via Guards do NestJS, garantindo que rotas administrativas (Kanban, Catálogo, Relatórios) sejam inacessíveis ao papel CLIENTE.

- Security Misconfiguration / API Abuse: rate limiting aplicado às rotas públicas (RNF05), reduzindo a superfície de ataques de força bruta e abuso de API.

## 6.1 Privacidade e LGPD

## Quais dados são coletados

O sistema coleta dados de identificação básica (nome, e-mail, telefone), endereço de entrega quando aplicável, restrições alimentares declaradas voluntariamente pelo cliente (campo sensível, tratado com cuidado adicional) e referências tokenizadas de pagamento fornecidas pelo gateway PIX — nunca os dados brutos do meio de pagamento.

## Como os dados são armazenados

Os dados são armazenados em PostgreSQL 16 com acesso restrito por papel de serviço (princípio do menor privilégio), senhas protegidas por Bcrypt (RNF04) e toda comunicação entre cliente e servidor criptografada via HTTPS/TLS. O consentimento para coleta de dados sensíveis (como restrições alimentares) é obtido de forma explícita por meio de uma caixa de seleção opt-in no momento do cadastro, nunca pré-marcada.

## Como o usuário pode solicitar remoção

Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), o sistema expõe um endpoint dedicado — DELETE /api/usuarios/me/anonymize — que permite ao próprio usuário solicitar a anonimização de seus dados pessoais a qualquer momento a partir da tela de Perfil, preservando apenas os registros transacionais agregados necessários à contabilidade da confeitaria (sem vínculo identificável com a pessoa).


## 7. Planejamento do Projeto

Por se tratar de um projeto de portfólio individual, a metodologia adotada é um fluxo Kanban pessoal e iterativo, sem cerimônias formais de Scrum (sem Sprint Planning ou Daily Meetings com terceiros), priorizando entregas verticais e funcionais a cada ciclo de aproximadamente duas semanas. A seguir, os marcos macro do projeto:

| Marco | Descrição | Prazo |
| --- | --- | --- |
| M1 | Setup do ambiente, modelagem do banco de dados e prova de conceito de autenticação JWT. | Semanas 1–2 |
| M2 | MVP funcional: Cake Builder completo, cálculo de preço em tempo real, checkout via PIX e Kanban administrativo operante. | Semanas 3–8 |
| M3 | Motor de gamificação (XP/níveis), testes E2E, ajustes finos de UX e polimento visual do Design System. | Semanas 9–10 |

## Detalhamento por Ciclo

Detalhamento complementar do macro-planejamento acima, distribuído nos cinco ciclos de desenvolvimento de duas semanas cada:

| Ciclo | Semanas | Foco Principal |
| --- | --- | --- |
| Ciclo 1 | 1–2 | Setup do projeto (monorepo), modelagem do banco com Prisma e fluxo de autenticação (cadastro/login/JWT). |
| Ciclo 2 | 3–4 | Construção do Cake Builder (frontend) e do PricingService (motor de precificação em tempo real). |
| Ciclo 3 | 5–6 | Implementação do Checkout, integração com o gateway PIX e tratamento de webhooks de pagamento. |
| Ciclo 4 | 7–8 | Painel Administrativo, Kanban de produção via WebSockets (Socket.io) e módulo de catálogo de ingredientes. |
| Ciclo 5 | 9–10 | Motor de gamificação (XP/níveis), testes E2E, testes de usabilidade e polimento final do Design System. |


## 8. Referências

- BECK, Kent. Test-Driven Development: By Example. Addison-Wesley, 2002.

- MARTIN, Robert C. Clean Architecture: A Craftsman's Guide to Software Structure and Design. Prentice Hall, 2017.

- ANDERSON, David J. Kanban: Successful Evolutionary Change for Your Technology Business. Blue Hole Press, 2010.

- NestJS — Documentação Oficial. Disponível em: https://docs.nestjs.com

- Next.js — Documentação Oficial. Disponível em: https://nextjs.org/docs

- Prisma ORM — Documentação Oficial. Disponível em: https://www.prisma.io/docs

- W3C. Web Content Accessibility Guidelines (WCAG) 2.1. Disponível em: https://www.w3.org/TR/WCAG21/


## 9. Apêndices

Esta seção reúne material complementar que não se encaixa diretamente na estrutura linear das seções anteriores, mas que agrega contexto relevante para a avaliação do projeto.

## Apêndice A — Matriz SWOT

| Quadrante | Pontos Identificados |
| --- | --- |
| Forças | Cake Builder visual com precificação instantânea; gamificação como diferencial de retenção; pagamento PIX nativo; Kanban em tempo real para a cozinha. |
| Fraquezas | Projeto de portfólio individual, sem equipe para suporte 24/7; dependência de um único desenvolvedor para todo o stack; ausência de apps nativos no MVP. |
| Oportunidades | Mercado de confeitarias artesanais ainda fortemente dependente do WhatsApp (Seção 1.2); possibilidade de expansão para outros nichos de produtos personalizados (doces finos, salgados). |
| Ameaças | Entrada de concorrentes genéricos (iFood/Rappi) com módulos de personalização; resistência de confeiteiros menos familiarizados com tecnologia à migração de processo. |

## Apêndice B — Estratégia de Qualidade e Testes (TDD)

O desenvolvimento do CakeCraft adota Test-Driven Development (TDD) como prática central para os módulos de maior risco de negócio:

- Testes unitários (Jest): meta de 95% de cobertura de código para o motor de precificação (PricingService) e para o motor de cálculo de XP, dada a criticidade financeira e de regras de negócio (RN02, RN04) desses componentes.

- Testes de integração (Supertest): cobertura das rotas REST críticas — autenticação, criação de pedido, checkout e webhook de pagamento — validando o comportamento ponta a ponta da API antes de cada merge na branch principal.


## 10. Parecer do Comitê de Avaliação

## Avaliador 1

## Nome: ______________________________________________

Status: Aprovado Ajustar

Observações:

## Avaliador 2

## Nome: ______________________________________________

## Status: Aprovado Ajustar

Observações:
