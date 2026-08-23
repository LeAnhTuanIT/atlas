import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IIntegrationConnectionRepository } from '@/modules/integrations/domain/repositories/integration-connection.repository.interface';
import type { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import type { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import { IntegrationConnectionOrmEntity } from '../entities/integration-connection.orm-entity';
import { IntegrationConnectionMapper } from '../mappers/integration-connection.mapper';

@Injectable()
export class TypeOrmIntegrationConnectionRepository
  implements IIntegrationConnectionRepository
{
  constructor(
    @InjectRepository(IntegrationConnectionOrmEntity)
    private readonly repo: Repository<IntegrationConnectionOrmEntity>,
  ) {}

  async findByMerchantAndProvider(
    merchantId: string,
    provider: IntegrationProviderEnum,
  ): Promise<IntegrationConnection | null> {
    const orm = await this.repo.findOne({ where: { merchantId, provider } });
    return orm ? IntegrationConnectionMapper.toDomain(orm) : null;
  }

  async findByExternalId(
    provider: IntegrationProviderEnum,
    externalId: string,
  ): Promise<IntegrationConnection | null> {
    const orm = await this.repo.findOne({ where: { provider, externalId } });
    return orm ? IntegrationConnectionMapper.toDomain(orm) : null;
  }

  async findById(uuid: string): Promise<IntegrationConnection | null> {
    const orm = await this.repo.findOne({ where: { uuid } });
    return orm ? IntegrationConnectionMapper.toDomain(orm) : null;
  }

  async save(connection: IntegrationConnection): Promise<void> {
    const orm = IntegrationConnectionMapper.toOrm(connection);
    // uuid là business key — tra `id` (PK bigint nội bộ) của bản ghi đã tồn tại
    // trước khi save, nếu không TypeORM sẽ INSERT trùng thay vì UPDATE.
    const existing = await this.repo.findOne({
      where: { uuid: orm.uuid },
      select: { id: true },
    });
    if (existing) {
      orm.id = existing.id;
    }
    await this.repo.save(orm);
  }
}
