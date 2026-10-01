import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { AppConfig } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  configureApp(app);
  const config = app.get(AppConfig);
  const port = config.get('PORT');
  await app.listen(port, config.get('HOST'));
  Logger.log(`API listening on http://localhost:${port}/api/v1 (docs: /docs)`, 'Bootstrap');
}

void bootstrap();
