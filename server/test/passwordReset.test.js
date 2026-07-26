import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import crypto from "node:crypto";
import express from "express";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";

import {
  forgotPassword,
  loginUser,
  resetPassword,
} from "../controllers/authController.js";
import {
  buildPasswordResetLimiter,
} from "../middleware/passwordResetRateLimit.js";
import User from "../models/User.js";

const originalEnvironment = {
  ALLOW_LOCALHOST_EMAIL_LINKS: process.env.ALLOW_LOCALHOST_EMAIL_LINKS,
  CLIENT_URL: process.env.CLIENT_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  SERVER_URL: process.env.SERVER_URL,
  SMTP_FROM: process.env.SMTP_FROM,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_USER: process.env.SMTP_USER,
};

before(() => {
  Object.assign(process.env, {
    ALLOW_LOCALHOST_EMAIL_LINKS: "true",
    CLIENT_URL: "https://app.munmai.test",
    JWT_SECRET: "munmai-password-reset-test-secret",
    SERVER_URL: "https://api.munmai.test",
    SMTP_FROM: "Munmai <no-reply@munmai.test>",
    SMTP_HOST: "smtp.munmai.test",
    SMTP_PASS: "test-password",
    SMTP_PORT: "587",
    SMTP_SECURE: "false",
    SMTP_USER: "test-user",
  });
});

after(() => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

const createResponse = () => ({
  statusCode: 200,
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

test("forgot password normalizes email and keeps unknown accounts neutral", async (t) => {
  const findOne = t.mock.method(User, "findOne", async (query) => {
    assert.deepEqual(query, { email: "person@example.com" });
    return null;
  });
  const res = createResponse();

  await forgotPassword(
    { body: { email: "  Person@Example.COM  " } },
    res
  );

  assert.equal(findOne.mock.callCount(), 1);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    message: "If an account exists, a password reset email has been sent.",
  });
});

test("forgot password stores only a hash and emails a bounded raw-token link", async (t) => {
  let deliveredHtml = "";
  t.mock.method(nodemailer, "createTransport", () => ({
    sendMail: async ({ html }) => {
      deliveredHtml = html;
    },
  }));

  const requestedAt = Date.now();
  const user = {
    _id: "507f1f77bcf86cd799439011",
    email: "person@example.com",
    name: "Person",
    resetPasswordToken: "",
    resetPasswordExpires: null,
    save: t.mock.fn(async () => undefined),
  };
  t.mock.method(User, "findOne", async () => user);
  const res = createResponse();

  await forgotPassword({ body: { email: user.email } }, res);

  const rawToken = deliveredHtml.match(
    /https:\/\/app\.munmai\.test\/reset-password\/([a-f0-9]{64})/
  )?.[1];
  assert.match(rawToken ?? "", /^[a-f0-9]{64}$/);
  assert.equal(
    user.resetPasswordToken,
    crypto.createHash("sha256").update(rawToken).digest("hex")
  );
  assert.notEqual(user.resetPasswordToken, rawToken);
  assert.ok(user.resetPasswordExpires instanceof Date);
  assert.ok(
    user.resetPasswordExpires.getTime() >= requestedAt + 59 * 60 * 1000
  );
  assert.ok(
    user.resetPasswordExpires.getTime() <= requestedAt + 61 * 60 * 1000
  );
  assert.equal(user.save.mock.callCount(), 1);
  assert.equal(JSON.stringify(res.body).includes(rawToken), false);
  assert.deepEqual(res.body, {
    message: "If an account exists, a password reset email has been sent.",
  });
});

test("email delivery failure stays neutral and logs no reset token", async (t) => {
  t.mock.method(nodemailer, "createTransport", () => ({
    sendMail: async () => {
      throw new Error("SMTP unavailable");
    },
  }));
  const warnings = [];
  t.mock.method(console, "warn", (...args) => warnings.push(args));
  const user = {
    _id: "507f1f77bcf86cd799439011",
    email: "person@example.com",
    name: "Person",
    resetPasswordToken: "",
    resetPasswordExpires: null,
    save: t.mock.fn(async () => undefined),
  };
  t.mock.method(User, "findOne", async () => user);
  const res = createResponse();

  await forgotPassword({ body: { email: user.email } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    message: "If an account exists, a password reset email has been sent.",
  });
  assert.equal(warnings.length, 1);
  assert.equal(
    JSON.stringify(warnings).includes(user.resetPasswordToken),
    false
  );
  assert.equal(JSON.stringify(warnings).includes("SMTP unavailable"), false);
});

test("local reset URLs require the explicit development control", async (t) => {
  let deliveredHtml = "";
  const createTransport = t.mock.method(nodemailer, "createTransport", () => ({
    sendMail: async ({ html }) => {
      deliveredHtml = html;
    },
  }));
  const user = {
    _id: "507f1f77bcf86cd799439011",
    email: "person@example.com",
    name: "Person",
    resetPasswordToken: "",
    resetPasswordExpires: null,
    save: t.mock.fn(async () => undefined),
  };
  t.mock.method(User, "findOne", async () => user);

  process.env.CLIENT_URL = "http://10.0.0.35:5173";
  process.env.ALLOW_LOCALHOST_EMAIL_LINKS = "true";
  await forgotPassword({ body: { email: user.email } }, createResponse());
  assert.match(
    deliveredHtml,
    /http:\/\/10\.0\.0\.35:5173\/reset-password\/[a-f0-9]{64}/
  );
  assert.equal(createTransport.mock.callCount(), 1);

  process.env.ALLOW_LOCALHOST_EMAIL_LINKS = "false";
  const warnings = [];
  t.mock.method(console, "warn", (...args) => warnings.push(args));
  const res = createResponse();
  await forgotPassword({ body: { email: user.email } }, res);

  assert.equal(createTransport.mock.callCount(), 1);
  assert.equal(warnings.length, 1);
  assert.deepEqual(res.body, {
    message: "If an account exists, a password reset email has been sent.",
  });
});

test("production reset URLs must use public HTTPS", async (t) => {
  const createTransport = t.mock.method(nodemailer, "createTransport", () => ({
    sendMail: async () => undefined,
  }));
  const warnings = [];
  t.mock.method(console, "warn", (...args) => warnings.push(args));
  const user = {
    _id: "507f1f77bcf86cd799439011",
    email: "person@example.com",
    name: "Person",
    resetPasswordToken: "",
    resetPasswordExpires: null,
    save: t.mock.fn(async () => undefined),
  };
  t.mock.method(User, "findOne", async () => user);
  process.env.ALLOW_LOCALHOST_EMAIL_LINKS = "false";
  process.env.CLIENT_URL = "http://app.munmai.test";
  const res = createResponse();

  await forgotPassword({ body: { email: user.email } }, res);

  assert.equal(createTransport.mock.callCount(), 0);
  assert.equal(warnings.length, 1);
  assert.deepEqual(res.body, {
    message: "If an account exists, a password reset email has been sent.",
  });
});

test("reset consumes the token atomically and installs only the new password", async (t) => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const expectedTokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  let persistedPassword;
  const findOneAndUpdate = t.mock.method(
    User,
    "findOneAndUpdate",
    async (filter, update, options) => {
      assert.equal(filter.resetPasswordToken, expectedTokenHash);
      assert.ok(filter.resetPasswordExpires.$gt instanceof Date);
      assert.equal(update.$set.resetPasswordToken, "");
      assert.equal(update.$set.resetPasswordExpires, null);
      assert.deepEqual(options, {
        projection: { _id: 1 },
        runValidators: true,
      });
      persistedPassword = update.$set.password;
      return { _id: "507f1f77bcf86cd799439011" };
    }
  );
  const res = createResponse();

  await resetPassword(
    {
      params: { token: rawToken },
      body: { password: "new-password", confirmPassword: "new-password" },
    },
    res
  );

  assert.equal(findOneAndUpdate.mock.callCount(), 1);
  assert.notEqual(persistedPassword, "new-password");
  assert.match(persistedPassword, /^\$2[aby]\$10\$/);
  assert.equal(await bcrypt.compare("new-password", persistedPassword), true);
  assert.equal(await bcrypt.compare("old-password", persistedPassword), false);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    message: "Password reset successful. You can now log in.",
  });

  t.mock.method(User, "findOne", async () => ({
    _id: "507f1f77bcf86cd799439011",
    email: "person@example.com",
    name: "Person",
    username: "person",
    password: persistedPassword,
    isVerified: true,
  }));
  const oldPasswordResponse = createResponse();
  await loginUser(
    { body: { email: "person@example.com", password: "old-password" } },
    oldPasswordResponse
  );
  assert.equal(oldPasswordResponse.statusCode, 400);
  assert.deepEqual(oldPasswordResponse.body, { message: "Invalid credentials" });

  const newPasswordResponse = createResponse();
  await loginUser(
    { body: { email: "person@example.com", password: "new-password" } },
    newPasswordResponse
  );
  assert.equal(newPasswordResponse.statusCode, 200);
  assert.equal(typeof newPasswordResponse.body.token, "string");
});

