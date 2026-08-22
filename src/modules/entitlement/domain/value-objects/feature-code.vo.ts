// domain/value-objects/feature-code.vo.ts
export class FeatureCode {
  private readonly value: string;

  constructor(code: string) {
    if (!code || code.trim().length === 0) {
      throw new Error('FeatureCode cannot be empty');
    }
    this.value = code.trim().toUpperCase();
  }

  getValue(): string {
    return this.value;
  }

  equals(other: FeatureCode): boolean {
    return this.value === other.getValue();
  }
}
