import { contrastRatio, relativeLuminance } from './contrast';

describe('relativeLuminance', () => {
  it('preto puro tem luminancia 0 e branco puro tem 1', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10);
  });

  it('aceita hex em maiusculas e minusculas', () => {
    expect(relativeLuminance('#AABBCC')).toBeCloseTo(relativeLuminance('#aabbcc'), 10);
  });

  it('rejeita valores que nao sao #rrggbb', () => {
    expect(() => relativeLuminance('red')).toThrow(/#rrggbb/);
    expect(() => relativeLuminance('#fff')).toThrow(/#rrggbb/);
    expect(() => relativeLuminance('#gggggg')).toThrow(/#rrggbb/);
  });
});

describe('contrastRatio', () => {
  it('preto sobre branco e 21:1, o maximo da WCAG', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('cor igual contra ela mesma e 1:1', () => {
    expect(contrastRatio('#8a5a2b', '#8a5a2b')).toBeCloseTo(1, 10);
  });

  it('nao depende da ordem (texto/fundo ou fundo/texto)', () => {
    expect(contrastRatio('#1b1814', '#faf7f2')).toBeCloseTo(
      contrastRatio('#faf7f2', '#1b1814'),
      10,
    );
  });

  it('reproduz o valor de referencia #777777 sobre branco (4.48:1, reprovado em AA)', () => {
    // Exemplo classico: #777 e o cinza mais claro que quase passa em AA, mas
    // nao passa (4.48 < 4.5). Serve de contra-prova do calculo.
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});
