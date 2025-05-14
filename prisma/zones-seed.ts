import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const zoneTypes = [
    {
      type: 'Salle de réunion',
      color: '#FF5733',
      icon: 'Table avec chaises',
      name: 'Salle de réunion',
      description:
        'Espace utilisé pour des réunions, généralement avec une table et des chaises.',
      priority: 'Haute',
      accessible: true,
    },
    {
      type: 'Zone d’urgence',
      color: '#FF0000',
      icon: "Signal d'alerte ou extincteur",
      name: 'Zone d’urgence',
      description:
        'Zone dédiée à la sécurité (ex : sortie de secours, extincteur, DAE).',
      priority: 'Très haute',
      accessible: true,
    },
    {
      type: 'Salle de détente',
      color: '#A8D5BA',
      icon: 'Canapé ou fauteuil',
      name: 'Salle de détente',
      description: 'Espace pour se détendre ou faire une pause.',
      priority: 'Moyenne',
      accessible: true,
    },
    {
      type: 'Salle de sport',
      color: '#FFA726',
      icon: 'Haltère ou équipement sportif',
      name: 'Salle de sport',
      description: 'Espace intérieur avec des équipements sportifs.',
      priority: 'Moyenne',
      accessible: false,
    },
    {
      type: 'Café',
      color: '#A9746E',
      icon: 'Tasse de café',
      name: 'Café',
      description: 'Espace pour consommer du café ou se restaurer.',
      priority: 'Moyenne',
      accessible: true,
    },
    {
      type: 'Bibliothèque',
      color: '#F5F5DC',
      icon: 'Livre ouvert',
      name: 'Bibliothèque',
      description: 'Espace calme pour la lecture ou le travail individuel.',
      priority: 'Moyenne',
      accessible: true,
    },
    {
      type: 'Salle de jeux',
      color: '#FF4081',
      icon: 'Manette ou borne arcade',
      name: 'Salle de jeux',
      description: 'Espace ludique avec jeux vidéo, billards, etc.',
      priority: 'Basse',
      accessible: true,
    },
    {
      type: 'Zone de circulation',
      color: '#CFD8DC',
      icon: 'Flèche directionnelle',
      name: 'Zone de circulation',
      description: 'Couloirs, passages ou escaliers pour le déplacement.',
      priority: 'Neutre',
      accessible: true,
    },
    {
      type: 'Salle de conférences',
      color: '#455A64',
      icon: 'Micro ou pupitre',
      name: 'Salle de conférences',
      description: 'Grande salle pour des conférences ou présentations.',
      priority: 'Haute',
      accessible: true,
    },
    {
      type: 'Bureau',
      color: '#BDBDBD',
      icon: 'Bureau avec chaise',
      name: 'Bureau',
      description: 'Espaces de travail individuels ou collectifs.',
      priority: 'Moyenne',
      accessible: true,
    },
    {
      type: 'Zone de services',
      color: '#9E9E9E',
      icon: 'Balai, outil ou chariot',
      name: 'Zone de services',
      description:
        'Espace réservé au personnel pour entretien, maintenance ou logistique.',
      priority: 'Moyenne',
      accessible: false,
    },
    {
      type: 'Zone technique',
      color: '#607D8B',
      icon: 'Engrenage ou tableau électrique',
      name: 'Zone technique',
      description: 'Espace technique (réseau, électricité, stockage matériel).',
      priority: 'Haute',
      accessible: false,
    },
    {
      type: 'Atelier',
      color: '#FFA000',
      icon: 'Clé à molette ou établi',
      name: 'Atelier',
      description: 'Espace de fabrication, réparation ou assemblage.',
      priority: 'Moyenne',
      accessible: true,
    },
    {
      type: 'Zone d’archives',
      color: '#D7CCC8',
      icon: 'Dossier ou étagère',
      name: 'Zone d’archives',
      description: 'Pièce de stockage de documents ou dossiers.',
      priority: 'Basse',
      accessible: false,
    },
    {
      type: 'Infirmerie / Assistance médicale',
      color: '#E91E63',
      icon: 'Croix médicale',
      name: 'Infirmerie / Assistance médicale',
      description: 'Espace réservé aux soins ou premiers secours.',
      priority: 'Très haute',
      accessible: true,
    },
    {
      type: "Point d'information",
      color: '#03A9F4',
      icon: "i d'information",
      name: "Point d'information",
      description: 'Zone avec signalétique ou personnel d’orientation.',
      priority: 'Moyenne',
      accessible: true,
    },
  ];

  await prisma.zone_type.createMany({
    data: zoneTypes,
    skipDuplicates: true,
  });

  console.log('✅ Zone types inserted.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
