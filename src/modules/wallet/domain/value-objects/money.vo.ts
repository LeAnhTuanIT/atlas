// src/modules/wallet/domain/value-objects/money.vo.ts
export class Money {
  constructor(
    private readonly amount: number,
    private readonly currency: string = 'VND',
  ) {
    if (amount < 0) {
      throw new Error('Số tiền không được là số âm');
    }
  }

  getAmount(): number {
    return this.amount;
  }

  getCurrency(): string {
    return this.currency;
  }

  add(other: Money): Money {
    this.ensureSameCurrency(other);
    return new Money(this.amount + other.getAmount(), this.currency);
  }

  subtract(other: Money): Money {
    this.ensureSameCurrency(other);
    if (this.amount < other.getAmount()) {
      throw new Error('Số dư ví không đủ để thực hiện giao dịch');
    }
    return new Money(this.amount - other.getAmount(), this.currency);
  }

  private ensureSameCurrency(other: Money) {
    if (this.currency !== other.getCurrency()) {
      throw new Error('Không thể tính toán giữa hai loại tiền tệ khác nhau');
    }
  }
}
