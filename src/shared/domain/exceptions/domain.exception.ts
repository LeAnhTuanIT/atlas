export abstract class DomainException extends Error {
  public abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ConflictException extends DomainException {
  readonly code = 'ENTITY_CONFLICT';
}

export class InvalidArgumentException extends DomainException {
  readonly code = 'INVALID_ARGUMENT';
}