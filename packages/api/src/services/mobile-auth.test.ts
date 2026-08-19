import assert from "node:assert/strict";
import test from "node:test";
import { consumeMobileLogin, createMobileLogin, isValidSignedSession, signSessionId } from "./mobile-auth";

test("assina e valida uma sessão sem expor o segredo", () => {
  const secret = "a".repeat(64);
  const token = signSessionId("session-id", secret);
  assert.equal(isValidSignedSession(token, secret), true);
  assert.equal(isValidSignedSession(`${token}alterado`, secret), false);
  assert.equal(token.includes(secret), false);
});

test("código móvel é descartável", () => {
  const code = createMobileLogin("session-id", { id: "user-1", name: "Fabi" });
  assert.equal(consumeMobileLogin(code)?.user.id, "user-1");
  assert.equal(consumeMobileLogin(code), null);
});
