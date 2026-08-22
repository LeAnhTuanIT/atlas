// src/modules/wallet/application/commands/deposit-wallet.handler.ts
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { DepositWalletCommand } from './deposit-wallet.command';

@Injectable()
export class DepositWalletHandler {
  private readonly logger = new Logger(DepositWalletHandler.name);

  constructor(private readonly dataSource: DataSource) {}

  async execute(command: DepositWalletCommand): Promise<void> {
    const merchantId = String(
      (command as any).merchantId || (command as any).merchant_id,
    );
    const amount = Number((command as any).amount);
    const code =
      (command as any).code ||
      (command as any).transactionCode ||
      (command as any).referenceCode ||
      `DEP_${Date.now()}`;
    const description = (command as any).description || 'Nạp tiền vào ví';

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Tìm thông tin merchant mapping
      let candidateIds: string[] = [merchantId];
      let targetUuid = merchantId;

      try {
        const merchants = await queryRunner.query(
          `SELECT id, uuid FROM merchants 
           WHERE (uuid::text = $1 OR id::text = $1) 
             AND deleted_at IS NULL 
           LIMIT 1`,
          [merchantId],
        );

        if (merchants && merchants.length > 0) {
          const m = merchants[0];
          if (m.uuid) targetUuid = String(m.uuid);
          candidateIds = Array.from(
            new Set(
              [
                merchantId,
                m.uuid ? String(m.uuid) : null,
                m.id ? String(m.id) : null,
              ].filter(Boolean) as string[],
            ),
          );
        }
      } catch (err: any) {
        this.logger.warn(`Không thể tìm merchant mapping: ${err?.message}`);
      }

      // 2. Tìm ví hiện tại theo candidateIds
      const wallets = await queryRunner.query(
        `SELECT * FROM wallets 
         WHERE merchant_id::text = ANY($1::text[]) 
         ORDER BY created_at ASC 
         FOR UPDATE`,
        [candidateIds],
      );

      let wallet = wallets && wallets.length > 0 ? wallets[0] : null;

      // 3. Nếu chưa có -> Tạo mới an toàn với ON CONFLICT
      if (!wallet) {
        const newWalletUuid = randomUUID();
        const inserted = await queryRunner.query(
          `INSERT INTO wallets (uuid, merchant_id, balance, currency, created_at, updated_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (merchant_id) DO UPDATE
           SET updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [newWalletUuid, targetUuid, 0, 'VND'],
        );
        wallet = inserted[0];
      }

      const balanceBefore = Number(wallet.balance || 0);
      const depositAmount = Number(amount);
      const balanceAfter = balanceBefore + depositAmount;

      // 4. Cập nhật số dư ví
      await queryRunner.query(
        `UPDATE wallets 
         SET balance = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [balanceAfter, wallet.id],
      );

      // 5. Ghi nhận giao dịch (dùng ON CONFLICT theo code để chống duplicate webhook)
      const transactionUuid = randomUUID();
      await queryRunner.query(
        `INSERT INTO wallet_transactions
         (uuid, wallet_id, merchant_id, transaction_id, code, type, amount, balance_after, status, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
         ON CONFLICT (uuid) DO NOTHING`,
        [
          transactionUuid,
          wallet.uuid,
          targetUuid,
          transactionUuid,
          code,
          'DEPOSIT',
          depositAmount,
          balanceAfter,
          'SUCCESS',
          description,
        ],
      );

      // 6. Hoàn tất transaction
      await queryRunner.commitTransaction();
      this.logger.log(
        `[Wallet] Đã cộng ${depositAmount} VND vào ví (Wallet ID: ${wallet.id}, Merchant: ${targetUuid}). Số dư mới: ${balanceAfter}`,
      );
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[Wallet] Lỗi nạp tiền vào ví: ${error?.message || error}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
