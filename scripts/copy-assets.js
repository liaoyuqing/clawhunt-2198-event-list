// 把 src 下的静态资源（wxml / wxss / json）复制到 miniprogram 编译产物目录，
// 与 tsc 生成的 js 一起组成可直接导入微信开发者工具的小程序。
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src');
const OUT = path.resolve(__dirname, '..', 'miniprogram');
const EXTS = ['.wxml', '.wxss', '.json'];

let count = 0;
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (EXTS.includes(path.extname(name))) {
      const rel = path.relative(SRC, full);
      const dest = path.join(OUT, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(full, dest);
      count += 1;
    }
  }
}
walk(SRC);
console.log('[build] copied ' + count + ' static assets to miniprogram/');
