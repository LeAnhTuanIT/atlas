import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(8080),
  HOST: z.string().default('0.0.0.0'),
  API_PREFIX: z.string().default('api'),
  CORS_ORIGIN: z.string().default('*'),

  // JWT Config
  JWT_SYSTEM_SECRET: z.string().min(1),
  JWT_MERCHANT_SECRET: z.string().min(1),
  JWT_CUSTOMER_SECRET: z.string().min(1),
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRATION: z.string().default('1d'),

  // Database
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().default(5432),
  DB_USERNAME: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_SCHEMA: z.string().default('public'),
  DB_SSL: z.coerce.boolean().default(false),
  DB_LOGGING: z.coerce.boolean().default(false),
  DB_POOL_MAX: z.coerce.number().default(10),

  // Redis & BullMQ
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_DB: z.coerce.number().default(0),
  REDIS_KEY_PREFIX: z.string().default('app:cache:'),
  BULLMQ_DEFAULT_ATTEMPTS: z.coerce.number().default(3),
  BULLMQ_BACKOFF_DELAY: z.coerce.number().default(1000),

  // RabbitMQ
  RABBITMQ_HOST: z.string().default('localhost'),
  RABBITMQ_PORT: z.coerce.number().default(5672),
  RABBITMQ_USER: z.string().default('guest'),
  RABBITMQ_PASS: z.string().default('guest'),
  RABBITMQ_VHOST: z.string().default('/'),
  RABBITMQ_URI: z.string().min(1),
  RABBITMQ_EXCHANGE_NAME: z.string().default('core.domain.events.topic'),

  // Kafka
  KAFKA_BROKERS: z.string().min(1),
  KAFKA_CLIENT_ID: z.string().default('nestjs-app'),
  KAFKA_GROUP_ID: z.string().default('nestjs-consumer-group'),

  // App URLs
  APP_BASE_URL: z.string().optional(),

  // PayOS
  PAYOS_CLIENT_ID: z.string().optional(),
  PAYOS_API_KEY: z.string().optional(),
  PAYOS_CHECKSUM_KEY: z.string().optional(),

  // VNPAY
  VNPAY_TMN_CODE: z.string().optional(),
  VNPAY_HASH_SECRET: z.string().optional(),
  VNPAY_URL: z.string().optional(),
  VNPAY_RETURN_URL: z.string().optional(),
  VNPAY_IPN_URL: z.string().optional(),

  // MoMo
  MOMO_PARTNER_CODE: z.string().default('MOMO'),
  MOMO_ACCESS_KEY: z.string().min(1),
  MOMO_SECRET_KEY: z.string().min(1),
  MOMO_API_ENDPOINT: z.string().min(1),
  MOMO_NOTIFY_URL: z.string().optional(),
  MOMO_RETURN_URL: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export const validateEnv = (config: Record<string, unknown>) => {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Config validation error: ${JSON.stringify(result.error.format(), null, 2)}`,
    );
  }
  return result.data;
};