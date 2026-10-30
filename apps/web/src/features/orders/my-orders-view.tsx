'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button, buttonStyles } from '@/components/ui/button';
import { messages } from '@/content/messages';
import { useAuth } from '@/features/auth/auth-provider';
import { NetworkError } from '@/lib/api/errors';
import {
  cancelOrder,
  fetchMyOrders,
  regenerateOrderPix,
  resolveApiAssetUrl,
} from '@/lib/api/orders';
import type { CustomerOrder, OrderStatus } from '@/lib/api/orders';
import { subscribeToOrderUpdates } from '@/lib/realtime/orders-socket';

const texts = messages.myOrders;

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeStyle: 'short',
});

function statusBadgeStyle(status: OrderStatus): string {
  switch (status) {
    case 'PRONTO':
    case 'ENTREGUE':
      return 'border-success-line bg-success-soft text-success';
    case 'CANCELADO':
      return 'border-danger-line bg-danger-soft text-danger';
    case 'AGUARDANDO_PAGAMENTO':
      return 'border-line-strong bg-sand-100 text-ink';
    default:
      return 'border-ink bg-ink text-on-ink';
  }
}

function toQrImageSrc(qrCode: string): string {
  return qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`;
}

export function MyOrdersView() {
  const { user, isLoading: authLoading, refreshUser } = useAuth();
  const searchParams = useSearchParams();
  const newlyCreatedOrderId = searchParams.get('novo');

  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string>();
  const [errorBanner, setErrorBanner] = useState<string>();
  const [feedbackBanner, setFeedbackBanner] = useState<string>();

  const userId = user?.id;
  const ordersLoading = Boolean(userId) && orders === null && !errorBanner;

  useEffect(() => {
    if (authLoading || !userId) {
      return;
    }

    let active = true;

    fetchMyOrders()
      .then((loaded) => {
        if (active) {
          setOrders(loaded);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setOrders([]);
          setErrorBanner(
            error instanceof NetworkError ? texts.errors.network : texts.errors.loadFailed,
          );
        }
      });

    const unsubscribe = subscribeToOrderUpdates((event) => {
      fetchMyOrders()
        .then((loaded) => {
          if (active) {
            setOrders(loaded);
          }
        })
        .catch(() => undefined);

      if (event.status === 'PRONTO' || event.status === 'ENTREGUE') {
        void refreshUser();
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [authLoading, userId, refreshUser]);

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
        <p className="mt-3 text-base text-ink-muted">{texts.unauthenticatedBody}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/entrar" className={buttonStyles({ size: 'lg' })}>
            {texts.goToLogin}
          </Link>
          <Link href="/builder" className={buttonStyles({ variant: 'secondary', size: 'lg' })}>
            {texts.goToBuilder}
          </Link>
        </div>
      </div>
    );
  }

  function replaceOrderInList(updated: CustomerOrder) {
    setOrders((prev) =>
      (prev ?? []).map((existing) => (existing.id === updated.id ? updated : existing)),
    );
  }

  async function handleCopyPix(code: string) {
    setErrorBanner(undefined);
    setFeedbackBanner(undefined);
    try {
      await navigator.clipboard.writeText(code);
      setFeedbackBanner(texts.pix.copiedFeedback);
    } catch {
      setErrorBanner(texts.errors.copyFailed);
    }
  }

  async function handleCancelOrder(orderId: string) {
    setBusyOrderId(orderId);
    setErrorBanner(undefined);
    setFeedbackBanner(undefined);
    try {
      const updated = await cancelOrder(orderId);
      replaceOrderInList(updated);
      setFeedbackBanner(texts.actions.cancelledFeedback);
    } catch (error) {
      setErrorBanner(
        error instanceof NetworkError ? texts.errors.network : texts.errors.actionFailed,
      );
    } finally {
      setBusyOrderId(undefined);
    }
  }

  async function handleRegeneratePix(orderId: string) {
    setBusyOrderId(orderId);
    setErrorBanner(undefined);
    setFeedbackBanner(undefined);
    try {
      const updated = await regenerateOrderPix(orderId);
      replaceOrderInList(updated);
      setFeedbackBanner(texts.pix.regeneratedFeedback);
    } catch (error) {
      setErrorBanner(
        error instanceof NetworkError ? texts.errors.network : texts.errors.actionFailed,
      );
    } finally {
      setBusyOrderId(undefined);
    }
  }

  const showNewBanner =
    Boolean(newlyCreatedOrderId) &&
    (orders ?? []).some((order) => order.id === newlyCreatedOrderId);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl leading-tight tracking-[-0.015em] sm:text-5xl">
            {texts.title}
          </h1>
          <p className="mt-2 max-w-2xl text-base text-ink-muted">{texts.subtitle}</p>
        </div>

        <Link href="/builder" className={buttonStyles({ variant: 'primary', size: 'md' })}>
          {texts.newCakeCta}
        </Link>
      </div>

      {showNewBanner && (
        <Alert variant="success" className="mt-6" messages={[texts.createdBanner]} />
      )}
      {errorBanner && <Alert variant="error" className="mt-6" messages={[errorBanner]} />}
      {feedbackBanner && <Alert variant="success" className="mt-6" messages={[feedbackBanner]} />}

      {ordersLoading ? (
        <p role="status" className="mt-8 text-ink-muted">
          {texts.loadingMessage}
        </p>
      ) : (orders ?? []).length === 0 ? (
        <section className="mt-8 rounded-control border border-line bg-surface p-8">
          <h2 className="font-serif text-2xl">{texts.emptyTitle}</h2>
          <p className="mt-2 text-base text-ink-muted">{texts.emptyBody}</p>
          <div className="mt-6">
            <Link href="/builder" className={buttonStyles({ size: 'lg' })}>
              {texts.goToBuilder}
            </Link>
          </div>
        </section>
      ) : (
        <ul className="mt-8 space-y-6">
          {(orders ?? []).map((order) => {
            const shortId = order.id.slice(0, 8);
            const isBusy = busyOrderId === order.id;
            const cfg = order.cakeConfiguration;
            const formatLabel = cfg
              ? messages.builder.structureSection.formats[cfg.format]
              : undefined;

            return (
              <li
                key={order.id}
                className="rounded-control border border-line bg-surface p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="font-serif text-2xl">{texts.orderTitle(shortId)}</h2>
                      <span
                        className={`rounded-control border px-2.5 py-0.5 text-xs font-bold ${statusBadgeStyle(order.status)}`}
                      >
                        {texts.status[order.status]}
                      </span>
                      {order.payment && (
                        <span className="rounded-control bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-ink-muted">
                          {texts.paymentStatus[order.payment.status]}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      {texts.createdAt(dateTimeFormatter.format(new Date(order.createdAt)))}
                    </p>
                  </div>

                  <p className="font-serif text-2xl font-bold text-ink">
                    {brlFormatter.format(order.totalPrice)}
                  </p>
                </div>

                {/* Detalhes estruturais e personalizacao */}
                <div className="mt-4 space-y-2 text-sm text-ink">
                  {cfg && formatLabel && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-4 w-4 rounded-full border border-line-strong"
                        style={{ backgroundColor: cfg.colorHex }}
                      />
                      <span className="font-medium">
                        {texts.cakeSummary(formatLabel, cfg.floorsCount)}
                      </span>
                      <span className="font-mono text-xs text-ink-muted">{cfg.colorHex}</span>
                    </div>
                  )}

                  {cfg && cfg.dietaryFlags.length > 0 && (
                    <p className="text-ink-muted">
                      <span className="font-medium text-ink">{texts.dietaryPrefix}</span>{' '}
                      {cfg.dietaryFlags.join(', ')}
                    </p>
                  )}

                  {order.toppingMessage && (
                    <p className="text-ink-muted">
                      <span className="font-medium text-ink">{texts.toppingPrefix}</span>{' '}
                      {order.toppingMessage}
                    </p>
                  )}

                  {order.deliveryAddress && (
                    <p className="text-ink-muted">
                      <span className="font-medium text-ink">{texts.deliveryPrefix}</span>{' '}
                      {order.deliveryAddress}
                    </p>
                  )}

                  {order.riceImageUrl && (
                    <p>
                      <a
                        href={resolveApiAssetUrl(order.riceImageUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-accent underline"
                      >
                        {texts.ricePaperLink}
                      </a>
                    </p>
                  )}
                </div>

                {/* Snapshots de itens (protecao historica de precos) */}
                {order.items.length > 0 && (
                  <div className="mt-4 rounded-control border border-line bg-paper p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                      {texts.itemsHeading}
                    </h3>
                    <ul className="mt-2 space-y-1 text-sm">
                      {order.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-3 text-ink"
                        >
                          <span>
                            {item.ingredientNameSnapshot} (
                            {item.weightKg.toLocaleString('pt-BR')} kg)
                          </span>
                          <span className="font-medium">
                            {brlFormatter.format(item.subtotal)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Painel PIX Asaas enquanto o pedido aguarda pagamento (RF07 / RN03 / Secao 3.2) */}
                {order.status === 'AGUARDANDO_PAGAMENTO' && order.payment && (
                  <div className="mt-5 rounded-control border border-line-strong bg-sand-100 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-serif text-xl">{texts.pix.title}</h3>
                      {order.payment.status === 'PENDENTE' && (
                        <span className="text-xs font-medium text-ink-muted">
                          {texts.pix.expiresAt(
                            timeFormatter.format(new Date(order.payment.expiresAt)),
                          )}
                        </span>
                      )}
                    </div>

                    {order.payment.status === 'PENDENTE' ? (
                      <div className="mt-4 grid gap-5 sm:grid-cols-12 sm:items-center">
                        {order.payment.qrCode && (
                          <div className="flex justify-center sm:col-span-4">
                            <img
                              src={toQrImageSrc(order.payment.qrCode)}
                              alt={texts.pix.qrAlt(shortId)}
                              className="h-44 w-44 rounded-control border border-line bg-surface p-2"
                            />
                          </div>
                        )}

                        {order.payment.copyPasteCode && (
                          <div className="space-y-3 sm:col-span-8">
                            <label
                              htmlFor={`pix-code-${order.id}`}
                              className="block text-sm font-medium text-ink"
                            >
                              {texts.pix.copyPasteLabel}
                            </label>
                            <input
                              id={`pix-code-${order.id}`}
                              type="text"
                              readOnly
                              value={order.payment.copyPasteCode}
                              className="h-11 w-full rounded-control border border-line-strong bg-surface px-3 font-mono text-xs text-ink"
                            />
                            <div className="flex flex-wrap gap-2.5">
                              <Button
                                variant="primary"
                                size="md"
                                onClick={() => {
                                  if (order.payment?.copyPasteCode) {
                                    void handleCopyPix(order.payment.copyPasteCode);
                                  }
                                }}
                              >
                                {texts.pix.copyButton}
                              </Button>
                              <Button
                                variant="secondary"
                                size="md"
                                loading={isBusy}
                                onClick={() => {
                                  void handleCancelOrder(order.id);
                                }}
                              >
                                {texts.actions.cancelOrder}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 space-y-4">
                        <p className="text-sm text-ink">{texts.pix.expiredNotice}</p>
                        <div className="flex flex-wrap gap-2.5">
                          <Button
                            variant="primary"
                            size="md"
                            loading={isBusy}
                            onClick={() => {
                              void handleRegeneratePix(order.id);
                            }}
                          >
                            {texts.pix.regenerateButton}
                          </Button>
                          <Button
                            variant="secondary"
                            size="md"
                            disabled={isBusy}
                            onClick={() => {
                              void handleCancelOrder(order.id);
                            }}
                          >
                            {texts.actions.cancelOrder}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
