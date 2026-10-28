'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button, buttonStyles } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { messages } from '@/content/messages';
import { useAuth } from '@/features/auth/auth-provider';
import {
  createCatalogIngredient,
  deactivateCatalogIngredient,
  fetchAdminCatalog,
  updateCatalogIngredient,
} from '@/lib/api/catalog';
import type { CatalogIngredient, IngredientType } from '@/lib/api/catalog';
import { NetworkError } from '@/lib/api/errors';

const texts = messages.adminCatalog;

type FilterOption = 'ALL' | IngredientType;

const FILTER_OPTIONS: FilterOption[] = ['ALL', 'MASSA', 'RECHEIO', 'COBERTURA'];
const INGREDIENT_TYPES: IngredientType[] = ['MASSA', 'RECHEIO', 'COBERTURA'];

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

interface FormState {
  mode: 'closed' | 'create' | 'edit';
  editingId?: string;
  name: string;
  type: IngredientType;
  pricePerKg: string;
  allergensText: string;
  isAerated: boolean;
}

const CLOSED_FORM: FormState = {
  mode: 'closed',
  name: '',
  type: 'MASSA',
  pricePerKg: '',
  allergensText: '',
  isAerated: false,
};

function parseAllergens(raw: string): string[] {
  const unique = new Set<string>();
  for (const part of raw.split(',')) {
    const cleaned = part.trim().toLowerCase();
    if (cleaned.length > 0) {
      unique.add(cleaned);
    }
  }
  return Array.from(unique);
}

