import {chromium} from 'playwright';
import fs from 'node:fs/promises';

const folder='northlight-house/qa';
await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch({
  headless:true,
  channel:'chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader','--disable-dev-shm-usage']
});
const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
const errors=[];
const captures=[];
page.on('pageerror',err=>errors.push(String(err)));
page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
page.on('requestfailed',req=>errors.push('Request failed: '+req.url()+' '+req.failure()?.errorText));
try {
  await page.goto('http://127.0.0.1:8765/northlight-house/?qa=1',{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.northlightQA?.ready===true,{timeout:60000});
  await page.waitForTimeout(1800);
  const details=await page.evaluate(()=>({
    meshObjects:window.northlightQA.sceneObjects,
    interactions:window.northlightQA.interactions,
    homes:window.northlightQA.homes
  }));
  if(details.meshObjects<500)throw Error('Unexpectedly few 3D objects: '+details.meshObjects);
  if(details.interactions<10)throw Error('Door interactions missing');
  await page.screenshot({path:folder+'/01-exterior.png',timeout:30000});
  captures.push('exterior');
  await page.evaluate(()=>window.northlightQA.selectFloor(1));
  await page.waitForTimeout(1400);
  await page.screenshot({path:folder+'/02-first-floor-cutaway.png',timeout:30000});
  captures.push('first-floor cutaway');
  await page.evaluate(()=>window.northlightQA.selectFloor(2));
  await page.waitForTimeout(1300);
  await page.screenshot({path:folder+'/03-second-floor-cutaway.png',timeout:30000});
  captures.push('second-floor cutaway');
  await page.evaluate(()=>window.northlightQA.selectFloor(4));
  await page.waitForTimeout(1400);
  await page.screenshot({path:folder+'/04-roof-garden.png',timeout:30000});
  captures.push('roof');
  await page.evaluate(()=>window.northlightQA.selectFloor(2));
  await page.evaluate(()=>window.northlightQA.enterWalk());
  await page.waitForTimeout(1300);
  const walking=await page.evaluate(()=>window.northlightQA.player);
  if(Math.abs(walking.y-6.7)>0.6)throw Error('Player feet failed to stay on upper floor: '+walking.y);
  await page.screenshot({path:folder+'/05-walk-level2.png',timeout:30000});
  captures.push('walk');
  await fs.writeFile(folder+'/results.json',JSON.stringify({ok:errors.length===0,details,walking,captures,errors,sourceCommit:process.env.GITHUB_SHA},null,2));
  if(errors.length)throw Error('Browser runtime errors: '+errors.slice(0,6).join('; '));
  console.log('NORTHLIGHT QA PASS '+JSON.stringify({details,walking,captures}));
}catch(e){
  await fs.writeFile(folder+'/results.json',JSON.stringify({ok:false,errors,captures,error:String(e),sourceCommit:process.env.GITHUB_SHA},null,2));
  console.error('NORTHLIGHT QA FAILED '+String(e));
  process.exitCode=1;
}finally{await browser.close()}
