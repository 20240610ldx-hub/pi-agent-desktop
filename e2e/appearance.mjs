import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';

const out='test-results/appearance';await mkdir(out,{recursive:true});
await build({entryPoints:['e2e/appearance.fixture.jsx'],bundle:true,platform:'browser',format:'iife',
  outfile:out+'/preview.js',define:{'process.env':'{"NODE_ENV":"production"}'},jsx:'automatic',logLevel:'warning'});
const js=await readFile(out+'/preview.js');
const css=(await Promise.all(['app/globals.css','app/settings.css','app/native-theme.css'].map(p=>readFile(p,'utf8'))))
  .map(s=>s.replace(/^@import[^;]*;/gm,'')).join('\n');
let stored=null,putDelay=0,activeWrites=0,maxWrites=0;
const serve=async(req,res)=>{
  if(req.url==='/api/appearance'){
    res.setHeader('Content-Type','application/json');
    if(req.method==='PUT'){
      activeWrites++;maxWrites=Math.max(maxWrites,activeWrites);
      let body='';for await(const chunk of req)body+=chunk;
      await delay(putDelay);stored=JSON.parse(body).background;activeWrites--;
    }
    res.end(JSON.stringify({background:stored}));return;
  }
  if(req.url.startsWith('/api/')){
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify(req.url.startsWith('/api/chat-settings')
      ?{model:null,thinkingLevel:null,instructions:'',allowedTools:[],confirmSave:false,instructionsMaxChars:8000}:{}));return;
  }
  res.setHeader('Content-Type',req.url==='/preview.js'?'text/javascript':req.url==='/style.css'?'text/css':'text/html; charset=utf-8');
  res.end(req.url==='/preview.js'?js:req.url==='/style.css'?css:
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}</style></head><body><div id="root"></div><script src="/preview.js"></script></body></html>');
};
const servers=[createServer(serve),createServer(serve)];
for(const server of servers)await new Promise(r=>server.listen(0,'127.0.0.1',r));
const urls=servers.map(s=>'http://127.0.0.1:'+s.address().port);
const browser=await chromium.launch();
const selected=(page,id)=>page.waitForFunction(value=>document.documentElement.dataset.background===value,id);
const saved=async()=>{for(let i=0;i<200;i++){if(activeWrites===0)return;await delay(20);}throw Error('Save did not finish');};
const names=['Petal','Mist','Meadow','Dusk','Plain','Sea Salt','Wisteria','Peach','Celadon','Warm Sand'];
const ids=['rex','mist','meadow','dusk','plain','sea','wisteria','peach','celadon','sand'];
const contrastResults=[];
try{
  // Saving a background must not move the following settings or scroll position.
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({viewport:{width:1280,height:820},colorScheme:theme,reducedMotion:'reduce'});
    await page.addInitScript(theme=>{localStorage.setItem('pi-theme',theme);localStorage.setItem('pi-locale','en');},theme);
    stored='rex'; putDelay=450;
    await page.goto(urls[0]); await page.locator('.settings-font-section').waitFor();
    await page.locator('.settings-dialog-surface').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished)));
    const measure=()=>page.locator('.settings-appearance').evaluate(el=>({
      fontTop:el.querySelector('.settings-font-section').getBoundingClientRect().top,
      gridTop:el.querySelector('.settings-background-grid').getBoundingClientRect().top,
      scrollTop:el.scrollTop,width:el.clientWidth,height:el.scrollHeight,
    }));
    for (const bottom of [false,true]) {
      await page.locator('.settings-appearance').evaluate((el,bottom)=>{el.scrollTop=bottom?el.scrollHeight:0;},bottom);
      const before=await measure();
      const response=page.waitForResponse(r=>r.url().endsWith('/api/appearance')&&r.request().method()==='PUT');
      response.catch(()=>{});
      await page.locator('input[name="background"][value="mist"]').evaluate(el=>el.click());
      await page.getByRole('status').waitFor();
      assert.deepEqual(await measure(),before,`background save must not shift layout (${theme}, bottom=${bottom})`);
      await response; await page.waitForFunction(()=>!document.querySelector('[role="status"]'));
      assert.deepEqual(await measure(),before,'saved state must retain geometry');
      await page.locator('input[name="background"][value="rex"]').evaluate(el=>el.click());
      await page.waitForFunction(()=>!document.querySelector('[role="status"]'));
    }
    await page.close();
  }
  putDelay=0;
  for(const theme of ['light','dark'])for(const width of [1464,1280,1024,800,640,390,320]){
    stored=null;const page=await browser.newPage({viewport:{width,height:820},colorScheme:theme,reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(theme=>{localStorage.setItem('pi-theme',theme);localStorage.setItem('pi-locale','en');},theme);
    await page.goto(urls[0]);await page.getByRole('radio',{name:'Petal',exact:true}).waitFor();
    const layout=await page.locator('.settings-background-grid').evaluate(grid=>{
      const box=grid.getBoundingClientRect();
      return {right:box.right,sectionRight:grid.parentElement.getBoundingClientRect().right,
        cards:[...grid.children].map(card=>{const rect=card.getBoundingClientRect();return {top:rect.top,right:rect.right};})};
    });
    if(width>=1024){
      assert.equal(layout.cards.length,10);
      assert.ok(layout.cards.slice(0,5).every(card=>Math.abs(card.top-layout.cards[0].top)<1),`Five backgrounds must fit per row at ${width}px`);
      assert.ok(layout.cards.slice(5).every(card=>Math.abs(card.top-layout.cards[5].top)<1),'The second row must also contain five backgrounds');
      assert.ok(layout.cards[5].top>layout.cards[0].top,'Desktop must use two balanced rows');
      assert.ok(Math.abs(layout.right-layout.sectionRight)<1,'Background choices must use the available section width');
      assert.ok(Math.abs(layout.cards.at(-1).right-layout.right)<1,'No empty grid column may reserve room after the last background');
    }
    if(width<=640)assert.ok(layout.cards[2].top>layout.cards[0].top,'Narrow windows must wrap background cards');
    const gradients=[];
    for(let i=0;i<ids.length;i++){
      const response=i>0?page.waitForResponse(r=>r.url().endsWith('/api/appearance')&&r.request().method()==='PUT'):null;
      await page.getByRole('radio',{name:names[i],exact:true}).locator('..').click();await selected(page,ids[i]);
      if(response)await response;
      assert.equal(await page.locator('input[name="background"]:checked').count(),1);
      gradients.push(await page.locator('.settings-dialog-surface').evaluate(el=>getComputedStyle(el).backgroundImage));
      if(width===1280 && i>=5){
        const contrast=await page.locator('.settings-dialog-surface').evaluate((el,dark)=>{
          const style=getComputedStyle(el);
          const prefix=dark?'--wash-dark':'--wash-light';
          const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
          const context=canvas.getContext('2d',{willReadFrequently:true});
          const rgba=value=>{
            context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);
            return [...context.getImageData(0,0,1,1).data];
          };
          const luminance=rgb=>rgb.slice(0,3).map(value=>{
            const s=value/255;return s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4;
          }).reduce((sum,value,index)=>sum+value*[0.2126,0.7152,0.0722][index],0);
          const glow=rgba(style.getPropertyValue(prefix+'-glow').trim());
          const backgrounds=style.getPropertyValue(prefix+'-stops').split(',').flatMap(stop=>{
            const base=rgba(stop.trim());
            return [base,base.map((value,index)=>index<3?value*(1-glow[3]/255)+glow[index]*glow[3]/255:value)];
          });
          return Object.fromEntries(['--text','--text-muted'].map(token=>{
            const foreground=luminance(rgba(style.getPropertyValue(token).trim()));
            return [token,Math.min(...backgrounds.map(background=>{
              const back=luminance(background);return (Math.max(foreground,back)+0.05)/(Math.min(foreground,back)+0.05);
            }))];
          }));
        },theme==='dark');
        for(const [token,ratio] of Object.entries(contrast))assert.ok(ratio>=4.5,`${ids[i]} ${theme} ${token}: ${ratio.toFixed(2)}:1`);
        contrastResults.push({background:ids[i],theme,minimumContrast:contrast});
        assert.equal(await page.locator(`[data-background-preview="${ids[i]}"]`).evaluate(el=>getComputedStyle(el).backgroundImage),gradients.at(-1),'Card preview and actual canvas must match');
      }
    }
    assert.equal(new Set(gradients).size,10,'All ten backgrounds must be visually distinct');
    await page.reload();await selected(page,'sand');assert.equal(await page.getByRole('radio',{name:'Warm Sand',exact:true}).isChecked(),true);
    await page.getByRole('radio',{name:'Warm Sand',exact:true}).focus();await page.keyboard.press('ArrowLeft');await selected(page,'celadon');
    await page.getByRole('radio',{name:theme==='light'?'Dark':'Light',exact:true}).locator('..').click();
    await page.waitForFunction(t=>document.documentElement.dataset.theme===t,theme==='light'?'dark':'light');
    assert.equal(await page.locator('html').getAttribute('data-background'),'celadon','Mode changes must preserve background');
    await page.getByRole('radio',{name:theme==='light'?'Light':'Dark',exact:true}).locator('..').click();
    await page.screenshot({path:`${out}/${theme}-${width}.png`});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await page.locator('.settings-theme-options').evaluate(el=>el.scrollWidth<=el.clientWidth),true,'Mode labels must fit without clipping');
    assert.deepEqual(errors,[]);await page.close();
  }
  // The server setting restores the choice even when localStorage is on a new origin.
  const page=await browser.newPage({viewport:{width:1280,height:820}});
  await page.addInitScript(()=>localStorage.setItem('pi-locale','en'));
  putDelay=120;await page.goto(urls[0]);await page.getByRole('radio',{name:'Sea Salt',exact:true}).locator('..').click();
  await page.getByRole('radio',{name:'Wisteria',exact:true}).locator('..').click();await page.getByRole('radio',{name:'Peach',exact:true}).locator('..').click();
  await page.getByRole('radio',{name:'Warm Sand',exact:true}).locator('..').click();await selected(page,'sand');
  await page.waitForFunction(()=>!document.querySelector('[role="status"]'));await saved();
  assert.equal(stored,'sand');assert.equal(maxWrites,1,'Saves must be serialized');
  await page.goto(urls[1]);await selected(page,'sand');assert.equal(await page.getByRole('radio',{name:'Warm Sand',exact:true}).isChecked(),true);
  // A delayed old read cannot undo a newer user selection.
  let release,markBlocked;const held=new Promise(r=>{release=r;});const blocked=new Promise(r=>{markBlocked=r;});
  await page.route('**/api/appearance',async route=>{
    if(route.request().method()==='GET'){markBlocked();await held;await route.fulfill({json:{background:'mist'}});}
    else await route.continue();
  });
  await page.reload();await page.waitForFunction(()=>document.querySelector('input[value="plain"]'));
  await blocked;await page.getByRole('radio',{name:'Plain',exact:true}).locator('..').click();release();
  await page.waitForFunction(()=>!document.querySelector('[role="status"]'));await selected(page,'plain');
  await page.unroute('**/api/appearance');
  await page.route('**/api/appearance',route=>route.fulfill({status:500,json:{error:'test failure'}}));
  await page.getByRole('radio',{name:'Mist',exact:true}).locator('..').click();await page.getByRole('alert').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-background'),'mist','Failed saves keep the local preview');
  await page.close();
  await writeFile(out+'/results.json',JSON.stringify({backgrounds:ids,themes:['light','dark'],widths:[1464,1280,1024,800,640,390,320],contrastResults,maxWrites,persistence:true,staleRead:true,saveFailure:true},null,2));
  console.log('PASS: ten backgrounds, light/dark, balanced desktop rows, narrow wrapping, preview matching, contrast, keyboard, reload/new-origin persistence, ordered saves, stale reads and save errors');
}finally{await browser.close();for(const server of servers)await new Promise(r=>server.close(r));}
