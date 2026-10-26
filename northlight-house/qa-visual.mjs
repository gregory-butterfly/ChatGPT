import {chromium} from 'playwright';
import fs from 'node:fs/promises';

const folder='northlight-house/qa/'+(process.env.GITHUB_SHA||'local').slice(0,12);
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
  if(details.interactions<100)throw Error('Expected many working furniture/lighting interactions: '+details.interactions);
  const featureQA=await page.evaluate(()=>{
    const qa=window.northlightQA;
    const count=qa.interactionsByType;
    if((count.switch||0)<24)throw Error('Light switches missing: '+(count.switch||0));
    if((count.cupboard||0)<40)throw Error('Interactive furniture missing: '+(count.cupboard||0));
    if((count.drawer||0)<12)throw Error('Pull-out kitchen drawers missing: '+(count.drawer||0));
    if((count.record||0)!==1)throw Error('Loft turntable missing');
    const lightsBefore=qa.lightSwitchesOn;
    const turnedOff=qa.testInteraction('switch');
    if(qa.lightSwitchesOn!==lightsBefore-1||turnedOff.on!==false)throw Error('Light switch did not turn off');
    const turnedOn=qa.testInteraction('switch');
    if(qa.lightSwitchesOn!==lightsBefore||turnedOn.on!==true)throw Error('Light did not turn back on');
    const drawerOpen=qa.testInteraction('drawer');
    if(drawerOpen.open!==true)throw Error('Drawer failed to open');
    qa.testInteraction('drawer');
    const cupboardOpen=qa.testInteraction('cupboard');
    if(cupboardOpen.open!==true)throw Error('Cabinet door failed to open');
    qa.testInteraction('cupboard');
    const music=qa.testInteraction('record');
    if(music.playing!==true)throw Error('Record failed to play');
    qa.testInteraction('record');
    return {counts:count,switches:lightsBefore};
  });
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
  // Verify different apartment styling and furnishings inside the real FPS camera.
  for(let index=0;index<6;index++){
    const location=await page.evaluate(i=>window.northlightQA.gotoHome(i,'living'),index);
    if(Math.abs(location.position.y-(Math.floor(index/2)+1)*3.35)>.04)
      throw Error('Floor mismatch in '+location.name+': '+location.position.y);
    await page.waitForTimeout(380);
    const focus=await page.evaluate(()=>window.northlightQA.focusedInteraction);
    if(index!==3 && focus && /record/i.test(focus))
      throw Error('False record-player prompt in '+location.name);
    const name='home-'+String(index+1).padStart(2,'0')+'-'+location.name.toLowerCase().replaceAll(' ','-');
    await page.screenshot({path:folder+'/'+name+'.png',timeout:30000});
    captures.push(name);
  }
  // Inspect the accent wall and distinctive bespoke decor in each home.
  for(let index=0;index<6;index++){
    await page.evaluate(i=>window.northlightQA.gotoHome(i,'decor'),index);
    await page.waitForTimeout(350);
    await page.screenshot({path:folder+'/decor-'+String(index+1).padStart(2,'0')+'.png',timeout:30000});
    captures.push('decor-'+String(index+1).padStart(2,'0'));
  }
  for(const [room,index] of [['bedroom',0],['kitchen',3],['bathroom',5]]){
    await page.evaluate(v=>window.northlightQA.gotoHome(v.index,v.room),{room,index});
    await page.waitForTimeout(380);
    await page.screenshot({path:folder+'/detail-'+room+'.png',timeout:30000});
    captures.push('detail-'+room);
  }
  await fs.writeFile(folder+'/results.json',JSON.stringify({ok:errors.length===0,details,featureQA,walking,captures,errors,sourceCommit:process.env.GITHUB_SHA},null,2));
  if(errors.length)throw Error('Browser runtime errors: '+errors.slice(0,6).join('; '));
  console.log('NORTHLIGHT QA PASS '+JSON.stringify({details,featureQA,walking,captures}));
}catch(e){
  await fs.writeFile(folder+'/results.json',JSON.stringify({ok:false,errors,captures,error:String(e),sourceCommit:process.env.GITHUB_SHA},null,2));
  console.error('NORTHLIGHT QA FAILED '+String(e));
  process.exitCode=1;
}finally{await browser.close()}
