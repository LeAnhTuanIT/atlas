import { BaseEntity } from './base.entity';
import { IDomainEvent } from './domain-event.base';

export abstract class AggregateRoot<TId = string> extends BaseEntity<TId> {
  private readonly _domainEvents: IDomainEvent[] = [];

  get domainEvents(): IDomainEvent[] {
    return [...this._domainEvents];
  }

  protected addDomainEvent(domainEvent: IDomainEvent): void {
    this._domainEvents.push(domainEvent);
  }

  public clearEvents(): void {
    this._domainEvents.length = 0;
  }

  public pullEvents(): IDomainEvent[] {
    const events = [...this._domainEvents];
    this.clearEvents();
    return events;
  }
}