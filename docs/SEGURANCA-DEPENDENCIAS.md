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

## Scripts de instalacao (allowScripts, npm 12)

A partir do npm 12, scripts de instalacao de dependencias (`preinstall`,
`install`, `postinstall` e o `node-gyp rebuild` implicito de pacotes com
`binding.gyp`) sao **bloqueados por padrao**. Vale tambem como defesa
contra ataques de cadeia de suprimentos: um pacote comprometido nao executa
codigo na maquina so por ser instalado. O npm 11.16 ja avisa; o 12 bloqueia.

Politica registrada no `package.json` da raiz (campo `allowScripts`).
Escrita pela propria ferramenta, com `npm approve-scripts` e
`npm deny-scripts`, nunca a mao:

| Pacote | Decisao | Motivo |
| --- | --- | --- |
| `bcrypt` | permitido | Hash de senha (RNF04). Traz binarios pre-compilados, mas o script e o fallback que compila se nenhum servir (ex.: arquitetura incomum no servidor). |
| `prisma`, `@prisma/client`, `@prisma/engines` | permitidos | Baixam o engine no install. Em CI e Docker e melhor que isso ocorra no install do que no meio de um build. |
| `unrs-resolver` | negado | So existe na cadeia do Jest. Os binarios nativos vem em pacotes por plataforma (`@unrs/resolver-binding-*`), entao o script nunca e necessario. |
| `@parcel/watcher` | negado | So existe na cadeia do Jest (haste-map). Mesmo mecanismo: binario por plataforma. |

Aprovacoes sem pin de versao (`"bcrypt": true`, e nao `"bcrypt@6.0.0"`):
sao pacotes confiaveis e ja fixados por intervalo semver no
`package.json` e por hash no lockfile; pinar exigiria reaprovar a cada
atualizacao de patch do Prisma. O pin e a alternativa mais estrita se o
risco mudar.

Como verificar: `npm approve-scripts --allow-scripts-pending` deve responder
"No packages with unreviewed install scripts". Se um pacote novo trouxer
script, o npm avisa no install e a decisao entra aqui, caso a caso.
Nunca usar `approve-scripts --all` sem ler a lista.

## O aviso "20 moderate severity vulnerabilities"

O `npm install` ainda imprime esse numero (e a sugestao `npm audit fix
--force`). E exatamente o estado descrito acima: 20 moderadas so na cadeia
de teste do Jest, sem versao corrigida. **Nao executar `npm audit fix
--force`**: ele rebaixaria o `ts-jest` para a v27 e quebraria a suite. O
criterio do projeto e `npm run audit:prod`, que fecha em 0.

## Avisos de pacotes "deprecated"

`whatwg-encoding` (via jsdom, usado pelo Jest do frontend) e `glob@10`
(via ferramentas de teste) aparecem como deprecated. Sao dependencias
transitivas de desenvolvimento, sem efeito em producao; sao resolvidas
quando o Jest/jsdom publicarem versoes que as troquem.
