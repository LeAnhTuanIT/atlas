import type { ZaloOaMessage } from '../models/zalo-oa-message.entity';

export interface ZaloOaMessagePage {
  items: ZaloOaMessage[];
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface IZaloOaMessageRepository {
  save(message: ZaloOaMessage): Promise<void>;
  existsByExternalMessageId(
    connectionId: string,
    externalMessageId: string,
  ): Promise<boolean>;
  findByConnection(
    connectionId: string,
    params: { cursor?: string; limit?: number },
  ): Promise<ZaloOaMessagePage>;
}

export const ZALO_OA_MESSAGE_REPOSITORY = Symbol('IZaloOaMessageRepository');
