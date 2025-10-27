// seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Crear una sucursal
  const branch = await prisma.branch.create({
    data: {
      name: 'Sucursal Centro'
    }
  });

  // Crear empleados asociados a la sucursal
  await prisma.employee.createMany({
    data: [
      {
        name: 'Juan Pérez',
        photoUrl: 'https://via.placeholder.com/150',
        branchId: branch.id
      },
      {
        name: 'Ana Gómez',
        photoUrl: 'https://via.placeholder.com/150',
        branchId: branch.id
      },
      {
        name: 'Carlos López',
        photoUrl: 'https://via.placeholder.com/150',
        branchId: branch.id
      }
    ]
  });

  console.log('Datos cargados exitosamente ✅');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
