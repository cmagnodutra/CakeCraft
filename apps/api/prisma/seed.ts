/**
 * Seed inicial do banco. Roda com: npm run prisma:seed -w apps/api
 *
 * Inclui pelo menos uma massa com isAerated=true (Pao de Lo) para permitir
 * testar RN01 manualmente (bloqueio em bolos de +2 andares) assim que o
 * builder ou uma chamada direta a /api/pricing/calculate usar esse id.
 */
import { PrismaClient, IngredientType, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

  // TODO: mover a senha para variavel de ambiente antes de qualquer deploy real.
  const adminPasswordHash = await bcrypt.hash('troque-esta-senha', saltRounds);

  await prisma.user.upsert({
    where: { email: 'admin@cakecraft.com.br' },
    update: {},
    create: {
      name: 'Administrador CakeCraft',
      email: 'admin@cakecraft.com.br',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });

  const ingredientes: Array<{
    name: string;
    type: IngredientType;
    pricePerKg: number;
    isAerated?: boolean;
    allergens?: string[];
  }> = [
    { name: 'Pao de Lo Tradicional', type: IngredientType.MASSA, pricePerKg: 35, isAerated: true },
    { name: 'Massa de Chocolate', type: IngredientType.MASSA, pricePerKg: 38 },
    { name: 'Massa Red Velvet', type: IngredientType.MASSA, pricePerKg: 45 },
    { name: 'Brigadeiro', type: IngredientType.RECHEIO, pricePerKg: 40, allergens: ['leite'] },
    { name: 'Doce de Leite', type: IngredientType.RECHEIO, pricePerKg: 42, allergens: ['leite'] },
    { name: 'Geleia de Frutas Vermelhas', type: IngredientType.RECHEIO, pricePerKg: 48 },
    { name: 'Chantilly', type: IngredientType.COBERTURA, pricePerKg: 50, allergens: ['leite'] },
    { name: 'Pasta Americana', type: IngredientType.COBERTURA, pricePerKg: 60 },
  ];

  for (const ingrediente of ingredientes) {
    const existente = await prisma.ingredient.findFirst({ where: { name: ingrediente.name } });
    if (!existente) {
      await prisma.ingredient.create({ data: ingrediente });
    }
  }

  console.log('Seed concluido.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
