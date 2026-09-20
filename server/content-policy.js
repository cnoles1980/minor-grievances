// Deliberately narrow: explicit racial/ethnic slurs, not profanity or identity words.
// Do not add ambiguous words such as "coon", "chink", or "spic": ordinary uses
// and names would be caught too. Reports and human review handle context.
const slurs = [
  "nigger",
  "nigga",
  "kike",
  "wetback",
  "raghead",
  "towelhead",
  "zipperhead",
];
const substitutions = {
  0: "o",
  1: "i",
  3: "e",
  4: "a",
  5: "s",
  7: "t",
  "@": "a",
  $: "s",
};
const patterns = slurs.map(
  (word) =>
    new RegExp(
      `(?<![\\p{L}\\p{N}])${[...word].join("[\\s._*\\-]*")}(?:s)?(?![\\p{L}\\p{N}])`,
      "u",
    ),
);

export const contentPolicyMessage =
  "Swearing is fine. Racial slurs aren’t. Please edit your grievance or signature and try again.";

export function containsBlockedSlur(value) {
  const normalized = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\p{M}\p{Cf}]/gu, "")
    .replace(/[013457@$]/g, (char) => substitutions[char]);
  return patterns.some((pattern) => pattern.test(normalized));
}

export function violatesContentPolicy(text, signature) {
  return containsBlockedSlur(text) || containsBlockedSlur(signature);
}
