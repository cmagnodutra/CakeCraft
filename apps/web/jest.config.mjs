import nextJest from 'next/jest.js';

// next/jest ja configura SWC para TS/JSX, CSS modules, next/font e carrega
// os arquivos .env, entao nao precisamos de ts-jest nem de babel aqui.
const createJestConfig = nextJest({ dir: './' });

export default createJestConfig({
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testMatch: ['<rootDir>/src/**/*.spec.{ts,tsx}'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/test/**',
    // Casca do Next sem logica propria; coberta pelo build.
    '!src/app/layout.tsx',
  ],
  // Meta institucional da disciplina para o frontend: 25%. Nasce como piso
  // de seguranca e deve subir conforme as telas ganharem logica.
  coverageThreshold: { global: { statements: 25, branches: 25, functions: 25, lines: 25 } },
});
