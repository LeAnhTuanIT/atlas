import { validateEnv } from './env.validation';

const baseValidConfig = {
  JWT_SYSTEM_SECRET: 'a',
  JWT_MERCHANT_SECRET: 'a',
  JWT_CUSTOMER_SECRET: 'a',
  DB_HOST: 'localhost',
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'postgres',
  DB_NAME: 'db',
  REDIS_HOST: 'localhost',
  RABBITMQ_URI: 'amqp://localhost',
  KAFKA_BROKERS: 'localhost:9092',
  MOMO_ACCESS_KEY: 'a',
  MOMO_SECRET_KEY: 'a',
  MOMO_API_ENDPOINT: 'https://example.com',
  ZALO_OA_APP_ID: 'app-id',
  ZALO_OA_SECRET_KEY: 'secret',
  ZALO_OA_REDIRECT_URI: 'https://api.example.com/api/v1/integrations/zalo-oa/callback',
  ZALO_OA_STATE_SECRET: 'state-secret',
};

describe('env.validation — Zalo OA', () => {
  it('parses successfully when all ZALO_OA_* vars are present', () => {
    const result = validateEnv(baseValidConfig);
    expect(result.ZALO_OA_APP_ID).toBe('app-id');
    expect(result.ZALO_OA_REDIRECT_URI).toBe(
      'https://api.example.com/api/v1/integrations/zalo-oa/callback',
    );
  });

  it('throws when ZALO_OA_APP_ID is missing', () => {
    const { ZALO_OA_APP_ID, ...rest } = baseValidConfig;
    expect(() => validateEnv(rest)).toThrow(/Config validation error/);
  });
});
