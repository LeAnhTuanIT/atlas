// src/modules/entitlement/presentation/decorators/require-feature.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const FEATURE_KEY = 'require_feature';
export const RequireFeature = (featureId: string) =>
  SetMetadata(FEATURE_KEY, featureId);
