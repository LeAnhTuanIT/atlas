// src/modules/entitlement/application/commands/grant-feature.command.ts
export class GrantFeatureCommand {
  constructor(
    public readonly shopId: string,
    public readonly featureCode: string,
    public readonly durationMonths: number,
  ) {}
}