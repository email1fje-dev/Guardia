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
  return text
    .normalize("NFKD")
    .replace(/\\p{M}/gu, "")
    .replace(/[\\p{Cf}\\u200B-\\u200D\\uFEFF]/gu, "")
    .toLowerCase()
    .replace(/[^\\p{L}\\p{N}]+/gu, " ")
    .split(/\\s+/)
    .map(token => [...token].map(ch => reverseMap.get(ch) || ch).join(""))
    .filter(Boolean)
    .join(" ");
}

function compactText(text) {
  return normalizeText(text).replace(/\\s+/g, "");
}

module.exports = { normalizeText, compactText };
