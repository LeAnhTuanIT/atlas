import { randomUUID } from 'crypto';

export class CustomerId {
  private readonly value: string;

  constructor(id?: string) {
    if (id && !this.isValidUUID(id)) {
      throw new Error(`Invalid Customer ID: ${id}`);
    }
    this.value = id || randomUUID();
  }

  private isValidUUID(uuid: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      uuid,
    );
  }

  getValue(): string {
    return this.value;
  }

  equals(other?: CustomerId): boolean {
    return !!other && this.value === other.value;
  }
}