export function AdminCatalogView() {
  const { user, isLoading: authLoading } = useAuth();
  const typeSelectId = useId();
  const aeratedCheckboxId = useId();

  const [items, setItems] = useState<CatalogIngredient[] | null>(null);
  const [filter, setFilter] = useState<FilterOption>('ALL');
  const [form, setForm] = useState<FormState>(CLOSED_FORM);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; pricePerKg?: string }>({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string>();
  const [errorBanner, setErrorBanner] = useState<string>();
  const [feedbackBanner, setFeedbackBanner] = useState<string>();

  const isAdmin = user?.role === 'ADMIN';
  const catalogLoading = isAdmin && items === null && !errorBanner;

  useEffect(() => {
    if (authLoading || !isAdmin) {
      return;
    }

    let active = true;

    fetchAdminCatalog()
      .then((loaded) => {
        if (active) {
          setItems(loaded);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setItems([]);
          setErrorBanner(
            error instanceof NetworkError ? texts.errors.network : texts.errors.loadFailed,
          );
        }
      });

    return () => {
      active = false;
    };
  }, [authLoading, isAdmin]);

  if (authLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <p role="status" className="text-ink-muted">
          {texts.loadingMessage}
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-12 sm:py-20">
        <h1 className="font-serif text-4xl leading-tight tracking-[-0.015em]">
          {texts.unauthenticatedTitle}
        </h1>
        <p className="mt-3 text-ink-muted">{texts.unauthenticatedBody}</p>
        <Link href="/entrar" className={`${buttonStyles({ size: 'lg', fullWidth: true })} mt-8`}>
          {texts.goToLogin}
        </Link>
      </div>
    );
  }

  if (user.role !== 'ADMIN') {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-12 sm:py-20">
        <h1 className="font-serif text-4xl leading-tight tracking-[-0.015em]">
          {texts.forbiddenTitle}
        </h1>
        <p className="mt-3 text-ink-muted">{texts.forbiddenBody}</p>
        <Link href="/" className={`${buttonStyles({ size: 'lg', fullWidth: true })} mt-8`}>
          {texts.backHome}
        </Link>
      </div>
    );
  }

  function openCreateForm() {
    setFieldErrors({});
    setErrorBanner(undefined);
    setFeedbackBanner(undefined);
    setForm({
      mode: 'create',
      name: '',
      type: filter === 'ALL' ? 'MASSA' : filter,
      pricePerKg: '',
      allergensText: '',
      isAerated: false,
    });
  }

  function openEditForm(item: CatalogIngredient) {
    setFieldErrors({});
    setErrorBanner(undefined);
    setFeedbackBanner(undefined);
    setForm({
      mode: 'edit',
      editingId: item.id,
      name: item.name,
      type: item.type,
      pricePerKg: String(item.pricePerKg),
      allergensText: item.allergens.join(', '),
      isAerated: item.isAerated,
    });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = form.name.trim();
    const normalizedPriceText = form.pricePerKg.trim().replace(',', '.');
    const parsedPrice =
      normalizedPriceText === '' ? Number.NaN : Number(normalizedPriceText);

    const nextErrors: { name?: string; pricePerKg?: string } = {};
    if (trimmedName.length < 2) {
      nextErrors.name = texts.validation.name;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      nextErrors.pricePerKg = texts.validation.pricePerKg;
    }

    if (nextErrors.name || nextErrors.pricePerKg) {
      setFieldErrors(nextErrors);
      return;
    }

    setSaving(true);
    setFieldErrors({});
    setErrorBanner(undefined);
    setFeedbackBanner(undefined);

    const payload = {
      name: trimmedName,
      type: form.type,
      pricePerKg: Math.round(parsedPrice * 100) / 100,
      isAerated: form.type === 'MASSA' ? form.isAerated : false,
      allergens: parseAllergens(form.allergensText),
    };

    try {
      if (form.mode === 'create') {
        const created = await createCatalogIngredient(payload);
        setItems((current) => [...(current ?? []), created]);
        setFeedbackBanner(texts.feedback.created(created.name));
      } else if (form.mode === 'edit' && form.editingId) {
        const updated = await updateCatalogIngredient(form.editingId, payload);
        setItems((current) =>
          (current ?? []).map((existing) => (existing.id === updated.id ? updated : existing)),
        );
        setFeedbackBanner(texts.feedback.updated(updated.name));
      }
      setForm(CLOSED_FORM);
    } catch (error) {
      setErrorBanner(
        error instanceof NetworkError ? texts.errors.network : texts.errors.saveFailed,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(item: CatalogIngredient) {
    setBusyId(item.id);
    setErrorBanner(undefined);
    setFeedbackBanner(undefined);
    try {
      await deactivateCatalogIngredient(item.id);
      setItems((current) =>
        (current ?? []).map((existing) =>
          existing.id === item.id ? { ...existing, active: false } : existing,
        ),
      );
      setFeedbackBanner(texts.feedback.deactivated(item.name));
    } catch (error) {
      setErrorBanner(
        error instanceof NetworkError ? texts.errors.network : texts.errors.saveFailed,
      );
    } finally {
      setBusyId(undefined);
    }
  }

  async function handleReactivate(item: CatalogIngredient) {
    setBusyId(item.id);
    setErrorBanner(undefined);
    setFeedbackBanner(undefined);
    try {
      const updated = await updateCatalogIngredient(item.id, { active: true });
      setItems((current) =>
        (current ?? []).map((existing) => (existing.id === updated.id ? updated : existing)),
      );
      setFeedbackBanner(texts.feedback.reactivated(updated.name));
    } catch (error) {
      setErrorBanner(
        error instanceof NetworkError ? texts.errors.network : texts.errors.saveFailed,
      );
    } finally {
      setBusyId(undefined);
    }
  }

  const allItems = items ?? [];
  const visibleItems =
    filter === 'ALL' ? allItems : allItems.filter((ingredient) => ingredient.type === filter);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl leading-tight tracking-[-0.015em]">{texts.title}</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">{texts.subtitle}</p>
        </div>

        {form.mode === 'closed' && (
          <Button variant="primary" onClick={openCreateForm}>
            {texts.actions.newIngredient}
          </Button>
        )}
      </div>

      {errorBanner && <Alert variant="error" className="mt-6" messages={[errorBanner]} />}
      {feedbackBanner && (
        <Alert variant="success" className="mt-6">
          {feedbackBanner}
        </Alert>
      )}

      {/* Formulario de criacao ou edicao */}
      {form.mode !== 'closed' && (
        <section className="mt-8 rounded-control border border-line-strong bg-surface p-6">
          <h2 className="font-serif text-2xl">
            {form.mode === 'create' ? texts.form.createTitle : texts.form.editTitle}
          </h2>

          <form
            onSubmit={(event) => {
              void handleSave(event);
            }}
            noValidate
            className="mt-6 grid gap-5 sm:grid-cols-2"
          >
            <Field
              label={texts.form.nameLabel}
              name="name"
              required
              value={form.name}
              onChange={(event) => {
                setForm((current) => ({ ...current, name: event.target.value }));
                if (fieldErrors.name) {
                  setFieldErrors((current) => ({ ...current, name: undefined }));
                }
              }}
              error={fieldErrors.name}
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor={typeSelectId} className="text-sm font-bold text-ink">
                {texts.form.typeLabel}
              </label>
              <select
                id={typeSelectId}
                name="type"
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    type: event.target.value as IngredientType,
                  }))
                }
                className="h-11 rounded-control border border-line-strong bg-surface px-3.5 text-base text-ink"
              >
                {INGREDIENT_TYPES.map((typeOption) => (
                  <option key={typeOption} value={typeOption}>
                    {texts.types[typeOption]}
                  </option>
                ))}
              </select>
            </div>

            <Field
              label={texts.form.pricePerKgLabel}
              name="pricePerKg"
              inputMode="decimal"
              required
              value={form.pricePerKg}
              onChange={(event) => {
                setForm((current) => ({ ...current, pricePerKg: event.target.value }));
                if (fieldErrors.pricePerKg) {
                  setFieldErrors((current) => ({ ...current, pricePerKg: undefined }));
                }
              }}
              error={fieldErrors.pricePerKg}
            />

            <Field
              label={texts.form.allergensLabel}
              name="allergens"
              hint={texts.form.allergensHint}
              value={form.allergensText}
              onChange={(event) =>
                setForm((current) => ({ ...current, allergensText: event.target.value }))
              }
            />

            {form.type === 'MASSA' && (
              <div className="flex items-center gap-3 sm:col-span-2">
                <input
                  id={aeratedCheckboxId}
                  type="checkbox"
                  checked={form.isAerated}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isAerated: event.target.checked }))
                  }
                  className="h-5 w-5 accent-ink"
                />
                <label htmlFor={aeratedCheckboxId} className="text-sm font-medium text-ink">
                  {texts.form.isAeratedLabel}
                </label>
              </div>
            )}

            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <Button type="submit" loading={saving}>
                {form.mode === 'create' ? texts.actions.saveNew : texts.actions.saveEdit}
              </Button>
              <Button
                variant="ghost"
                disabled={saving}
                onClick={() => {
                  setForm(CLOSED_FORM);
                  setFieldErrors({});
                }}
              >
                {texts.actions.cancel}
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* Filtros por categoria */}
      <div
        role="group"
        aria-label={texts.filtersLabel}
        className="mt-8 flex flex-wrap gap-2"
      >
        {FILTER_OPTIONS.map((option) => (
          <Button
            key={option}
            variant={filter === option ? 'primary' : 'secondary'}
            size="md"
            aria-pressed={filter === option}
            onClick={() => setFilter(option)}
          >
            {texts.filters[option]}
          </Button>
        ))}
      </div>

      {/* Lista de insumos */}
      {catalogLoading ? (
        <p role="status" className="mt-8 text-ink-muted">
          {texts.loadingMessage}
        </p>
      ) : visibleItems.length === 0 ? (
        <p className="mt-8 rounded-control border border-line bg-surface p-6 text-ink-muted">
          {texts.emptyMessage}
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {visibleItems.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-control border border-line bg-surface p-5"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-serif text-xl font-normal">{item.name}</span>
                  <span className="rounded-control border border-line bg-sand-100 px-2.5 py-0.5 text-xs font-bold">
                    {texts.types[item.type]}
                  </span>
                  <span
                    className={
                      item.active
                        ? 'rounded-control border border-success-line bg-success-soft px-2.5 py-0.5 text-xs font-bold text-success'
                        : 'rounded-control border border-danger-line bg-danger-soft px-2.5 py-0.5 text-xs font-bold text-danger'
                    }
                  >
                    {item.active ? texts.status.active : texts.status.inactive}
                  </span>
                  {item.isAerated && (
                    <span className="rounded-control border border-line-strong bg-sand-200 px-2.5 py-0.5 text-xs font-bold text-ink">
                      {texts.badges.aerated}
                    </span>
                  )}
                </div>

                <p className="mt-1 font-bold text-accent">
                  {brlFormatter.format(item.pricePerKg)} / kg
                </p>

                <p className="mt-1 text-xs text-ink-muted">
                  {item.allergens.length > 0
                    ? `${texts.badges.allergensPrefix} ${item.allergens.join(', ')}`
                    : texts.badges.noAllergens}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="md" onClick={() => openEditForm(item)}>
                  {texts.actions.edit}
                </Button>
                {item.active ? (
                  <Button
                    variant="ghost"
                    size="md"
                    loading={busyId === item.id}
                    onClick={() => {
                      void handleDeactivate(item);
                    }}
                  >
                    {texts.actions.deactivate}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="md"
                    loading={busyId === item.id}
                    onClick={() => {
                      void handleReactivate(item);
                    }}
                  >
                    {texts.actions.reactivate}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
