import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,chmod,utimes,rm,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {SourceSnapshot} from '../source-snapshot.mjs';

async function fixture(t){
 const root=await mkdtemp(path.join(os.tmpdir(),'reportstudio-snapshot-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(path.join(root,'source'));const file=path.join(root,'source','main.rs');
 await writeFile(file,'first');const timestamp=new Date('2026-01-01T00:00:00Z');await utimes(file,timestamp,timestamp);
 return {root,file,timestamp,snapshot:new SourceSnapshot(root,['source'])};
}
test('metadata, directory timestamps and identical rewrites do not count as source edits',async t=>{
 const {root,file,timestamp,snapshot}=await fixture(t);const initial=await snapshot.fingerprint();
 await chmod(file,0o600);await utimes(file,new Date(),timestamp);await utimes(path.join(root,'source'),new Date(),new Date());
 assert.equal(await snapshot.fingerprint(),initial);
 await writeFile(file,'first');assert.equal(await snapshot.fingerprint(),initial);
});
test('changed bytes are detected even with preserved modification time',async t=>{
 const {file,timestamp,snapshot}=await fixture(t);const initial=await snapshot.fingerprint();
 await writeFile(file,'other');await utimes(file,timestamp,timestamp);
 assert.notEqual(await snapshot.fingerprint(),initial);
});
test('adding and removing source files changes the snapshot',async t=>{
 const {root,snapshot}=await fixture(t);const initial=await snapshot.fingerprint();const extra=path.join(root,'source','new.rs');
 await writeFile(extra,'new source');assert.notEqual(await snapshot.fingerprint(),initial);
 await rm(extra);assert.equal(await snapshot.fingerprint(),initial);
});
