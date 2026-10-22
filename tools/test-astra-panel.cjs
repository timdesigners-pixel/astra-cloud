// Optional browser verification: requires Playwright + Chromium. Backend transport is mocked.
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const compile=p=>ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../',p),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();
  await page.setContent('<meta charset="utf-8"><main></main>');
  await page.evaluate(({dom,panel})=>{
   const domExports={};new Function('exports',dom)(domExports);
   window.calls=[];window.rpcError=true;window.conflicts=0;
   const exports={};const require=name=>{
    if(name.endsWith('/dom'))return domExports;
    if(name.endsWith('/istemci'))return{istemciAl:()=>({rpc:async(name,args)=>{calls.push({name,args});return rpcError?{error:{code:'PGRST202'}}:{data:{yeni:1,atlanacak:0,cakisma:conflicts,toplam:1,onizleme:args.p_onizleme}};}})};
    if(name.endsWith('/hata'))return{hataMetni:e=>e.message};
    if(name.endsWith('/panel'))return{panelSifirla:()=>{window.reset=true}};
    throw Error(name);
   };
   new Function('require','exports',panel)(require,exports);
   document.querySelector('main').append(exports.aktarimPaneli());
  },{dom:compile('apps/web/src/ortak/dom.ts'),panel:compile('apps/web/src/ozellikler/sistem/astra-aktarim.ts')});
  const apply=page.getByRole('button',{name:'Paketi canlı kayıtlara aktar',exact:true});
  const preview=page.getByRole('button',{name:'Sunucuda önizle',exact:true});
  assert(await apply.isDisabled());
  const packet={format:'astra-os-transfer',version:1,records:[],library:[]};
  await page.getByLabel('Astra OS aktarım paketi').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(packet))});
  await preview.click();await page.getByRole('status').filter({hasText:'0028'}).waitFor();assert(await apply.isDisabled());
  await page.evaluate(()=>{rpcError=false;conflicts=1});await preview.click();await page.getByRole('status').filter({hasText:'1 çakışma'}).waitFor();assert(await apply.isDisabled());
  await page.evaluate(()=>{conflicts=0});await preview.click();await page.waitForFunction(()=>!document.querySelector('button.btn.primary').disabled);
  assert((await page.evaluate(()=>calls)).every(c=>c.args.p_onizleme));
  await apply.click();await page.getByRole('status').filter({hasText:'Aktarım tamamlandı'}).waitFor();
  assert.equal((await page.evaluate(()=>calls.at(-1))).args.p_onizleme,false);assert(await page.evaluate(()=>window.reset));
  console.log('PASS: actual TypeScript import panel in Chromium, migration error, conflict lock, preview-only and explicit apply. RPC transport mocked.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
