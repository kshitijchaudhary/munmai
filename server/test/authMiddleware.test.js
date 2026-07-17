import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { protect } from "../middleware/authMiddleware.js";

const TEST_JWT_SECRET = "munmai-auth-middleware-test-secret";
const existingJwtSecret = process.env.JWT_SECRET;

before(() => {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
});

after(() => {
  if (existingJwtSecret === undefined) {
    delete process.env.JWT_SECRET;
    return;
  }

  process.env.JWT_SECRET = existingJwtSecret;
});

const createRequest = (token) => ({
  headers: {
    authorization: `Bearer ${token}`,
  },
});

const createResponse = () => ({
  statusCode: undefined,
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("protect authenticates a valid JWT when the user exists", async (t) => {
  const userId = "507f1f77bcf86cd799439011";
  const user = { _id: userId, name: "Munmai User" };
  const select = t.mock.fn(async () => user);

  t.mock.method(User, "findById", (id) => {
    assert.equal(id, userId);
    return { select };
  });

  const req = createRequest(jwt.sign({ id: userId }, TEST_JWT_SECRET));
  const res = createResponse();
  const next = t.mock.fn();

  await protect(req, res, next);

  assert.equal(select.mock.calls[0].arguments[0], "-password");
  assert.equal(next.mock.callCount(), 1);
  assert.equal(req.user, user);
  assert.equal(res.statusCode, undefined);
  assert.equal(res.body, undefined);
});

test("protect rejects a valid JWT when the referenced user is missing", async (t) => {
  const userId = "507f1f77bcf86cd799439012";
  const select = t.mock.fn(async () => null);

  t.mock.method(User, "findById", (id) => {
    assert.equal(id, userId);
    return { select };
  });

  const req = createRequest(jwt.sign({ id: userId }, TEST_JWT_SECRET));
  const res = createResponse();
  const next = t.mock.fn();

  await protect(req, res, next);

  assert.equal(next.mock.callCount(), 0);
  assert.equal(Object.hasOwn(req, "user"), false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { message: "Not authorized, token failed" });
});

test("protect rejects malformed and invalidly signed JWTs", async (t) => {
  const findById = t.mock.method(User, "findById", () => {
    throw new Error("User lookup must not run for an invalid JWT");
  });
  const invalidTokens = [
    "not-a-jwt",
    jwt.sign({ id: "507f1f77bcf86cd799439013" }, "wrong-secret"),
  ];

  for (const token of invalidTokens) {
    const req = createRequest(token);
    const res = createResponse();
    const next = t.mock.fn();

    await protect(req, res, next);

    assert.equal(next.mock.callCount(), 0);
    assert.equal(Object.hasOwn(req, "user"), false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { message: "Not authorized, token failed" });
  }

  assert.equal(findById.mock.callCount(), 0);
});
