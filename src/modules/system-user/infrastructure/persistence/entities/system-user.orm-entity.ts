import { Entity, Column, Index } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';

export enum SystemRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  SYSTEM_SUPPORT = 'SYSTEM_SUPPORT',
}

@Entity({ name: 'system_users' })
export class SystemUserOrmEntity extends BaseOrmEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    select: false,
  })
  passwordHash: string;

  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName: string;

  @Column({
    type: 'enum',
    enum: SystemRole,
    default: SystemRole.SUPER_ADMIN,
  })
  role: SystemRole;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date;
}
