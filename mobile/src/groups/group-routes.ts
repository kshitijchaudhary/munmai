const objectIdPattern = /^[a-f\d]{24}$/i;

export function buildGroupRoute(groupId: string) {
  if (!objectIdPattern.test(groupId)) throw new Error('Invalid group route parameters');
  return `/groups/${groupId.toLowerCase()}` as const;
}

export function buildGroupAddExpenseRoute(groupId: string) {
  return `${buildGroupRoute(groupId)}/add-expense` as const;
}

export function buildSettlementHistoryRoute(groupId: string) {
  return `${buildGroupRoute(groupId)}/settlements` as const;
}

export function buildNewSettlementRoute(groupId: string, from: string, to: string) {
  if (!objectIdPattern.test(from) || !objectIdPattern.test(to) || from === to) {
    throw new Error('Invalid settlement route parameters');
  }
  return `${buildSettlementHistoryRoute(groupId)}/new?from=${from.toLowerCase()}&to=${to.toLowerCase()}` as const;
}

export function parseSettlementRoute(groupId: unknown, from: unknown, to: unknown) {
  const parsedGroupId = parseGroupRoute(groupId);
  if (
    !parsedGroupId ||
    typeof from !== 'string' ||
    typeof to !== 'string' ||
    !objectIdPattern.test(from) ||
    !objectIdPattern.test(to) ||
    from.toLowerCase() === to.toLowerCase()
  ) return null;
  return { groupId: parsedGroupId, from: from.toLowerCase(), to: to.toLowerCase() };
}

export function parseGroupRoute(groupId: unknown): string | null {
  if (typeof groupId !== 'string' || !objectIdPattern.test(groupId)) return null;
  return groupId.toLowerCase();
}
