const fs = require('fs'); 
const ejsFiles = []; 
function walk(dir) { 
  if(!fs.existsSync(dir)) return; 
  fs.readdirSync(dir).forEach(file => { 
    const p = dir + '/' + file; 
    if (fs.statSync(p).isDirectory()) walk(p); 
    else if (p.endsWith('.ejs') || p.endsWith('.md')) ejsFiles.push(p); 
  }); 
} 
walk('src/characters'); 
walk('src/prompts'); 
walk('src/events'); 
const getvars = new Set(); 
const setvars = new Set(); 
ejsFiles.forEach(f => { 
  const content = fs.readFileSync(f, 'utf8'); 
  const gMatch = [...content.matchAll(/getvar\(['"]([^'"]+)['"]\)/g)]; 
  gMatch.forEach(m => getvars.add(m[1])); 
  const sMatch = [...content.matchAll(/setvar\(['"]([^'"]+)['"]/g)]; 
  sMatch.forEach(m => setvars.add(m[1])); 
}); 
console.log('GETVARS:'); 
console.log([...getvars].join('\n')); 
console.log('SETVARS:'); 
console.log([...setvars].join('\n'));
