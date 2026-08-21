export interface SystemJwtPayload {
  sub: string; // system_user.uuid
  email: string;
  scope: 'SYSTEM';
  role: string;
}

export interface MerchantJwtPayload {
  sub: string; // merchant_user.uuid
  email: string;
  scope: 'MERCHANT';
  merchantId: string;
  role: string;
}

export interface CustomerJwtPayload {
  sub: string; // customer.uuid
  phoneOrEmail: string;
  scope: 'CUSTOMER';
  merchantId: string;
}
