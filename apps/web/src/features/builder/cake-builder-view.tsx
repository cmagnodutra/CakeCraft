'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button, buttonStyles } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { messages } from '@/content/messages';
import { useAuth } from '@/features/auth/auth-provider';
import { fetchPublicCatalog } from '@/lib/api/catalog';
import type { CatalogIngredient, IngredientType } from '@/lib/api/catalog';
import { NetworkError } from '@/lib/api/errors';
import {
  calculateCakePrice,
  createOrder,
  resolveApiAssetUrl,
  uploadRicePaperImage,
} from '@/lib/api/orders';
import type { CakeFloorInput, CakeFormat, PriceCalculationResult } from '@/lib/api/orders';

import { CakePreview3D } from './cake-preview-3d';

export const BUILDER_DRAFT_STORAGE_KEY = 'cakecraft:builder-draft:v1';

const texts = messages.builder;

type DietaryKey = keyof typeof texts.dietarySection.options;

const DIETARY_KEYS: DietaryKey[] = ['lactose', 'gluten', 'ovos', 'castanhas', 'amendoim', 'soja'];

const DIETARY_EQUIVALENTS: Record<DietaryKey, string[]> = {
  lactose: ['lactose', 'leite'],
  gluten: ['gluten', 'trigo'],
  ovos: ['ovos', 'ovo'],
  castanhas: ['castanhas', 'nozes', 'amendoas'],
  amendoim: ['amendoim'],
  soja: ['soja'],
};

const FORMAT_OPTIONS: CakeFormat[] = ['REDONDO', 'QUADRADO', 'RETANGULAR'];
const FLOOR_COUNTS = [1, 2, 3, 4] as const;

const PRESET_SWATCHES = [
  { hex: '#FAF7F2', name: 'Baunilha' },
  { hex: '#F3EDE3', name: 'Creme' },
  { hex: '#E8B4B8', name: 'Rosé' },
  { hex: '#C8A27C', name: 'Caramelo' },
  { hex: '#6B4423', name: 'Cacau' },
  { hex: '#BFD8C4', name: 'Pistache' },
] as const;

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export interface BuilderDraft {
  format: CakeFormat;
  colorHex: string;
  floors: CakeFloorInput[];
  dietaryFlags: DietaryKey[];
  toppingMessage: string;
  riceImageUrl?: string;
  deliveryAddress: string;
}

interface QuoteState {
  key: string;
  quote: PriceCalculationResult | null;
  error?: string;
}

