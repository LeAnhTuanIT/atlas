export const PASSWORD_HASHER_PORT = Symbol('PASSWORD_HASHER_PORT');

export interface IPasswordHasherPort {
  hash(plainText: string): Promise<string>;
  compare(plainText: string, hashed: string): Promise<boolean>;
}