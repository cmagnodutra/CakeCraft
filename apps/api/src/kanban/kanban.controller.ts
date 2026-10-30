import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateKanbanStatusDto } from './dto/update-kanban-status.dto';
import { KanbanOrderCard, KanbanService } from './kanban.service';

@Controller('kanban')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class KanbanController {
  constructor(private readonly kanbanService: KanbanService) {}

  @Get('orders')
  listQueue(): Promise<KanbanOrderCard[]> {
    return this.kanbanService.listProductionQueue();
  }

  @Patch('orders/:id/status')
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateKanbanStatusDto,
  ): Promise<KanbanOrderCard> {
    return this.kanbanService.transitionOrderStatus(id, dto.status);
  }
}
