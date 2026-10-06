# chore(lint): configura ESLint 10 (flat config) e Prettier

**Branch:** `chore/lint-and-format` -> `main`

## Contexto

Item obrigatorio do nucleo comum de engenharia do Portfolio Playbook
que ainda nao existia (ver `PLANO-EXECUCAO-CAKECRAFT.md`, Secao 2.2,
item 3 - na verdade compartilhado com o item de analise estatica).

## O que foi implementado

- **ESLint 10** (flat config, `eslint.config.js`) +
  `typescript-eslint` 8 com `recommendedTypeChecked` - mais rigoroso
  que o "recommended" puro, pega erros que so aparecem com os tipos
  reais (ex.: promise esquecida sem `await`).
- **`eslint-config-prettier`** desliga as regras de estilo do ESLint
  que brigariam com o Prettier.
- Duas customizacoes sobre o padrao (`no-floating-promises` vira
  `error`; parametro `_prefixado` nao gera aviso de nao-usado - ja e
  convencao em uso nos TODOs de `AuthService`).
- Override para arquivos de teste: desliga a familia `no-unsafe-*`
  (`response.body` do Supertest e o `.value` do Joi sao `any` por
  natureza das bibliotecas, nao por descuido de quem escreveu o teste).
- **Prettier** (aspas simples, trailing comma, printWidth 100,
  `endOfLine: lf`).
- Scripts novos: `lint`, `lint:fix`, `format`, `format:check`.

## Como testar

```bash
cd apps/api
npm run lint
npm run format:check
npm test && npm run test:e2e
```

## Nota para quem revisar

Rodei o lint contra o codigo real de `main` antes de decidir o override
de teste: os 12 erros encontrados eram todos em arquivos `.spec.ts`/
`test/`, nenhum em codigo de producao. O reformat do Prettier tocou 3
arquivos, sempre colapsando linhas quebradas manualmente que cabiam no
limite de 100 colunas - sem mudanca semantica (suite de testes e build
reconfirmados depois).

## Pendente (fora do escopo deste PR, proximos da fila)

- GitHub Actions (lint + test a cada push)
- Dockerfile multi-stage da API
- Rodar `npm run lint`/`format` nas branches `feature/*` antes de
  mergear em `main` (esta branch so cobre o codigo que ja estava em
  `main`)

## Checklist

- [x] `npm install` limpo
- [x] `nest build` sem erros
- [x] Testes unitarios e e2e passando
- [x] `npm run lint` e `npm run format:check` passando
- [x] `npm audit` sem vulnerabilidades novas
- [ ] Revisado por um colega (code review avaliativo da disciplina)
