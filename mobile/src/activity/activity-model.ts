import { isCanonicalMoneyAmount } from '../money/money-amount.js';

export type ActivityEventType =
  | 'income'
  | 'expense'
  | 'shared-expense'
  | 'settlement';

export type ActivityFeedFilter = 'all' | 'personal' | 'shared';

export interface ActivityEventUser {
  id: string;
  name: string;
}

export interface ActivityEventSplit {
  userId: string;
  userName: string;
  amount: number;
  isCurrentUser: boolean;
  isPayer: boolean;
}

export interface ActivityEvent {
  id: string;
  sourceId: string;
  type: ActivityEventType;
  title: string;
  amount: number;
  occurredAt: string;
  category?: string;
  notes?: string;
  spaceId?: string;
  spaceName?: string;
  paidBy?: ActivityEventUser;
  userShare?: number;
  splits?: ActivityEventSplit[];
  from?: ActivityEventUser;
  to?: ActivityEventUser;
  note?: string;
  destination: string;
}

const ACTIVITY_EVENT_ERROR = 'Munmai returned unexpected activity feed data.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(ACTIVITY_EVENT_ERROR);
  return value.trim();
}

function readType(value: unknown): ActivityEventType {
  if (value !== 'income' && value !== 'expense' && value !== 'shared-expense' && value !== 'settlement') {
    throw new Error(ACTIVITY_EVENT_ERROR);
  }
  return value;
}

function readAmount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(ACTIVITY_EVENT_ERROR);
  if (value <= 0) throw new Error(ACTIVITY_EVENT_ERROR);
  if (!isCanonicalMoneyAmount(value)) throw new Error(ACTIVITY_EVENT_ERROR);
  return value;
}

function readIsoDate(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error(ACTIVITY_EVENT_ERROR);
  return value;
}

function readOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error(ACTIVITY_EVENT_ERROR);
  return value.trim() || undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(ACTIVITY_EVENT_ERROR);
  if (value <= 0) throw new Error(ACTIVITY_EVENT_ERROR);
  if (!isCanonicalMoneyAmount(value)) throw new Error(ACTIVITY_EVENT_ERROR);
  return value;
}

function readUser(value: unknown): ActivityEventUser | undefined {
  if (!isRecord(value)) return undefined;
  const id = readOptionalString(value.id);
  const name = readOptionalString(value.name) || 'Member';
  return id ? { id, name } : undefined;
}

function readSplit(value: unknown): ActivityEventSplit | null {
  if (!isRecord(value)) return null;
  return {
    userId: readId(value.userId),
    userName: readOptionalString(value.userName) || 'Member',
    amount: readAmount(value.amount),
    isCurrentUser: value.isCurrentUser === true,
    isPayer: value.isPayer === true,
  };
}

function readSplits(value: unknown): ActivityEventSplit[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (value.length === 0) return undefined;
  const splits = value.map(readSplit).filter((s): s is ActivityEventSplit => s !== null);
  return splits.length > 0 ? splits : undefined;
}

function validateEventContract(event: Record<string, unknown>, type: ActivityEventType): void {
  const destination = typeof event.destination === 'string' ? event.destination : '';
  switch (type) {
    case 'income':
      if (!event.category || typeof event.category !== 'string' || !event.category.trim()) throw new Error(ACTIVITY_EVENT_ERROR);
      if (!destination.startsWith('/transactions/income/')) throw new Error(ACTIVITY_EVENT_ERROR);
      break;
    case 'expense':
      if (!event.category || typeof event.category !== 'string' || !event.category.trim()) throw new Error(ACTIVITY_EVENT_ERROR);
      if (!destination.startsWith('/transactions/expense/')) throw new Error(ACTIVITY_EVENT_ERROR);
      break;
    case 'shared-expense':
      if (!event.spaceId || typeof event.spaceId !== 'string' || !event.spaceId.trim()) throw new Error(ACTIVITY_EVENT_ERROR);
      if (!event.spaceName || typeof event.spaceName !== 'string' || !event.spaceName.trim()) throw new Error(ACTIVITY_EVENT_ERROR);
      if (!event.paidBy || !isRecord(event.paidBy)) throw new Error(ACTIVITY_EVENT_ERROR);
      if (!isRecord(event.paidBy) || !event.paidBy.id || !event.paidBy.name) throw new Error(ACTIVITY_EVENT_ERROR);
      if (!Array.isArray(event.splits) || event.splits.length === 0) throw new Error(ACTIVITY_EVENT_ERROR);
      if (!destination.startsWith('/groups/')) throw new Error(ACTIVITY_EVENT_ERROR);
      break;
    case 'settlement':
      if (!event.spaceId || typeof event.spaceId !== 'string' || !event.spaceId.trim()) throw new Error(ACTIVITY_EVENT_ERROR);
      if (!event.spaceName || typeof event.spaceName !== 'string' || !event.spaceName.trim()) throw new Error(ACTIVITY_EVENT_ERROR);
      if (!event.from || !isRecord(event.from)) throw new Error(ACTIVITY_EVENT_ERROR);
      if (!event.to || !isRecord(event.to)) throw new Error(ACTIVITY_EVENT_ERROR);
      if (!destination.startsWith('/groups/')) throw new Error(ACTIVITY_EVENT_ERROR);
      break;
  }
}

function parseActivityEvent(value: unknown): ActivityEvent | null {
  if (!isRecord(value)) return null;
  try {
    const event = {
      id: readId(value.id),
      sourceId: readId(value.sourceId),
      type: readType(value.type),
      title: readOptionalString(value.title) || '',
      amount: readAmount(value.amount),
      occurredAt: readIsoDate(value.occurredAt),
      category: readOptionalString(value.category),
      notes: readOptionalString(value.notes),
      spaceId: readOptionalString(value.spaceId),
      spaceName: readOptionalString(value.spaceName),
      paidBy: readUser(value.paidBy),
      userShare: readOptionalNumber(value.userShare),
      splits: readSplits(value.splits),
      from: readUser(value.from),
      to: readUser(value.to),
      note: readOptionalString(value.note),
      destination: readId(value.destination),
    };
    validateEventContract(value, event.type);
    return event;
  } catch {
    return null;
  }
}

export function parseActivityFeedResponse(value: unknown): ActivityEvent[] {
  if (!isRecord(value)) return [];
  if (!Array.isArray(value.events)) return [];
  return value.events.map(parseActivityEvent).filter((e): e is ActivityEvent => e !== null);
}

export function filterActivityEvents(
  events: readonly ActivityEvent[],
  filter: ActivityFeedFilter,
): ActivityEvent[] {
  if (filter === 'all') return [...events];
  const personal = filter === 'personal';
  return events.filter((event) =>
    personal
      ? event.type === 'income' || event.type === 'expense'
      : event.type === 'shared-expense' || event.type === 'settlement',
  );
}
