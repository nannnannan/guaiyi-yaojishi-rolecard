import { spawn } from 'node:child_process';
import { readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import YAML from 'yaml';

const name = process.argv.slice(2).filter(arg => arg !== '--').join(' ').trim();

if (!name) {
  console.error('请提供角色卡名，例如：pnpm bundle:card -- "雾港来信"');
  process.exit(1);
}

const child = spawn(process.execPath, ['tavern_sync.mjs', 'bundle', name], {
  cwd: process.cwd(),
  stdio: 'inherit',
});

child.on('error', error => {
  console.error(`无法启动打包：${error.message}`);
  process.exit(1);
});

child.on('exit', async code => {
  if (code !== 0) process.exit(code ?? 1);

  const settings = YAML.parse(await readFile(path.join(process.cwd(), 'tavern_sync.yaml'), 'utf8'));
  const configured = settings?.配置?.[name]?.导出文件路径;
  if (!configured) process.exit(0);

  const pngFile = path.resolve(process.cwd(), configured.endsWith('.png') ? configured : `${configured}.png`);
  const output = await readFile(pngFile);
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!output.subarray(0, 8).equals(pngSignature)) {
    const jsonFile = pngFile.replace(/\.png$/iu, '.json');
    await rename(pngFile, jsonFile);
    console.info(`未设置有效 PNG 头像，已改为导出 JSON：${jsonFile}`);
  }
  process.exit(0);
});
