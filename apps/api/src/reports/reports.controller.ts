import { Controller, Get, Header, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';

import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { FinancialReportQueryDto } from './dto/financial-report-query.dto';
import { FinancialReportResult, ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('financial')
  getFinancial(@Query() query: FinancialReportQueryDto): Promise<FinancialReportResult> {
    return this.reportsService.getFinancialReport(query);
  }

  @Get('financial/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async downloadFinancialCsv(
    @Query() query: FinancialReportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.reportsService.exportFinancialCsv(query);
    const suffix = query.from && query.to ? `${query.from}_${query.to}` : 'ultimos-30-dias';
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="relatorio-financeiro-${suffix}.csv"`,
    );
    res.send(csv);
  }
}
