import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const categories = [
    'Distributeur automatique',
    'Ascenseur',
    'Escalier',
    'Toilettes',
    'Fontaine à eau',
    'Bureau d’accueil / Réception',
    'Borne interactive',
    'Extincteur',
    'Défibrillateur (DAE)',
    'Caméra de surveillance',
    'Table tactile / écran interactif',
    'Casier / consigne',
    'Poubelle / Point de tri',
    'Point Wi-Fi',
    'Prise de courant / Chargeur USB',
    'Climatisation / Chauffage visible',
    'Horloge murale',
    'Affichage dynamique / écran d’information',
    'Sculpture / œuvre d’art intérieure',
    'Plante décorative / mur végétal',
    'Panneau signalétique',
    'Table / mobilier spécifique',
    'Tableau blanc / écran de projection',
    'Projecteur',
    'Machine à café',
  ];

  await prisma.poi_category.createMany({
    data: categories.map((category) => ({ category })),
    skipDuplicates: true, // avoids duplicates on category name
  });

  console.log('✅ POI categories inserted.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
