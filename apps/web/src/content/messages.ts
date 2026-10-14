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
} as const;
