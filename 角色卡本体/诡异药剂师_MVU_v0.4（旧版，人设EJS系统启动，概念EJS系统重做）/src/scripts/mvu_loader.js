const MVU_URLS = [
  'https://cdn.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate@b42817925d0391c15fa242a8238d2bbe28eb6319/artifact/bundle.js',
  'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate@b42817925d0391c15fa242a8238d2bbe28eb6319/artifact/bundle.js',
];

async function importFirstAvailable(urls) {
  let lastError;
  for (const url of urls) {
    try {
      await import(url);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`[诡异药剂师v0.4] MVU 加载失败，尝试备用源：${url}`, error);
    }
  }
  throw lastError ?? new Error('没有可用的 MVU 运行源');
}

if (!globalThis.Mvu) {
  await importFirstAvailable(MVU_URLS);
}

if (typeof waitGlobalInitialized === 'function') {
  await waitGlobalInitialized('Mvu');
}

if (!globalThis.Mvu) {
  throw new Error('[诡异药剂师v0.4] MVU 未就绪；正文仍可继续，但状态不会持久化。');
}
