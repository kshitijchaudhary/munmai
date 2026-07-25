/**
 * @param {import('../groups/group-model').GroupActivity} activity
 * @param {string} groupId
 * @param {string} groupName
 * @param {string} currentUserId
 * @returns {import('./activity-model').ActivityEvent}
 */
export function groupActivityToEvent(
  activity,
  groupId,
  groupName,
  currentUserId,
) {
  if (activity.kind === 'shared-expense') {
    const splits = activity.splits.map((split) => ({
      amount: split.amount,
      isCurrentUser: split.user.id === currentUserId,
      isPayer: split.user.id === activity.paidBy.id,
      userId: split.user.id,
      userName: split.user.name,
    }));

    return {
      amount: activity.amount,
      destination: `/groups/${groupId}`,
      id: `shared-expense:${activity.id}`,
      occurredAt: activity.occurredAt,
      paidBy: { id: activity.paidBy.id, name: activity.paidBy.name },
      sourceId: activity.id,
      spaceId: groupId,
      spaceName: groupName,
      splits,
      title: activity.title,
      type: 'shared-expense',
      userShare: splits.find((split) => split.isCurrentUser)?.amount,
    };
  }

  return {
    amount: activity.amount,
    destination: `/groups/${groupId}`,
    from: { id: activity.from.id, name: activity.from.name },
    id: `settlement:${activity.id}`,
    note: activity.note || undefined,
    occurredAt: activity.occurredAt,
    sourceId: activity.id,
    spaceId: groupId,
    spaceName: groupName,
    title: activity.title,
    to: { id: activity.to.id, name: activity.to.name },
    type: 'settlement',
  };
}
