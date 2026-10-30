import { IsIn } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export const KANBAN_TARGET_STATUSES: readonly OrderStatus[] = [
  OrderStatus.EM_ESPERA,
  OrderStatus.EM_PRODUCAO,
  OrderStatus.FINALIZACAO,
  OrderStatus.PRONTO,
  OrderStatus.ENTREGUE,
];

export class UpdateKanbanStatusDto {
  @IsIn(KANBAN_TARGET_STATUSES)
  status!: OrderStatus;
}
