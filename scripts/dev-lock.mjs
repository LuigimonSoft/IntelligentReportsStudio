import {mkdir,open,readFile,unlink} from 'node:fs/promises';
import path from 'node:path';

/** Trunk staging output must have a single writer per project. */
export async function acquireDevLock(directory){
 await mkdir(directory,{recursive:true});
 const filename=path.join(directory,'reportstudio-frontend-dev.lock');
 for(let attempt=0;attempt<3;attempt++){
  try{
   const file=await open(filename,'wx');
   await file.writeFile(String(process.pid));await file.close();
   let owned=true;
   return async()=>{if(owned){owned=false;await unlink(filename).catch(error=>{if(error.code!=='ENOENT')throw error;});}};
  }catch(error){
   if(error.code!=='EEXIST')throw error;
   let pid;
   try{pid=Number(await readFile(filename,'utf8'));}catch(error){if(error.code==='ENOENT')continue;throw error;}
   if(!Number.isSafeInteger(pid)||pid<=0)throw new Error(`Development lock is incomplete: ${filename}. Retry after the other startup finishes.`);
   let alive=true;
   try{process.kill(pid,0);}catch(error){if(error.code==='ESRCH')alive=false;else throw error;}
   if(alive)throw new Error(`Report Studio development server is already running (PID ${pid}). Stop that cargo tauri dev execution before starting another.`);
   await unlink(filename).catch(error=>{if(error.code!=='ENOENT')throw error;});
  }
 }
 throw new Error('Could not acquire the Report Studio development lock.');
}
