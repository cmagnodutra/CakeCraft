import { BadRequestException, Injectable } from '@nestjs/common';
import { CakeFormat, OrderStatus, PaymentStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { FinancialReportQueryDto } from './dto/financial-report-query.dto';

export interface FinancialOrderRow {
  id: string;
  customerName: string;
  status: OrderStatus;
  format: CakeFormat | null;
  floorsCount: number | null;
  totalPrice: number;
  paidAt: Date;
  gatewayProvider: string;
  gatewayReference: string;
}

export interface FinancialReportResult {
  from: string;
  to: string;
  paidOrdersCount: number;
  totalRevenue: number;
  averageTicket: number;
  orders: FinancialOrderRow[];
}

const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r']);

/**
 * Escapa celula CSV protegendo contra OWASP CSV Formula Injection no Excel /
 * LibreOffice Calc quando o campo comeca com `=`, `+`, `-` ou `@`.
 */
export function sanitizeCsvCell(raw: string): string {
  const safe = raw.length > 0 && FORMULA_TRIGGERS.has(raw.charAt(0)) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function formatDateOnlyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseStrictUtcDay(dateStr: string, boundary: 'start' | 'end'): Date {
  const [yStr, mStr, dStr] = dateStr.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);

  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(check.getTime()) ||
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new BadRequestException(`Data invalida informada no filtro: ${dateStr}`);
  }

  return boundary === 'start'
    ? new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
    : new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * UC06 / RF10: agrega receita confirmada (PIX PAGO), quantidade de pedidos
   * pagos e ticket medio do periodo em centavos inteiros.
   */
  async getFinancialReport(query: FinancialReportQueryDto): Promise<FinancialReportResult> {
    const now = new Date();
    const defaultTo = formatDateOnlyUtc(now);
    const defaultFrom = formatDateOnlyUtc(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));

    const fromStr = query.from ?? defaultFrom;
    const toStr = query.to ?? defaultTo;

    const startUtc = parseStrictUtcDay(fromStr, 'start');
    const endUtc = parseStrictUtcDay(toStr, 'end');

    if (startUtc.getTime() > endUtc.getTime()) {
      throw new BadRequestException('A data inicial (from) nao pode ser posterior a data final (to).');
    }

    const paidOrders = await this.prisma.order.findMany({
      where: {
        status: { not: OrderStatus.CANCELADO },
        OR: [
          {
            payment: {
              is: {
                status: PaymentStatus.PAGO,
                paidAt: { gte: startUtc, lte: endUtc },
              },
            },
          },
          {
            payment: {
              is: {
                status: PaymentStatus.PAGO,
                paidAt: null,
              },
            },
            createdAt: { gte: startUtc, lte: endUtc },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true } },
        cakeConfiguration: { select: { format: true, floorsCount: true } },
        payment: {
          select: {
            paidAt: true,
            gatewayProvider: true,
            gatewayReference: true,
          },
        },
      },
    });

    let totalRevenueCents = 0;
    const rows: FinancialOrderRow[] = (paidOrders ?? []).map((order) => {
      const priceCents = Math.round(Number(order.totalPrice) * 100);
      totalRevenueCents += priceCents;

      return {
        id: order.id,
        customerName: order.user.name,
        status: order.status,
        format: order.cakeConfiguration?.format ?? null,
        floorsCount: order.cakeConfiguration?.floorsCount ?? null,
        totalPrice: priceCents / 100,
        paidAt: order.payment?.paidAt ?? order.createdAt,
        gatewayProvider: order.payment?.gatewayProvider ?? 'ASAAS',
        gatewayReference: order.payment?.gatewayReference ?? '',
      };
    });

    const paidOrdersCount = rows.length;
    const averageTicketCents =
      paidOrdersCount > 0 ? Math.round(totalRevenueCents / paidOrdersCount) : 0;

    return {
      from: fromStr,
      to: toStr,
      paidOrdersCount,
      totalRevenue: totalRevenueCents / 100,
      averageTicket: averageTicketCents / 100,
      orders: rows,
    };
  }

  /**
   * UC06 / RF10: gera arquivo CSV com BOM UTF-8 e separador `;` (padrao Excel
   * pt-BR) pronto para download em 1 clique.
   */
  async exportFinancialCsv(query: FinancialReportQueryDto): Promise<string> {
    const report = await this.getFinancialReport(query);
    const header =
      'pedido_id;data_pagamento;cliente;status;formato;andares;valor_brl;referencia_pix';

    const lines = report.orders.map((row) =>
      [
        sanitizeCsvCell(row.id),
        sanitizeCsvCell(row.paidAt.toISOString()),
        sanitizeCsvCell(row.customerName),
        sanitizeCsvCell(row.status),
        sanitizeCsvCell(row.format ?? ''),
        sanitizeCsvCell(row.floorsCount !== null ? String(row.floorsCount) : ''),
        sanitizeCsvCell(row.totalPrice.toFixed(2)),
        sanitizeCsvCell(row.gatewayReference),
      ].join(';'),
    );

    return `\uFEFF${[header, ...lines].join('\r\n')}\r\n`;
  }
}
