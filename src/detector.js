const { normalizeText, compactText } = require("./normalizer");

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&");
}

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
    const compactWord = word.replace(/\\s+/g, "");
    if (!compactWord) continue;

    const spacedPattern = compactWord.split("").map(escapeRegex).join("[^\\p{L}\\p{N}]*");
    const spacedRegex = new RegExp("(^|[^\\p{L}\\p{N}])" + spacedPattern + "($|[^\\p{L}\\p{N}])", "iu");

    if (spacedRegex.test(normalized)) return word;
    if (compact.includes(compactWord)) return word;
  }

  return null;
}

module.exports = { findBadWord, prepareWords };
