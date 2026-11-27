// 等价于微信开发者工具的「构建 npm」：把 tdesign-miniprogram 的 miniprogram_dist
// 复制到 miniprogram/miniprogram_npm/tdesign-miniprogram，供小程序 import 使用。
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '..', 'node_modules', 'tdesign-miniprogram', 'miniprogram_dist');
const dest = path.resolve(__dirname, '..', 'miniprogram', 'miniprogram_npm', 'tdesign-miniprogram');

if (!fs.existsSync(src)) {
  console.error('[build] tdesign-miniprogram 未安装，请先 npm install');
  process.exit(1);
}
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log('[build] tdesign-miniprogram -> miniprogram/miniprogram_npm/tdesign-miniprogram');
