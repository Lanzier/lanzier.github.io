const fs = require('fs');
const { execSync } = require('child_process');
const w = 'C:/Users/Administrator/.openclaw/workspace/website/';

const b = fs.readFileSync(w + 'install.ps1');
console.log('BOM:', b[0] === 0xEF ? 'OK' : '无');
const t = b.toString('utf8');
console.log('判达标加PATH(added to PATH):', t.includes('added') && t.includes('to PATH'));
console.log('含SQLite判据:', t.includes('Get-ZClawSqliteVersion'));

const zipOut = w + 'ZierClaw一键安装-v1.7.zip';
const pkgDir = w + '_pkg_v17';
const files = ['安装OpenClaw.bat', 'install.ps1', 'ZierClaw.vbs', 'ZierClaw-Launcher-Template.vbs', '安装前必看.txt', 'ZierClaw网站.url', '制作不易-打赏作者orz.docx'];
fs.rmSync(pkgDir, { recursive: true, force: true });
fs.mkdirSync(pkgDir, { recursive: true });
files.forEach(f => { if (fs.existsSync(w + f)) fs.copyFileSync(w + f, pkgDir + '/' + f); });
execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${pkgDir}\\*' -DestinationPath '${zipOut}' -Force"`, { timeout: 40000, stdio: 'pipe' });
fs.rmSync(pkgDir, { recursive: true, force: true });
console.log('v1.7 打包完成:', fs.statSync(zipOut).size + ' bytes');

const html = w + 'adopt.html';
let h = fs.readFileSync(html, 'utf8');
const before = h;
h = h.replace(/ZierClaw一键安装-v1\.6\.zip/g, 'ZierClaw一键安装-v1.7.zip');
fs.writeFileSync(html, h, 'utf8');
console.log('adopt.html v1.6->v1.7:', before !== h ? '已更新' : '未变化');
