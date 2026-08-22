import { BadRequestException } from '@nestjs/common';

export class MerchantCode {
  private readonly value: string;

  constructor(code: string) {
    const formatted = code?.trim().toLowerCase();
    if (!formatted || !/^[a-z0-9_-]{3,30}$/.test(formatted)) {
      throw new BadRequestException(
        'Merchant Code phải từ 3-30 ký tự, chỉ gồm chữ thường, số, dấu gạch.',
      );
    }
    this.value = formatted;
  }

  getValue(): string {
    return this.value;
  }
}
