const { normalizeText, compactText, toConfusableRegex } = require("./normalizer");

function prepareWords(words) {
  return [...new Set(
    words
      .filter(word => typeof word === "string")
      .map(word => normalizeText(word).trim())
      .filter(word => word.length >= 2)
  )];
}

function buildRegex(word, flags = "giu") {
  const compactWord = normalizeText(word).replace(/\s+/g, "");
  if (!compactWord) return null;

  const pattern = toConfusableRegex(compactWord);
  return new RegExp(
    "(?<![\\p{L}\\p{N}])" + pattern + "(?![\\p{L}\\p{N}])",
    flags
  );
}

function findBadWord(text, words) {
  const normalized = normalizeText(text);
  const compact = compactText(text);
  const prepared = prepareWords(words);

  for (const word of prepared) {
    const compactWord = word.replace(/\s+/g, "");
    if (!compactWord) continue;

    const regex = buildRegex(compactWord, "iu");

    if (regex?.test(text)) return word;
    if (compact.includes(compactWord)) return word;
  }

  return null;
}

function censorText(text, words) {
  let result = String(text ?? "");
  const prepared = prepareWords(words);

  for (const word of prepared) {
    const compactWord = word.replace(/\s+/g, "");
    if (!compactWord) continue;

    const regex = buildRegex(compactWord, "giu");
    if (!regex) continue;

    result = result.replace(regex, match => {
      return [...match].map(char =>
        /[\p{L}\p{N}]/u.test(char) ? "*" : char
      ).join("");
    });
  }

  return result;
}

module.exports = { findBadWord, censorText, prepareWords };