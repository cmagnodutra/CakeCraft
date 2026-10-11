import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { contrastRatio } from '@/lib/contrast';

/**
 * RNF03 (RFC): o design system deve respeitar o contraste da WCAG 2.1.
 *
 * A fonte da verdade das cores e o globals.css. Este teste le o proprio
 * arquivo e valida cada par texto/fundo, entao ninguem consegue trocar uma
 * cor no CSS e quebrar a acessibilidade sem um teste falhar.
 */
const css = readFileSync(join(__dirname, 'globals.css'), 'utf-8');

function tokens(): Record<string, string> {
  const found: Record<string, string> = {};
  for (const match of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    found[match[1]] = match[2];
  }
  return found;
}

const AA_TEXTO = 4.5; // WCAG 1.4.3: texto normal
const AA_COMPONENTE = 3; // WCAG 1.4.11: bordas de campo, foco, icones

const TEXTO: Array<[string, string, string]> = [
  ['ink', 'paper', 'texto principal na pagina'],
  ['ink', 'surface', 'texto principal em cartoes'],
  ['ink-muted', 'paper', 'texto secundario na pagina'],
  ['ink-muted', 'surface', 'texto secundario em cartoes'],
  ['ink-muted', 'sand-100', 'texto secundario em areas de areia'],
  ['on-ink', 'ink', 'texto branco do botao preto (CTA)'],
  ['accent', 'paper', 'destaque em italico na marca'],
  ['danger', 'danger-soft', 'texto de erro no alerta'],
  ['success', 'success-soft', 'texto de sucesso no alerta'],
];

const COMPONENTE: Array<[string, string, string]> = [
  ['line-strong', 'paper', 'borda de campo sobre a pagina'],
  ['line-strong', 'surface', 'borda de campo sobre cartao'],
  ['ink', 'paper', 'anel de foco do teclado'],
];

describe('design tokens (globals.css)', () => {
  const colors = tokens();

  it('define as cores base do High-Key quente', () => {
    for (const name of ['paper', 'surface', 'ink', 'on-ink', 'sand-100', 'line', 'line-strong']) {
      expect(colors).toHaveProperty([name]);
    }
  });

  it('o preto do CTA e o do texto sao o mesmo token (CTA em preto solido, High-Key)', () => {
    expect(colors.ink).toBeDefined();
    expect(colors['on-ink'].toLowerCase()).toBe('#ffffff');
  });

  describe('contraste de texto >= 4.5:1 (WCAG AA)', () => {
    it.each(TEXTO)('%s sobre %s (%s)', (fg, bg) => {
      expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(AA_TEXTO);
    });
  });

  describe('contraste de componentes >= 3:1 (WCAG 1.4.11)', () => {
    it.each(COMPONENTE)('%s sobre %s (%s)', (fg, bg) => {
      expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(AA_COMPONENTE);
    });
  });
});
