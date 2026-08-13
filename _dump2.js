const fs = require('fs');
const t = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/website/index.html', 'utf8');
const i = t.indexOf('💡 接下来');
// 找到这段 section 的闭合 </section>
const seg = t.slice(i - 50);   // 到文件末尾
const secEnd = seg.indexOf('</section>');
console.log('section 闭合位置(相对):', secEnd);
console.log(seg.slice(0, secEnd + 12));
