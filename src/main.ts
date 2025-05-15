import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get and initialize PrismaService
  const prismaService = app.get(PrismaService);
  await prismaService.onModuleInit();
  prismaService.enableShutdownHooks(app);

  await app.listen(process.env.PORT || 3512, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap().catch((err) => {
  console.error('Application bootstrap failed:', err);
  process.exit(1);
});
