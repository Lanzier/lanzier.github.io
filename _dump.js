const fs = require('fs');
const t = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/website/index.html', 'utf8');
const i = t.indexOf('💡 接下来');
// 从 h2 开始读到 section 结束
const seg = t.slice(i - 50, i + 1500);
console.log(seg);
console.log('\n=== 总长度:', t.length, ' ===');