test("two concurrent reset attempts consume one token exactly once", async (t) => {
  let tokenAvailable = true;
  const findOneAndUpdate = t.mock.method(
    User,
    "findOneAndUpdate",
    async () => {
      if (!tokenAvailable) {
        return null;
      }

      tokenAvailable = false;
      return { _id: "507f1f77bcf86cd799439011" };
    }
  );
  const request = {
    params: { token: crypto.randomBytes(32).toString("hex") },
    body: { password: "new-password", confirmPassword: "new-password" },
  };
  const responses = [createResponse(), createResponse()];

  await Promise.all(
    responses.map((response) => resetPassword(request, response))
  );

  assert.equal(findOneAndUpdate.mock.callCount(), 2);
  assert.deepEqual(
    responses.map((response) => response.statusCode).sort(),
    [200, 400]
  );
  const losingResponse = responses.find((response) => response.statusCode === 400);
  assert.deepEqual(losingResponse.body, {
    message: "Password reset link is invalid or expired",
  });
  assert.equal(
    responses.some((response) =>
      JSON.stringify(response.body).includes("new-password")
    ),
    false
  );
});

test("password reset endpoints enforce their route-specific rate limits", async () => {
  const app = express();
  app.use(express.json());
  app.post("/forgot", buildPasswordResetLimiter(5), (_req, res) =>
    res.status(200).json({ message: "ok" })
  );
  app.post("/reset", buildPasswordResetLimiter(10), (_req, res) =>
    res.status(200).json({ message: "ok" })
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();

  try {
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const response = await fetch(`http://127.0.0.1:${port}/forgot`, {
        method: "POST",
      });
      assert.equal(response.status, attempt <= 5 ? 200 : 429);
    }

    for (let attempt = 1; attempt <= 11; attempt += 1) {
      const response = await fetch(`http://127.0.0.1:${port}/reset`, {
        method: "POST",
      });
      assert.equal(response.status, attempt <= 10 ? 200 : 429);
    }
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});
