export class PhoneNumber {
  private readonly value: string;

  constructor(rawPhone: string) {
    const formatted = this.format(rawPhone);
    if (!this.isValid(formatted)) {
      throw new Error(`Số điện thoại không hợp lệ: ${rawPhone}`);
    }
    this.value = formatted;
  }

  private format(phone: string): string {
    const clean = phone.replace(/\s+/g, '');
    if (clean.startsWith('0')) return `+84${clean.slice(1)}`;
    if (clean.startsWith('84')) return `+${clean}`;
    return clean;
  }

  private isValid(phone: string): boolean {
    return /^\+84[3|5|7|8|9][0-9]{8}$/.test(phone);
  }

  getValue(): string {
    return this.value;
  }
}