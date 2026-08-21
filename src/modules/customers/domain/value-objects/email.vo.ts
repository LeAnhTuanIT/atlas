export class Email {
  private readonly value: string;

  constructor(rawEmail: string) {
    const clean = rawEmail.trim().toLowerCase();
    if (!this.isValid(clean)) {
      throw new Error(`Email không hợp lệ: ${rawEmail}`);
    }
    this.value = clean;
  }

  private isValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  getValue(): string {
    return this.value;
  }
}