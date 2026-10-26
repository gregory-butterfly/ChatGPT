
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createBuilding,H,homes} from './world.js';

const $=id=>document.getElementById(id);
const viewport=$('viewport');
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.18;
renderer.shadowMap.enabled=!new URLSearchParams(location.search).has('qa');
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);

const scene=new THREE.Scene();
scene.background=new THREE.Color(0xa8c4c7);
scene.fog=new THREE.Fog(0xb7cdcb,85,210);
const camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.08,270);
camera.position.set(36,23,39);
const orbit=new OrbitControls(camera,renderer.domElement);
orbit.target.set(0,7,0);
orbit.enableDamping=true;orbit.dampingFactor=.055;
orbit.maxPolarAngle=Math.PI/2.08;
orbit.minDistance=8;orbit.maxDistance=100;
orbit.enablePan=true;orbit.panSpeed=.6;orbit.zoomSpeed=.9;
orbit.update();

const ambient=new THREE.HemisphereLight(0xe4f6fa,0x78816b,1.4);
scene.add(ambient);
const sun=new THREE.DirectionalLight(0xffedcd,2.35);
sun.position.set(-22,39,25);sun.castShadow=true;
sun.shadow.mapSize.set(1536,1536);
sun.shadow.camera.left=-34;sun.shadow.camera.right=34;
sun.shadow.camera.top=32;sun.shadow.camera.bottom=-32;
sun.shadow.camera.far=120;sun.shadow.bias=-.0006;sun.shadow.normalBias=.025;
scene.add(sun);
const moon=new THREE.DirectionalLight(0xb6d5ed,0);
moon.position.set(18,22,-12);scene.add(moon);
const world=createBuilding(scene);
const state={floor:0,cutaway:false,mode:'orbit',night:false,hit:null,previousCutaway:false};
const player={x:0,y:0,z:4.8,yaw:0,pitch:0,eye:1.66};
const euler=new THREE.Euler(0,0,0,'YXZ');
const ray=new THREE.Raycaster();
const center=new THREE.Vector2(0,0);
const down=new Set();
const tmpV=new THREE.Vector3();
const tmpBox=new THREE.Box3();
let targetView=null;
let fpsLocked=false;
let touchLook=null;
const coarsePointer=matchMedia('(pointer:coarse)').matches;
let last=performance.now();
let frame=0;
let lastProbe=0;
const collisions=world.col.map(mesh=>({
 mesh,box:new THREE.Box3().setFromObject(mesh),
 dynamic:mesh.userData.role==='door'
}));

