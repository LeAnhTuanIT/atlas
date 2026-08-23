import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  IZaloOaMessageRepository,
  ZaloOaMessagePage,
} from '@/modules/integrations/domain/repositories/zalo-oa-message.repository.interface';
import type { ZaloOaMessage } from '@/modules/integrations/domain/models/zalo-oa-message.entity';
import { paginateByUuidCursor } from '@/shared/infrastructure/persistence/cursor-pagination.util';
import { ZaloOaMessageOrmEntity } from '../entities/zalo-oa-message.orm-entity';
import { ZaloOaMessageMapper } from '../mappers/zalo-oa-message.mapper';

@Injectable()
export class TypeOrmZaloOaMessageRepository implements IZaloOaMessageRepository {
  constructor(
    @InjectRepository(ZaloOaMessageOrmEntity)
    private readonly repo: Repository<ZaloOaMessageOrmEntity>,
  ) {}

  async save(message: ZaloOaMessage): Promise<void> {
    const orm = ZaloOaMessageMapper.toOrm(message);
    await this.repo.save(orm);
  }

  async existsByExternalMessageId(
    connectionId: string,
    externalMessageId: string,
  ): Promise<boolean> {
    const count = await this.repo.count({
      where: { connectionId, externalMessageId },
    });
    return count > 0;
  }

  async findByConnection(
    connectionId: string,
    params: { cursor?: string; limit?: number },
  ): Promise<ZaloOaMessagePage> {
    const qb = this.repo
      .createQueryBuilder('m')
      .where('m.connection_id = :connectionId', { connectionId });

    const { items, meta } = await paginateByUuidCursor(qb, 'm', {
      cursor: params.cursor,
      limit: params.limit,
      order: 'DESC',
    });

    return {
      items: items.map((orm) => ZaloOaMessageMapper.toDomain(orm)),
      hasNextPage: meta.hasNextPage,
      nextCursor: meta.nextCursor,
    };
  }
}
