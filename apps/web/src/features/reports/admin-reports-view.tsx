'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button, buttonStyles } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { messages } from '@/content/messages';
import { useAuth } from '@/features/auth/auth-provider';
import { ApiError, NetworkError } from '@/lib/api/errors';
import { downloadFinancialCsvText, fetchFinancialReport } from '@/lib/api/kanban-reports';
import type { FinancialReport } from '@/lib/api/kanban-reports';

const texts = messages.adminReports;

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function resolveReportErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof NetworkError) {
    return texts.errors.network;
  }
  if (error instanceof ApiError && error.status === 400) {
    return texts.errors.invalidDateRange;
  }
  return fallback;
}

export function AdminReportsView() {
  const { user, isLoading: authLoading } = useAuth();

  const [report, setReport] = useState<FinancialReport | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filtering, setFiltering] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string>();
  const [feedbackBanner, setFeedbackBanner] = useState<string>();

  const isAdmin = user?.role === 'ADMIN';
  const initialLoading = isAdmin && report === null && !errorBanner;

  useEffect(() => {
    if (authLoading || !isAdmin) {
      return;
    }

    let active = true;

    fetchFinancialReport()
      .then((loaded) => {
        if (active) {
          setReport(loaded);
          setFromDate(loaded.from);
          setToDate(loaded.to);
        }
      })
      .catch((error: unknown) => {
        if (active) {
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

  async function handleApplyFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorBanner(undefined);
    setFeedbackBanner(undefined);

    if (fromDate && toDate && fromDate > toDate) {
      setErrorBanner(texts.errors.invalidDateRange);
      return;
    }

    setFiltering(true);

    try {
      const loaded = await fetchFinancialReport({
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setReport(loaded);
      setFromDate(loaded.from);
      setToDate(loaded.to);
    } catch (error) {
      setErrorBanner(resolveReportErrorMessage(error, texts.errors.loadFailed));
    } finally {
      setFiltering(false);
    }
  }

  async function handleQuickPreset(
    preset: 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'CURRENT_MONTH',
  ) {
    const now = new Date();
    const toStr = now.toISOString().slice(0, 10);
    let fromStr = toStr;

    if (preset === 'LAST_7_DAYS') {
      const d = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      fromStr = d.toISOString().slice(0, 10);
    } else if (preset === 'LAST_30_DAYS') {
      const d = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      fromStr = d.toISOString().slice(0, 10);
    } else if (preset === 'CURRENT_MONTH') {
      fromStr = `${toStr.slice(0, 7)}-01`;
    }

    setFromDate(fromStr);
    setToDate(toStr);
    setFiltering(true);
    setErrorBanner(undefined);
    setFeedbackBanner(undefined);

    try {
      const loaded = await fetchFinancialReport({ from: fromStr, to: toStr });
      setReport(loaded);
      setFromDate(loaded.from);
      setToDate(loaded.to);
    } catch (error) {
      setErrorBanner(
        error instanceof NetworkError ? texts.errors.network : texts.errors.loadFailed,
      );
    } finally {
      setFiltering(false);
    }
  }

  async function handleExportCsv() {
    setErrorBanner(undefined);
    setFeedbackBanner(undefined);

    if (fromDate && toDate && fromDate > toDate) {
      setErrorBanner(texts.errors.invalidDateRange);
      return;
    }

    setExporting(true);

    try {
      const csvText = await downloadFinancialCsvText({
        from: fromDate || undefined,
        to: toDate || undefined,
      });

      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      const suffix = fromDate && toDate ? `${fromDate}_${toDate}` : 'periodo';
      anchor.download = `relatorio-financeiro-${suffix}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);

      setFeedbackBanner(texts.feedback.csvExported);
    } catch (error) {
      setErrorBanner(resolveReportErrorMessage(error, texts.errors.exportFailed));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <div>
        <h1 className="font-serif text-4xl leading-tight tracking-[-0.015em] sm:text-5xl">
          {texts.title}
        </h1>
        <p className="mt-2 max-w-3xl text-base text-ink-muted">{texts.subtitle}</p>
      </div>

      {/* Filtro de periodo + exportacao CSV em 1 clique */}
      <form
        noValidate
        onSubmit={(event) => {
          void handleApplyFilter(event);
        }}
        className="mt-8 space-y-4 rounded-control border border-line bg-surface p-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-ink-muted">
            {texts.filterForm.presetsLabel}
          </span>
          {(['TODAY', 'LAST_7_DAYS', 'LAST_30_DAYS', 'CURRENT_MONTH'] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={filtering}
              onClick={() => {
                void handleQuickPreset(preset);
              }}
              className="h-8 rounded-control border border-line-strong bg-surface px-3 text-xs font-medium text-ink transition-colors hover:bg-sand-100 disabled:opacity-50"
            >
              {texts.filterForm.presets[preset]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-44 flex-1">
            <Field
              label={texts.filterForm.fromLabel}
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="min-w-44 flex-1">
            <Field
              label={texts.filterForm.toLabel}
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Button type="submit" variant="secondary" loading={filtering}>
              {texts.filterForm.applyButton}
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={exporting}
              onClick={() => {
                void handleExportCsv();
              }}
            >
              {texts.filterForm.exportCsvButton}
            </Button>
          </div>
        </div>
      </form>

      {errorBanner && <Alert variant="error" className="mt-6" messages={[errorBanner]} />}
      {feedbackBanner && <Alert variant="success" className="mt-6" messages={[feedbackBanner]} />}

      {initialLoading ? (
        <p role="status" className="mt-8 text-ink-muted">
          {texts.loadingMessage}
        </p>
      ) : report ? (
        <>
          {/* KPIs do fechamento financeiro (Persona 4 - Juliana) */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-control border border-line bg-surface p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                {texts.kpis.totalRevenue}
              </p>
              <p className="mt-2 font-serif text-3xl font-bold text-ink">
                {brlFormatter.format(report.totalRevenue)}
              </p>
            </div>

            <div className="rounded-control border border-line bg-surface p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                {texts.kpis.paidOrders}
              </p>
              <p className="mt-2 font-serif text-3xl font-bold text-ink">
                {report.paidOrdersCount}
              </p>
            </div>

            <div className="rounded-control border border-line bg-surface p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                {texts.kpis.averageTicket}
              </p>
              <p className="mt-2 font-serif text-3xl font-bold text-ink">
                {brlFormatter.format(report.averageTicket)}
              </p>
            </div>
          </div>

          {/* Tabela detalhada de pedidos pagos no periodo */}
          <section className="mt-8 rounded-control border border-line bg-surface p-6">
            <h2 className="font-serif text-2xl">{texts.table.heading}</h2>

            {report.orders.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">{texts.table.empty}</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs font-bold uppercase tracking-wide text-ink-muted">
                      <th className="py-2.5 pr-4">{texts.table.colOrder}</th>
                      <th className="py-2.5 pr-4">{texts.table.colPaidAt}</th>
                      <th className="py-2.5 pr-4">{texts.table.colCustomer}</th>
                      <th className="py-2.5 pr-4">{texts.table.colStatus}</th>
                      <th className="py-2.5 pr-4">{texts.table.colFormat}</th>
                      <th className="py-2.5 text-right">{texts.table.colAmount}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {report.orders.map((row) => (
                      <tr key={row.id}>
                        <td className="py-3 pr-4 font-mono text-xs font-bold text-ink">
                          #{row.id.slice(0, 8)}
                        </td>
                        <td className="py-3 pr-4 text-ink-muted">
                          {dateTimeFormatter.format(new Date(row.paidAt))}
                        </td>
                        <td className="py-3 pr-4 font-medium text-ink">{row.customerName}</td>
                        <td className="py-3 pr-4 text-ink-muted">
                          {messages.myOrders.status[row.status]}
                        </td>
                        <td className="py-3 pr-4 text-ink-muted">
                          {row.format && row.floorsCount
                            ? messages.myOrders.cakeSummary(
                                messages.builder.structureSection.formats[row.format],
                                row.floorsCount,
                              )
                            : '—'}
                        </td>
                        <td className="py-3 text-right font-bold text-ink">
                          {brlFormatter.format(row.totalPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
