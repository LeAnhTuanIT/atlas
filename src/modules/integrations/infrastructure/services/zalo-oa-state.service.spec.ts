import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ZaloOaStateService } from './zalo-oa-state.service';

describe('ZaloOaStateService', () => {
  const jwtService = new JwtService({});
  const configService = {
    getOrThrow: jest.fn().mockReturnValue('state-secret'),
  } as unknown as ConfigService;
  const service = new ZaloOaStateService(jwtService, configService);

  it('signState() rồi verifyState() trả lại đúng merchantId', async () => {
    const state = await service.signState('merchant-1');
    const payload = await service.verifyState(state);
    expect(payload.merchantId).toBe('merchant-1');
  });

  it('verifyState() throw UnauthorizedException khi token sai', async () => {
    await expect(service.verifyState('token-gia')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('verifyState() throw UnauthorizedException khi ký bằng secret khác', async () => {
    const otherService = new ZaloOaStateService(jwtService, {
      getOrThrow: jest.fn().mockReturnValue('secret-khac'),
    } as unknown as ConfigService);
    const state = await otherService.signState('merchant-1');

    await expect(service.verifyState(state)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
