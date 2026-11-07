// Verify metadata events do not reload the UI, while real source edits still do.
import {spawn} from 'node:child_process';
import {writeFile, readFile, chmod, utimes, unlink, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url));
const probe=path.join(root,'public',`.watcher-probe-${process.pid}.txt`);
const output=path.join(root,'end2end/test-results/watcher-stability.log');
const port=Number(process.env.REPORTSTUDIO_WATCH_TEST_PORT || 1431);
const dist=path.join(os.tmpdir(),`reportstudio-watch-${process.pid}`);
const timestamp=new Date('2026-01-01T00:00:00Z');
await writeFile(probe,'before\n');await utimes(probe,timestamp,timestamp);
let log='',browser,child;
const waitFor=async(predicate,description,timeout=120000)=>{
 const deadline=Date.now()+timeout;
 while(!predicate()){if(Date.now()>deadline)throw new Error(`Timed out: ${description}`);await new Promise(resolve=>setTimeout(resolve,200));}
};
const builds=()=> (log.match(/Report Studio: starting build/g)||[]).length;
const successes=()=> (log.match(/Report Studio: build complete/g)||[]).length;
try {
 child=spawn(process.execPath,['scripts/frontend.mjs','serve','--port',String(port),'--dist',dist,'--log','trunk=debug'],{cwd:root,env:{...process.env,NO_COLOR:'true'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
 child.stdout.on('data',chunk=>{log+=chunk;});child.stderr.on('data',chunk=>{log+=chunk;});
 child.on('error',error=>{log+=error.message;});
 await waitFor(()=>successes()===1,'initial build');
 browser=await chromium.launch({executablePath:process.env.REPORTSTUDIO_CHROMIUM});
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${port}`);await page.waitForFunction(()=>window.reportstudioReady);
 await page.getByRole('button',{name:'Data',exact:true}).click();
 await page.evaluate(()=>{window.watcherSentinel='unchanged';});
 const baseline=builds();
 // Neither permission changes nor access-time changes modify file contents/mtime.
 for(let i=0;i<5;i++){
  await chmod(probe,i%2?0o600:0o644);await readFile(probe);await utimes(probe,new Date(),timestamp);
  await new Promise(resolve=>setTimeout(resolve,1100));
 }
 assert.equal(builds(),baseline,'Metadata-only changes triggered a build');
 assert.equal(await page.evaluate(()=>window.watcherSentinel),'unchanged','Metadata-only changes reloaded the page');
 assert.equal(await page.locator('.model-canvas').count(),1,'Data tab was lost');
 console.log('PASS: metadata changes preserve the Data tab without rebuilding.');
 await writeFile(probe,'actual edit\n');
 await waitFor(()=>successes()===2,'one rebuild after an actual edit');
 await waitFor(()=>builds()===2,'one build for the real edit');
 await page.waitForFunction(()=>window.reportstudioReady && !window.watcherSentinel);
 await new Promise(resolve=>setTimeout(resolve,5000));
 assert.equal(builds(),2,'Build output created another rebuild loop');
 console.log('PASS: a real edit triggers one reload, with no follow-up loop.');
} finally {
 await browser?.close();
 if(child?.pid){
  if(process.platform==='win32')spawn('taskkill',['/PID',String(child.pid),'/T','/F']);
  else {try{process.kill(-child.pid,'SIGINT');}catch(error){if(error.code!=='ESRCH')throw error;}}
 }
 await mkdir(path.dirname(output),{recursive:true});await writeFile(output,log);await unlink(probe).catch(()=>{});
}
