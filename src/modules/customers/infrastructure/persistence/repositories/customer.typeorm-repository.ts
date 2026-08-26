import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  type CustomerFilterParams,
  type CustomerPaginatedResult,
  type ICustomerRepository,
} from '../../../domain/repositories/customer.repository.interface';
import { Customer } from '../../../domain/models/customer.model';
import { CustomerId } from '../../../domain/value-objects/customer-id.vo';
import { PhoneNumber } from '../../../domain/value-objects/phone.vo';
import { Email } from '../../../domain/value-objects/email.vo';
import { CustomerOrmEntity } from '../entities/customer.orm-entity';
import { CustomerMapper } from '../mappers/customer.mapper';
import { paginateByUuidCursor } from '@/shared/infrastructure/persistence/cursor-pagination.util';

@Injectable()
export class CustomerTypeOrmRepository implements ICustomerRepository {
  constructor(
    @InjectRepository(CustomerOrmEntity)
    private readonly repo: Repository<CustomerOrmEntity>,
  ) {}

  async save(customer: Customer): Promise<void> {
    const entity = CustomerMapper.toPersistence(customer);
    await this.repo.save(entity);
  }

  async saveMany(customers: Customer[]): Promise<void> {
    const entities = customers.map((c) => CustomerMapper.toPersistence(c));
    await this.repo.save(entities, { chunk: 500 });
  }

  async findById(merchantId: string, id: CustomerId): Promise<Customer | null> {
    const entity = await this.repo.findOne({
      where: { uuid: id.getValue(), merchantId },
    });
    return entity ? CustomerMapper.toDomain(entity) : null;
  }

  async findByPhone(
    merchantId: string,
    phone: PhoneNumber,
  ): Promise<Customer | null> {
    const entity = await this.repo.findOne({
      where: { merchantId, phone: phone.getValue() },
    });
    return entity ? CustomerMapper.toDomain(entity) : null;
  }

  async findByEmail(
    merchantId: string,
    email: Email,
  ): Promise<Customer | null> {
    const entity = await this.repo.findOne({
      where: { merchantId, email: email.getValue() },
    });
    return entity ? CustomerMapper.toDomain(entity) : null;
  }

  async findByZaloUid(
    merchantId: string,
    zaloUid: string,
  ): Promise<Customer | null> {
    const entity = await this.repo.findOne({
      where: { merchantId, zaloUid },
    });
    return entity ? CustomerMapper.toDomain(entity) : null;
  }

  async findPaginated(
    merchantId: string,
    params: CustomerFilterParams,
  ): Promise<CustomerPaginatedResult> {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.merchantId = :merchantId', { merchantId });

    if (params.status) {
      qb.andWhere('c.status = :status', { status: params.status });
    }

    if (params.search) {
      qb.andWhere(
        '(c.fullName ILIKE :search OR c.phone ILIKE :search OR c.email ILIKE :search)',
        { search: `%${params.search}%` },
      );
    }

    if (params.tagId) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM customer_tag_assignments cta WHERE cta.customer_id = c.uuid AND cta.tag_id = :tagId)',
        { tagId: params.tagId },
      );
    }

    const { items, meta } = await paginateByUuidCursor(qb, 'c', {
      cursor: params.cursor,
      limit: params.limit,
      order: 'DESC',
    });

    return {
      data: items.map((e) => CustomerMapper.toDomain(e)),
      hasNextPage: meta.hasNextPage,
      nextCursor: meta.nextCursor,
    };
  }

  async findAll(merchantId: string): Promise<Customer[]> {
    const entities = await this.repo.find({
      where: { merchantId },
      order: { createdAt: 'DESC' },
    });
    return entities.map((e) => CustomerMapper.toDomain(e));
  }

  async delete(merchantId: string, id: CustomerId): Promise<void> {
    await this.repo.delete({ uuid: id.getValue(), merchantId });
  }
}
