import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-request';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService, SerializedOrder } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
  ): Promise<SerializedOrder> {
    return this.ordersService.createOrder(user.id, dto);
  }

  @Get('my')
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<SerializedOrder[]> {
    return this.ordersService.findMyOrders(user.id);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SerializedOrder> {
    return this.ordersService.findOrderById(id, user);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SerializedOrder> {
    return this.ordersService.cancelOrder(id, user);
  }

  @Post(':id/regenerate-pix')
  @HttpCode(HttpStatus.OK)
  regeneratePix(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SerializedOrder> {
    return this.ordersService.regeneratePixCharge(id, user);
  }
}
