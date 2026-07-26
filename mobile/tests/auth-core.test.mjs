import assert from 'node:assert/strict';
import test from 'node:test';

import { isSessionAuthenticationFailure } from '../src/api/session-failure.ts';
import { createSessionOperationQueue } from '../src/auth/session-operation-queue.ts';
import {
  FORGOT_PASSWORD_CONFIRMATION,
  validateForgotPasswordEmail,
} from '../src/auth/forgot-password.ts';
import { parseSession, SESSION_VERSION } from '../src/auth/types.ts';
import { readFileSync } from 'node:fs';

const readMobileSource = (path) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

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

test('forgot-password email validation is local, trimmed, and consistent', () => {
  assert.equal(validateForgotPasswordEmail(''), 'Email is required.');
  assert.equal(
    validateForgotPasswordEmail('not-an-email'),
    'Enter a valid email address.',
  );
  assert.equal(validateForgotPasswordEmail(' person@example.com '), null);
  assert.equal(
    FORGOT_PASSWORD_CONFIRMATION,
    'If an account exists, a password reset email has been sent.',
  );
});

test('signed-out forgot-password navigation and API submission are wired safely', () => {
  const signInSource = readMobileSource('../src/app/sign-in.tsx');
  const forgotSource = readMobileSource('../src/app/forgot-password.tsx');
  const rootLayoutSource = readMobileSource('../src/app/_layout.tsx');
  const apiSource = readMobileSource('../src/api/auth.ts');
  const routeSource = readMobileSource('../src/navigation/routes.ts');

  assert.match(signInSource, /href=\{PUBLIC_ROUTES\.forgotPassword\}/);
  assert.match(signInSource, />Forgot password\?<\/Text>/);
  const passwordInputIndex = signInSource.indexOf('textContentType="password"');
  const signInButtonIndex = signInSource.indexOf('label="Sign In"');
  const forgotPasswordLinkIndex = signInSource.indexOf(
    'href={PUBLIC_ROUTES.forgotPassword}',
  );
  assert.ok(passwordInputIndex >= 0);
  assert.ok(signInButtonIndex > passwordInputIndex);
  assert.ok(forgotPasswordLinkIndex > signInButtonIndex);
  assert.match(
    rootLayoutSource,
    /<Stack\.Protected guard=\{!isAuthenticated\}>[\s\S]*<Stack\.Screen name="forgot-password" \/>/,
  );
  assert.match(routeSource, /forgotPassword: '\/forgot-password'/);
  assert.match(
    apiSource,
    /apiClient\.post<ForgotPasswordResponse>\('\/auth\/forgot-password'/,
  );
  assert.match(apiSource, /email: email\.trim\(\)\.toLowerCase\(\)/);
  assert.match(forgotSource, /submissionInProgress\.current/);
  assert.match(forgotSource, /disabled=\{isSubmitting\}/);
  assert.match(forgotSource, /loadingLabel="Sending…"/);
  assert.equal(forgotSource.includes('Sending\\u2026'), false);
  assert.match(forgotSource, />Forgot your password\?<\/Text>/);
  assert.match(forgotSource, />Check your email<\/Text>/);
  assert.match(forgotSource, /setIsComplete\(true\)/);
  assert.match(forgotSource, /FORGOT_PASSWORD_CONFIRMATION/);
  assert.match(forgotSource, /href=\{PUBLIC_ROUTES\.signIn\} replace/);
  assert.doesNotMatch(forgotSource, /reset-password\/|rawToken|SecureStore/);
});
