import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';

import { CatalogService } from './catalog.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';

/**
 * TODO (fecha quando feature/auth for mergeada): proteger as rotas abaixo
 * de POST/PATCH/DELETE e GET /admin com @UseGuards(JwtAuthGuard,
 * RolesGuard) + @Roles(Role.ADMIN). Hoje estao publicas de proposito -
 * catalog e auth foram construidas em paralelo, em branches
 * independentes, e o RBAC depende de infraestrutura que so existe em
 * feature/auth (JwtAuthGuard, RolesGuard, decorator @Roles, enum Role).
 */
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  /** Rota publica - consumida pelo Cake Builder e pelo PricingService. */
  @Get()
  findAllActive() {
    return this.catalogService.findAllActive();
  }

  /** TODO: restringir a ADMIN quando o RBAC estiver disponivel. */
  @Get('admin')
  findAllForAdmin() {
    return this.catalogService.findAllForAdmin();
  }

  /** TODO: restringir a ADMIN quando o RBAC estiver disponivel. */
  @Post()
  create(@Body() dto: CreateIngredientDto) {
    return this.catalogService.create(dto);
  }

  /** TODO: restringir a ADMIN quando o RBAC estiver disponivel. */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateIngredientDto) {
    return this.catalogService.update(id, dto);
  }

  /** TODO: restringir a ADMIN quando o RBAC estiver disponivel. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivate(@Param('id') id: string) {
    return this.catalogService.deactivate(id);
  }
}
