import assert from 'node:assert/strict';
import test from 'node:test';

import { isSessionAuthenticationFailure } from '../src/api/session-failure.ts';
import { createSessionOperationQueue } from '../src/auth/session-operation-queue.ts';
import { parseSession, SESSION_VERSION } from '../src/auth/types.ts';

const validSession = {
  version: SESSION_VERSION,
  token: 'header.payload.signature',
  user: {
    id: 'user-id',
    name: 'Jane Doe',
    email: 'jane@example.com',
    username: 'jane_doe',
  },
};

test('parseSession accepts the persisted backend user shape', () => {
  assert.deepEqual(parseSession(JSON.stringify(validSession)), validSession);
  assert.deepEqual(
    parseSession(JSON.stringify({ ...validSession, user: { ...validSession.user, username: '' } })),
    { ...validSession, user: { ...validSession.user, username: '' } },
  );
});

test('parseSession rejects malformed JSON, unknown versions, and incomplete profiles', () => {
  assert.equal(parseSession('{broken-json'), null);
  assert.equal(parseSession(JSON.stringify({ ...validSession, version: 2 })), null);
  assert.equal(parseSession(JSON.stringify({ ...validSession, token: '   ' })), null);
  assert.equal(
    parseSession(JSON.stringify({ ...validSession, user: { ...validSession.user, id: '' } })),
    null,
  );
});

test('session failure classification distinguishes authentication from permission errors', () => {
  assert.equal(isSessionAuthenticationFailure(401, 'Not authorized, token failed', true), true);
  assert.equal(isSessionAuthenticationFailure(401, 'Invalid credentials', false), false);
  assert.equal(
    isSessionAuthenticationFailure(403, 'Please verify your email before logging in', false),
    false,
  );
  assert.equal(
    isSessionAuthenticationFailure(403, 'Only active group members can view balances', true),
    false,
  );
  assert.equal(isSessionAuthenticationFailure(403, 'JWT expired', true), true);
});

test('session operation queue serializes a clear before a later write', async () => {
  const queue = createSessionOperationQueue();
  const events = [];
  let releaseClear;
  const clearGate = new Promise((resolve) => {
    releaseClear = resolve;
  });

  const clearOperation = queue.run(async () => {
    events.push('clear:start');
    await clearGate;
    events.push('clear:end');
  });
  const writeOperation = queue.run(async () => {
    events.push('write');
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ['clear:start']);

  releaseClear();
  await Promise.all([clearOperation, writeOperation]);
  assert.deepEqual(events, ['clear:start', 'clear:end', 'write']);
});

test('session operation queue continues after a failed storage operation', async () => {
  const queue = createSessionOperationQueue();

  await assert.rejects(
    queue.run(async () => {
      throw new Error('storage unavailable');
    }),
    /storage unavailable/,
  );

  assert.equal(await queue.run(async () => 'recovered'), 'recovered');
});
