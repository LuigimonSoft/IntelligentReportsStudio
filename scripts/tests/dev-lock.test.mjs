import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {acquireDevLock} from '../dev-lock.mjs';
test('development output has one writer and can restart after release',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'reportstudio-dev-lock-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const release=await acquireDevLock(directory);
 await assert.rejects(()=>acquireDevLock(directory),/already running/);
 await release();await release();const next=await acquireDevLock(directory);await next();
});
test('a stale process lock is recoverable',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'reportstudio-dev-lock-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 await writeFile(path.join(directory,'reportstudio-frontend-dev.lock'),'2147483647');
 const release=await acquireDevLock(directory);await release();
});
