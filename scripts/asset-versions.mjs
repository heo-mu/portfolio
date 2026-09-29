// Cache-busting versions are content hashes, generated in one place. Every
// page and module that loads a file therefore references the same `?v=`.
// Only references that already carry `?v=` and are reachable from a page are
// managed, so vendor files and unlinked experiments stay untouched.
// node scripts/asset-versions.mjs          reports files that are out of sync
// node scripts/asset-versions.mjs --write  rewrites them
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pages=fs.readdirSync(root).filter(f=>f.endsWith('.html')).sort();
// href/src attributes in pages; static and dynamic specifiers in modules.
const pageRef=/((?:href|src)=")([^"?#]+\.(?:css|js))\?v=([^"&#]*)(")/g;
const moduleRef=/((['"]))(\.{1,2}\/[^'"?#]+\.(?:css|js))\?v=([^'"&#]*)\2/g;
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const versions=new Map(),rewritten=new Map(),visiting=new Set();
function version(file){
 if(versions.has(file))return versions.get(file);
 if(visiting.has(file))throw Error('Circular asset reference: '+file);
 if(!fs.existsSync(path.join(root,file)))throw Error('Missing asset: '+file);
 visiting.add(file);
 let text=read(file);
 if(file.endsWith('.js'))text=text.replace(moduleRef,(all,quote,_,spec)=>{
  const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),spec));
  return quote+spec+'?v='+version(target)+quote;
 });
 rewritten.set(file,text);visiting.delete(file);
 // Line endings are normalised so a CRLF checkout keeps the same versions.
 const hash=crypto.createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex').slice(0,8);
 versions.set(file,hash);return hash;
}
for(const page of pages)rewritten.set(page,read(page).replace(pageRef,(all,open,src,_,close)=>open+src+'?v='+version(path.posix.normalize(src))+close));
const stale=[...rewritten].filter(([file,text])=>text!==read(file)).map(([file])=>file);
if(process.argv.includes('--write')){
 for(const file of stale)fs.writeFileSync(path.join(root,file),rewritten.get(file));
 console.log(`${versions.size} versioned assets; ${stale.length} file(s) updated${stale.length?': '+stale.join(', '):''}.`);
}else{
 console.log(`${versions.size} versioned assets; ${stale.length} file(s) out of sync${stale.length?': '+stale.join(', '):''}.`);
 if(stale.length)process.exitCode=1;
}
