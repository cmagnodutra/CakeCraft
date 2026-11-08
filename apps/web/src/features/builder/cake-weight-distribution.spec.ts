import {
  DEFAULT_SERVINGS,
  SERVINGS_OPTIONS,
  distributeWeightAcrossFloors,
  formatWeightKg,
  getMinServingsForFloors,
  normalizeServingsForFloors,
  servingsToTotalWeightKg,
} from './cake-weight-distribution';

describe('cake-weight-distribution', () => {
  it('calcula o peso total a razao de 100g por pessoa sem ruido de ponto flutuante', () => {
    expect(DEFAULT_SERVINGS).toBe(15);
    expect(servingsToTotalWeightKg(10)).toBe(1);
    expect(servingsToTotalWeightKg(15)).toBe(1.5);
    expect(servingsToTotalWeightKg(25)).toBe(2.5);
    expect(servingsToTotalWeightKg(120)).toBe(12);
  });

  it('define quantidade minima de pessoas compativel com o numero de andares', () => {
    expect(getMinServingsForFloors(1)).toBe(10);
    expect(getMinServingsForFloors(2)).toBe(15);
    expect(getMinServingsForFloors(3)).toBe(25);
    expect(getMinServingsForFloors(4)).toBe(30);
    expect(getMinServingsForFloors(99)).toBe(30);
    expect(getMinServingsForFloors(NaN)).toBe(10);
  });

  it('normaliza a selecao de pessoas respeitando o minimo estrutural dos andares', () => {
    expect(normalizeServingsForFloors(15, 1)).toBe(15);
    expect(normalizeServingsForFloors(10, 2)).toBe(15);
    expect(normalizeServingsForFloors(15, 3)).toBe(25);
    expect(normalizeServingsForFloors(20, 4)).toBe(30);
    expect(normalizeServingsForFloors(48, 2)).toBe(50);
    expect(normalizeServingsForFloors(NaN, 1)).toBe(15);
  });

  it('divide o peso idealmente de forma decrescente da base ao topo com soma exata em todas as opcoes', () => {
    expect(distributeWeightAcrossFloors(15, 1)).toEqual([1.5]);
    expect(distributeWeightAcrossFloors(15, 2)).toEqual([0.93, 0.57]);
    expect(distributeWeightAcrossFloors(25, 3)).toEqual([1.15, 0.8, 0.55]);
    expect(distributeWeightAcrossFloors(30, 4)).toEqual([1.08, 0.78, 0.63, 0.51]);

    for (const floorsCount of [1, 2, 3, 4] as const) {
      const minServings = getMinServingsForFloors(floorsCount);
      for (const option of SERVINGS_OPTIONS) {
        if (option < minServings) continue;

        const weights = distributeWeightAcrossFloors(option, floorsCount);
        expect(weights).toHaveLength(floorsCount);

        for (let i = 0; i < weights.length; i++) {
          const current = weights[i] ?? 0;
          expect(current).toBeGreaterThanOrEqual(0.5);
          expect(current).toBeLessThanOrEqual(20);
          const decimalPart = String(current).split('.')[1] ?? '';
          expect(decimalPart.length).toBeLessThanOrEqual(2);

          if (i > 0) {
            const below = weights[i - 1] ?? 0;
            expect(current).toBeLessThan(below);
          }
        }

        const totalCents = weights.reduce((acc, w) => acc + Math.round(w * 100), 0);
        expect(totalCents).toBe(Math.round(servingsToTotalWeightKg(option) * 100));
      }
    }
  });

  it('formata o peso em pt-BR com ate duas casas decimais', () => {
    expect(formatWeightKg(1.5)).toBe('1,5');
    expect(formatWeightKg(0.93)).toBe('0,93');
    expect(formatWeightKg(2)).toBe('2');
  });
});
