const { normalizeText, compactText, toConfusableRegex } = require("./normalizer");

function prepareWords(words) {
  return [...new Set(
    words
      .filter(word => typeof word === "string")
      .map(word => normalizeText(word).trim())
      .filter(word => word.length >= 2)
  )];
}

function findBadWord(text, words) {
  const normalized = normalizeText(text);
  const compact = compactText(text);
  const prepared = prepareWords(words);

  for (const word of prepared) {
    const compactWord = word.replace(/\s+/g, "");
    if (!compactWord) continue;

    const pattern = toConfusableRegex(compactWord);
    const regex = new RegExp("(^|[^\p{L}\p{N}])" + pattern + "($|[^\p{L}\p{N}])", "iu");

    if (regex.test(text)) return word;
    if (compact.includes(compactWord)) return word;
  }

  return null;
}

module.exports = { findBadWord, prepareWords };
