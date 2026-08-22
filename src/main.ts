import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);

  // 1. Đọc cấu hình từ ConfigService
  const port = configService.get<number>('PORT', 8080);
  const host = configService.get<string>('HOST', '0.0.0.0');
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  // Global prefix chỉ để 'api', phần 'v1' do enableVersioning đảm nhiệm
  const apiPrefix = configService.get<string>('API_PREFIX', 'api');
  const corsOrigin = configService.get<string>(
    'CORS_ORIGIN',
    'http://localhost:3000',
  );

  // 2. Middlewares cơ sở (Bảo mật, nén, parse cookie)
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  const allowedOrigins =
    corsOrigin === '*'
      ? true
      : corsOrigin.split(',').map((origin) => origin.trim());

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'x-correlation-id',
    ],
    credentials: true,
  });

  // 4. Global Prefix & Versioning -> Đường dẫn: /api/v1/...
  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // 5. Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 6. Graceful Shutdown
  app.enableShutdownHooks();

  // 7. Swagger Documentation
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Core Enterprise API')
      .setDescription('DDD & Clean Architecture Backend Services')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Nhập access token của bạn',
          in: 'header',
        },
        'JWT-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    logger.log(
      `Swagger documentation available at: http://localhost:${port}/docs`,
    );
  }

  // 8. Khởi chạy ứng dụng
  await app.listen(port, host);
  logger.log(
    `🚀 Application is running on: http://${host}:${port}/${apiPrefix}/v1 [${nodeEnv.toUpperCase()}]`,
  );
}

bootstrap();
