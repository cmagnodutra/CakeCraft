/**
 * Regras de rendimento e divisao estrutural ideal de peso por andar (RF02 / RN02).
 *
 * Padrao de confeitaria adotado no CakeCraft: 100g (0,1 kg) por pessoa/fatia.
 * Em bolos de multiplos andares, a massa total e distribuida de forma decrescente
 * da base (1o andar, mais largo e estavel) ate o topo, preservando ao menos
 * 0,50 kg por andar e aritmetica inteira em dezenas de gramas (0,01 kg) para
 * eliminar desvios de ponto flutuante IEEE-754.
 */

export const SERVINGS_OPTIONS = [10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120] as const;

export type ServingsOption = (typeof SERVINGS_OPTIONS)[number];

export const DEFAULT_SERVINGS: ServingsOption = 15;

type SupportedFloorCount = 1 | 2 | 3 | 4;

const MIN_SERVINGS_BY_FLOORS: Record<SupportedFloorCount, ServingsOption> = {
  1: 10,
  2: 15,
  3: 25,
  4: 30,
};

const IDEAL_FLOOR_RATIOS: Record<SupportedFloorCount, readonly number[]> = {
  1: [1],
  2: [0.62, 0.38],
  3: [0.46, 0.32, 0.22],
  4: [0.36, 0.26, 0.21, 0.17],
};

function clampFloorCount(floorsCount: number): SupportedFloorCount {
  const rounded = Number.isFinite(floorsCount) ? Math.round(floorsCount) : 1;
  return Math.max(1, Math.min(4, rounded)) as SupportedFloorCount;
}

export function getMinServingsForFloors(floorsCount: number): ServingsOption {
  return MIN_SERVINGS_BY_FLOORS[clampFloorCount(floorsCount)];
}

export function normalizeServingsForFloors(
  rawServings: number,
  floorsCount: number,
): ServingsOption {
  const minServings = getMinServingsForFloors(floorsCount);
  const allowedOptions = SERVINGS_OPTIONS.filter((option) => option >= minServings);
  const safeTarget = Number.isFinite(rawServings) ? rawServings : DEFAULT_SERVINGS;

  let closest = allowedOptions[0] ?? minServings;
  let smallestDiff = Math.abs(closest - safeTarget);

  for (const option of allowedOptions) {
    const diff = Math.abs(option - safeTarget);
    if (diff < smallestDiff) {
      closest = option;
      smallestDiff = diff;
    }
  }

  return closest;
}

export function servingsToTotalWeightKg(servings: number): number {
  const centiKg = Math.round(servings * 10);
  return Number((centiKg / 100).toFixed(2));
}

export function distributeWeightAcrossFloors(servings: number, floorsCount: number): number[] {
  const clampedFloors = clampFloorCount(floorsCount);
  const normalizedServings = normalizeServingsForFloors(servings, clampedFloors);
  const totalCentiKg = normalizedServings * 10;

  if (clampedFloors === 1) {
    return [Number((totalCentiKg / 100).toFixed(2))];
  }

  const ratios = IDEAL_FLOOR_RATIOS[clampedFloors];
  const upperCentiKg: number[] = [];

  for (let index = 1; index < clampedFloors; index++) {
    const ratio = ratios[index] ?? 0;
    const allocated = Math.max(50, Math.round(totalCentiKg * ratio));
    upperCentiKg.push(allocated);
  }

  const upperSum = upperCentiKg.reduce((sum, item) => sum + item, 0);
  const baseCentiKg = Math.max(50, totalCentiKg - upperSum);

  return [baseCentiKg, ...upperCentiKg].map((centiKg) => Number((centiKg / 100).toFixed(2)));
}

export function formatWeightKg(weightKg: number): string {
  return weightKg.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
