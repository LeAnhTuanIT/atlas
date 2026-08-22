import { Global, Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('RedisConnection');
        const client = new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          db: configService.get<number>('REDIS_DB', 0),
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        });

        client.on('connect', () => {
          logger.log('🔄 Redis connecting...');
        });

        client.on('ready', () => {
          logger.log('✅ Redis connected and ready to use');
        });

        client.on('error', (err) => {
          logger.error(`❌ Redis connection error: ${err.message}`);
        });

        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
