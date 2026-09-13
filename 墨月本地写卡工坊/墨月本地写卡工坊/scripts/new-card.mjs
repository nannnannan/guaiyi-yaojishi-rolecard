import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import YAML from 'yaml';

const root = process.cwd();
const name = process.argv.slice(2).filter(arg => arg !== '--').join(' ').trim();

if (!name) {
  console.error('请提供角色卡名，例如：pnpm new -- "雾港来信"');
  process.exit(1);
}

if (/^[. ]|[. ]$|[<>:"/\\|?*\u0000-\u001F]/u.test(name) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/iu.test(name)) {
  console.error(`角色卡名不能作为 Windows 文件夹名称：${name}`);
  process.exit(1);
}

const templateDir = path.join(root, '初始模板', '墨月角色卡');
const targetDir = path.join(root, 'src', name);
const statusTemplate = path.join(root, '初始模板', '项目状态.md');
const workbenchTemplate = path.join(root, '初始模板', '创作台.md');
const settingsFile = path.join(root, 'tavern_sync.yaml');
let createdTarget = false;

try {
  await access(targetDir).then(
    () => {
      throw new Error(`角色卡已经存在：src/${name}`);
    },
    () => undefined,
  );

  const settingsText = await readFile(settingsFile, 'utf8');
  const settings = YAML.parseDocument(settingsText);
  if (settings.hasIn(['配置', name])) {
    throw new Error(`tavern_sync.yaml 已存在同名配置：${name}`);
  }
  const configs = settings.get('配置', true);
  if (configs && typeof configs === 'object' && 'flow' in configs) configs.flow = false;

  await mkdir(path.dirname(targetDir), { recursive: true });
  await cp(templateDir, targetDir, { recursive: true, errorOnExist: true, force: false });
  createdTarget = true;
  await cp(statusTemplate, path.join(targetDir, '项目状态.md'), { errorOnExist: true, force: false });
  await cp(workbenchTemplate, path.join(targetDir, '创作台.md'), { errorOnExist: true, force: false });

  settings.setIn(['配置', name], {
    类型: '角色卡',
    酒馆中的名称: name,
    本地文件路径: `src/${name}/index`,
    导出文件路径: `导出/${name}/${name}`,
  });
  await writeFile(settingsFile, settings.toString({ lineWidth: 0 }), 'utf8');
  console.info(`已建立空白角色卡：src/${name}`);
} catch (error) {
  if (createdTarget) await rm(targetDir, { recursive: true, force: true });
  console.error(error.message);
  process.exit(1);
}
