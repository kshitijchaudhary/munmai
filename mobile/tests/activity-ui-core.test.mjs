import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  getActivityEventPresentation,
  getActivitySplitAccessibilityLabel,
} from '../src/activity/activity-event-presentation.js';
import {
  buildActivitySpaceRoute,
  getActivityEventNavigationTarget,
} from '../src/activity/activity-navigation.js';
import {
  filterActivityEvents,
  parseActivityFeedResponse,
} from '../src/activity/activity-model.ts';
import { groupActivityToEvent } from '../src/activity/group-activity-event.js';

const readMobileSource = (path) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const occurredAt = '2026-07-20T00:00:00.000Z';
const destination = '/groups/64a000000000000000000001';
const users = {
  avery: { id: 'user-1', name: 'Avery' },
  blair: { id: 'user-2', name: 'Blair' },
  casey: { id: 'user-3', name: 'Casey' },
};

const events = parseActivityFeedResponse({
  events: [
    {
      amount: 100,
      category: 'Salary',
      destination: '/transactions/income/i1',
      id: 'income:i1',
      occurredAt,
      sourceId: 'i1',
      title: 'Payroll',
      type: 'income',
    },
    {
      amount: 20,
      category: 'Food',
      destination: '/transactions/expense/e1',
      id: 'expense:e1',
      occurredAt,
      sourceId: 'e1',
      title: 'Cafe',
      type: 'expense',
    },
    {
      amount: 10,
      destination,
      id: 'shared-expense:s1',
      occurredAt,
      paidBy: users.avery,
      sourceId: 's1',
      spaceId: '64a000000000000000000001',
      spaceName: 'Test Trip',
      splits: [
        {
          amount: 3.34,
          isCurrentUser: false,
          isPayer: true,
          userId: users.avery.id,
          userName: users.avery.name,
        },
        {
          amount: 3.33,
          isCurrentUser: true,
          isPayer: false,
          userId: users.blair.id,
          userName: users.blair.name,
        },
        {
          amount: 3.33,
          isCurrentUser: false,
          isPayer: false,
          userId: users.casey.id,
          userName: users.casey.name,
        },
      ],
      title: 'Dinner',
      type: 'shared-expense',
      userShare: 3.33,
    },
    {
      amount: 5,
      destination,
      from: users.avery,
      id: 'settlement:t1',
      occurredAt,
      sourceId: 't1',
      spaceId: '64a000000000000000000001',
      spaceName: 'Test Trip',
      title: 'Avery paid Blair',
      to: users.blair,
      type: 'settlement',
    },
  ],
});

test('All, Personal, and Shared filters select the documented event types', () => {
  assert.deepEqual(
    filterActivityEvents(events, 'all').map((event) => event.type),
    ['income', 'expense', 'shared-expense', 'settlement'],
  );
  assert.deepEqual(
    filterActivityEvents(events, 'personal').map((event) => event.type),
    ['income', 'expense'],
  );
  assert.deepEqual(
    filterActivityEvents(events, 'shared').map((event) => event.type),
    ['shared-expense', 'settlement'],
  );
});

test('filtering does not mutate the loaded source events', () => {
  const before = events.map((event) => event.id);
  const all = filterActivityEvents(events, 'all');
  filterActivityEvents(events, 'personal');
  filterActivityEvents(events, 'shared');

  assert.deepEqual(events.map((event) => event.id), before);
  assert.notEqual(all, events);
});

