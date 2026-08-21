import { AsyncLocalStorage } from 'async_hooks';

export interface MerchantContextData {
  userId: string;       // merchant_user.uuid hoặc system_user.uuid
  merchantId: string;   // merchant.id (BigInt dạng string)
  role?: string;        // 'OWNER' | 'ADMIN' | 'STAFF'
  permissions?: string[];
  isSuperAdmin?: boolean;
}

export class MerchantContext {
  private static readonly storage = new AsyncLocalStorage<MerchantContextData>();

  /**
   * Khởi tạo và bao bọc execution context trong vòng đời của 1 Request
   */
  static run<T>(data: MerchantContextData, next: () => T): T {
    return this.storage.run(data, next);
  }

  /**
   * Lấy toàn bộ context data hiện tại của request
   */
  static get(): MerchantContextData | undefined {
    return this.storage.getStore();
  }

  /**
   * Lấy merchantId hiện tại, ném lỗi nếu truy cập ngoài luồng request hợp lệ
   */
  static getMerchantId(): string {
    const store = this.storage.getStore();
    if (!store || !store.merchantId) {
      throw new Error(
        'MerchantContext chưa được thiết lập hoặc User không thuộc Merchant nào.',
      );
    }
    return store.merchantId;
  }

  /**
   * Lấy userId của tài khoản đang thực hiện request
   */
  static getUserId(): string {
    const store = this.storage.getStore();
    if (!store || !store.userId) {
      throw new Error('MerchantContext chưa có thông tin UserId.');
    }
    return store.userId;
  }

  /**
   * Kiểm tra xem request có đang nằm trong Merchant Context hợp lệ hay không
   */
  static hasContext(): boolean {
    return Boolean(this.storage.getStore()?.merchantId);
  }
}