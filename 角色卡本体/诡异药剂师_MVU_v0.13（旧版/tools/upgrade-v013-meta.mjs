// tools/upgrade-v013-meta.mjs
// 集成：把 manifest/profile/src/card.json/tavern_helper_scripts.json 版本引用同步到 v0.13.0。
// （契约 contract.json 已由 upgrade-v013-contract.mjs 升级）
import { resolve } from 'node:path';
import { root, backup, readJson, writeJson } from './v013-common.mjs';

const manifestPath = resolve(root, 'manifest.json');
backup(manifestPath);
const manifest = readJson(manifestPath);
manifest.id = manifest.id.replace(/\.v0\.\d+/, '.v0.13');
manifest.version = '0.13.0';
manifest.packed_json = 'dist/诡异药剂师_v0.13.json';
manifest.card.display_name = '《诡异药剂师》v0.13';
manifest.worldbook.version = '0.13.0';
manifest.deliverables = ['dist/诡异药剂师_v0.13.json'];
for (const dep of manifest.runtime_dependencies) {
  if (dep.id === 'mvu-loader') dep.evidence = '/data/extensions/tavern_helper/scripts[id=tavernweave-mvu-loader-v0.13]';
  if (dep.id === 'mvu-zod-schema') {
    dep.role = '验证 v0.13 状态结构';
    dep.evidence = '/data/extensions/tavern_helper/scripts[id=tavernweave-mvu-schema-v0.13]';
  }
}
writeJson(manifestPath, manifest);
console.log('manifest.json 已同步 v0.13.0');

const profilePath = resolve(root, 'profile.json');
backup(profilePath);
const profile = readJson(profilePath);
profile.version = '0.13.0';
profile.display_name = '《诡异药剂师》v0.13';
writeJson(profilePath, profile);
console.log('profile.json 已同步 v0.13.0');

const cardPath = resolve(root, 'src/card.json');
backup(cardPath);
const card = readJson(cardPath);
card.name = '《诡异药剂师》v0.13';
card.character_version = '0.13.0';
card.creator_notes = card.creator_notes.replace(/v0\.\d+(\s|$)/g, 'v0.13 ');
writeJson(cardPath, card);
console.log('src/card.json 已同步 v0.13.0');

const helperPath = resolve(root, 'src/tavern_helper_scripts.json');
backup(helperPath);
const helper = readJson(helperPath);
for (const script of helper) {
  if (script.id?.includes('v0.12')) script.id = script.id.replace('v0.12', 'v0.13');
  if (script.name?.includes('v0.12')) script.name = script.name.replace('v0.12', 'v0.13');
  if (script.data?.tavernweave?.version) script.data.tavernweave.version = '0.13.0';
}
writeJson(helperPath, helper);
console.log('src/tavern_helper_scripts.json 已同步 v0.13.0');

console.log('=== meta 同步完成 ===');