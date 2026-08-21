import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (configService?: ConfigService): DataSourceOptions => {
  const isDevelopment = (configService?.get<string>('NODE_ENV') || process.env.NODE_ENV) === 'development';

  return {
    type: 'postgres',
    host: configService?.get<string>('DB_HOST') || process.env.DB_HOST || 'localhost',
    port: Number(configService?.get<number>('DB_PORT') || process.env.DB_PORT || 5432),
    username: configService?.get<string>('DB_USERNAME') || process.env.DB_USERNAME || 'postgres',
    password: configService?.get<string>('DB_PASSWORD') || process.env.DB_PASSWORD || 'postgres',
    database: configService?.get<string>('DB_NAME') || process.env.DB_NAME || 'my_db',
    entities: [path.join(__dirname, '/../../modules/**/*.orm-entity.{ts,js}')],
    migrations: [path.join(__dirname, '/migrations/*.{ts,js}')],
    migrationsTableName: 'typeorm_migrations',
    synchronize: true,
    logging: isDevelopment,
    extra: {
      max: 20,
      connectionTimeoutMillis: 5000,
    },
  };
};

export const dataSourceOptions: DataSourceOptions = getDatabaseConfig();

const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;