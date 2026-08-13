const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');
const url = 'https://lanzier.github.io/ZierClaw%E4%B8%80%E9%94%AE%E5%AE%89%E8%A3%85-v1.5.zip';
const tmp = 'C:/Users/Administrator/.openclaw/workspace/website/_ov15.zip';
https.get(url, r => {
  console.log('HTTP', r.statusCode, '| Last-Modified:', r.headers['last-modified'] || 'N/A');
  if (r.statusCode !== 200) { console.log('非200'); r.resume(); return; }
  const f = fs.createWriteStream(tmp);
  r.pipe(f);
  f.on('finish', () => f.close(() => check()));
}).on('error', e => console.log('ERR', e.message));
function check() {
  console.log('大小:', fs.statSync(tmp).size);
  const dir = 'C:/Users/Administrator/.openclaw/workspace/website/_ov15u';
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir);
  execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${tmp}' -DestinationPath '${dir}' -Force"`, { timeout: 30000, stdio: 'pipe' });
  const ps = fs.readFileSync(dir + '/install.ps1', 'utf8');
  console.log('=== 在线 v1.5 install.ps1 ===');
  console.log('含Node24预装(Test-ZClawNodeCompliant):', ps.includes('Test-ZClawNodeCompliant'));
  console.log('含ZierClaw-node24:', ps.includes('ZierClaw-node24'));
  console.log('含latest-v24.x:', ps.includes('latest-v24.x'));
  console.log('含portable-node探测:', ps.includes('portable-node'));
  console.log('BOM:', fs.readFileSync(dir + '/install.ps1')[0] === 0xEF ? 'OK' : '无');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(tmp, { force: true });
}
