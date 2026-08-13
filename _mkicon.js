const sharp = require('sharp');
const fs = require('fs');

async function main() {
  const outDir = 'C:/Users/Administrator/.openclaw/workspace/website/';
  const svg = fs.readFileSync(outDir + 'favicon.svg', 'utf8');
  // 生成 256x256 PNG（用 SVG 渲染，会带渐变圆角+Z）
  const pngBuf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  fs.writeFileSync(outDir + 'zierclaw-icon.png', pngBuf);
  console.log('PNG 生成:', pngBuf.length, 'bytes');

  // 转 ICO（含 256 和 48 两个尺寸，48 用于资源管理器小图标）
  // sharp 不能直接出 ico，用 ICO 容器手动封装单张 PNG（256）简单方案：
  // 更稳：用 sharp 出多尺寸，然后用 ICO header 组装。
  // 简单起见：生成一个 256 的 ICO（PNG 压缩）。
  // ICO header: 6 bytes + 1 dir entry(16 bytes) + PNG data
  const entrySize = 256; // 用 256 尺寸
  const icoDir = Buffer.from([
    0, 0, // reserved
    1, 0, // type: icon(1)
    1, 0, // count: 1
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 // placeholder
  ]);
  // entry
  const w = (entrySize === 256) ? 0 : entrySize; // 0 means 256
  const h = (entrySize === 256) ? 0 : entrySize;
  const entry = Buffer.alloc(16);
  entry[0] = w; entry[1] = h;
  entry[2] = 0; entry[3] = 0; // palette
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(pngBuf.length, 8); // size
  entry.writeUInt32LE(6 + 16, 12); // offset
  const ico = Buffer.concat([icoDir, entry, pngBuf]);
  fs.writeFileSync(outDir + 'zierclaw-icon.ico', ico);
  console.log('ICO 生成:', ico.length, 'bytes');
}
main().catch(e => console.log('ERR', e.message));
