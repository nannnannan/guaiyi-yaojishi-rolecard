const html = require('fs').readFileSync('src/ui/status.html', 'utf8');
const bridgeMatch = html.match(/const BRIDGE_PAIRS = \[([\s\S]*?)\];/);
if(bridgeMatch){
  const str = bridgeMatch[0];
  console.log(str.substring(str.indexOf("from: 'E62'"), str.indexOf("from: 'E66'")));
}
