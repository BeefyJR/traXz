/* Run before every deploy:  node stamp-sw.js
   Hashes the app shell and writes the hash into sw.js as VERSION. A changed hash makes browsers install the new worker,
   which then offers the update in Settings > Backup. No change in the files = same hash = no update. */
const fs=require('fs'),crypto=require('crypto');
const files=['index.html','manifest.webmanifest','icon-192.png','icon-512.png'].filter(f=>fs.existsSync(f));
const h=crypto.createHash('sha1');
for(const f of files)h.update(f).update(fs.readFileSync(f));
const v=h.digest('hex').slice(0,8);
const sw=fs.readFileSync('sw.js','utf8');
const out=sw.replace(/const VERSION='[^']*'/,"const VERSION='"+v+"'");
if(out===sw&&!sw.includes("const VERSION='"+v+"'")){console.error("Could not find the VERSION line in sw.js");process.exit(1)}
if(out!==sw)fs.writeFileSync('sw.js',out);
console.log('sw.js VERSION = '+v+(out===sw?' (unchanged)':'')+'  [hashed: '+files.join(', ')+']');
