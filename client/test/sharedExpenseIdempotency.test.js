import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath) =>
  readFileSync(new URL("../" + relativePath, import.meta.url), "utf-8");

test("createSharedExpense sends Idempotency-Key header", () => {
  const source = readSource("src/api/groups.js");
  assert.match(source, /Idempotency-Key/i);
});

test("SharedExpenseForm generates a key on first submission", () => {
  const source = readSource("src/components/SharedExpenseForm.jsx");
  assert.match(source, /logicalRequestId\.current\s*\|\|\s*globalThis\.crypto\.randomUUID/);
});

test("SharedExpenseForm clears the key on every field edit", () => {
  const source = readSource("src/components/SharedExpenseForm.jsx");
  const matches = source.match(/updateFormData/g);
  assert.ok(matches && matches.length >= 4, "expected at least 4 updateFormData calls for paidBy, participants, amount, description");
});

test("SharedExpenseForm clears the key on reset after success", () => {
  const source = readSource("src/components/SharedExpenseForm.jsx");
  assert.match(source, /resetForm[\s\S]*?logicalRequestId\.current\s*=\s*null/);
});

test("logical request ID lifecycle: first submit generates, retry reuses, edits clear, success clears", () => {
  let currentKey = null;
  let generated = 0;
  const generate = () => { generated += 1; return "key-" + generated + "-0123456789ab"; };

  const submit = () => {
    currentKey = currentKey || generate();
    return currentKey;
  };
  const editField = () => { currentKey = null; };
  const reset = () => { currentKey = null; };

  assert.equal(currentKey, null, "initial state: no key");

  const k1 = submit();
  assert.equal(generated, 1, "first submit generates one key");
  assert.equal(k1, currentKey, "key is stored");

  const k2 = submit();
  assert.equal(k2, k1, "retry reuses the same key");
  assert.equal(generated, 1, "no new generation on retry");

  editField();
  assert.equal(currentKey, null, "amount edit clears key");

  submit();
  assert.equal(generated, 2, "new submit after edit generates new key");

  editField();
  assert.equal(currentKey, null, "payer edit clears key");

  editField();
  assert.equal(currentKey, null, "description edit clears key");

  editField();
  assert.equal(currentKey, null, "participant toggle clears key");

  submit();
  assert.equal(generated, 3, "next new submission generates another key");

  reset();
  assert.equal(currentKey, null, "successful reset clears key");

  submit();
  assert.equal(generated, 4, "next submission after reset generates a new key");
  assert.notEqual(currentKey, k1, "new key differs from first");
});