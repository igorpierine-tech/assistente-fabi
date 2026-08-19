import assert from "node:assert/strict";
import test from "node:test";
import { optionalEmail, optionalId, requiredIsoDate, requiredString, ValidationError } from "./validation";

test("normaliza textos e e-mails válidos", () => {
  assert.equal(requiredString("  Fabiana  ", "Nome", 20), "Fabiana");
  assert.equal(optionalEmail(" FABI@EXAMPLE.COM "), "fabi@example.com");
});

test("rejeita entradas malformadas", () => {
  assert.throws(() => requiredString("", "Nome", 20), ValidationError);
  assert.throws(() => optionalEmail("email-invalido"), ValidationError);
  assert.throws(() => optionalId("../segredo"), ValidationError);
  assert.throws(() => requiredIsoDate("18/08/2026", "Data"), ValidationError);
});

test("aceita data ISO e identificador opaco", () => {
  assert.equal(requiredIsoDate("2026-08-18T10:30:00-04:00", "Data"), "2026-08-18T10:30:00-04:00");
  assert.equal(optionalId("abc_123-XYZ"), "abc_123-XYZ");
});