function saveDraftToSession(draft: BuilderDraft): void {
  try {
    window.sessionStorage.setItem(BUILDER_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Modo privado estrito: segue em memoria sem interromper a experiencia.
  }
}

function clearDraftFromSession(): void {
  try {
    window.sessionStorage.removeItem(BUILDER_DRAFT_STORAGE_KEY);
  } catch {
    // Sem acao necessaria.
  }
}

function readDraftFromSession(catalog: CatalogIngredient[]): BuilderDraft | null {
  try {
    const raw = window.sessionStorage.getItem(BUILDER_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BuilderDraft>;
    if (
      !parsed ||
      !Array.isArray(parsed.floors) ||
      parsed.floors.length < 1 ||
      parsed.floors.length > 4
    ) {
      return null;
    }

    const activeIds = new Set(catalog.map((item) => item.id));
    const allValid = parsed.floors.every(
      (f) =>
        activeIds.has(f.doughIngredientId) &&
        activeIds.has(f.coverageIngredientId) &&
        Array.isArray(f.fillingIngredientIds) &&
        f.fillingIngredientIds.length <= 2 &&
        f.fillingIngredientIds.every((id) => activeIds.has(id)),
    );
    if (!allValid) return null;

    return {
      format: parsed.format && FORMAT_OPTIONS.includes(parsed.format) ? parsed.format : 'REDONDO',
      colorHex:
        typeof parsed.colorHex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(parsed.colorHex)
          ? parsed.colorHex.toUpperCase()
          : '#F3EDE3',
      floors: parsed.floors,
      dietaryFlags: Array.isArray(parsed.dietaryFlags)
        ? parsed.dietaryFlags.filter((k): k is DietaryKey => DIETARY_KEYS.includes(k))
        : [],
      toppingMessage: typeof parsed.toppingMessage === 'string' ? parsed.toppingMessage : '',
      riceImageUrl: typeof parsed.riceImageUrl === 'string' ? parsed.riceImageUrl : undefined,
      deliveryAddress: typeof parsed.deliveryAddress === 'string' ? parsed.deliveryAddress : '',
    };
  } catch {
    return null;
  }
}

function createDefaultFloor(
  floorNumber: number,
  doughs: CatalogIngredient[],
  fillings: CatalogIngredient[],
  coverages: CatalogIngredient[],
  requireStructuredDough: boolean,
): CakeFloorInput {
  const chosenDough =
    (requireStructuredDough ? doughs.find((d) => !d.isAerated) : doughs[0]) ?? doughs[0];
  return {
    floorNumber,
    doughIngredientId: chosenDough.id,
    coverageIngredientId: coverages[0].id,
    fillingIngredientIds: [fillings[0].id],
    estimatedWeightKg: Math.max(0.8, Number((1.6 - (floorNumber - 1) * 0.3).toFixed(1))),
  };
}

function buildInitialDraft(catalog: CatalogIngredient[]): BuilderDraft | null {
  const doughs = catalog.filter((item) => item.type === 'MASSA' && item.active);
  const fillings = catalog.filter((item) => item.type === 'RECHEIO' && item.active);
  const coverages = catalog.filter((item) => item.type === 'COBERTURA' && item.active);

  if (doughs.length === 0 || fillings.length === 0 || coverages.length === 0) {
    return null;
  }

  return {
    format: 'REDONDO',
    colorHex: '#F3EDE3',
    floors: [createDefaultFloor(1, doughs, fillings, coverages, false)],
    dietaryFlags: [],
    toppingMessage: '',
    deliveryAddress: '',
  };
}

function hasAllergenConflict(
  ingredient: CatalogIngredient,
  flags: DietaryKey[],
): DietaryKey | null {
  const normalizedAllergens = ingredient.allergens.map((a) => a.trim().toLowerCase());
  for (const flag of flags) {
    const forbidden = DIETARY_EQUIVALENTS[flag];
    if (normalizedAllergens.some((tag) => forbidden.includes(tag))) {
      return flag;
    }
  }
  return null;
}

function findCompatibleSubstitute(
  catalog: CatalogIngredient[],
  type: IngredientType,
  flags: DietaryKey[],
  requireStructuredDough: boolean,
): CatalogIngredient | undefined {
  return catalog.find((candidate) => {
    if (!candidate.active || candidate.type !== type) return false;
    if (type === 'MASSA' && requireStructuredDough && candidate.isAerated) return false;
    return hasAllergenConflict(candidate, flags) === null;
  });
}

function isFloorCompleteForQuote(floor: CakeFloorInput): boolean {
  return (
    Boolean(floor.doughIngredientId) &&
    Boolean(floor.coverageIngredientId) &&
    floor.fillingIngredientIds.length >= 1 &&
    floor.fillingIngredientIds.length <= 2 &&
    floor.estimatedWeightKg >= 0.5 &&
    floor.estimatedWeightKg <= 20
  );
}

export function CakeBuilderView() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const formatId = useId();
  const floorsId = useId();
  const colorPickerId = useId();
  const ricePaperInputId = useId();

  const [catalog, setCatalog] = useState<CatalogIngredient[] | null>(null);
  const [catalogError, setCatalogError] = useState<string>();
  const [draft, setDraft] = useState<BuilderDraft | null>(null);
  const [weightInputs, setWeightInputs] = useState<Record<number, string>>({});
  const [quoteState, setQuoteState] = useState<QuoteState>({ key: '', quote: null });

  const [aeratedNotice, setAeratedNotice] = useState<string>();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string>();

  const catalogLoading = catalog === null && !catalogError;

  useEffect(() => {
    let active = true;

    fetchPublicCatalog()
      .then((items) => {
        if (!active) return;
        setCatalog(items);
        const restored = readDraftFromSession(items) ?? buildInitialDraft(items);
        if (restored) {
          saveDraftToSession(restored);
        }
        setDraft(restored);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCatalog([]);
        setCatalogError(
          error instanceof NetworkError ? texts.errors.network : texts.errors.catalogLoad,
        );
      });

    return () => {
      active = false;
    };
  }, []);

  const floorsSignature = draft ? JSON.stringify(draft.floors) : '';

  useEffect(() => {
    if (!draft || draft.floors.length === 0) {
      return;
    }

    const everyFloorValid = draft.floors.every(isFloorCompleteForQuote);
    if (!everyFloorValid) {
      return;
    }

    let active = true;
    const targetKey = JSON.stringify(draft.floors);

    calculateCakePrice(draft.floors)
      .then((quote) => {
        if (active) {
          setQuoteState({ key: targetKey, quote });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setQuoteState({
            key: targetKey,
            quote: null,
            error:
              error instanceof NetworkError ? texts.errors.network : texts.errors.pricingFailed,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [draft, floorsSignature]);

  if (catalogLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <p role="status" className="text-ink-muted">
          {texts.loadingCatalog}
        </p>
      </div>
    );
  }

  if (catalogError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <h1 className="font-serif text-4xl leading-tight tracking-[-0.015em]">{texts.title}</h1>
        <Alert variant="error" className="mt-6" messages={[catalogError]} />
      </div>
    );
  }

  if (!catalog || !draft) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <h1 className="font-serif text-4xl leading-tight tracking-[-0.015em]">{texts.title}</h1>
        <Alert variant="info" className="mt-6" messages={[texts.emptyCatalog]} />
      </div>
    );
  }

  const doughs = catalog.filter((item) => item.type === 'MASSA' && item.active);
  const fillings = catalog.filter((item) => item.type === 'RECHEIO' && item.active);
  const coverages = catalog.filter((item) => item.type === 'COBERTURA' && item.active);
  const catalogById = new Map(catalog.map((item) => [item.id, item]));

  const requireStructuredDough = draft.floors.length > 2;

  // Verifica conflitos RF06 em todas as camadas ativas
  const dietaryConflicts: string[] = [];
  if (draft.dietaryFlags.length > 0) {
    for (const floor of draft.floors) {
      const selectedIds = [
        floor.doughIngredientId,
        floor.coverageIngredientId,
        ...floor.fillingIngredientIds,
      ];
      for (const id of selectedIds) {
        const ingredient = catalogById.get(id);
        if (!ingredient) continue;
        const conflictedFlag = hasAllergenConflict(ingredient, draft.dietaryFlags);
        if (conflictedFlag) {
          const substitute = findCompatibleSubstitute(
            catalog,
            ingredient.type,
            draft.dietaryFlags,
            requireStructuredDough,
          );
          const msg = texts.dietarySection.conflictDetail(
            floor.floorNumber,
            ingredient.name,
            texts.dietarySection.options[conflictedFlag],
            substitute?.name,
          );
          if (!dietaryConflicts.includes(msg)) {
            dietaryConflicts.push(msg);
          }
        }
      }
    }
  }

  // Verifica RN01 (caso extremo em que nao exista massa estruturada no catalogo)
  const hasAeratedViolation =
    requireStructuredDough &&
    draft.floors.some((f) => catalogById.get(f.doughIngredientId)?.isAerated);

  const hasPendingInvalidWeight = draft.floors.some((floor) => {
    const raw = weightInputs[floor.floorNumber];
    if (raw === undefined) return false;
    const parsed = Number.parseFloat(raw.trim().replaceAll(',', '.'));
    return Number.isNaN(parsed) || parsed < 0.5 || parsed > 20;
  });

  const hasMissingFillings = draft.floors.some(
    (floor) => floor.fillingIngredientIds.length < 1 || floor.fillingIngredientIds.length > 2,
  );
  const canCalculateQuote = draft.floors.every(isFloorCompleteForQuote);
  const isQuoteLoading = canCalculateQuote && quoteState.key !== floorsSignature;
  const currentQuote =
    canCalculateQuote && quoteState.key === floorsSignature ? quoteState.quote : null;

  function updateDraft(updater: (prev: BuilderDraft) => BuilderDraft) {
    setActionError(undefined);
    setDraft((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      saveDraftToSession(next);
      return next;
    });
  }

  function handleFloorsCountChange(nextCount: number) {
    if (!draft) return;
    const mustBeStructured = nextCount > 2;
    const structuredFallback = doughs.find((d) => !d.isAerated);
    let replacedAerated = false;

    const nextFloors: CakeFloorInput[] = [];
    for (let i = 1; i <= nextCount; i++) {
      const existing = draft.floors[i - 1];
      if (existing) {
        const currentDough = catalogById.get(existing.doughIngredientId);
        if (mustBeStructured && currentDough?.isAerated && structuredFallback) {
          replacedAerated = true;
          nextFloors.push({
            ...existing,
            floorNumber: i,
            doughIngredientId: structuredFallback.id,
          });
        } else {
          nextFloors.push({ ...existing, floorNumber: i });
        }
      } else {
        nextFloors.push(createDefaultFloor(i, doughs, fillings, coverages, mustBeStructured));
      }
    }

    const nextDraft: BuilderDraft = { ...draft, floors: nextFloors };
    setActionError(undefined);
    setWeightInputs({});
    saveDraftToSession(nextDraft);
    setDraft(nextDraft);
    setAeratedNotice(replacedAerated ? texts.floorsSection.aeratedAutoAdjusted : undefined);
  }

  function updateFloor(floorNumber: number, patch: Partial<CakeFloorInput>) {
    setAeratedNotice(undefined);
    updateDraft((prev) => ({
      ...prev,
      floors: prev.floors.map((floor) =>
        floor.floorNumber === floorNumber ? { ...floor, ...patch } : floor,
      ),
    }));
  }

  function handleWeightChange(floorNumber: number, rawValue: string) {
    setWeightInputs((prev) => ({ ...prev, [floorNumber]: rawValue }));
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return;
    }
    const parsed = Number.parseFloat(trimmed.replaceAll(',', '.'));
    if (!Number.isNaN(parsed) && parsed >= 0.5 && parsed <= 20) {
      updateFloor(floorNumber, {
        estimatedWeightKg: Number(parsed.toFixed(2)),
      });
    }
  }

  function handleWeightBlur(floorNumber: number, fallbackWeightKg: number) {
    const rawValue = weightInputs[floorNumber];
    if (rawValue === undefined) {
      return;
    }
    const parsed = Number.parseFloat(rawValue.trim().replaceAll(',', '.'));
    const clamped = Number.isNaN(parsed)
      ? Math.max(0.5, Math.min(20, fallbackWeightKg))
      : Math.max(0.5, Math.min(20, Number(parsed.toFixed(2))));

    updateFloor(floorNumber, { estimatedWeightKg: clamped });
    setWeightInputs((prev) => {
      const next = { ...prev };
      delete next[floorNumber];
      return next;
    });
  }

  function toggleFilling(floorNumber: number, fillingId: string) {
    updateDraft((prev) => ({
      ...prev,
      floors: prev.floors.map((floor) => {
        if (floor.floorNumber !== floorNumber) return floor;
        const exists = floor.fillingIngredientIds.includes(fillingId);
        if (exists) {
          return {
            ...floor,
            fillingIngredientIds: floor.fillingIngredientIds.filter((id) => id !== fillingId),
          };
        }
        if (floor.fillingIngredientIds.length >= 2) {
          return floor;
        }
        return {
          ...floor,
          fillingIngredientIds: [...floor.fillingIngredientIds, fillingId],
        };
      }),
    }));
  }

  function toggleDietaryFlag(flag: DietaryKey) {
    updateDraft((prev) => {
      const exists = prev.dietaryFlags.includes(flag);
      return {
        ...prev,
        dietaryFlags: exists
          ? prev.dietaryFlags.filter((item) => item !== flag)
          : [...prev.dietaryFlags, flag],
      };
    });
  }

  async function handleRicePaperChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setActionError(undefined);
    setUploadSuccess(undefined);

    try {
      const uploaded = await uploadRicePaperImage(file);
      updateDraft((prev) => ({ ...prev, riceImageUrl: uploaded.url }));
      setUploadSuccess(texts.personalizationSection.ricePaperUploaded);
    } catch (error) {
      setActionError(
        error instanceof NetworkError ? texts.errors.network : texts.errors.uploadFailed,
      );
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  }

  function handleResetDraft() {
    if (!catalog) return;
    const fresh = buildInitialDraft(catalog);
    if (fresh) {
      saveDraftToSession(fresh);
      setDraft(fresh);
      setWeightInputs({});
      setAeratedNotice(undefined);
      setUploadSuccess(undefined);
      setActionError(undefined);
    }
  }

  async function handleSubmitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !draft ||
      !user ||
      dietaryConflicts.length > 0 ||
      hasAeratedViolation ||
      hasMissingFillings ||
      hasPendingInvalidWeight
    ) {
      return;
    }

    setSubmitting(true);
    setActionError(undefined);

    try {
      const created = await createOrder({
        format: draft.format,
        colorHex: draft.colorHex,
        floors: draft.floors,
        dietaryFlags: draft.dietaryFlags,
        toppingMessage: draft.toppingMessage.trim() || undefined,
        riceImageUrl: draft.riceImageUrl,
        deliveryAddress: draft.deliveryAddress.trim() || undefined,
      });
      clearDraftFromSession();
      router.push(`/meus-pedidos?novo=${created.id}`);
    } catch (error) {
      setActionError(
        error instanceof NetworkError ? texts.errors.network : texts.errors.orderFailed,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="max-w-3xl">
        <h1 className="font-serif text-4xl leading-tight tracking-[-0.015em] sm:text-5xl">
          {texts.title}
        </h1>
        <p className="mt-2 text-base text-ink-muted">{texts.subtitle}</p>
      </div>

      {actionError && <Alert variant="error" className="mt-6" messages={[actionError]} />}
      {aeratedNotice && <Alert variant="info" className="mt-6" messages={[aeratedNotice]} />}
      {hasAeratedViolation && (
        <Alert
          variant="error"
          className="mt-6"
          messages={[texts.floorsSection.aeratedManualError]}
        />
      )}
      {dietaryConflicts.length > 0 && (
        <Alert
          variant="error"
          className="mt-6"
          title={texts.dietarySection.conflictTitle}
          messages={dietaryConflicts}
        />
      )}

      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmitOrder(event);
        }}
        className="mt-8 grid gap-8 lg:grid-cols-12 lg:items-start"
      >
        {/* Coluna principal de configuracao (7 colunas no desktop) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Estrutura e acabamento (RF04) */}
          <section className="rounded-control border border-line bg-surface p-6">
            <h2 className="font-serif text-2xl">{texts.structureSection.title}</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={formatId} className="text-sm font-medium text-ink">
                  {texts.structureSection.formatLabel}
                </label>
                <select
                  id={formatId}
                  value={draft.format}
                  onChange={(e) =>
                    updateDraft((prev) => ({
                      ...prev,
                      format: e.target.value as CakeFormat,
                    }))
                  }
                  className="h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-base text-ink"
                >
                  {FORMAT_OPTIONS.map((fmt) => (
                    <option key={fmt} value={fmt}>
                      {texts.structureSection.formats[fmt]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={floorsId} className="text-sm font-medium text-ink">
                  {texts.structureSection.floorsLabel}
                </label>
                <select
                  id={floorsId}
                  value={String(draft.floors.length)}
                  onChange={(e) => handleFloorsCountChange(Number(e.target.value))}
                  className="h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-base text-ink"
                >
                  {FLOOR_COUNTS.map((count) => (
                    <option key={count} value={String(count)}>
                      {texts.structureSection.floorOption(count)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={colorPickerId} className="text-sm font-medium text-ink">
                  {texts.structureSection.colorPickerLabel}
                </label>
                <span className="font-mono text-xs font-medium text-ink-muted">
                  {draft.colorHex}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                <input
                  id={colorPickerId}
                  type="color"
                  value={draft.colorHex}
                  onChange={(e) =>
                    updateDraft((prev) => ({
                      ...prev,
                      colorHex: e.target.value.toUpperCase(),
                    }))
                  }
                  className="h-11 w-14 cursor-pointer rounded-control border border-line-strong bg-surface p-1"
                />
                {PRESET_SWATCHES.map((swatch) => {
                  const selected = draft.colorHex.toUpperCase() === swatch.hex;
                  return (
                    <button
                      key={swatch.hex}
                      type="button"
                      onClick={() => updateDraft((prev) => ({ ...prev, colorHex: swatch.hex }))}
                      aria-pressed={selected}
                      className={`inline-flex h-11 items-center gap-2 rounded-control border px-3 text-xs font-medium transition-colors ${
                        selected
                          ? 'border-ink bg-sand-100 text-ink font-bold'
                          : 'border-line-strong bg-surface text-ink hover:bg-sand-100'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="h-4 w-4 rounded-full border border-line-strong"
                        style={{ backgroundColor: swatch.hex }}
                      />
                      {swatch.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Restricoes alimentares (RF06) */}
          <section className="rounded-control border border-line bg-surface p-6">
            <h2 className="font-serif text-2xl">{texts.dietarySection.title}</h2>
            <p className="mt-1 text-sm text-ink-muted">{texts.dietarySection.hint}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {DIETARY_KEYS.map((key) => {
                const checked = draft.dietaryFlags.includes(key);
                return (
                  <label
                    key={key}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-control border px-3.5 py-2 text-sm transition-colors ${
                      checked
                        ? 'border-ink bg-sand-100 font-bold text-ink'
                        : 'border-line bg-surface text-ink hover:bg-sand-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDietaryFlag(key)}
                      className="h-4 w-4 accent-ink"
                    />
                    <span>{texts.dietarySection.options[key]}</span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Camadas por andar (RF02 / RN01) */}
          <section className="space-y-4">
            <h2 className="font-serif text-2xl">{texts.floorsSection.title}</h2>

            {draft.floors.map((floor) => {
              const doughSelectId = `floor-${floor.floorNumber}-dough`;
              const covSelectId = `floor-${floor.floorNumber}-coverage`;
              const weightInputId = `floor-${floor.floorNumber}-weight`;

              return (
                <div
                  key={floor.floorNumber}
                  className="rounded-control border border-line bg-surface p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-serif text-xl">
                      {texts.floorsSection.floorHeading(floor.floorNumber)}
                    </h3>

                    <div className="flex items-center gap-2">
                      <label htmlFor={weightInputId} className="text-sm font-medium text-ink">
                        {texts.floorsSection.weightLabel}
                      </label>
                      <input
                        id={weightInputId}
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="20"
                        value={weightInputs[floor.floorNumber] ?? String(floor.estimatedWeightKg)}
                        onChange={(e) => handleWeightChange(floor.floorNumber, e.target.value)}
                        onBlur={() => handleWeightBlur(floor.floorNumber, floor.estimatedWeightKg)}
                        className="h-11 w-24 rounded-control border border-line-strong bg-surface px-3 text-base text-ink"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={doughSelectId} className="text-sm font-medium text-ink">
                        {texts.floorsSection.doughLabel}
                      </label>
                      <select
                        id={doughSelectId}
                        value={floor.doughIngredientId}
                        onChange={(e) =>
                          updateFloor(floor.floorNumber, { doughIngredientId: e.target.value })
                        }
                        className="h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-base text-ink"
                      >
                        {doughs.map((dough) => {
                          const blockedByRn01 = requireStructuredDough && dough.isAerated;
                          return (
                            <option key={dough.id} value={dough.id} disabled={blockedByRn01}>
                              {dough.name} ({brlFormatter.format(dough.pricePerKg)}/kg)
                              {blockedByRn01 ? ` — ${texts.floorsSection.aeratedBlockedTag}` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={covSelectId} className="text-sm font-medium text-ink">
                        {texts.floorsSection.coverageLabel}
                      </label>
                      <select
                        id={covSelectId}
                        value={floor.coverageIngredientId}
                        onChange={(e) =>
                          updateFloor(floor.floorNumber, {
                            coverageIngredientId: e.target.value,
                          })
                        }
                        className="h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-base text-ink"
                      >
                        {coverages.map((cov) => (
                          <option key={cov.id} value={cov.id}>
                            {cov.name} ({brlFormatter.format(cov.pricePerKg)}/kg)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <fieldset className="mt-4">
                    <legend className="text-sm font-medium text-ink">
                      {texts.floorsSection.fillingsLabel}
                    </legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {fillings.map((filling) => {
                        const selected = floor.fillingIngredientIds.includes(filling.id);
                        const atMax = !selected && floor.fillingIngredientIds.length >= 2;
                        return (
                          <label
                            key={filling.id}
                            className={`flex min-h-11 items-center gap-2.5 rounded-control border px-3 py-2 text-sm ${
                              selected
                                ? 'border-ink bg-sand-100 font-medium text-ink'
                                : atMax
                                  ? 'cursor-not-allowed border-line bg-paper text-ink-muted opacity-60'
                                  : 'cursor-pointer border-line bg-surface text-ink hover:bg-sand-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={atMax}
                              onChange={() => toggleFilling(floor.floorNumber, filling.id)}
                              className="h-4 w-4 accent-ink"
                            />
                            <span>
                              {filling.name} ({brlFormatter.format(filling.pricePerKg)}/kg)
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                </div>
              );
            })}
          </section>

          {/* Personalizacao e entrega (RF05) */}
          <section className="space-y-4 rounded-control border border-line bg-surface p-6">
            <h2 className="font-serif text-2xl">{texts.personalizationSection.title}</h2>

            <Field
              label={texts.personalizationSection.toppingMessageLabel}
              hint={texts.personalizationSection.toppingMessageHint}
              maxLength={120}
              value={draft.toppingMessage}
              onChange={(e) => updateDraft((prev) => ({ ...prev, toppingMessage: e.target.value }))}
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor={ricePaperInputId} className="text-sm font-medium text-ink">
                {texts.personalizationSection.ricePaperLabel}
              </label>
              <input
                id={ricePaperInputId}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploadingImage}
                onChange={(event) => {
                  void handleRicePaperChange(event);
                }}
                className="block w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-sm text-ink file:mr-3 file:rounded-control file:border-0 file:bg-sand-100 file:px-3 file:py-1.5 file:font-bold file:text-ink"
              />
              {uploadingImage && (
                <p role="status" className="text-sm text-ink-muted">
                  {texts.personalizationSection.ricePaperUploading}
                </p>
              )}
              {uploadSuccess && draft.riceImageUrl && (
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-control border border-success-line bg-success-soft px-3 py-2 text-sm text-success">
                  <span>{uploadSuccess}</span>
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => {
                      setUploadSuccess(undefined);
                      updateDraft((prev) => ({ ...prev, riceImageUrl: undefined }));
                    }}
                  >
                    {texts.personalizationSection.removeRicePaper}
                  </Button>
                </div>
              )}
            </div>

            <Field
              label={texts.personalizationSection.deliveryAddressLabel}
              maxLength={255}
              value={draft.deliveryAddress}
              onChange={(e) =>
                updateDraft((prev) => ({ ...prev, deliveryAddress: e.target.value }))
              }
            />
          </section>
        </div>

        {/* Coluna lateral sticky: Preview 3D (RF04) + Orcamento em tempo real (RN02 / RF07) */}
        <aside className="space-y-6 lg:sticky lg:top-6 lg:col-span-5">
          <CakePreview3D
            format={draft.format}
            floorsCount={draft.floors.length}
            colorHex={draft.colorHex}
            toppingMessage={draft.toppingMessage}
            riceImageUrl={draft.riceImageUrl ? resolveApiAssetUrl(draft.riceImageUrl) : undefined}
          />

          <div className="rounded-control border border-line bg-surface p-6">
            <h2 className="font-serif text-2xl">{texts.quoteSection.title}</h2>

            {quoteState.error && (
              <Alert variant="error" className="mt-4" messages={[quoteState.error]} />
            )}

            {hasMissingFillings && (
              <Alert
                variant="info"
                className="mt-4"
                messages={[texts.floorsSection.fillingsCountError]}
              />
            )}

            {isQuoteLoading && !currentQuote ? (
              <p role="status" className="mt-4 text-sm text-ink-muted">
                {texts.quoteSection.calculating}
              </p>
            ) : currentQuote ? (
              <dl className="mt-4 space-y-2.5 text-sm">
                {currentQuote.layers.map((layer) => (
                  <div
                    key={layer.floorNumber}
                    className="flex items-center justify-between gap-3 text-ink-muted"
                  >
                    <dt>
                      {texts.quoteSection.floorItem(
                        layer.floorNumber,
                        layer.weightKg.toLocaleString('pt-BR'),
                      )}
                    </dt>
                    <dd className="font-medium text-ink">{brlFormatter.format(layer.subtotal)}</dd>
                  </div>
                ))}

                <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5 text-ink-muted">
                  <dt>{texts.quoteSection.totalWeightLabel}</dt>
                  <dd className="font-medium text-ink">
                    {(() => {
                      const totalWeightKg = currentQuote.layers.reduce(
                        (acc, layer) => acc + layer.weightKg,
                        0,
                      );
                      const estimatedSlices = Math.max(1, Math.round(totalWeightKg * 10));
                      return texts.quoteSection.servingsEstimate(
                        totalWeightKg.toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
                        estimatedSlices,
                      );
                    })()}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5 text-ink-muted">
                  <dt>{texts.quoteSection.assemblyFee}</dt>
                  <dd className="font-medium text-ink">
                    {brlFormatter.format(currentQuote.assemblyBaseFee)}
                  </dd>
                </div>

                <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                  <dt className="text-base font-bold text-ink">{texts.quoteSection.total}</dt>
                  <dd className="font-serif text-3xl font-bold text-ink">
                    {brlFormatter.format(currentQuote.totalPrice)}
                  </dd>
                </div>
              </dl>
            ) : null}

            <p className="mt-4 text-xs text-ink-muted">{texts.quoteSection.pixNotice}</p>

            {!authLoading && !user ? (
              <div className="mt-5 space-y-3">
                <Alert variant="info" messages={[texts.quoteSection.guestNotice]} />
                <div className="flex flex-col gap-2.5">
                  <Link href="/entrar" className={buttonStyles({ fullWidth: true })}>
                    {texts.quoteSection.loginToCheckout}
                  </Link>
                  <Link
                    href="/cadastro"
                    className={buttonStyles({ variant: 'secondary', fullWidth: true })}
                  >
                    {texts.quoteSection.registerToCheckout}
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-2.5">
                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  loading={submitting}
                  disabled={
                    authLoading ||
                    uploadingImage ||
                    dietaryConflicts.length > 0 ||
                    hasAeratedViolation ||
                    hasMissingFillings ||
                    hasPendingInvalidWeight ||
                    !currentQuote
                  }
                >
                  {texts.quoteSection.submitOrder}
                </Button>
                <Button type="button" variant="ghost" fullWidth onClick={handleResetDraft}>
                  {texts.quoteSection.resetDraft}
                </Button>
              </div>
            )}
          </div>
        </aside>
      </form>
    </div>
  );
}
