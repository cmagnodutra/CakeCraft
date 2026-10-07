const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Promise esquecida sem await/catch e uma classe de bug real deste
      // projeto (ex.: um handler async que nunca propaga erro) - vira
      // erro, nao so aviso.
      '@typescript-eslint/no-floating-promises': 'error',

      // Parametro nao usado comecando com "_" e convencao deliberada
      // (ja usada em auth.service.ts para os metodos TODO) - nao
      // devemos ser avisados sobre algo que e de proposito.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Testes (*.spec.ts e tudo em test/) lidam o tempo todo com valores
    // naturalmente tipados como `any` por quem os gerou - response.body
    // do Supertest, o .value do retorno de Joi.validate() - sem que isso
    // seja, de fato, um descuido de tipagem em codigo de producao. Exigir
    // tipagem explicita em todo assert de teste JSON geraria muito ruido
    // para pouco ganho real; o codigo de producao (fora deste bloco)
    // continua com a regra cheia.
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
);
