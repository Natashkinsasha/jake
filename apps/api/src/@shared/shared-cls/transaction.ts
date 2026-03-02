import { SetMetadata } from "@nestjs/common";

export const TRANSACTION_KEY = "TRANSACTION";

/**
 * @Transaction() decorator — wraps a method in a DB transaction via CLS.
 * DAOs inside the transaction automatically receive tx from AsyncLocalStorage.
 */
export function Transaction(): MethodDecorator {
  return SetMetadata(TRANSACTION_KEY, true);
}
