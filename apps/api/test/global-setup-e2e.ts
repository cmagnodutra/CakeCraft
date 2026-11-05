import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { resolveE2eDatabaseUrl } from './e2e-env';

/**
 * Aplica todas as migrations versionadas do Prisma no schema `e2e_test` do
 * PostgreSQL real antes de iniciar os testes E2E. Assim qualquer ambiente
 * recem-subido (Docker local ou servico Postgres do GitHub Actions) fica
 * pronto automaticamente, sem passos manuais.
 */
export default function globalSetupE2e(): void {
  const apiRoot = resolve(__dirname, '..');
  const e2eDatabaseUrl = resolveE2eDatabaseUrl();
  const prismaCli = require.resolve('prisma/build/index.js');

  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: apiRoot,
    env: {
      ...process.env,
      DATABASE_URL: e2eDatabaseUrl,
    },
    stdio: 'pipe',
  });
}
