import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IZbsTemplateRepository } from '@/modules/integrations/domain/repositories/zbs-template.repository.interface';
import type { ZbsTemplate } from '@/modules/integrations/domain/models/zbs-template.entity';
import { ZbsTemplateOrmEntity } from '../entities/zbs-template.orm-entity';
import { ZbsTemplateMapper } from '../mappers/zbs-template.mapper';

@Injectable()
export class TypeOrmZbsTemplateRepository implements IZbsTemplateRepository {
  constructor(
    @InjectRepository(ZbsTemplateOrmEntity)
    private readonly repo: Repository<ZbsTemplateOrmEntity>,
  ) {}

  async findByConnection(connectionId: string): Promise<ZbsTemplate[]> {
    const orms = await this.repo.find({ where: { connectionId } });
    return orms.map((orm) => ZbsTemplateMapper.toDomain(orm));
  }

  async findByConnectionAndTemplateId(
    connectionId: string,
    templateId: string,
  ): Promise<ZbsTemplate | null> {
    const orm = await this.repo.findOne({
      where: { connectionId, templateId },
    });
    return orm ? ZbsTemplateMapper.toDomain(orm) : null;
  }

  async findByUuidAndConnection(
    uuid: string,
    connectionId: string,
  ): Promise<ZbsTemplate | null> {
    const orm = await this.repo.findOne({ where: { uuid, connectionId } });
    return orm ? ZbsTemplateMapper.toDomain(orm) : null;
  }

  async save(template: ZbsTemplate): Promise<void> {
    const orm = ZbsTemplateMapper.toOrm(template);
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

  async softDelete(uuid: string): Promise<void> {
    await this.repo.softDelete({ uuid });
  }
}
