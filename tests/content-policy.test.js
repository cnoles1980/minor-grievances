import test from "node:test";
import assert from "node:assert/strict";
import {
  containsBlockedSlur,
  violatesContentPolicy,
} from "../server/content-policy.js";

test("narrow policy blocks explicit slurs, plurals and common obfuscations", () => {
  for (const value of [
    "nigger",
    "NIGGERS",
    "n1gg3r",
    "n.i.g.g.e.r",
    "n i g g e r",
    "ni\u200bggér",
    "ｎｉｇｇｅｒ",
    "wetbacks",
    "raghead",
    "towelhead",
    "zipperhead",
    "kike",
    "nigga",
  ]) {
    assert.equal(containsBlockedSlur(value), true, "expected blocked fixture");
  }
  assert.equal(violatesContentPolicy("A harmless complaint", "nigger"), true);
});

test("ordinary profanity, identities and embedded word fragments stay allowed", () => {
  for (const value of [
    "This fucking printer is shit.",
    "Raccoons in the attic",
    "A chink in the armor",
    "Spic and span",
    "Gobbledygook",
    "Sniggering coworkers",
    "Black, Jewish, Muslim, white and Asian people",
    "Kikeli",
    "I hate racism",
    "Niger is a country",
    "Nigeria",
    "Cocktails in Scunthorpe",
  ]) {
    assert.equal(containsBlockedSlur(value), false, value);
  }
});
