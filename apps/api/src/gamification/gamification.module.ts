import { Module } from '@nestjs/common';

import { EmailModule } from '../email/email.module';
import { GamificationService } from './gamification.service';

@Module({
  imports: [EmailModule],
  providers: [GamificationService],
  exports: [GamificationService],
})
export class GamificationModule {}
