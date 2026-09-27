const CONFUSABLES = {
  a: "aàáâãäåāăąǎȧạảấầẩẫậắằẳẵặа",
  b: "bḃḅḇɓƀ",
  c: "cçćĉċčḉс",
  d: "dďđḍḏɗ",
  e: "eèéêëēĕėęěẹẻẽếềểễệе",
  f: "fƒḟ",
  g: "gĝğġģǧḡ",
  h: "hĥħḥһ",
  i: "iìíîïīĭįıİǐỉịĩɨі",
  j: "jĵǰ",
  k: "kķḳк",
  l: "lĺļľłḷ",
  m: "mḿṁṃм",
  n: "nñńņňṇṉ",
  o: "oòóôõöøōŏőơọỏốồổỗộớờởỡợо",
  p: "pṕр",
  q: "q",
  r: "rŕŗřṛ",
  s: "sśŝşšṣѕ",
  t: "tţťŧṭṯ",
  u: "uùúûüūŭůűųưụủũứừửữựу",
  v: "vṽ",
  w: "wŵẇ",
  x: "xх",
  y: "yýÿŷỳỵỷỹу",
  z: "zźżžẓ"
};

const reverseMap = new Map();
for (const [base, chars] of Object.entries(CONFUSABLES)) {
  for (const char of [...chars]) reverseMap.set(char, base);
}

function normalizeText(text) {
  return String(text ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[\p{Cf}\u200B-\u200D\uFEFF]/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .map(token => [...token].map(ch => reverseMap.get(ch) || ch).join(""))
    .filter(Boolean)
    .join(" ");
}

function compactText(text) {
  return normalizeText(text).replace(/\s+/g, "");
}

function makeVariants(word) {
  const chars = [...normalizeText(word).replace(/\s+/g, "")];
  const variants = [""];
  for (const char of chars) {
    const source = CONFUSABLES[char] || char;
    const next = [];
    for (const prefix of variants) {
      for (const variant of [...source]) next.push(prefix + variant);
    }
    variants.splice(0, variants.length, ...next.slice(0, 50000));
    if (variants.length >= 50000) break;
  }
  return [...new Set(variants)];
}

function toConfusableRegex(word) {
  const normalized = normalizeText(word).replace(/\s+/g, "");
  const parts = [];
  for (const char of [...normalized]) {
    const variants = [...new Set([char, ...(CONFUSABLES[char] || "")])];
    parts.push("[" + variants.map(v => v.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")).join("") + "]");
  }
  return parts.join("[^\\p{L}\\p{N}]*");
}

module.exports = { CONFUSABLES, normalizeText, compactText, makeVariants, toConfusableRegex };
