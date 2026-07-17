import type { TransactionRecordType } from '@/transactions/transaction-history-model';

export interface TransactionDetailRouteParams {
  id: string;
  type: TransactionRecordType;
}

type RouteParameter = string | string[] | undefined;

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

function readSingleParameter(value: RouteParameter): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function parseTransactionDetailRoute(
  typeValue: RouteParameter,
  idValue: RouteParameter,
): TransactionDetailRouteParams | null {
  const type = readSingleParameter(typeValue);
  const id = readSingleParameter(idValue);

  if ((type !== 'income' && type !== 'expense') || !id || !OBJECT_ID_PATTERN.test(id)) {
    return null;
  }

  return { type, id: id.toLowerCase() };
}

export function buildTransactionDetailRoute(
  type: TransactionRecordType,
  id: string,
): string {
  const params = parseTransactionDetailRoute(type, id);

  if (!params) {
    throw new Error('Cannot build a transaction detail route from invalid parameters.');
  }

  return `/transactions/${params.type}/${params.id}`;
}
