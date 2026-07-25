/**
 * @param {import('./activity-model').ActivityEvent} event
 */
export function buildActivitySpaceRoute(event) {
  if (
    (event.type !== 'shared-expense' && event.type !== 'settlement') ||
    typeof event.spaceId !== 'string' ||
    !event.spaceId.trim()
  ) {
    throw new Error('A shared Activity event requires a Space ID.');
  }

  return {
    pathname: '/transactions/spaces/[groupId]',
    params: {
      groupId: event.spaceId.trim(),
    },
  };
}

/**
 * @param {import('./activity-model').ActivityEvent} event
 */
export function getActivityEventNavigationTarget(event) {
  return event.type === 'shared-expense' || event.type === 'settlement'
    ? buildActivitySpaceRoute(event)
    : event.destination;
}
