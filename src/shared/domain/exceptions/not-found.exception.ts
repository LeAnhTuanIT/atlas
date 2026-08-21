import { DomainException } from './domain.exception';

export class NotFoundException extends DomainException {
  readonly code = 'ENTITY_NOT_FOUND';

  constructor(entityName: string, identifier: string | number) {
    super(`${entityName} với định danh [${identifier}] không tồn tại.`);
  }
}