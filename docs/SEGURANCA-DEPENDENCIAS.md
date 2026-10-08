# Seguranca de dependencias

Politica adotada para o `npm audit` no CakeCraft.

## Regra

- `npm run audit:prod` (equivale a `npm audit --omit=dev`) deve sempre
  fechar em **0 vulnerabilidades**. Ele cobre tudo que e empacotado e
  executado em producao. E o comando que o pipeline de CI deve rodar.
- `npm audit` completo pode apontar problemas apenas em ferramentas de
  desenvolvimento e teste. Estes sao avaliados caso a caso, nunca
  corrigidos com `npm audit fix --force` sem analise.

## Estado conhecido (outubro/2026)

- Producao: 0 vulnerabilidades.
- Completo: 20 de severidade moderada, todas na cadeia `jest` / `ts-jest`
  (`js-yaml` -> `argparse` -> `sprintf-js`). Motivos para nao agir:
  1. `sprintf-js` (DoS por precisao ilimitada) esta marcado como afetado em
     todas as versoes; a 1.1.3 ja e a ultima publicada, logo nao existe
     versao corrigida para aguardar.
  2. A "correcao" sugerida pelo npm e rebaixar o `ts-jest` para a v27,
     incompativel com o Jest 30 e com TypeScript 5.9: quebraria a suite de
     testes para tratar um risco que so existe em maquina de desenvolvedor
     ou CI, processando entrada controlada por nos.
  3. Nada disso e distribuido na imagem de producao.

## Quando reavaliar

Reexecutar `npm audit` ao atualizar o Jest/ts-jest ou a cada novo modulo
que adicione dependencias. Se surgir versao corrigida do `sprintf-js` ou do
`js-yaml`, tratar com `overrides` no `package.json` raiz, como ja e feito
para `webpack`, `multer` e `deepmerge-ts`.
