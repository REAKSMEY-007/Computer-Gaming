const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9355;
function launch(){return new Promise((resolve,reject)=>{const proc=spawn(CHROME,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--hide-scrollbars','--remote-debugging-port='+PORT,'--user-data-dir='+path.join(__dirname,'.cdpT-'+Date.now()),'about:blank'],{stdio:'ignore'});let t=0;const poll=()=>http.get('http://127.0.0.1:'+PORT+'/json/version',(res)=>{res.resume();res.on('end',()=>resolve(proc));}).on('error',()=>{t++;if(t>50)return reject(new Error('up'));setTimeout(poll,300);});poll();});}
function jreq(url){return new Promise((resolve,reject)=>{http.get(url,(res)=>{let d='';res.on('data',(c)=>d+=c);res.on('end',()=>{try{resolve(JSON.parse(d));}catch(e){reject(e);}});}).on('error',reject);});}
let msgId=0;
class B{constructor(ws){this.ws=ws;this.p=new Map();ws.on('message',(raw)=>{const m=JSON.parse(raw.toString());if(m.id&&this.p.has(m.id)){this.p.get(m.id)(m.result||m);this.p.delete(m.id);}});}
send(method,params={}){return new Promise((resolve)=>{const id=++msgId;this.p.set(id,resolve);this.ws.send(JSON.stringify({id,method,params}));});}}
const sl=(ms)=>new Promise(r=>setTimeout(r,ms));
const val=(r)=>{if(r&&r.result&&r.result.value!==undefined&&r.result.value!==null)return typeof r.result.value==='string'?r.result.value:JSON.stringify(r.result.value);return 'NO-VALUE:'+JSON.stringify(r).slice(0,300);};
(async()=>{
  const proc=await launch();
  try{
    const list=await jreq('http://127.0.0.1:'+PORT+'/json/list');
    const ws=new WebSocket((list.find(x=>x.type==='page')||list[0]).webSocketDebuggerUrl);
    await new Promise((r,j)=>{ws.on('open',r);ws.on('error',j);});
    const c=new B(ws);
    await c.send('Runtime.enable');await c.send('Page.enable');
    await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await c.send('Page.navigate',{url:'http://localhost:4200/products/gaming'});
    await sl(8000);
    await c.send('Runtime.evaluate',{expression:'window.scrollTo(0,120)'});await sl(400);
    const pos=await c.send('Runtime.evaluate',{expression:`(()=>{const nv=[...document.querySelectorAll('li.nav-item')].find(li=>li.querySelector('.nv').textContent.includes('Gaming')).querySelector('.nv');const r=nv.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`,returnByValue:true});
    const p=JSON.parse(val(pos)); const x=+p.x, y=+p.y;
    await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
    await sl(450);
    const probe=await c.send('Runtime.evaluate',{expression:`(()=>{
      const desc=e=>{const c=e.className;return e.tagName+'.'+((typeof c==='string'&&c)?c.split(' ').slice(0,3).join('.'):'');};
      const pts=[[720,180],[720,220],[720,260],[720,290]];
      const res=pts.map(([px,py])=>{
        const top=document.elementFromPoint(px,py);
        return String(px+','+py)+'->'+desc(top)+'[z='+getComputedStyle(top).zIndex+']';
      });
      const dd=document.querySelector('.nav-drop'), panel=document.querySelector('.nav-panel');
      const dr=dd.getBoundingClientRect(), pr=panel.getBoundingClientRect();
      return JSON.stringify({rows:res, drop:'t'+Math.round(dr.top)+'-b'+Math.round(dr.bottom),
        panel:'t'+Math.round(pr.top)+'-b'+Math.round(pr.bottom),
        ddZ:getComputedStyle(dd).zIndex,
        ancestorChain:(()=>{let e=panel.getBoundingClientRect?panel:{},out=[];let n=panel;while(n){out.push(desc(n));n=n.parentElement;}return out.slice(0,6);})()});
    })()`,returnByValue:true});
    console.log(val(probe));
    ws.close();
  }finally{proc.kill();}
})().catch(e=>{console.log('ERR',e);process.exit(1);});
