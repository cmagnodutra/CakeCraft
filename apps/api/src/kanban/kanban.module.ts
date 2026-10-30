import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { EmailModule } from '../email/email.module';
import { GamificationModule } from '../gamification/gamification.module';
import { KanbanController } from './kanban.controller';
import { KanbanGateway } from './kanban.gateway';
import { KanbanService } from './kanban.service';

@Module({
  imports: [JwtModule.register({}), GamificationModule, EmailModule],
  controllers: [KanbanController],
  providers: [KanbanService, KanbanGateway],
  exports: [KanbanService],
})
export class KanbanModule {}
