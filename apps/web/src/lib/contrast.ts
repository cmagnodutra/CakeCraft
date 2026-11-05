/**
 * Calculo de contraste conforme a WCAG 2.1 (RNF03 do RFC).
 * Referencia: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */

const HEX_COLOR = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** Converte um canal sRGB (0-255) para luz linear, como a WCAG define. */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Luminancia relativa (0 = preto, 1 = branco) de uma cor no formato #rrggbb. */
export function relativeLuminance(hex: string): number {
  const match = HEX_COLOR.exec(hex);
  if (!match) {
    throw new Error(`Cor invalida "${hex}": use o formato #rrggbb.`);
  }

  const [r, g, b] = [match[1], match[2], match[3]].map((part) =>
    linearize(Number.parseInt(part, 16)),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razao de contraste entre duas cores, de 1 (igual) a 21 (preto e branco). */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
