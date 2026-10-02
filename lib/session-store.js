// One active workspace per app process. No project files or past-project list.
const clone=x=>JSON.parse(JSON.stringify(x));
class SessionStore{
 constructor(){this.session=null;}
 list(){return [];}
 current(id){const s=this.session;if(!s||s.id!==id)throw Error('Start a new script or import your Markdown file.');const p=clone(s.revisions[s.cursor].snapshot);return {...p,version:s.cursor+1,canUndo:s.cursor>0,canRedo:s.cursor<s.revisions.length-1,history:s.revisions.map((r,i)=>({version:i+1,note:r.note,at:r.at,state:r.snapshot.state})),archive:[]};}
 save(p,note,version){if(version!==undefined&&this.current(p.id).version!==version)throw Error('Script changed. Reopen the workspace first.');if(!this.session||this.session.id!==p.id)this.session={id:p.id,revisions:[],cursor:-1};const s=this.session,snapshot=clone(p);for(const key of ['version','canUndo','canRedo','history','archive'])delete snapshot[key];s.revisions=s.revisions.slice(0,s.cursor+1);s.revisions.push({snapshot,note,at:new Date().toISOString()});s.cursor++;return this.current(p.id);}
 move(id,step,version){if(this.current(id).version!==version)throw Error('Script changed.');const target=this.session.cursor+step;if(target<0||target>=this.session.revisions.length)throw Error('No revision in that direction.');this.session.cursor=target;return this.current(id);}
}
module.exports={SessionStore};
