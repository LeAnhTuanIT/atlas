export interface MapperPort<TDomainEntity, TOrmEntity> {
  toDomain(ormEntity: TOrmEntity): TDomainEntity;
  toOrm(domainEntity: TDomainEntity): TOrmEntity;
}
