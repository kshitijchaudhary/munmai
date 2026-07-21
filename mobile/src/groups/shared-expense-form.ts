import type { GroupMember } from '@/groups/group-model';

export interface SharedExpenseFormValues {
  amount: string;
  description: string;
  paidBy: string;
  participantIds: string[];
}

export interface CreateSharedExpensePayload {
  groupId: string;
  paidBy: string;
  participants: string[];
  amount: number;
  description: string;
}

export interface SharedExpenseFormErrors {
  amount?: string;
  description?: string;
  paidBy?: string;
  participants?: string;
}

export function validateSharedExpense(values: SharedExpenseFormValues, members: GroupMember[]) {
  const errors: SharedExpenseFormErrors = {};
  const amount = Number(values.amount);
  const memberIds = new Set(members.map((member) => member.user.id));
  if (!Number.isFinite(amount) || amount <= 0) errors.amount = 'Enter an amount greater than 0.';
  if (!values.description.trim()) errors.description = 'Description is required.';
  if (!memberIds.has(values.paidBy)) errors.paidBy = 'Select a current Space member.';
  const participants = [...new Set(values.participantIds)];
  if (participants.length === 0) errors.participants = 'Select at least one participant.';
  else if (participants.some((id) => !memberIds.has(id))) errors.participants = 'Every participant must be a current Space member.';
  return errors;
}

export function buildEqualSplitPayload(groupId: string, values: SharedExpenseFormValues, members: GroupMember[]): CreateSharedExpensePayload | null {
  if (Object.keys(validateSharedExpense(values, members)).length > 0) return null;
  return {
    groupId,
    paidBy: values.paidBy,
    participants: [...new Set(values.participantIds)].sort(),
    amount: Math.round(Number(values.amount) * 100) / 100,
    description: values.description.trim(),
  };
}