function sourceVisible(o){
 let q=o;
 while(q){if(q.visible===false) return false;q=q.parent;}
 return true;
}
function applyLayers(){
 world.levels.forEach((lv,i)=>{
  // In cutaway, remove upper floors so the selected interior is genuinely visible.
  lv.group.visible=!state.cutaway || state.floor===4 || i<=state.floor;
  lv.front.visible=!state.cutaway;
  if(lv.ceiling)lv.ceiling.visible=!state.cutaway && state.mode!=='walk';
 });
 $('cutaway').classList.toggle('active',state.cutaway);
 $('cutaway').setAttribute('aria-pressed',String(state.cutaway));
 document.querySelectorAll('.floor-btn').forEach(btn=>{
   const active=+btn.dataset.floor===state.floor;
   btn.classList.toggle('active',active);
   btn.setAttribute('aria-pressed',String(active));
 });
}
function setText(){
 const info=[
  ['PUBLIC SPACES','A welcoming place to arrive','Reception, resident lounge, planted courtyard and lift.'],
  ['FIRST FLOOR','Two thoughtfully furnished homes',homes[0].name+' · '+homes[1].name+' — individually designed interiors.'],
  ['SECOND FLOOR','A different palette on each side',homes[2].name+' · '+homes[3].name+' — explore their living spaces.'],
  ['THIRD FLOOR','The top-floor residences',homes[4].name+' · '+homes[5].name+' — warm art and natural materials.'],
  ['THE ROOF','A garden above the city','Timber pergola, outdoor sofas, planters and a panoramic terrace.']
 ][state.floor];
 $('scene-kicker').textContent=info[0];
 $('scene-title').textContent=info[1];
 $('scene-detail').textContent=info[2];
}
function aimCamera(x,y,z,d=27){
 const polar=.88,az=.72;
 const dest=new THREE.Vector3(x+Math.sin(az)*d,y+Math.sin(polar)*d*.63,z+Math.cos(az)*d);
 const look=new THREE.Vector3(x,y,z);
 targetView={dest,look};
}
function selectFloor(f,forceCutaway=true){
 state.floor=Math.max(0,Math.min(4,f));
 if(state.mode==='walk'){
  player.x=state.floor===4?5.5:0;
  player.y=state.floor*H;
  player.z=state.floor===4?2.6:4.8;
  player.yaw=0;player.pitch=0;
  state.cutaway=false;
 }else{
  state.cutaway=forceCutaway && state.floor!==4;
  aimCamera(0,state.floor===4?4*H+1.5:state.floor*H+1.50,0,state.floor===4?29:25);
 }
 applyLayers();setText();
}
function showExterior(){
 if(state.mode==='walk')exitWalk();
 state.cutaway=false;
 state.floor=0;applyLayers();setText();
 aimCamera(0,7.2,0,47);
 $('scene-kicker').textContent='NORTHLIGHT HOUSE / COMPLETE VIEW';
 $('scene-title').textContent='Six homes. One considered design.';
 $('scene-detail').textContent='A new building developed from the ground up, not a repaired copy.';
}
function enterWalk(){
 state.previousCutaway=state.cutaway;
 state.mode='walk';state.cutaway=false;document.body.classList.add('walking');applyLayers();
 orbit.enabled=false;targetView=null;
 $('explore-label').textContent='Exit walking';
 $('mode-label').textContent='WALK-THROUGH MODE';
 $('walk-help').hidden=false;$('crosshair').hidden=false;$('orbit-help').hidden=true;
 $('touch-movement').hidden=!coarsePointer;
 if(state.floor===0){player.x=0;player.y=0;player.z=4.8;}
 else if(state.floor===4){player.x=5.5;player.y=4*H;player.z=2.5;}
 else {player.x=0;player.y=state.floor*H;player.z=4.8;}
 player.yaw=0;player.pitch=0;
 if(!coarsePointer)renderer.domElement.requestPointerLock?.().catch(()=>{});
}
function exitWalk(){
 state.mode='orbit';document.body.classList.remove('walking');state.cutaway=state.previousCutaway;
 orbit.enabled=true;down.clear();state.hit=null;
 if(document.pointerLockElement===renderer.domElement)document.exitPointerLock?.();
 $('interaction').hidden=true;$('walk-help').hidden=true;$('crosshair').hidden=true;$('orbit-help').hidden=false;
 $('touch-movement').hidden=true;touchLook=null;
 $('explore-label').textContent='Walk inside';
 $('mode-label').textContent='ARCHITECTURAL VIEW';
 applyLayers();
 aimCamera(0,state.floor===4?4*H+1.3:state.floor*H+1.45,0,28);
}
function toggleWalk(){state.mode==='walk'?exitWalk():enterWalk()}
function toggleDay(){
 state.night=!state.night;world.setNight(state.night);
 scene.background.setHex(state.night?0x132632:0xa8c4c7);
 scene.fog.color.setHex(state.night?0x172a33:0xb7cdcb);
 ambient.intensity=state.night?.55:1.4;
 sun.intensity=state.night?.10:2.35;moon.intensity=state.night?.72:0;
 for(const l of world.lamps)l.intensity=(state.night?9:4.8)*(l.userData.power||1);
 renderer.toneMappingExposure=state.night?1.43:1.18;
 $('day-label').textContent=state.night?'Daylight':'Evening';
 $('day').classList.toggle('active',state.night);
 $('day').setAttribute('aria-pressed',String(state.night));
}
function activeColliders(){
 return collisions.filter(c=>sourceVisible(c.mesh)&&!(c.dynamic&&c.mesh.userData.interaction?.open));
}
function isBlocked(nx,nz,py){
 const rad=.28,bottom=py+.16,top=py+1.69;
 for(const item of activeColliders()){
  if(item.dynamic)item.box.setFromObject(item.mesh);
  const b=item.box;
  if(top>b.min.y&&bottom<b.max.y && nx+rad>b.min.x && nx-rad<b.max.x && nz+rad>b.min.z && nz-rad<b.max.z)return true;
 }
 return false;
}
function motion(dt){
 const sprint=down.has('ShiftLeft')||down.has('ShiftRight')?6.0:3.55;
 const forward=Number(down.has('KeyW')||down.has('ArrowUp'))-Number(down.has('KeyS')||down.has('ArrowDown'));
 const strafe=Number(down.has('KeyD')||down.has('ArrowRight'))-Number(down.has('KeyA')||down.has('ArrowLeft'));
 const len=Math.hypot(forward,strafe)||1;
 // Forward is -Z in Three's right-handed camera convention.
 const dx=(-Math.sin(player.yaw)*forward+Math.cos(player.yaw)*strafe)/len*sprint*dt;
 const dz=(-Math.cos(player.yaw)*forward-Math.sin(player.yaw)*strafe)/len*sprint*dt;
 let nx=player.x+dx,nz=player.z+dz;
 if(!isBlocked(nx,player.z,player.y))player.x=nx;
 if(!isBlocked(player.x,nz,player.y))player.z=nz;
 // Prevent the player from leaving the plaza into unloaded infinity.
 player.x=THREE.MathUtils.clamp(player.x,-35,35);
 player.z=THREE.MathUtils.clamp(player.z,-32,35);
 const nextFloor=world.floorAt(player.x,player.z,player.y);
 if(Math.abs(nextFloor-player.y)<4.0) player.y=THREE.MathUtils.lerp(player.y,nextFloor,Math.min(1,dt*9));
 euler.set(player.pitch,player.yaw,0);
 camera.quaternion.setFromEuler(euler);
 camera.position.set(player.x,player.y+player.eye,player.z);
 const area=player.y>=4*H-1?'ROOF GARDEN':player.y<2?'GROUND FLOOR':'LEVEL '+Math.max(1,Math.round(player.y/H));
 $('walk-place').textContent=area;
}
function detectInteraction(now){
 if(state.mode!=='walk'||now-lastProbe<85)return;
 lastProbe=now;
 ray.setFromCamera(center,camera);
 ray.far=3.2;
 const active=world.interactions.filter(i=>sourceVisible(i.object));
 const objects=[];
 for(const item of active){objects.push(item.object);if(item.secondary)objects.push(item.secondary);}
 const hit=ray.intersectObjects(objects,false)[0];
 const target=hit?.object?.userData?.interaction || active.find(i=>i.object===hit?.object||i.secondary===hit?.object);
 state.hit=target || null;
 $('interaction').hidden=!state.hit;
 if(state.hit)$('use').textContent='E · '+state.hit.label.toUpperCase();
}
function useInteraction(){
 if(!state.hit)return;
 const item=state.hit;
 if(item.label.includes('lift')||item.label.includes('Lift')){
  // Simple level transfer is deliberate: no teleport hidden behind first-use geometry.
  selectFloor((state.floor+1)%5);
 }else item.toggle?.();
}
function render(now){
 requestAnimationFrame(render);
 const dt=Math.min(.05,Math.max(.001,(now-last)/1000));last=now;
 if(state.mode==='walk'){
  motion(dt);
  // The pointer-lock camera must not be overridden by OrbitControls.
  detectInteraction(now);
 }else{
  if(targetView){
   camera.position.lerp(targetView.dest,Math.min(1,dt*4.5));
   orbit.target.lerp(targetView.look,Math.min(1,dt*4.5));
   if(camera.position.distanceTo(targetView.dest)<.07&&orbit.target.distanceTo(targetView.look)<.07)targetView=null;
  }
  orbit.update();
 }
 // Cached interaction motion: doors swing, drawers slide, records spin.
 for(const item of world.interactions){
  if(item.pivot)item.pivot.rotation.y=THREE.MathUtils.damp(item.pivot.rotation.y,item.desired,9,dt);
  if(item.slide)item.slide.position.z=THREE.MathUtils.damp(item.slide.position.z,
    item.open?item.openZ:item.closedZ,11,dt);
  if(item.spinner&&item.playing)item.spinner.rotation.y+=dt*3.8;
 }
 // Culling lights respects room switches and avoids a large shader-light list.
 if(frame++%12===0){
  const lights=world.lamps.filter(l=>l.userData.enabled!==false&&sourceVisible(l))
    .sort((a,b)=>a.getWorldPosition(tmpV.clone()).distanceToSquared(camera.position)-
      b.getWorldPosition(tmpV.clone()).distanceToSquared(camera.position));
  const visible=new Set(lights.slice(0,state.mode==='walk'?6:9));
  for(const l of world.lamps)l.visible=l.userData.enabled!==false&&visible.has(l);
 }
 renderer.render(scene,camera);
 if(frame===2){$('loading').hidden=true;window.northlightQA.ready=true;}
}
function onResize(){
 camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
 renderer.setSize(innerWidth,innerHeight);
}
addEventListener('resize',onResize);
document.querySelectorAll('[data-floor]').forEach(btn=>btn.addEventListener('click',()=>selectFloor(+btn.dataset.floor,true)));
$('whole').addEventListener('click',showExterior);
$('cutaway').addEventListener('click',()=>{
 if(state.mode==='walk')exitWalk();
 state.cutaway=!state.cutaway;
 applyLayers();
 if(state.cutaway)aimCamera(0,state.floor*H+1.4,0,25);
 else aimCamera(0,7.0,0,47);
});
$('day').addEventListener('click',toggleDay);
$('reset').addEventListener('click',()=>{if(state.mode==='walk')exitWalk();showExterior()});
$('explore').addEventListener('click',toggleWalk);
$('help').addEventListener('click',()=>$('help-dialog').showModal());
$('close-help').addEventListener('click',()=>$('help-dialog').close());
$('start-help').addEventListener('click',()=>$('help-dialog').close());
$('use').addEventListener('click',useInteraction);
addEventListener('keydown',e=>{
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
 down.add(e.code);
 if(e.code==='KeyE'&&state.mode==='walk'&&!e.repeat)useInteraction();
 if(e.code==='Escape'&&state.mode==='walk')exitWalk();
});
addEventListener('keyup',e=>down.delete(e.code));
addEventListener('blur',()=>down.clear());
renderer.domElement.addEventListener('click',()=>{
 if(state.mode==='walk' && !fpsLocked && !coarsePointer)renderer.domElement.requestPointerLock?.().catch(()=>{});
});
document.addEventListener('pointerlockchange',()=>{
 fpsLocked=document.pointerLockElement===renderer.domElement;
});
document.addEventListener('mousemove',e=>{
 if(state.mode!=='walk'||!fpsLocked)return;
 player.yaw-=e.movementX*.0020;
 player.pitch=THREE.MathUtils.clamp(player.pitch-e.movementY*.0019,-1.40,1.40);
});
// On mobile the actual FPS camera is controlled by a canvas swipe while
// arrows hold the same WASD inputs as a keyboard.
for(const button of document.querySelectorAll('[data-move]')){
 const key=button.dataset.move;
 const release=()=>{down.delete(key);button.classList.remove('pressed');};
 button.addEventListener('pointerdown',e=>{
   e.preventDefault();e.stopPropagation();
   button.setPointerCapture(e.pointerId);down.add(key);button.classList.add('pressed');
 });
 button.addEventListener('pointerup',release);
 button.addEventListener('pointercancel',release);
 button.addEventListener('lostpointercapture',release);
}
renderer.domElement.addEventListener('pointerdown',e=>{
 if(state.mode!=='walk'||e.pointerType!=='touch')return;
 touchLook={id:e.pointerId,x:e.clientX,y:e.clientY};
 renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove',e=>{
 if(state.mode!=='walk'||!touchLook||e.pointerId!==touchLook.id)return;
 const dx=e.clientX-touchLook.x,dy=e.clientY-touchLook.y;
 player.yaw-=dx*.0051;
 player.pitch=THREE.MathUtils.clamp(player.pitch-dy*.0046,-1.40,1.40);
 touchLook.x=e.clientX;touchLook.y=e.clientY;
});
renderer.domElement.addEventListener('pointerup',e=>{if(touchLook?.id===e.pointerId)touchLook=null;});
renderer.domElement.addEventListener('pointercancel',()=>{touchLook=null;down.clear()});
// Expose minimal read-only QA data, and camera selection to automated visual tests.
window.northlightQA={
 ready:false,
 get sceneObjects(){let count=0;scene.traverse(()=>count++);return count},
 get floor(){return state.floor},
 get cutaway(){return state.cutaway},
 get player(){return {...player}},
 selectFloor(n){selectFloor(n,true)},
 showExterior,enterWalk,exitWalk,
 get interactions(){return world.interactions.length},
 get interactionsByType(){
   return world.interactions.reduce((out,i)=>{out[i.type||'door']=(out[i.type||'door']||0)+1;return out;},{});
 },
 get lightSwitchesOn(){return world.interactions.filter(i=>i.type==='switch'&&i.on).length},
 testInteraction(type){
   const i=world.interactions.find(i=>i.type===type);
   if(!i)throw Error('Interaction type not found: '+type);
   const before=i.label;
   i.toggle();
   return {before,after:i.label,open:i.open,on:i.on,playing:i.playing};
 },
 gotoHome(index,room='living'){
   const indexN=Math.max(0,Math.min(5,Math.floor(index)));
   const floor=Math.floor(indexN/2)+1;
   selectFloor(floor);
   if(state.mode!=='walk')enterWalk();
   const sign=indexN%2===0?-1:1;
   player.x=sign*(15.8-(room==='bedroom'?2.25:room==='kitchen'?10.16:room==='bathroom'?5.90:5.05));
   player.y=floor*H;
   player.z=room==='bedroom'?-3.1:room==='kitchen'?-2.90:room==='bathroom'?-2.25:6.30;
   player.yaw=0;player.pitch=-.1;
   motion(0);
   return {name:homes[indexN].name,room,position:{...player}};
 },
 get homes(){return homes.map(h=>h.name)}
};
applyLayers();
setText();
aimCamera(0,6.8,0,44);
for(const l of world.lamps)l.intensity=4.8*(l.userData.power||1);
requestAnimationFrame(render);
