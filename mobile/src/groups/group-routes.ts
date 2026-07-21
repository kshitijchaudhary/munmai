const objectIdPattern = /^[a-f\d]{24}$/i;

export function buildGroupRoute(groupId: string) {
  if (!objectIdPattern.test(groupId)) throw new Error('Invalid group route parameters');
  return `/groups/${groupId.toLowerCase()}` as const;
}

export function buildGroupAddExpenseRoute(groupId: string) {
  return `${buildGroupRoute(groupId)}/add-expense` as const;
}

export function parseGroupRoute(groupId: unknown): string | null {
  if (typeof groupId !== 'string' || !objectIdPattern.test(groupId)) return null;
  return groupId.toLowerCase();
}
