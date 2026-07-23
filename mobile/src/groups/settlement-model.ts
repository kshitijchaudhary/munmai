import type { GroupActivity, GroupBalance, GroupMember, GroupUser } from '@/groups/group-model';
import {
  getMoneyAmountInputError,
  parseMoneyAmountInput,
} from '../money/money-amount.js';

export interface SettlementRecord {
  id: string;
  groupId: string;
  from: GroupUser;
  to: GroupUser;
  amount: number;
  note: string;
  recordedBy: GroupUser;
  createdAt: string;
}

export interface SettlementDirection {
  from: GroupUser;
  to: GroupUser;
  outstandingCents: number;
  label: string;
}

export interface SettlementFormValues {
  amount: string;
  note: string;
}

export interface SettlementFormErrors {
  amount?: string;
  direction?: string;
}

export interface CreateSettlementPayload {
  from: string;
  to: string;
  amount: number;
  note: string;
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseUser(value: unknown): GroupUser | null {
  const source = record(value);
  const id = text(source?._id);
  if (!source || !id) return null;
  const email = text(source.email) ?? '';
  const username = text(source.username) ?? '';
  return { id, name: text(source.name) ?? (username || email || 'Member'), email, username };
}

export function currencyToCents(value: string | number): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? Math.round((value + Number.EPSILON) * 100) : null;
  }
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function centsToAmount(cents: number): number {
  return cents / 100;
}

export function getSettlementDirection(balance: GroupBalance, currentUserId: string): SettlementDirection | null {
  const outstandingCents = currencyToCents(balance.amount);
  if (!outstandingCents || balance.from.id === balance.to.id) return null;
  return {
    from: balance.from,
    to: balance.to,
    outstandingCents,
    label: balance.from.id === currentUserId
      ? `You pay ${balance.to.name}`
      : balance.to.id === currentUserId
        ? `${balance.from.name} pays you`
        : `${balance.from.name} pays ${balance.to.name}`,
  };
}

export function findSettlementDirection(
  balances: GroupBalance[],
  fromId: string,
  toId: string,
  currentUserId: string,
): SettlementDirection | null {
  const balance = balances.find((item) => item.from.id === fromId && item.to.id === toId);
  return balance ? getSettlementDirection(balance, currentUserId) : null;
}

export function validateSettlement(
  values: SettlementFormValues,
  direction: SettlementDirection | null,
  members: GroupMember[],
): SettlementFormErrors {
  const errors: SettlementFormErrors = {};
  const amount = parseMoneyAmountInput(values.amount);
  const amountCents = amount === null ? null : currencyToCents(amount);
  const amountError = getMoneyAmountInputError(values.amount);
  if (amountError) errors.amount = amountError;
  if (!direction) errors.direction = 'This balance is no longer available.';
  else {
    const memberIds = new Set(members.map((member) => member.user.id));
    if (direction.from.id === direction.to.id) errors.direction = 'Settlement members must be different.';
    else if (!memberIds.has(direction.from.id) || !memberIds.has(direction.to.id)) errors.direction = 'Both people must be active Space members.';
    if (amountCents && amountCents > direction.outstandingCents) errors.amount = 'Amount cannot exceed the outstanding balance.';
  }
  return errors;
}

export function buildSettlementPayload(
  values: SettlementFormValues,
  direction: SettlementDirection | null,
  members: GroupMember[],
): CreateSettlementPayload | null {
  if (!direction || Object.keys(validateSettlement(values, direction, members)).length) return null;
  const amount = parseMoneyAmountInput(values.amount);
  if (amount === null) return null;
  return { from: direction.from.id, to: direction.to.id, amount, note: values.note.trim() };
}

export function parseSettlementHistory(value: unknown): SettlementRecord[] {
  const source = record(value);
  const settlements = Array.isArray(source?.settlements) ? source.settlements : [];
  return settlements.flatMap((entry) => {
    const item = record(entry);
    const id = text(item?._id);
    const groupId = text(item?.group);
    const from = parseUser(item?.from);
    const to = parseUser(item?.to);
    const recordedBy = parseUser(item?.recordedBy);
    const amountCents = typeof item?.amount === 'number' ? currencyToCents(item.amount) : null;
    const createdAt = text(item?.createdAt);
    if (!id || !groupId || !from || !to || !recordedBy || !amountCents || !createdAt || !Number.isFinite(Date.parse(createdAt))) return [];
    return [{ id, groupId, from, to, recordedBy, amount: centsToAmount(amountCents), note: text(item?.note) ?? '', createdAt }];
  }).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || left.id.localeCompare(right.id));
}

export function settlementToActivity(settlement: SettlementRecord): GroupActivity {
  return {
    id: `settlement:${settlement.id}`,
    kind: 'settlement',
    title: `${settlement.from.name} paid ${settlement.to.name}`,
    amount: settlement.amount,
    occurredAt: settlement.createdAt,
    from: settlement.from,
    to: settlement.to,
    note: settlement.note,
  };
}

export function mergeFinancialActivity(expenses: GroupActivity[], settlements: SettlementRecord[]): GroupActivity[] {
  return [...expenses, ...settlements.map(settlementToActivity)].sort(
    (left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt) || `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`),
  );
}
