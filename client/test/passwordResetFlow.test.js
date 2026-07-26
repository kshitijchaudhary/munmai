import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readClientSource = (path) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

test("web routes preserve the existing forgot and tokenized reset pages", () => {
  const appSource = readClientSource("../src/App.jsx");

  assert.match(
    appSource,
    /<Route path="\/forgot-password" element=\{<ForgotPassword \/>\} \/>/
  );
  assert.match(
    appSource,
    /<Route path="\/reset-password\/:token" element=\{<ResetPassword \/>\} \/>/
  );
});

test("web forgot-password uses the neutral backend request flow", () => {
  const source = readClientSource("../src/pages/ForgotPassword.jsx");

  assert.match(source, /api\.post\("\/auth\/forgot-password"/);
  assert.match(source, /email: email\.trim\(\)/);
  assert.match(
    source,
    /If an account exists, a password reset email has been sent\./
  );
  assert.match(source, /type="email"/);
  assert.match(source, /required/);
  assert.match(source, /disabled=\{loading\}/);
});

test("web reset-password keeps the token route and backend password contract", () => {
  const source = readClientSource("../src/pages/ResetPassword.jsx");

  assert.match(
    source,
    /api\.post\(`\/auth\/reset-password\/\$\{token\}`, formData\)/
  );
  assert.equal((source.match(/minLength="6"/g) ?? []).length, 2);
  assert.match(source, /password: ""/);
  assert.match(source, /confirmPassword: ""/);
  assert.match(source, /disabled=\{loading\}/);
});

test("telemetry redacts reset tokens from route names", () => {
  const source = readClientSource("../src/utils/telemetry.js");

  assert.match(source, /pathname\.startsWith\("\/reset-password\/"\)/);
  assert.match(source, /return "\/reset-password\/:token"/);
});
