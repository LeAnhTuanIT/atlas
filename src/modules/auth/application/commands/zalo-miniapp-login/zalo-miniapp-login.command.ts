export class ZaloMiniAppLoginCommand {
  constructor(
    public readonly zaloMiniAppId: string,
    public readonly uid: string,
    public readonly accessToken: string,
    public readonly phoneToken: string,
  ) {}
}
