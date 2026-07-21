export interface GroupListItem {
  id: string;
  name: string;
  memberIds: string[];
  updatedAt: string | null;
}

export interface GroupUser {
  id: string;
  name: string;
  email: string;
  username: string;
}

export interface GroupMember {
  id: string;
  user: GroupUser;
  role: 'owner' | 'member';
  joinedAt: string | null;
}

export interface GroupBalance {
  from: GroupUser;
  to: GroupUser;
  amount: number;
}

export interface GroupSummary {
  expenseCount: number;
  totalExpenses: number;
  totalYouOwe: number;
  totalYouAreOwed: number;
  netBalance: number;
}

export interface GroupActivity {
  id: string;
  kind: 'shared-expense';
  title: string;
  amount: number;
  occurredAt: string;
  paidBy: GroupUser;
  participants: GroupUser[];
}

export interface GroupDetailData {
  group: GroupListItem;
  summary: GroupSummary;
  balances: GroupBalance[];
  members: GroupMember[];
  activity: GroupActivity[];
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

function money(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function date(value: unknown): string | null {
  const parsed = text(value);
  return parsed && Number.isFinite(Date.parse(parsed)) ? parsed : null;
}

export function parseGroupUser(value: unknown): GroupUser | null {
  const source = record(value);
  const id = text(source?._id);
  if (!source || !id) return null;
  const email = text(source.email) ?? '';
  const username = text(source.username) ?? '';
  return {
    id,
    name: text(source.name) ?? username ?? email ?? 'Member',
    email,
    username,
  };
}

export function parseGroupsResponse(value: unknown): GroupListItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const source = record(entry);
    const id = text(source?._id);
    const name = text(source?.name);
    if (!source || !id || !name) return [];
    const memberIds = Array.isArray(source.members)
      ? source.members.map((member) => text(record(member)?._id ?? member)).filter((item): item is string => Boolean(item))
      : [];
    return [{ id, name, memberIds: [...new Set(memberIds)], updatedAt: date(source.updatedAt) }];
  });
}

export function parseMembershipsResponse(value: unknown): GroupMember[] {
  const source = record(value);
  const members = Array.isArray(source?.activeMembers) ? source.activeMembers : [];
  return members.flatMap((entry) => {
    const membership = record(entry);
    const id = text(membership?._id);
    const user = parseGroupUser(membership?.userId);
    const role = membership?.role === 'owner' ? 'owner' : membership?.role === 'member' ? 'member' : null;
    return id && user && role
      ? [{ id, user, role, joinedAt: date(membership?.joinedAt) }]
      : [];
  });
}

export function parseBalancesResponse(value: unknown): GroupBalance[] {
  const balances = Array.isArray(value) ? value : [];
  return balances.flatMap((entry) => {
    const source = record(entry);
    const from = parseGroupUser(source?.from);
    const to = parseGroupUser(source?.to);
    const amount = money(source?.amount);
    return from && to && amount !== null && amount > 0 ? [{ from, to, amount }] : [];
  });
}

export function parseActivityResponse(value: unknown): GroupActivity[] {
  const source = record(value);
  const expenses = Array.isArray(source?.expenses) ? source.expenses : [];
  return expenses.flatMap((entry) => {
    const expense = record(entry);
    const id = text(expense?._id);
    const amount = money(expense?.amount);
    const occurredAt = date(expense?.createdAt);
    const paidBy = parseGroupUser(expense?.paidBy);
    if (!id || amount === null || !occurredAt || !paidBy) return [];
    const splits = Array.isArray(expense?.splits) ? expense.splits : [];
    const participants = splits
      .map((split) => parseGroupUser(record(split)?.user))
      .filter((user): user is GroupUser => Boolean(user));
    return [{
      id,
      kind: 'shared-expense' as const,
      title: text(expense?.description) ?? 'Shared expense',
      amount,
      occurredAt,
      paidBy,
      participants,
    }];
  }).sort((left, right) =>
    Date.parse(right.occurredAt) - Date.parse(left.occurredAt) || left.id.localeCompare(right.id),
  );
}

export function parseSummaryResponse(value: unknown): Pick<GroupDetailData, 'group' | 'summary' | 'balances'> | null {
  const source = record(value);
  const groups = parseGroupsResponse(source?.group ? [{ ...source.group, members: [] }] : []);
  const summary = record(source?.summary);
  const expenseCount = money(summary?.expenseCount);
  const totalExpenses = money(summary?.totalExpenses);
  const totalYouOwe = money(summary?.totalYouOwe);
  const totalYouAreOwed = money(summary?.totalYouAreOwed);
  const netBalance = typeof summary?.netBalance === 'number' && Number.isFinite(summary.netBalance)
    ? summary.netBalance
    : null;
  if (!groups[0] || [expenseCount, totalExpenses, totalYouOwe, totalYouAreOwed, netBalance].some((item) => item === null)) return null;
  return {
    group: groups[0],
    summary: { expenseCount: expenseCount!, totalExpenses: totalExpenses!, totalYouOwe: totalYouOwe!, totalYouAreOwed: totalYouAreOwed!, netBalance: netBalance! },
    balances: parseBalancesResponse(source?.balances),
  };
}

export function getBalancePresentation(balance: GroupBalance, currentUserId: string) {
  if (balance.from.id === currentUserId) return { direction: 'owe' as const, label: `You owe ${balance.to.name}` };
  if (balance.to.id === currentUserId) return { direction: 'owed' as const, label: `${balance.from.name} owes you` };
  return { direction: 'other' as const, label: `${balance.from.name} owes ${balance.to.name}` };
}
