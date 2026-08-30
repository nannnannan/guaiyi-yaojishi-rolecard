// tools/upgrade-v012-meta.mjs
// 探针：同步 manifest/profile/schema.js 的版本与基础引用到 v0.12.0
// （契约 contract.json 已由 upgrade-v012-contract.mjs 升级）
// 只改：版本号、显示名、产物文件名、内部 id、schema phaseNames 扩展 S32-S35。
// 内容不在此步扩容（事件/概念/角色正文后续按蓝图生成）。
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backup = (p) => {
  const b = `${p}.bak-v011-baseline`;
  if (!existsSync(b)) copyFileSync(p, b);
};

// ===== manifest.json =====
const manifestPath = resolve(root, 'manifest.json');
backup(manifestPath);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.id = manifest.id.replace('.v0.11', '.v0.12');
manifest.version = '0.12.0';
manifest.packed_json = 'dist/诡异药剂师_v0.12.json';
manifest.card.stable_id = manifest.card.stable_id;
manifest.card.display_name = '《诡异药剂师》v0.12';
manifest.worldbook.version = '0.12.0';
manifest.deliverables = ['dist/诡异药剂师_v0.12.json'];
for (const dep of manifest.runtime_dependencies) {
  if (dep.id === 'mvu-loader') dep.evidence = '/data/extensions/tavern_helper/scripts[id=tavernweave-mvu-loader-v0.12]';
  if (dep.id === 'mvu-zod-schema') {
    dep.role = '验证 v0.12 状态结构';
    dep.evidence = '/data/extensions/tavern_helper/scripts[id=tavernweave-mvu-schema-v0.12]';
  }
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log('manifest.json 已同步 v0.12.0');

// ===== profile.json =====
const profilePath = resolve(root, 'profile.json');
backup(profilePath);
const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
profile.version = '0.12.0';
profile.display_name = '《诡异药剂师》v0.12';
profile.ui_variant = 'death_realm_four_page'; // 保持
writeFileSync(profilePath, `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
console.log('profile.json 已同步 v0.12.0');

// ===== src/card.json =====
const cardPath = resolve(root, 'src/card.json');
backup(cardPath);
const card = JSON.parse(readFileSync(cardPath, 'utf8'));
card.name = '《诡异药剂师》v0.12';
card.character_version = '0.12.0';
card.creator_notes = card.creator_notes.replace('v0.11', 'v0.12');
writeFileSync(cardPath, `${JSON.stringify(card, null, 2)}\n`, 'utf8');
console.log('src/card.json 已同步 v0.12.0');

// ===== src/scripts/schema.js：phaseNames 扩展 S32-S35 =====
const schemaPath = resolve(root, 'src/scripts/schema.js');
backup(schemaPath);
let schema = readFileSync(schemaPath, 'utf8');
if (!schema.includes("S32:")) {
  const s32 = "  S32: '蜀都核爆与脱裤救世',\n  S33: '跨界逆召与三位一体',\n  S34: '使徒决战与神圣破防',\n  S35: '圣殿覆灭与蓝星家庭',\n};";
  schema = schema.replace(/  S31: '[^']*',\n};/, s32);
  writeFileSync(schemaPath, schema, 'utf8');
  console.log('schema.js phaseNames 已追加 S32-S35');
} else {
  console.log('schema.js 已含 S32-S35（跳过）');
}

console.log('=== meta 同步完成 ===');
