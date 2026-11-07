import {createHash} from 'node:crypto';
import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';

export const frontendInputs=['app/src','frontend/src','public','index.html','Cargo.toml','app/Cargo.toml','frontend/Cargo.toml','Trunk.toml'];

/** Directory/access-time notifications are hints, not edits. Compare file bytes. */
export class SourceSnapshot {
  constructor(root,inputs=frontendInputs){this.root=root;this.inputs=inputs;this.cache=new Map();}
  async fingerprint(){
    const files=[];
    const visit=async filename=>{
      let info;
      try{info=await stat(filename);}catch(error){if(error.code==='ENOENT')return;throw error;}
      if(info.isDirectory()){
        for(const entry of await readdir(filename,{withFileTypes:true})){
          if(entry.name==='.DS_Store'||entry.isSymbolicLink())continue;
          await visit(path.join(filename,entry.name));
        }
      }else if(info.isFile())files.push([filename,info]);
    };
    for(const input of this.inputs)await visit(path.join(this.root,input));
    files.sort(([a],[b])=>a.localeCompare(b));
    const result=createHash('sha256');const live=new Set();
    for(const [filename,info] of files){
      live.add(filename);
      const stamp=`${info.ino}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`;
      let cached=this.cache.get(filename);
      if(!cached||cached.stamp!==stamp){
        cached={stamp,hash:createHash('sha256').update(await readFile(filename)).digest('hex')};
        this.cache.set(filename,cached);
      }
      result.update(path.relative(this.root,filename)).update('\0').update(cached.hash).update('\0');
    }
    for(const filename of this.cache.keys())if(!live.has(filename))this.cache.delete(filename);
    return result.digest('hex');
  }
}
