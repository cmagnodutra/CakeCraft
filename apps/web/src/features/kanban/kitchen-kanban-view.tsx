'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button, buttonStyles } from '@/components/ui/button';
import { messages } from '@/content/messages';
import { useAuth } from '@/features/auth/auth-provider';
import { NetworkError } from '@/lib/api/errors';
import {
  fetchKanbanOrders,
  updateKanbanOrderStatus,
} from '@/lib/api/kanban-reports';
import type { KanbanOrderCard, KanbanTargetStatus } from '@/lib/api/kanban-reports';
import { cancelOrder, resolveApiAssetUrl } from '@/lib/api/orders';
import { subscribeToOrderUpdates } from '@/lib/realtime/orders-socket';

const texts = messages.adminKanban;

type BoardColumnStatus = 'EM_ESPERA' | 'EM_PRODUCAO' | 'FINALIZACAO' | 'PRONTO';

const BOARD_COLUMNS: BoardColumnStatus[] = [
  'EM_ESPERA',
  'EM_PRODUCAO',
  'FINALIZACAO',
  'PRONTO',
];

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function KitchenKanbanView() {
  const { user, isLoading: authLoading } = useAuth();

  const [cards, setCards] = useState<KanbanOrderCard[] | null>(null);
  const [busyId, setBusyId] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string>();
  const [feedbackBanner, setFeedbackBanner] = useState<string>();
  const [searchQuery, setSearchQuery] = useState('');
  const [modalityFilter, setModalityFilter] = useState<'ALL' | 'DELIVERY' | 'PICKUP'>('ALL');

  const isAdmin = user?.role === 'ADMIN';
  const initialLoading = isAdmin && cards === null && !errorBanner;

  const reloadQueue = useCallback(async () => {
    try {
      const loaded = await fetchKanbanOrders();
      setCards(loaded);
      setErrorBanner(undefined);
    } catch (error) {
      setCards((prev) => prev ?? []);
      setErrorBanner(
        error instanceof NetworkError ? texts.errors.network : texts.errors.loadFailed,
      );
    }
  }, []);

  useEffect(() => {
    if (authLoading || !isAdmin) {
      return;
    }

    let active = true;

    fetchKanbanOrders()
      .then((loaded) => {
        if (active) {
          setCards(loaded);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setCards([]);
          setErrorBanner(
            error instanceof NetworkError ? texts.errors.network : texts.errors.loadFailed,
          );
        }
      });

    const unsubscribe = subscribeToOrderUpdates(() => {
      if (active) {
        void reloadQueue();
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [authLoading, isAdmin, reloadQueue]);

  if (authLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
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
        <p className="mt-3 text-base text-ink-muted">{texts.unauthenticatedBody}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/entrar" className={buttonStyles({ size: 'lg' })}>
            {texts.goToLogin}
          </Link>
          <Link href="/" className={buttonStyles({ variant: 'secondary', size: 'lg' })}>
            {texts.backHome}
          </Link>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-12 sm:py-20">
        <h1 className="font-serif text-4xl leading-tight tracking-[-0.015em]">
          {texts.forbiddenTitle}
        </h1>
        <p className="mt-3 text-base text-ink-muted">{texts.forbiddenBody}</p>
        <div className="mt-8">
          <Link href="/" className={buttonStyles({ variant: 'secondary', size: 'lg' })}>
            {texts.backHome}
          </Link>
        </div>
      </div>
    );
  }

  async function handleManualRefresh() {
    setRefreshing(true);
    try {
      await reloadQueue();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleMoveCard(card: KanbanOrderCard, targetStatus: KanbanTargetStatus) {
    setBusyId(card.id);
    setErrorBanner(undefined);
    setFeedbackBanner(undefined);
    const shortId = card.id.slice(0, 8);

    try {
      const updated = await updateKanbanOrderStatus(card.id, targetStatus);
      if (targetStatus === 'ENTREGUE') {
        setCards((prev) => (prev ?? []).filter((item) => item.id !== card.id));
        setFeedbackBanner(texts.feedback.delivered(shortId));
      } else {
        setCards((prev) =>
          (prev ?? []).map((item) => (item.id === updated.id ? updated : item)),
        );
        if (targetStatus === 'PRONTO') {
          setFeedbackBanner(texts.feedback.markedReady(shortId));
        } else {
          setFeedbackBanner(texts.feedback.moved(shortId, texts.columns[targetStatus]));
        }
      }
    } catch (error) {
      setErrorBanner(
        error instanceof NetworkError ? texts.errors.network : texts.errors.transitionFailed,
      );
    } finally {
      setBusyId(undefined);
    }
  }

  async function handleAdminCancel(card: KanbanOrderCard) {
    setBusyId(card.id);
    setErrorBanner(undefined);
    setFeedbackBanner(undefined);
    const shortId = card.id.slice(0, 8);

    try {
      await cancelOrder(card.id);
      setCards((prev) => (prev ?? []).filter((item) => item.id !== card.id));
      setFeedbackBanner(texts.feedback.cancelled(shortId));
    } catch (error) {
      setErrorBanner(
        error instanceof NetworkError ? texts.errors.network : texts.errors.transitionFailed,
      );
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-4xl leading-tight tracking-[-0.015em] sm:text-5xl">
              {texts.title}
            </h1>
            <span className="rounded-control border border-success-line bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
              {texts.liveBadge}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-base text-ink-muted">{texts.subtitle}</p>
        </div>

        <Button
          variant="secondary"
          size="md"
          loading={refreshing}
          onClick={() => {
            void handleManualRefresh();
          }}
        >
          {texts.refreshButton}
        </Button>
      </div>

      {errorBanner && <Alert variant="error" className="mt-6" messages={[errorBanner]} />}
      {feedbackBanner && <Alert variant="success" className="mt-6" messages={[feedbackBanner]} />}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-control border border-line bg-surface p-4">
        <div className="min-w-[240px] flex-1">
          <input
            type="search"
            aria-label={texts.searchAriaLabel}
            placeholder={texts.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-control border border-line-strong bg-surface px-3 text-sm text-ink"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-ink-muted">{texts.modalityFilterLabel}</span>
          {(['ALL', 'DELIVERY', 'PICKUP'] as const).map((mode) => {
            const active = modalityFilter === mode;
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={active}
                onClick={() => setModalityFilter(mode)}
                className={`h-9 rounded-control border px-3 text-xs font-medium transition-colors ${
                  active
                    ? 'border-ink bg-sand-100 font-bold text-ink'
                    : 'border-line-strong bg-surface text-ink hover:bg-sand-100'
                }`}
              >
                {texts.modalities[mode]}
              </button>
            );
          })}
        </div>
      </div>

      {initialLoading ? (
        <p role="status" className="mt-8 text-ink-muted">
          {texts.loadingMessage}
        </p>
      ) : (
        <div className="mt-8 grid gap-5 lg:grid-cols-4 lg:items-start">
          {BOARD_COLUMNS.map((colStatus) => {
            const normalizedSearch = searchQuery.trim().toLowerCase();
            const colCards = (cards ?? []).filter((card) => {
              if (card.status !== colStatus) return false;
              const hasAddress = Boolean(card.deliveryAddress?.trim());
              if (modalityFilter === 'DELIVERY' && !hasAddress) return false;
              if (modalityFilter === 'PICKUP' && hasAddress) return false;
              if (!normalizedSearch) return true;
              const haystack = [
                card.customerName,
                card.id,
                card.toppingMessage ?? '',
              ]
                .join(' ')
                .toLowerCase();
              return haystack.includes(normalizedSearch);
            });

            return (
              <section
                key={colStatus}
                aria-label={texts.columns[colStatus]}
                className="rounded-control border border-line bg-sand-100 p-4"
              >
                <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
                  <h2 className="font-serif text-xl">{texts.columns[colStatus]}</h2>
                  <span className="rounded-control bg-surface px-2.5 py-0.5 text-xs font-bold text-ink">
                    {colCards.length}
                  </span>
                </div>

                {colCards.length === 0 ? (
                  <p className="mt-4 text-sm text-ink-muted">{texts.emptyColumn}</p>
                ) : (
                  <ul className="mt-4 space-y-4">
                    {colCards.map((card) => {
                      const shortId = card.id.slice(0, 8);
                      const isBusy = busyId === card.id;
                      const cfg = card.cakeConfiguration;
                      const formatLabel = cfg
                        ? messages.builder.structureSection.formats[cfg.format]
                        : '';

                      return (
                        <li
                          key={card.id}
                          className="rounded-control border border-line bg-surface p-4 shadow-xs"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-mono text-sm font-bold text-ink">
                              {texts.cardTitle(shortId)}
                            </span>
                            <span className="text-sm font-bold text-ink">
                              {brlFormatter.format(card.totalPrice)}
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-ink-muted">
                            <span className="font-medium text-ink">{texts.customerPrefix}</span>{' '}
                            {card.customerName}
                          </p>

                          {cfg && cfg.dietaryFlags.length > 0 && (
                            <div className="mt-2.5 rounded-control border border-danger-line bg-danger-soft px-2.5 py-1.5 text-xs font-bold text-danger">
                              {texts.dietaryAlertPrefix} {cfg.dietaryFlags.join(', ')}
                            </div>
                          )}

                          {cfg && (
                            <div className="mt-2.5 space-y-1.5 text-xs text-ink">
                              <div className="flex items-center gap-2 font-bold">
                                <span
                                  aria-hidden="true"
                                  className="h-3.5 w-3.5 rounded-full border border-line-strong"
                                  style={{ backgroundColor: cfg.colorHex }}
                                />
                                <span>
                                  {messages.myOrders.cakeSummary(formatLabel, cfg.floorsCount)}
                                </span>
                              </div>

                              <ul className="space-y-1 text-ink-muted">
                                {cfg.layers.map((layer) => (
                                  <li key={layer.id}>
                                    {texts.layerLine(
                                      layer.floorNumber,
                                      layer.estimatedWeightKg.toLocaleString('pt-BR'),
                                      layer.doughName,
                                      layer.fillingNames.join(' + '),
                                      layer.coverageName,
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {card.toppingMessage && (
                            <p className="mt-2 text-xs text-ink-muted">
                              <span className="font-medium text-ink">{texts.toppingPrefix}</span>{' '}
                              {card.toppingMessage}
                            </p>
                          )}

                          {card.deliveryAddress && (
                            <p className="mt-1 text-xs text-ink-muted">
                              <span className="font-medium text-ink">{texts.deliveryPrefix}</span>{' '}
                              {card.deliveryAddress}
                            </p>
                          )}

                          {card.riceImageUrl && (
                            <p className="mt-2 text-xs">
                              <a
                                href={resolveApiAssetUrl(card.riceImageUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-accent underline"
                              >
                                {texts.ricePaperLink}
                              </a>
                            </p>
                          )}

                          <div className="mt-4 flex flex-col gap-2">
                            {colStatus === 'EM_ESPERA' && (
                              <>
                                <Button
                                  size="md"
                                  fullWidth
                                  loading={isBusy}
                                  onClick={() => {
                                    void handleMoveCard(card, 'EM_PRODUCAO');
                                  }}
                                >
                                  {texts.actions.startProduction}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="md"
                                  fullWidth
                                  disabled={isBusy}
                                  onClick={() => {
                                    void handleAdminCancel(card);
                                  }}
                                >
                                  {texts.actions.cancelAndRefund}
                                </Button>
                              </>
                            )}

                            {colStatus === 'EM_PRODUCAO' && (
                              <>
                                <Button
                                  size="md"
                                  fullWidth
                                  loading={isBusy}
                                  onClick={() => {
                                    void handleMoveCard(card, 'FINALIZACAO');
                                  }}
                                >
                                  {texts.actions.moveToFinishing}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="md"
                                  fullWidth
                                  disabled={isBusy}
                                  onClick={() => {
                                    void handleMoveCard(card, 'EM_ESPERA');
                                  }}
                                >
                                  {texts.actions.backToWaiting}
                                </Button>
                              </>
                            )}

                            {colStatus === 'FINALIZACAO' && (
                              <>
                                <Button
                                  size="md"
                                  fullWidth
                                  loading={isBusy}
                                  onClick={() => {
                                    void handleMoveCard(card, 'PRONTO');
                                  }}
                                >
                                  {texts.actions.markReady}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="md"
                                  fullWidth
                                  disabled={isBusy}
                                  onClick={() => {
                                    void handleMoveCard(card, 'EM_PRODUCAO');
                                  }}
                                >
                                  {texts.actions.backToProduction}
                                </Button>
                              </>
                            )}

                            {colStatus === 'PRONTO' && (
                              <Button
                                variant="secondary"
                                size="md"
                                fullWidth
                                loading={isBusy}
                                onClick={() => {
                                  void handleMoveCard(card, 'ENTREGUE');
                                }}
                              >
                                {texts.actions.confirmDelivered}
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
