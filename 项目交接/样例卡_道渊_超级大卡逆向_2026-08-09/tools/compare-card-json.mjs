import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [originalArg, rebuiltArg, outputArg] = process.argv.slice(2);
if (!originalArg || !rebuiltArg || !outputArg) {
  console.error('Usage: node compare-card-json.mjs <original.json> <rebuilt.json> <output.json>');
  process.exit(2);
}
const originalPath = path.resolve(originalArg);
const rebuiltPath = path.resolve(rebuiltArg);
const outputPath = path.resolve(outputArg);
if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite: ${outputPath}`);
const originalBytes = fs.readFileSync(originalPath);
const rebuiltBytes = fs.readFileSync(rebuiltPath);
const original = JSON.parse(originalBytes.toString('utf8'));
const rebuilt = JSON.parse(rebuiltBytes.toString('utf8'));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function pointerPart(key) {
  return String(key).replaceAll('~', '~0').replaceAll('/', '~1');
}

function valueSummary(value) {
  const type = typeOf(value);
  if (type === 'string') return { type, characters: [...value].length, sha256: sha256(Buffer.from(value)), preview: value.slice(0, 120) };
  if (type === 'array') return { type, length: value.length, sha256: sha256(Buffer.from(JSON.stringify(canonical(value)))) };
  if (type === 'object') return { type, keys: Object.keys(value).length, sha256: sha256(Buffer.from(JSON.stringify(canonical(value)))) };
  return { type, value };
}

const differences = [];
function compare(a, b, pointer = '') {
  const ta = typeOf(a);
  const tb = typeOf(b);
  if (ta !== tb) {
    differences.push({ pointer: pointer || '/', kind: 'type', original: valueSummary(a), rebuilt: valueSummary(b) });
    return;
  }
  if (ta === 'array') {
    if (a.length !== b.length) differences.push({ pointer: pointer || '/', kind: 'array-length', original: a.length, rebuilt: b.length });
    const length = Math.max(a.length, b.length);
    for (let i = 0; i < length; i += 1) {
      if (i >= a.length) differences.push({ pointer: `${pointer}/${i}`, kind: 'added', rebuilt: valueSummary(b[i]) });
      else if (i >= b.length) differences.push({ pointer: `${pointer}/${i}`, kind: 'removed', original: valueSummary(a[i]) });
      else compare(a[i], b[i], `${pointer}/${i}`);
    }
    return;
  }
  if (ta === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of [...keys].sort()) {
      const next = `${pointer}/${pointerPart(key)}`;
      if (!(key in a)) differences.push({ pointer: next, kind: 'added', rebuilt: valueSummary(b[key]) });
      else if (!(key in b)) differences.push({ pointer: next, kind: 'removed', original: valueSummary(a[key]) });
      else compare(a[key], b[key], next);
    }
    return;
  }
  if (!Object.is(a, b)) differences.push({ pointer: pointer || '/', kind: 'changed', original: valueSummary(a), rebuilt: valueSummary(b) });
}
compare(original, rebuilt);

const originalEntries = original.data?.character_book?.entries ?? [];
const rebuiltEntries = rebuilt.data?.character_book?.entries ?? [];
const originalRegexes = original.data?.extensions?.regex_scripts ?? [];
const rebuiltRegexes = rebuilt.data?.extensions?.regex_scripts ?? [];
const originalScripts = original.data?.extensions?.tavern_helper?.scripts ?? [];
const rebuiltScripts = rebuilt.data?.extensions?.tavern_helper?.scripts ?? [];
const byId = (items) => new Map(items.map((item) => [item.id, item]));
const compareCollection = (before, after) => {
  const left = byId(before);
  const right = byId(after);
  return {
    originalCount: before.length,
    rebuiltCount: after.length,
    missingIds: [...left.keys()].filter((id) => !right.has(id)),
    addedIds: [...right.keys()].filter((id) => !left.has(id)),
    exactSemanticMatches: [...left.entries()].filter(([id, value]) => right.has(id) && JSON.stringify(canonical(value)) === JSON.stringify(canonical(right.get(id)))).length,
  };
};

const result = {
  original: { path: originalPath, bytes: originalBytes.length, sha256: sha256(originalBytes), canonicalSha256: sha256(Buffer.from(JSON.stringify(canonical(original)))) },
  rebuilt: { path: rebuiltPath, bytes: rebuiltBytes.length, sha256: sha256(rebuiltBytes), canonicalSha256: sha256(Buffer.from(JSON.stringify(canonical(rebuilt)))) },
  semanticEqual: differences.length === 0,
  differenceCount: differences.length,
  differenceKinds: Object.fromEntries([...differences.reduce((map, item) => map.set(item.kind, (map.get(item.kind) ?? 0) + 1), new Map())]),
  differenceRoots: Object.fromEntries([...differences.reduce((map, item) => {
    const root = `/${item.pointer.split('/').filter(Boolean)[0] ?? ''}`;
    map.set(root, (map.get(root) ?? 0) + 1);
    return map;
  }, new Map())]),
  collections: {
    worldbookEntries: compareCollection(originalEntries, rebuiltEntries),
    regexes: compareCollection(originalRegexes, rebuiltRegexes),
    helperScripts: compareCollection(originalScripts, rebuiltScripts),
  },
  differences,
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({
  semanticEqual: result.semanticEqual,
  differenceCount: result.differenceCount,
  differenceKinds: result.differenceKinds,
  differenceRoots: result.differenceRoots,
  collections: result.collections,
  output: outputPath,
}, null, 2));
