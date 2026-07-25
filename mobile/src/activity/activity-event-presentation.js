const TYPE_LABELS = {
  income: 'Income',
  expense: 'Expense',
  'shared-expense': 'Shared expense',
  settlement: 'Settlement',
};

function formatCurrency(value) {
  return new Intl.NumberFormat('en-CA', {
    currency: 'CAD',
    style: 'currency',
  }).format(value);
}

function formatTransactionDate(value) {
  return new Intl.DateTimeFormat('en-CA', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

/**
 * @param {import('./activity-model').ActivityEvent} event
 * @param {'main' | 'space'} [context]
 */
export function getActivityEventPresentation(event, context = 'main') {
  const date = formatTransactionDate(event.occurredAt);

  if (event.type === 'shared-expense') {
    const share =
      event.userShare === undefined
        ? 'No personal share'
        : formatCurrency(event.userShare);
    const payer = event.paidBy?.name ?? 'Member';

    return {
      amount: context === 'space' ? formatCurrency(event.amount) : share,
      footer:
        event.userShare === undefined
          ? context === 'space'
            ? 'No personal share'
            : `No personal share \u00B7 ${formatCurrency(event.amount)} total`
          : context === 'space'
            ? `Your share ${formatCurrency(event.userShare)}`
            : `Your share \u00B7 ${formatCurrency(event.amount)} total`,
      metadata:
        context === 'space'
          ? `${payer} paid \u00B7 ${date}`
          : `${event.spaceName ?? 'Space'} \u00B7 ${payer} paid \u00B7 ${date}`,
      people: `${event.splits?.length ?? 0} ${
        event.splits?.length === 1 ? 'person' : 'people'
      }`,
      title: event.title || 'Shared expense',
      typeLabel: TYPE_LABELS[event.type],
    };
  }

  if (event.type === 'settlement') {
    const from = event.from?.name ?? 'Member';
    const to = event.to?.name ?? 'Member';
    return {
      amount: formatCurrency(event.amount),
      metadata:
        context === 'space'
          ? date
          : `${event.spaceName ?? 'Space'} \u00B7 ${date}`,
      title: `${from} paid ${to}`,
      typeLabel: TYPE_LABELS[event.type],
    };
  }

  return {
    amount: `${event.type === 'income' ? '+' : '\u2212'}${formatCurrency(event.amount)}`,
    metadata: `${event.category ?? 'Uncategorized'} \u00B7 ${TYPE_LABELS[event.type]} \u00B7 ${date}`,
    title: event.title || TYPE_LABELS[event.type],
    typeLabel: TYPE_LABELS[event.type],
  };
}

/**
 * @param {import('./activity-model').ActivityEventSplit} split
 */
export function getActivitySplitAccessibilityLabel(split) {
  const markers = [
    split.isPayer ? 'payer' : null,
    split.isCurrentUser ? 'you' : null,
  ].filter(Boolean);
  return `${split.userName}, ${formatCurrency(split.amount)}${
    markers.length ? `, ${markers.join(', ')}` : ''
  }`;
}
