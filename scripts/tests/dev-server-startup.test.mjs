import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import path from 'node:path';

test('the built frontend is served even while the content watcher baseline is blocked',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'reportstudio-startup-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(path.join(root,'bin'));await mkdir(path.join(root,'target/csr'),{recursive:true});
 await writeFile(path.join(root,'target/csr/index.html'),'<body>Ready</body>');
 await writeFile(path.join(root,'bin/trunk'),'#!/bin/sh\nexit 0\n',{mode:0o755});
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const script=fileURLToPath(new URL('../dev-server.mjs',import.meta.url));
 const snapshot=fileURLToPath(new URL('../source-snapshot.mjs',import.meta.url));
 const code=`import {serveFrontend} from ${JSON.stringify('file://'+script)};import {SourceSnapshot} from ${JSON.stringify('file://'+snapshot)};SourceSnapshot.prototype.fingerprint=()=>new Promise(()=>{});await serveFrontend(${JSON.stringify(root)},process.env,[],{serve:true});`;
 const child=spawn(process.execPath,['--input-type=module','-e',code],{env:{...process.env,PATH:path.join(root,'bin')+path.delimiter+process.env.PATH,TRUNK_SERVE_PORT:String(port),CARGO_TARGET_DIR:path.join(root,'cache')},stdio:'ignore'});
 t.after(async()=>{if(child.exitCode===null){child.kill('SIGTERM');await once(child,'exit');}});
 let html='';for(let attempt=0;attempt<100;attempt++){
  try{html=await (await fetch(`http://127.0.0.1:${port}/`)).text();break;}catch{await new Promise(resolve=>setTimeout(resolve,50));}
 }
 assert.match(html,/Ready/);
});