test('filter controls expose selected state and do not request the API again', () => {
  const screen = readMobileSource(
    '../src/app/(app)/transactions/index.tsx',
  );
  assert.match(screen, /accessibilityState=\{\{ selected \}\}/);
  assert.match(screen, /onPress=\{\(\) => setFilter\(item\.value\)\}/);
  assert.equal((screen.match(/useActivityFeed\(\)/g) ?? []).length, 1);
  assert.doesNotMatch(screen, /setFilter\(item\.value\)[\s\S]{0,80}refresh\(/);
});

test('main shared card keeps context without visible event-type duplication', () => {
  const presentation = getActivityEventPresentation(events[2], 'main');
  const visibleCopy = [
    presentation.title,
    presentation.metadata,
    presentation.footer,
  ].join(' ');

  assert.equal(presentation.metadata, 'Test Trip · Avery paid · Jul 20');
  assert.equal((visibleCopy.match(/Shared expense/g) ?? []).length, 0);
  assert.equal(presentation.amount, '$3.33');
  assert.equal(presentation.footer, 'Your share · $10.00 total');
  assert.equal(presentation.people, '3 people');
  assert.equal(presentation.typeLabel, 'Shared expense');
});

test('settlement card keeps its type accessible without visible duplication', () => {
  const presentation = getActivityEventPresentation(events[3], 'main');
  const visibleCopy = [
    presentation.title,
    presentation.metadata,
  ].join(' ');

  assert.equal(presentation.title, 'Avery paid Blair');
  assert.equal(presentation.metadata, 'Test Trip · Jul 20');
  assert.equal((visibleCopy.match(/Settlement/g) ?? []).length, 0);
  assert.equal(presentation.amount, '$5.00');
  assert.equal(presentation.typeLabel, 'Settlement');

  const spacePresentation = getActivityEventPresentation(events[3], 'space');
  assert.equal(spacePresentation.metadata, 'Jul 20');
  assert.equal(spacePresentation.metadata.includes('Settlement'), false);
  assert.equal(spacePresentation.metadata.includes('Test Trip'), false);
});

test('Space Activity omits redundant Space and type text while keeping split context', () => {
  const presentation = getActivityEventPresentation(events[2], 'space');
  assert.equal(presentation.metadata, 'Avery paid · Jul 20');
  assert.equal(presentation.metadata.includes('Test Trip'), false);
  assert.equal(presentation.metadata.includes('Shared expense'), false);
  assert.equal(presentation.amount, '$10.00');
  assert.equal(presentation.footer, 'Your share $3.33');

  const screen = readMobileSource(
    '../src/groups/group-detail-screen.tsx',
  );
  assert.match(screen, /<ActivityEventCard context="space"/);
});

test('Space adapter preserves every exact persisted split and marker', () => {
  const event = groupActivityToEvent(
    {
      amount: 10,
      id: 'expense-1',
      kind: 'shared-expense',
      occurredAt,
      paidBy: users.avery,
      participants: [users.avery, users.blair, users.casey],
      splits: [
        { amount: 3.34, user: users.avery },
        { amount: 3.33, user: users.blair },
        { amount: 3.33, user: users.casey },
      ],
      title: 'Dinner',
    },
    '64a000000000000000000001',
    'Test Trip',
    users.blair.id,
  );

  assert.deepEqual(
    event.splits.map((split) => split.amount),
    [3.34, 3.33, 3.33],
  );
  assert.equal(event.userShare, 3.33);
  assert.equal(event.splits[0].isPayer, true);
  assert.equal(event.splits[1].isCurrentUser, true);
  assert.match(
    getActivitySplitAccessibilityLabel(event.splits[0]),
    /Avery, \$3\.34, payer/,
  );
  assert.match(
    getActivitySplitAccessibilityLabel(event.splits[1]),
    /Blair, \$3\.33, you/,
  );
});

test('a user without a persisted split retains the explicit no-share state', () => {
  const presentation = getActivityEventPresentation(
    { ...events[2], userShare: undefined },
    'main',
  );
  assert.equal(presentation.amount, 'No personal share');
  assert.equal(presentation.footer, 'No personal share · $10.00 total');
});

test('shared navigation uses the Activity-owned Space route', () => {
  assert.deepEqual(getActivityEventNavigationTarget(events[2]), {
    pathname: '/transactions/spaces/[groupId]',
    params: {
      groupId: '64a000000000000000000001',
    },
  });
  assert.equal(
    getActivityEventNavigationTarget(events[0]),
    '/transactions/income/i1',
  );
  assert.deepEqual(
    getActivityEventNavigationTarget(events[3]),
    getActivityEventNavigationTarget(events[2]),
  );
  assert.deepEqual(
    buildActivitySpaceRoute({
      ...events[2],
      destination: '/groups/backend-fallback-must-not-be-used',
    }),
    getActivityEventNavigationTarget(events[2]),
  );
  assert.throws(
    () => buildActivitySpaceRoute({ ...events[2], spaceId: '' }),
    /Space ID/,
  );
});

test('card body navigates while the split control only expands', () => {
  const screen = readMobileSource(
    '../src/app/(app)/transactions/index.tsx',
  );
  const card = readMobileSource('../src/components/activity-event-card.tsx');

  assert.match(screen, /router\.push\(getActivityEventNavigationTarget\(event\) as Href\)/);
  assert.match(card, /onPress=\{onPress\}/);
  assert.match(card, /onPress=\{\(\) => setExpanded/);
  assert.match(card, /expanded && canExpand/);
  assert.match(card, /event\.splits\?\.map/);
  assert.doesNotMatch(card, /setExpanded[\s\S]{0,80}onPress\(\)/);
});

test('Activity and Spaces wrappers own their respective history and fallback', () => {
  const spacesRoute = readMobileSource(
    '../src/app/(app)/groups/[groupId]/index.tsx',
  );
  const activityRoute = readMobileSource(
    '../src/app/(app)/transactions/spaces/[groupId].tsx',
  );
  const detail = readMobileSource('../src/groups/group-detail-screen.tsx');

  assert.match(spacesRoute, /initialSection="overview"/);
  assert.match(spacesRoute, /router\.back\(\)/);
  assert.match(spacesRoute, /router\.replace\(PUBLIC_ROUTES\.groups as Href\)/);
  assert.match(activityRoute, /initialSection="activity"/);
  assert.match(activityRoute, /router\.back\(\)/);
  assert.match(
    activityRoute,
    /router\.replace\(PUBLIC_ROUTES\.transactions as Href\)/,
  );
  assert.doesNotMatch(activityRoute, /PUBLIC_ROUTES\.groups/);
  assert.doesNotMatch(activityRoute, /\/groups\/\[groupId\]/);
  assert.match(detail, /<BackLink label="Back" onPress=\{onBack\} \/>/);
  assert.doesNotMatch(detail, /<BackLink label="Spaces"/);
});

test('both route owners render one shared group-detail implementation', () => {
  const spacesRoute = readMobileSource(
    '../src/app/(app)/groups/[groupId]/index.tsx',
  );
  const activityRoute = readMobileSource(
    '../src/app/(app)/transactions/spaces/[groupId].tsx',
  );

  assert.match(spacesRoute, /<GroupDetailScreen/);
  assert.match(activityRoute, /<GroupDetailScreen/);
  assert.doesNotMatch(spacesRoute, /useGroupDetail|Financial activity|Your balances/);
  assert.doesNotMatch(activityRoute, /useGroupDetail|Financial activity|Your balances/);
});

test('shared card navigation pushes exactly one group destination', () => {
  const screen = readMobileSource(
    '../src/app/(app)/transactions/index.tsx',
  );
  assert.equal(
    (screen.match(/router\.push\(getActivityEventNavigationTarget\(event\) as Href\)/g) ?? []).length,
    1,
  );
  assert.match(screen, /<ActivityEventCard\s+context="main"/);
  assert.doesNotMatch(screen, /router\.push\(PUBLIC_ROUTES\.groups/);
  assert.doesNotMatch(screen, /router\.push\(event\.destination/);
});

test('Space Activity card cannot navigate to the current Space again', () => {
  const screen = readMobileSource(
    '../src/groups/group-detail-screen.tsx',
  );
  const cardUsage = screen.match(
    /<ActivityEventCard context="space"[^>]+\/>/,
  )?.[0];
  assert.ok(cardUsage);
  assert.equal(cardUsage.includes('onPress='), false);
});

test('Activity screen retains loading, retry, empty, and refresh states', () => {
  const screen = readMobileSource(
    '../src/app/(app)/transactions/index.tsx',
  );
  assert.match(screen, /isLoading && data === null/);
  assert.match(screen, /onRetry=\{retry\}/);
  assert.match(screen, /ListEmptyComponent=/);
  assert.match(screen, /refreshing=\{isRefreshing\}/);
  assert.match(screen, /onRefresh=\{refresh\}/);
});

test('compact controls and long names retain accessible behavior', () => {
  const longName = 'A'.repeat(240);
  const presentation = getActivityEventPresentation({
    ...events[3],
    from: { id: 'long', name: longName },
  });
  const card = readMobileSource('../src/components/activity-event-card.tsx');

  assert.ok(presentation.title.startsWith(longName));
  assert.match(card, /accessibilityRole="button"/);
  assert.match(
    card,
    /accessibilityLabel=\{`\$\{presentation\.title\}, \$\{presentation\.typeLabel\}/,
  );
  assert.match(card, /accessibilityState=\{\{ expanded \}\}/);
  assert.match(card, /minHeight: touchTargets\.minimum/);
  assert.match(card, /numberOfLines=\{1\} style=\{styles\.splitName\}/);
});

test('Space Activity reuses the shared card and retained split parser', () => {
  const screen = readMobileSource(
    '../src/groups/group-detail-screen.tsx',
  );
  const model = readMobileSource('../src/groups/group-model.ts');
  assert.match(screen, /groupActivityToEvent\(/);
  assert.match(model, /amount: splitAmount/);
});
