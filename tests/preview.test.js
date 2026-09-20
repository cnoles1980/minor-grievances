import test from "node:test";
import assert from "node:assert/strict";
import { previewResponse } from "../src/preview.js";
test("public preview supports reading/sorting but never claims to persist actions", () => {
  const notes = previewResponse("/notes?sort=most");
  assert.ok(notes.length);
  assert.ok(notes.every((n) => n.demo));
  assert.ok(notes.every((n, i) => i === 0 || notes[i - 1].votes >= n.votes));
  assert.throws(
    () => previewResponse("/notes", { text: "This must not save" }),
    /read-only/,
  );
  assert.throws(
    () => previewResponse("/notes/founding-1/endorse", {}),
    /read-only/,
  );
  assert.equal(previewResponse("/notes/founding-1").id, "founding-1");
  assert.ok(
    previewResponse("/notes?category=Tech").every((n) => n.category === "Tech"),
  );
});
