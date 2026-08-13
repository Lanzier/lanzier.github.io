const fs = require('fs');
const { execSync } = require('child_process');
const w = 'C:/Users/Administrator/.openclaw/workspace/website/';

// 确认
const b = fs.readFileSync(w + 'install.ps1');
const t = b.toString('utf8');
console.log('BOM:', b[0] === 0xEF ? 'OK' : '无');
console.log('Find-NodeExe:', t.includes('Find-NodeExe'));
console.log('portable-node探测:', t.includes('portable-node'));
console.log('Git清华正确路径:', t.includes('EscapeDataString'));

const zipOut = w + 'ZierClaw一键安装-v1.4.zip';
const pkgDir = w + '_pkg_v14';
const files = ['安装OpenClaw.bat', 'install.ps1', 'ZierClaw.vbs', 'ZierClaw-Launcher-Template.vbs', '安装前必看.txt', 'ZierClaw网站.url', '制作不易-打赏作者orz.docx'];
fs.rmSync(pkgDir, { recursive: true, force: true });
fs.mkdirSync(pkgDir, { recursive: true });
files.forEach(f => { if (fs.existsSync(w + f)) fs.copyFileSync(w + f, pkgDir + '/' + f); });
execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${pkgDir}\\*' -DestinationPath '${zipOut}' -Force"`, { timeout: 40000, stdio: 'pipe' });
fs.rmSync(pkgDir, { recursive: true, force: true });
console.log('v1.4 打包完成:', fs.statSync(zipOut).size + ' bytes');

const html = w + 'adopt.html';
let h = fs.readFileSync(html, 'utf8');
const before = h;
h = h.replace(/ZierClaw一键安装-v1\.3\.zip/g, 'ZierClaw一键安装-v1.4.zip');
fs.writeFileSync(html, h, 'utf8');
console.log('adopt.html v1.3->v1.4:', before !== h ? '已更新' : '未变化');
