// src/modules/wallet/application/commands/deposit-wallet.command.ts
export class DepositWalletCommand {
  constructor(
    public readonly merchantId: string,
    public readonly amount: number,
    public readonly referenceCode: string,
    // public readonly code: string,
    public readonly description: string,
  ) {}
}
