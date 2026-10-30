import { IsOptional, Matches } from 'class-validator';

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class FinancialReportQueryDto {
  @IsOptional()
  @Matches(ISO_DATE_ONLY, { message: 'from deve estar no formato YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @Matches(ISO_DATE_ONLY, { message: 'to deve estar no formato YYYY-MM-DD' })
  to?: string;
}
