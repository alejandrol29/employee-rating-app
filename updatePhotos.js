// updatePhotos.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.employee.updateMany({
    where: { name: 'Juan Pérez' },
    data: { photoUrl: '/images/juan.jpeg' }
  });

  await prisma.employee.updateMany({
    where: { name: 'Ana Gómez' },
    data: { photoUrl: '/images/ana.jpeg' }
  });

  await prisma.employee.updateMany({
    where: { name: 'Carlos López' },
    data: { photoUrl: '/images/carlos.jpeg' }
  });

  console.log('Fotos actualizadas ✅');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
