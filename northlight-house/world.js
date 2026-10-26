
import * as THREE from 'three';

const H=3.35, W=15.8, D=8.1, LEVELS=4;
const standard=new THREE.BoxGeometry(1,1,1);
const sphereGeometry=new THREE.SphereGeometry(1,12,8);
const materials=new Map();
const col=[];
const interactions=[];
const lamps=[];
const supports=[];
const levels=[];
let night=false;

function material(c,rough=.82,metal=0,trans=1) {
 const key=[c,rough,metal,trans].join(':');
 if(!materials.has(key)) materials.set(key,new THREE.MeshStandardMaterial({
   color:c,roughness:rough,metalness:metal,transparent:trans<1,opacity:trans,
   side:trans<1?THREE.DoubleSide:THREE.FrontSide,depthWrite:trans>=1
 }));
 return materials.get(key);
}
const C={
 brick:0x996e58, brickDark:0x765044, lime:0xe6e4da, stone:0xcdc9bb,white:0xf6f3e9,
 floor:0xbeb7a6, timber:0xa98059, darkwood:0x765641, forest:0x325b4c,
 sage:0x90a996, olive:0x67735b, blue:0x6c959e, ink:0x23323a,
 steel:0x3a5459,black:0x1b2b30, bronze:0xb58b56, glass:0x8bc7d3,
 glassDark:0x376a78, leaf:0x47785d, leaf2:0x6e9b74, warm:0xffdcb1
};
const m={
 brick:material(C.brick),brickDark:material(C.brickDark),lime:material(C.lime),stone:material(C.stone),
 white:material(C.white),floor:material(C.floor),timber:material(C.timber),darkwood:material(C.darkwood),
 forest:material(C.forest),sage:material(C.sage),olive:material(C.olive),blue:material(C.blue),
 ink:material(C.ink),steel:material(C.steel,.4,.3),black:material(C.black,.62,.23),
 bronze:material(C.bronze,.32,.6),glass:material(C.glass,.11,.1,.26),
 glassDark:material(C.glassDark,.2,.2,.4),leaf:material(C.leaf),leaf2:material(C.leaf2)
};
const glow=material(0xffe4b9,.8,.1);
glow.emissive=new THREE.Color(0xffbb78);glow.emissiveIntensity=.25;
const luminous=material(0xe7fbec,.7,0);
luminous.emissive=new THREE.Color(0xb9ffd9);luminous.emissiveIntensity=.4;

function group(parent,x=0,y=0,z=0) {const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g}
function box(parent,w,h,d,x,y,z,mat,opt={}) {
 if(w<=0||h<=0||d<=0) return null;
 const mesh=new THREE.Mesh(standard,typeof mat==='number'?material(mat):mat);
 mesh.position.set(x,y,z);mesh.scale.set(w,h,d);
 mesh.castShadow=!!opt.shadow;mesh.receiveShadow=true;
 mesh.userData.role=opt.role||'architecture';
 parent.add(mesh);
 if(opt.collide) col.push(mesh);
 return mesh;
}
function ball(parent,r,x,y,z,mat) {const o=new THREE.Mesh(sphereGeometry,mat);o.position.set(x,y,z);o.scale.setScalar(r);o.castShadow=false;parent.add(o);return o}
function cylinder(parent,r,h,x,y,z,mat,n=14) {
 const a=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,n),mat);
 a.position.set(x,y,z);parent.add(a);return a;
}
function plane(parent,w,h,x,y,z,mat,rotation=0){
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);
 mesh.position.set(x,y,z);mesh.rotation.y=rotation;parent.add(mesh);return mesh;
}
function hwall(p,x0,x1,z,lo,hi,mat,cl=true){return box(p,x1-x0,hi-lo,.16,(x0+x1)/2,(lo+hi)/2,z,mat,{collide:cl})}
function vwall(p,x,z0,z1,lo,hi,mat,cl=true){return box(p,.16,hi-lo,z1-z0,x,(lo+hi)/2,(z0+z1)/2,mat,{collide:cl})}
function hWindow(p,x0,x1,z,lo=.9,hi=2.48){
 hwall(p,x0,x1,z,0,lo,m.brick);
 hwall(p,x0,x1,z,hi,H,m.brick);
 box(p,x1-x0,hi-lo,.035,(x0+x1)/2,(lo+hi)/2,z,m.glass,{collide:true,role:'window'});
 for(const px of [x0,x1])box(p,.055,hi-lo,.09,px,(lo+hi)/2,z,m.steel);
 box(p,x1-x0+.09,.065,.16,(x0+x1)/2,lo,z,m.stone);
 box(p,x1-x0+.09,.055,.10,(x0+x1)/2,hi,z,m.steel);
 if(x1-x0>1.8)box(p,.045,hi-lo,.075,(x0+x1)/2,(lo+hi)/2,z,m.steel);
}
function vWindow(p,x,z0,z1,lo=.85,hi=2.46){
 vwall(p,x,z0,z1,0,lo,m.brick);vwall(p,x,z0,z1,hi,H,m.brick);
 box(p,.035,hi-lo,z1-z0,x,(lo+hi)/2,(z0+z1)/2,m.glass,{collide:true,role:'window'});
 for(const pz of [z0,z1])box(p,.08,hi-lo,.04,x,(lo+hi)/2,pz,m.steel);
 box(p,.11,.05,z1-z0,x,lo,(z0+z1)/2,m.stone);
}
function slab(p,x0,x1,z0,z1,y,mat=m.floor,walk=true){
 box(p,x1-x0,.2,z1-z0,(x0+x1)/2,y-.12,(z0+z1)/2,mat,{shadow:true});
 if(walk){
   // Support heights are WORLD-space. Upper-floor slabs used to register at
   // ground level, which would make first-person visitors fall through floors.
   p.updateWorldMatrix(true,false);
   const worldY=p.localToWorld(new THREE.Vector3(0,y,0)).y;
   supports.push({x0,x1,z0,z1,y:worldY,kind:'slab'});
 }
}
function wallText(p,txt,x,y,z,scale=1,col='#f6f3e9',rot=0){
 // Canvas-backed text, constrained to a solid surface (never a floating label).
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
 const ctx=canvas.getContext('2d');ctx.clearRect(0,0,1024,256);
 ctx.font='800 120px system-ui, Arial';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillStyle=col;ctx.fillText(txt,512,130,982);
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 return plane(p,5*scale,1.25*scale,x,y,z,new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide}),rot);
}
function art(p,x,y,z,w,h,rot,colors=[0x88aa91,0x496e70,0xe0b57b]){
 const g=group(p,x,y,z);g.rotation.y=rot;
 box(g,w+.11,h+.11,.045,0,0,0,m.darkwood);
 box(g,w,h,.022,0,0,.028,m.white);
 const [a,b,c]=colors.map(q=>material(q));
 box(g,w*.63,h*.35,.025,-w*.10,h*.13,.048,a);
 ball(g,Math.min(w,h)*.20,w*.23,-h*.12,.076,b);
 const stripe=box(g,w*.18,h*.75,.025,-w*.29,-h*.02,.063,c);stripe.rotation.z=.24;
 return g;
}
function rug(p,x,z,w,d,color,trim=m.white,style=-1){
 box(p,w,.014,d,x,.037,z,color);
 // Genuine layered woven rugs, with a distinct pattern per residence.
 const border=.075;
 for(const zedge of [-1,1])box(p,w,.009,border,x,.050,z+zedge*(d/2-border/2),trim);
 for(const xedge of [-1,1])box(p,border,.009,d,x+xedge*(w/2-border/2),.050,z,trim);
 if(style<0)return;
 const inW=w-.31,inD=d-.31;
 if(style===0){ // Dune: broad irregular sand bands
  for(let i=0;i<5;i++)box(p,inW*(i%2?.72:.90),.007,.09,x+(i%2?.06:-.04),.051,z-inD/2+.18+i*(inD-.36)/4,trim);
 }else if(style===1){ // Tide: marine pinstripes
  for(let i=0;i<7;i++)box(p,.035,.007,inD,x-inW/2+(i+.5)*inW/7,.052,z,trim);
 }else if(style===2){ // Grove: offset natural woven blocks
  for(let i=0;i<4;i++)for(let j=0;j<3;j++)box(p,inW/5,.007,inD/5,x-inW/2+(i+.68)*inW/4,.051,z-inD/2+(j+.55)*inD/3,(i+j)%2?trim:m.sage);
 }else if(style===3){ // Loft: industrial grid
  for(let i=0;i<5;i++)box(p,.028,.007,inD,x-inW/2+(i+1)*inW/6,.051,z,trim);
  for(let i=0;i<4;i++)box(p,inW,.007,.028,x,.052,z-inD/2+(i+1)*inD/5,trim);
 }else if(style===4){ // Atelier: offset painterly geometry
  for(let i=0;i<4;i++){const q=box(p,inW*.38,.007,inD*.10,x+((i%2)-.5)*inW*.4,.052,z-inD*.30+i*inD*.21,trim);q.rotation.y=(i%2?-.10:.10);}
 }else { // Library: quiet woven chevrons
  for(let i=0;i<5;i++){const zz=z-inD*.39+i*inD*.19;for(const sign of [-1,1]){const q=box(p,inW*.45,.007,.055,x+sign*inW*.22,.052,zz,trim);q.rotation.y=sign*.30;}}
 }
}
function plant(p,x,z,size=1){
 const g=group(p,x,0,z);g.scale.setScalar(size);
 cylinder(g,.21,.37,0,.19,0,m.stone,12);
 cylinder(g,.13,.20,0,.42,0,m.darkwood,10);
 for(const [sx,sy,sz,r] of [[0,.72,0,.3],[.23,.65,-.08,.22],[-.18,.68,.08,.24],[.06,.98,.06,.20]])
 ball(g,r,sx,sy,sz,(sx>0?m.leaf2:m.leaf));
 return g;
}
function roomLight(p,x,y,z,power=1.0,switchAt=null,name='room'){
 cylinder(p,.18,.045,x,y,z,m.bronze);
 const bulbMaterial=glow.clone();
 cylinder(p,.15,.04,x,y-.032,z,bulbMaterial);
 const light=new THREE.PointLight(0xffd4a5,power*8,7,2);
 light.position.set(x,y-.23,z);
 light.userData.enabled=true;
 light.userData.power=power;
 p.add(light);lamps.push(light);
 if(switchAt){
   const plate=box(p,.045,.25,.18,switchAt.x,1.22,switchAt.z,m.white);
   const toggleButton=box(p,.067,.105,.095,switchAt.x+.027,1.23,switchAt.z,m.bronze);
   const item={type:'switch',object:plate,secondary:toggleButton,lamp:light,on:true,
     label:'Turn off '+name+' lights'};
   item.toggle=()=>{
     item.on=!item.on;
     light.userData.enabled=item.on;
     bulbMaterial.emissiveIntensity=item.on?.7:0;
     toggleButton.position.y=item.on?1.23:1.17;
     item.label=(item.on?'Turn off ':'Turn on ')+name+' lights';
   };
   plate.userData.interaction=item;toggleButton.userData.interaction=item;
   interactions.push(item);
 }
 return light;
}
function bench(p,x,z,w=1.8,mat=m.timber){
 box(p,w,.11,.55,x,.49,z,mat,{collide:true});
 for(const xx of [-w/2+.13,w/2-.13])box(p,.09,.42,.45,x+xx,.23,z,m.steel);
}
function chair(p,x,z,color=m.timber,rot=0){
 const g=group(p,x,0,z);g.rotation.y=rot;
 box(g,.53,.095,.5,0,.46,0,color,{collide:true});
 box(g,.55,.53,.09,0,.74,-.23,color);
 for(const dx of [-.2,.2])for(const dz of [-.18,.18])box(g,.06,.43,.06,dx,.24,dz,m.darkwood);
}
function table(p,x,z,color=m.darkwood,w=1.5,d=.85){
 const g=group(p,x,0,z);box(g,w,.1,d,0,.77,0,color,{collide:true});
 for(const dx of [-w/2+.12,w/2-.12])for(const dz of [-d/2+.12,d/2-.12])box(g,.065,.71,.065,dx,.37,dz,m.steel);
 return g;
}
function sofa(p,x,z,color,rot=0,w=2.55){
 const g=group(p,x,0,z);g.rotation.y=rot;
 box(g,w,.34,.91,0,.34,0,color,{collide:true});
 box(g,w,.6,.20,0,.75,-.40,color);
 for(const dx of [-w/2+.11,w/2-.11])box(g,.19,.42,.88,dx,.54,0,color);
 for(let i=0;i<3;i++)box(g,(w-.48)/3-.025,.15,.63,-(w-.48)/3+((w-.48)/3)*i,.57,.12,color);
 for(const dx of [-w/2+.18,w/2-.18])box(g,.09,.16,.09,dx,.08,0,m.darkwood);
 return g;
}
function bed(p,x,z,wood,cloth,rot=0){
 const g=group(p,x,0,z);g.rotation.y=rot;
 box(g,1.84,.27,2.25,0,.25,0,wood,{collide:true});
 box(g,1.9,1.03,.13,0,.6,-1.13,wood);
 box(g,1.70,.19,2.05,0,.48,.03,m.white);
 box(g,1.74,.11,1.42,0,.61,.36,cloth);
 for(const dx of [-.43,.43])box(g,.72,.11,.45,dx,.66,-.76,m.lime);
 return g;
}
function cabinet(p,x,z,w=1.25,color=m.darkwood,rot=0,height=1.0,depth=.44,label='cabinet'){
 const g=group(p,x,0,z);g.rotation.y=rot;
 const t=.045,front=depth/2;
 box(g,t,height,depth,-w/2+t/2,height/2,0,color,{collide:true});
 box(g,t,height,depth,w/2-t/2,height/2,0,color,{collide:true});
 box(g,w,t,depth,0,height-t/2,0,color);
 box(g,w,t,depth,0,t/2,0,color);
 box(g,w,height,t,0,height/2,-depth/2+t/2,color);
 if(height>1.4)for(const yy of [.74,1.42])box(g,w-.11,.04,depth-.12,0,yy,0,color);
 const leafW=(w-.12)/2;
 for(const left of [true,false]){
   const hinge=left?-w/2+t:w/2-t;
   const sign=left?1:-1;
   const pivot=group(g,hinge,.065,front+.01);
   const panel=box(pivot,leafW,height-.13,.045,sign*leafW/2,(height-.13)/2,0,color,{role:'door'});
   const knob=box(pivot,.07,.075,.065,sign*(leafW-.12),height*.6,.055,m.bronze);
   const item={type:'cupboard',object:panel,secondary:knob,pivot,desired:0,open:false,
     label:'Open '+label};
   item.toggle=()=>{item.open=!item.open;item.desired=item.open?(left?-1.47:1.47):0;item.label=(item.open?'Close ':'Open ')+label;};
   panel.userData.interaction=item;knob.userData.interaction=item;interactions.push(item);
 }
 return g;
}
function drawer(p,x,y,z,w=.66,color=m.timber,label='drawer'){
 const g=group(p,x,y,z);
 box(g,w,.23,.035,0,0,0,color,{role:'drawer'});
 const face=g.children[0];
 const handle=box(g,.28,.04,.056,0,.025,.055,m.bronze);
 box(g,w-.06,.035,.48,0,-.11,-.22,color);
 for(const sx of [-1,1])box(g,.035,.20,.48,sx*(w/2-.04),-.015,-.22,color);
 const item={type:'drawer',object:face,secondary:handle,slide:g,closedZ:z,openZ:z+.43,
   open:false,label:'Open '+label};
 item.toggle=()=>{item.open=!item.open;item.label=(item.open?'Close ':'Open ')+label;};
 face.userData.interaction=item;handle.userData.interaction=item;interactions.push(item);
 return g;
}
function bookcase(p,x,z,rot,wood=m.darkwood){
 const g=group(p,x,0,z);g.rotation.y=rot;
 box(g,.95,2.2,.35,0,1.1,0,wood,{collide:true});
 const books=[0xb55d4a,0x9bb5ab,0xd9bc76,0x568e9a,0xf0e7c6];
 for(let row=0;row<4;row++){
  box(g,.9,.045,.36,0,.28+row*.49,0,m.black);
  for(let i=0;i<6;i++)box(g,.105,.24+(i%3)*.045,.24,-.37+i*.145,.44+row*.49,0,material(books[(i+row)%books.length]));
 }
}
function kitchen(p,x,z,colors){
 const g=group(p,x,0,z);
 // Built-in cabinet carcass: leave cavities visible behind the hinged doors.
 box(g,4.65,.055,.68,0,.075,0,colors.cabinets);
 box(g,4.65,.05,.68,0,.91,0,colors.cabinets);
 box(g,4.65,.83,.045,0,.48,-.32,colors.cabinets);
 for(const a of [-2.29,-1.12,.01,1.13,2.29])
  box(g,.045,.84,.66,a,.48,0,colors.cabinets);
 box(g,4.80,.085,.76,0,.964,0,colors.counter,{collide:true});
 // Three low cupboards plus a triple drawer stack, all interactive.
 for(const [bx,bw] of [[-1.69,1.04],[-.56,1.05],[1.73,1.03]]){
   makeDoor(g,bx,.095,.354,bw,.78,0,'kitchen cupboard',colors.cabinets, bx<0?-1:1);
 }
 for(let i=0;i<3;i++)drawer(g,.57,.23+i*.255,.37,.95,colors.cabinets,'kitchen drawer');
 // Upper wall cupboards: doors can open independently.
 for(const bx of [-1.75,-.88,0,.88,1.75]){
   box(g,.85,.73,.36,bx,2.19,-.15,colors.cabinets);
   makeDoor(g,bx,1.84,.068,.78,.70,0,'wall cupboard',colors.cabinets,bx<0?-1:1);
 }
 // Sink and tap on the countertop.
 box(g,.78,.021,.41,-1.12,1.01,.05,m.steel);
 cylinder(g,.024,.3,-1.39,1.15,-.13,m.bronze);
 box(g,.30,.025,.026,-1.24,1.3,-.13,m.bronze);
 box(g,.83,.025,.59,1.12,1.01,.035,m.black);
 for(const bx of [.88,1.34])for(const zz of [-.15,.23])
  cylinder(g,.10,.016,bx,1.035,zz,m.steel);
 box(g,.85,.14,.66,1.12,1.9,-.1,m.steel);
 box(g,.31,.40,.24,1.12,2.15,-.17,m.steel);
 // Appliances: a small oven opening and a separate glass hob.
 const oven=makeDoor(g,1.15,.11,.398,.72,.55,0,'oven',m.black,-1);
 void oven;
}
function refrigerator(p,x,z,finish=m.steel){
 const g=group(p,x,0,z);
 const w=.83,h=1.95,d=.76;
 box(g,.045,h,d,-w/2+.023,h/2,0,finish,{collide:true});
 box(g,.045,h,d,w/2-.023,h/2,0,finish,{collide:true});
 box(g,w,.045,d,0,.03,0,finish);
 box(g,w,.045,d,0,h-.025,0,finish);
 box(g,w,h,.05,0,h/2,-d/2,finish);
 for(const yy of [.48,.96,1.44]){
   box(g,w-.08,.035,d-.12,0,yy,0,m.white);
 }
 makeDoor(g,0,.06,d/2+.02,w-.09,h-.13,0,'fridge',finish,-1);
 return g;
}
function recordPlayer(p,x,z,colors){
 const g=group(p,x,0,z);
 box(g,.85,.75,.52,0,.375,0,colors.cabinets);
 box(g,.78,.05,.46,0,.78,0,m.ink);
 const disc=cylinder(g,.21,.016,-.12,.82,.01,m.black,22);
 cylinder(g,.055,.022,-.12,.839,.01,m.bronze);
 const arm=box(g,.24,.028,.025,.21,.85,.07,m.bronze);arm.rotation.y=-.32;
 const interaction={type:'record',object:disc,label:'Play record',playing:false,spinner:disc};
 interaction.toggle=()=>{
   interaction.playing=!interaction.playing;
   interaction.label=interaction.playing?'Stop record':'Play record';
 };
 disc.userData.interaction=interaction;
 interactions.push(interaction);
}
function bathroom(p,colors){
 // Bathroom's own coordinate system: x 4.38..7.5, z -7.67..0.
 box(p,3.10,.025,7.42,5.94,.057,-3.75,material(0xd3d7d2,.32));
 // Walkable door at x 5.1..6.08 and z=0. Shower at rear-left.
 box(p,1.18,.085,1.16,4.98,.075,-7.42,m.white,{collide:true});
 box(p,.042,1.95,1.16,5.60,1.08,-7.42,m.glassDark,{collide:true});
 box(p,1.18,1.95,.035,4.98,1.08,-6.82,m.glass,{collide:false});
 cylinder(p,.025,1.55,4.60,1.39,-7.70,m.steel);
 cylinder(p,.13,.042,4.74,2.16,-7.62,m.bronze);
 // Vanity is anchored 0.2m in front of the rear solid wall.
 cabinet(p,6.53,-7.39,1.15,colors.cabinets,0,.85,.55);
 box(p,1.20,.075,.59,6.53,.92,-7.39,colors.counter);
 cylinder(p,.24,.10,6.53,1.01,-7.39,m.white);
 cylinder(p,.025,.27,6.18,1.16,-7.56,m.bronze);
 box(p,.36,.032,.032,6.33,1.30,-7.56,m.bronze);
 box(p,.82,1.04,.042,6.53,1.78,-8.01,m.steel);
 box(p,.74,.96,.018,6.53,1.78,-7.978,material(0xc7e2e7,.08,.12));
 box(p,.14,.06,.11,6.97,.985,-7.27,material(0xf0bfa7));
 // Toilet placed opposite glass screen, facing towards room front.
 box(p,.5,.50,.43,6.95,.26,-3.70,m.white,{collide:true});
 cylinder(p,.27,.14,6.95,.51,-3.42,m.white);
 box(p,.55,.43,.23,6.95,.65,-3.94,m.white);
 box(p,.50,.045,.55,6.95,.61,-3.44,m.lime);
 // Towel on side partition: behind WC, safely away from entry doorway.
 box(p,.045,.035,.61,7.41,1.35,-5.05,m.bronze);
 box(p,.052,.68,.47,7.36,1.05,-5.05,material(colors.towel));
}
function makeDoor(parent,x,y,z,w,h,rot,label,mat=m.timber,openTo=1){
 const anchor=group(parent,x,y,z);anchor.rotation.y=rot;
 const pivot=group(anchor,-w/2,0,0);
 const leaf=box(pivot,w-.06,h-.06,.075,w/2,h/2,0,mat,{collide:true,role:'door'});
 const surround=material(C.bronze,.3,.7);
 // Frame is embedded into fixed wall around the opening.
 for(const dx of [-w/2,w/2])box(anchor,.07,h,.13,dx,h/2,0,surround);
 box(anchor,w+.07,.07,.13,0,h,0,surround);
 const handle=box(pivot,.065,.065,.14,w-.2,Math.min(1.04,h*.65),.085,m.bronze);
 anchor.userData.door=true;
 const i={label:'Open '+label,object:leaf,secondary:handle,open:false,anchor,pivot,angle:0,desired:0,openTo};
 const toggle=()=>{i.open=!i.open;i.desired=i.open?openTo*1.60:0;i.label=(i.open?'Close ':'Open ')+label;};
 i.toggle=toggle;
 interactions.push(i);
 leaf.userData.interaction=i;
 handle.userData.interaction=i;
 return i;
}
function balcony(p,x,z,y){
 const g=group(p,x,y,z);
 box(g,3.1,.16,1.90,0,-.08,.95,m.stone);
 // Glass balustrade, with a top handrail.
 box(g,3.0,.96,.05,0,.53,1.85,m.glassDark,{collide:true});
 box(g,.05,.96,1.82,-1.49,.53,.93,m.glassDark,{collide:true});
 box(g,.05,.96,1.82,1.49,.53,.93,m.glassDark,{collide:true});
 box(g,3.08,.045,.06,0,1.03,1.85,m.steel);
 for(const bx of [-1.48,0,1.48])box(g,.05,1.05,.06,bx,.52,1.85,m.steel);
 plant(g,-1.1,1.2,.55);
 box(g,.50,.055,.45,.45,.45,1.16,m.timber);
 g.updateWorldMatrix(true,false);
 supports.push({x0:x-1.55,x1:x+1.55,z0:z,z1:z+1.9,y:g.getWorldPosition(new THREE.Vector3()).y,kind:'balcony'});
}
const homes=[
 {name:'THE DUNE',subtitle:'Warm sand · Honey oak',wall:0xf4ebda,floor:0xbe9b70,sofa:0xc6a16f,accent:0xe7d2b0,cab:0xb8905e,art:[0xc18a66,0xe4c7a3,0x537d78],variant:0},
 {name:'THE TIDE',subtitle:'Coastal blue · Walnut',wall:0xeaf2f1,floor:0xa6b6a8,sofa:0x528995,accent:0xe0c79d,cab:0x365d65,art:[0x558d98,0xceab78,0xacc8c7],variant:1},
 {name:'THE GROVE',subtitle:'Sage green · Natural wood',wall:0xe7eee5,floor:0xb4a083,sofa:0x739477,accent:0xddb880,cab:0x76906b,art:[0x739a79,0xe2c184,0x567977],variant:2},
 {name:'THE LOFT',subtitle:'Charcoal · Ochre',wall:0xe9e5de,floor:0xaba39b,sofa:0x465a62,accent:0xc89655,cab:0x484d4a,art:[0x3f6067,0xc6a16e,0xd5dad4],variant:3},
 {name:'THE ATELIER',subtitle:'Terracotta · Linen',wall:0xf4e7db,floor:0xc5a589,sofa:0xb87456,accent:0xe8cbb0,cab:0xb07957,art:[0xc97957,0x637e85,0xe8cbb0],variant:4},
 {name:'THE LIBRARY',subtitle:'Deep forest · Brass',wall:0xe9eee6,floor:0x8f9984,sofa:0x395f50,accent:0xc5ae79,cab:0x587057,art:[0x486c54,0xc4a56d,0x9bbaa3],variant:5}
];
function apartment(parent,level,side,config,aptNo){
 // Opposite residences are mirrored spatially, but styled and furnished separately.
 const flat=group(parent,side==='L'?-W:W,0,0);
 if(side==='R')flat.scale.x=-1;
 const wallMat=material(config.wall);
 const floorMat=material(config.floor,.69);
 const sofaMat=material(config.sofa);
 const cabMat=material(config.cab);
 const accentMat=material(config.accent);
 const colors={cabinets:cabMat,counter:m.white,towel:config.accent};
 // Total flat local x=0..12.95 (outer to corridor), back z=-7.8..0.
 slab(flat,.25,12.94,-7.65,7.65,0,floorMat,false);
 hwall(flat,.2,1.40,0,0,H,wallMat);
 hwall(flat,1.4,2.36,0,2.26,H,wallMat);
 makeDoor(flat,1.88,0,0,.87,2.16,0,'bedroom',cabMat,1);
 hwall(flat,2.36,4.36,0,0,H,wallMat);
 hwall(flat,4.36,5.08,0,0,H,wallMat);
 hwall(flat,5.08,6.03,0,2.26,H,wallMat);
 makeDoor(flat,5.55,0,0,.87,2.16,0,'bathroom',cabMat,-1);
 hwall(flat,6.03,7.54,0,0,H,wallMat);
 hwall(flat,7.54,8.28,0,0,H,wallMat);
 hwall(flat,8.28,11.42,0,2.38,H,wallMat); // kitchen arch
 hwall(flat,11.42,12.95,0,0,H,wallMat);
 vwall(flat,4.36,-7.6,0,0,H,wallMat);
 vwall(flat,7.54,-7.6,0,0,H,wallMat);
 // Lounge and dining, keep a 1.2m clear line between the entry and bathroom.
 rug(flat,5.40,4.00,4.4,2.9,accentMat,m.white);
 sofa(flat,5.00,4.65,sofaMat,Math.PI,config.variant===4?2.8:2.6);
 table(flat,5.15,2.8,m.timber,1.1,.60);
 cabinet(flat,4.6,.56,1.88,m.darkwood,0,.50,.47);
 box(flat,1.49,.87,.08,4.60,1.17,.48,m.black);
 roomLight(flat,5.10,H-.16,3.60,.7);
 plant(flat,.85,5.9,.90);
 // The outer x wall is solid from z 2.1 .. 3.3; hang art there.
 art(flat,.18,1.82,5.25,1.0,.85,Math.PI/2,config.art);
 const arm=chair(flat,1.50,3.62,accentMat,-Math.PI/3);
 void arm;
 table(flat,9.60,3.4,m.timber,1.65,1.02);
 for(const dx of [-.57,.57])chair(flat,9.6+dx,4.30,sofaMat,Math.PI);
 for(const dx of [-.57,.57])chair(flat,9.6+dx,2.52,accentMat,0);
 if(config.variant===1 || config.variant===5)bookcase(flat,12.15,5.48,Math.PI/2,cabMat);
 if(config.variant===2 || config.variant===4) {
   const desk=table(flat,11.7,5.3,m.white,1.15,.61);desk.rotation.y=Math.PI/2;
   box(flat,.48,.33,.065,11.59,1.1,5.28,m.black);
 }
 // Bedroom is x 0.2..4.3, z -7.6..0
 rug(flat,2.14,-3.25,2.62,1.65,material(0xcac5b7),m.white);
 bed(flat,2.14,-6.50,cabMat,sofaMat);
 cabinet(flat,.72,-7.35,.65,cabMat,0,.56,.42);
 cabinet(flat,3.56,-7.35,.65,cabMat,0,.56,.42);
 box(flat,.56,2.15,.57,.58,1.08,-1.10,cabMat,{collide:true}); // built-in wardrobe
 box(flat,.08,.08,.065,.66,1.18,-.77,m.bronze);
 art(flat,4.25,1.70,-2.48,1.0,.8,-Math.PI/2,config.art);
 roomLight(flat,2.05,H-.16,-3.3,.55);
 // Bathroom uses a dedicated self-contained layout; all fixtures are inside its walls.
 bathroom(flat,colors);
 roomLight(flat,5.95,H-.15,-3.5,.55);
 // Kitchen, x 7.6..12.9, z -7.6..0
 kitchen(flat,10.18,-7.72,colors);
 box(flat,.8,1.9,.75,12.12,.95,-4.95,m.steel,{collide:true}); // refrigerator
 box(flat,.04,.85,.07,12.51,1.10,-4.75,m.bronze);
 table(flat,10.10,-2.65,config.variant%2?cabMat:m.timber,1.36,.73);
 chair(flat,9.8,-1.88,sofaMat,Math.PI);
 chair(flat,10.4,-3.44,accentMat,0);
 roomLight(flat,10.18,H-.16,-3.1,.6);
 // Entry mat near corridor-facing door
 rug(flat,11.85,3.1,1.15,.72,material(0x827b6f),m.white);
 // All decoration respects open door and window spans.
 flat.userData={homeName:config.name,aptNo};
 return flat;
}
function floorShell(scene,idx){
 const layer=group(scene,0,idx*H,0);layer.name='Level '+idx;
 const front=group(layer);
 const content=group(layer);
 levels.push({group:layer,front,contents:content,name:idx===0?'Ground floor':'Residences'});
 if(idx>0){
   slab(content,-15.8,-2.6,-8.1,8.1,0,m.stone);
   slab(content,2.6,15.8,-8.1,8.1,0,m.stone);
   slab(content,-2.6,2.6,-1.55,8.1,0,m.stone);
   // Each level needs a real landing inside the lift shaft. Without it,
   // visitors could step through the lift doorway and fall to ground level.
   slab(content,.78,2.12,-7.67,-4.32,0,m.stone);
 }else{
   slab(content,-15.8,15.8,-8.1,8.1,0,m.stone);
 }
 // Side walls with two big framed windows each.
 for(const side of [-1,1]){
   const xx=side*15.80;
   vwall(content,xx,-8.1,-5.35,0,H,m.brick);
   vWindow(content,xx,-5.35,-2.65);
   vwall(content,xx,-2.65,1.45,0,H,m.brick);
   vWindow(content,xx,1.45,4.15);
   vwall(content,xx,4.15,8.1,0,H,m.brick);
 }
 // Back elevation, 2 bedrooms windows and 2 kitchen windows per level.
 const segments=[[-15.8,-14,'wall'],[-14,-12,'win'],[-12,-8,'wall'],[-8,-5,'win'],[-5,5,'wall'],[5,8,'win'],[8,12,'wall'],[12,14,'win'],[14,15.8,'wall']];
 for(const [a,b,k] of segments){if(k==='win')hWindow(content,a,b,-8.10,.95,2.43);else hwall(content,a,b,-8.1,0,H,m.brick)}
 // Dramatic horizontal concrete ribbon and shaded balcony lintel.
 box(front,31.8,.16,.26,0,3.27,8.17,m.stone);
 if(idx===0){
  hwall(front,-15.8,-10.9,8.1,0,H,m.brick);
  hWindow(front,-10.9,-6.3,8.1,.55,2.83);
  hwall(front,-6.3,-2.45,8.1,0,H,m.brick);
  // Front entrance glazing and double doors.
  hwall(front,-2.45,2.45,8.1,2.66,H,m.stone);
  hwall(front,-2.45,-1.3,8.1,0,2.66,m.steel);
  hwall(front,1.3,2.45,8.1,0,2.66,m.steel);
  makeDoor(front,-.65,0,8.10,1.22,2.53,0,'front entrance',m.glassDark,-1);
  makeDoor(front,.65,0,8.10,1.22,2.53,0,'front entrance',m.glassDark,1);
  hwall(front,2.45,6.3,8.1,0,H,m.brick);
  hWindow(front,6.3,10.9,8.1,.55,2.83);
  hwall(front,10.9,15.8,8.1,0,H,m.brick);
  box(front,4.3,.58,.22,0,2.91,8.36,m.forest);
  wallText(front,'NORTHLIGHT HOUSE',0,2.92,8.49,.56,'#ecf4e8');
 }else{
  for(const side of [-1,1]){
   const part=group(front,side===-1?-W:W,0,8.1);
   if(side===1)part.scale.x=-1;
   hwall(part,0,.86,0,0,H,m.brick);
   hWindow(part,.86,2.92,0,.85,2.49);
   hwall(part,2.92,3.40,0,0,H,m.brick);
   // Balcony door opening at x3.4..4.48
   hwall(part,3.40,4.48,0,2.32,H,m.brick);
   makeDoor(part,3.94,0,0,1.02,2.25,0,'balcony',m.glassDark,1);
   hwall(part,4.48,5.58,0,0,H,m.brick);
   hWindow(part,5.58,10.65,0,.62,2.48);
   hwall(part,10.65,12.95,0,0,H,m.brick);
   balcony(content,side===-1?-W+3.95:W-3.95,8.1,0);
  }
  // Core glazing above the entrance.
  hwall(front,-2.85,2.85,8.1,0,.62,m.stone);
  hwall(front,-2.85,2.85,8.1,2.78,H,m.stone);
  box(front,5.7,2.15,.06,0,1.70,8.1,m.glass);
  for(const fx of [-2.85,-.95,.95,2.85])box(front,.07,2.2,.07,fx,1.7,8.1,m.steel);
  // apartment entrance walls between corridor and homes
  for(const side of [-1,1]){
   const xx=side*2.64;
   vwall(content,xx,-8.1,1.25,0,H,m.lime);
   vwall(content,xx,1.25,2.33,2.25,H,m.lime);
   vwall(content,xx,2.33,8.1,0,H,m.lime);
   makeDoor(content,xx,0,1.79,1.00,2.19,Math.PI/2,
      'residence '+idx+'0'+(side===-1?'1':'2'),m.timber,side===-1?-1:1);
  }
 }
 // Core two narrow walls protecting lift shaft, no floating decorations.
 vwall(content,.38,-7.8,-4.28,0,H,m.lime);
 vwall(content,2.52,-7.8,-4.28,0,H,m.lime);
 hwall(content,.38,2.52,-7.8,0,H,m.lime);
 hwall(content,.38,.77,-4.28,0,H,m.lime);
 hwall(content,2.13,2.52,-4.28,0,H,m.lime);
 hwall(content,.77,2.13,-4.28,2.55,H,m.lime);
 box(content,1.28,2.46,.10,1.45,1.23,-4.28,m.glassDark); // lift doors (visual)
 const call=box(content,.22,.27,.06,.46,1.10,-4.16,m.black);
 const button=box(content,.09,.10,.076,.46,1.12,-4.115,m.bronze);
 const item={label:'Ride lift to next floor',object:call,secondary:button,toggle:()=>{}};
 interactions.push(item);call.userData.interaction=item;button.userData.interaction=item;
 wallText(content,'LIFT',1.42,2.76,-4.18,.17,'#38514e');
 return levels[levels.length-1];
}
function stairwell(parent,floor){
 // Two flights with a half-landing. All beams have positive aligned elevation.
 const baseY=0, steps=10, stairStep=H/(steps*2);
 for(let k=0;k<steps;k++){
   const y=(k+1)*stairStep;
   const z=-1.90-(k+.5)*.44;
   box(parent,1.08,.12,.44,-1.94,baseY+y-.06,z,m.stone);
   supports.push({x0:-2.50,x1:-1.38,z0:z-.22,z1:z+.22,y:floor*H+y,kind:'step'});
   const y2=H/2+(k+1)*stairStep;
   const z2=-6.32+(k+.5)*.44;
   box(parent,1.08,.12,.44,-.73,baseY+y2-.06,z2,m.stone);
   supports.push({x0:-1.29,x1:-.17,z0:z2-.22,z1:z2+.22,y:floor*H+y2,kind:'step'});
 }
 // Mid flight landing.
 box(parent,2.25,.14,.73,-1.32,H/2-.07,-6.62,m.stone);
 supports.push({x0:-2.50,x1:-.18,z0:-7.0,z1:-6.23,y:floor*H+H/2,kind:'landing'});
 for(const sx of [-2.46,-1.45]){
   const beam=box(parent,.075,.11,4.6,sx,.82,-4.1,m.steel);
   beam.rotation.x=Math.atan2(H/2,4.4);
 }
 for(const sx of [-1.23,-.23]){
   const beam=box(parent,.075,.11,4.6,sx,2.50,-4.1,m.steel);
   beam.rotation.x=-Math.atan2(H/2,4.4);
 }
 // Sloping rails: thin beams, not giant diagonal slabs.
 function rail(x,y,z,sign){
   const rr=box(parent,.055,.055,4.45,x,y,z,m.bronze);
   rr.rotation.x=sign*Math.atan2(H/2,4.4);
 }
 rail(-2.48,1.70,-4.10,1);rail(-.18,3.35,-4.10,-1);
 for(let i=0;i<6;i++){
  let z1=-1.9-i*.80;
  let z2=-6.3+i*.80;
  box(parent,.055,.86,.055,-2.48,.50+(.45+ i*.30),z1,m.steel);
  box(parent,.055,.86,.055,-.18,2.20+(.45+i*.30),z2,m.steel);
 }
 // Stairwell light; no opaque hanging billboards.
 roomLight(parent,-1.35,H-.2,-5.2,.65);
}
function groundLobby(parent){
 // A calm reception atrium, lounge and gallery with separated circulation.
 rug(parent,-7,3.4,8.0,4.8,material(0x9ba99a),m.white);
 sofa(parent,-9.25,3.9,m.forest,Math.PI/2,2.9);
 sofa(parent,-6.45,1.9,m.sage,Math.PI,2.4);
 table(parent,-7.1,3.15,m.timber,1.45,.75);
 plant(parent,-13.6,6.2,1.45);plant(parent,-4.0,5.9,1.1);
 roomLight(parent,-8.0,H-.16,2.7,1.0);
 // Reception counter sits off the central entrance path (x within 2.3m kept clear).
 box(parent,4.10,1.02,1.05,7.0,.51,2.0,m.darkwood,{collide:true});
 box(parent,4.26,.09,1.14,7.0,1.04,2.0,m.stone);
 box(parent,2.20,.62,.04,7.0,.56,2.57,m.forest);
 wallText(parent,'WELCOME HOME',7,2.40,-7.89,.48,'#6f866f');
 plant(parent,10.2,5.7,1.25);
 // Residents' mailboxes on solid side wall to avoid blocking entrance glazing.
 for(let row=0;row<3;row++)for(let i=0;i<5;i++){
  const x=10.2+(i-2)*.51,y=1.20+row*.39;
  box(parent,.47,.34,.10,x,y,-7.80,m.steel);
  box(parent,.12,.026,.016,x,y-.015,-7.72,m.bronze);
 }
 // Gallery, no pictures in openings; hang on side of planted display.
 for(let i=0;i<3;i++){
  const panel=group(parent,12.2,0,-2.5+i*2);
  box(panel,.14,1.92,1.3,0,1.31,0,m.ink);
  art(panel,-.10,1.42,0,1.05,.9,-Math.PI/2,[0xa9c4a2,0xddbd87,0x5d867c]);
 }
 bench(parent,12.7,4.9,2.0);
 // Courtyard view: planted atrium pool without blocking exits.
 box(parent,2.1,.19,2.1,-11.8,.095,-4.3,m.stone);
 box(parent,1.9,.025,1.9,-11.8,.20,-4.3,m.glassDark);
 plant(parent,-11.8,-4.3,1.28);
}
function roofGarden(scene){
 const g=group(scene,0,H*4,0);
 const face=group(g);
 slab(g,-15.80,15.80,-8.10,8.10,0,m.stone);
 // Raised wood decking and walkway.
 box(g,24.6,.10,11.8,0,.12,0,m.timber);
 for(let xx=-11.7;xx<12;xx+=.55)box(g,.025,.01,11.8,xx,.181,0,m.darkwood);
 // Secure perimeter: low parapet + high glass railing.
 for(const z of [-8.0,8.0]){
  box(g,31.8,.55,.25,0,.28,z,m.stone,{collide:true});
  box(g,31.8,.75,.07,0,.95,z,m.glassDark,{collide:true});
  box(g,31.8,.045,.11,0,1.34,z,m.steel);
 }
 for(const x of [-15.75,15.75]){
  box(g,.25,.55,16.2,x,.28,0,m.stone,{collide:true});
  box(g,.07,.75,16.2,x,.95,0,m.glassDark,{collide:true});
  box(g,.10,.045,16.2,x,1.34,0,m.steel);
 }
 // Rooftop pergola with timber slats.
 for(const x of [-10.8,-4.0]){
  for(const z of [-5.0,.5])box(g,.23,3.0,.23,x,1.56,z,m.darkwood);
 }
 for(let z=-5;z<.7;z+=.55)box(g,7.35,.12,.13,-7.4,3.1,z,m.timber);
 box(g,7.45,.14,.18,-7.4,3.1,-5.0,m.timber);
 sofa(g,-7.8,-2.75,m.forest,Math.PI,2.65);
 sofa(g,-5.0,-2.8,m.sage,Math.PI/2,2.2);
 table(g,-7.0,-3.25,m.timber,1.15,.65);
 rug(g,-7.1,-2.7,5.5,3.8,material(0xc5bea7),m.white);
 // Viewing platform seating to the east.
 for(const x of [4.8,9.2]){bench(g,x,-4.7,2.6);bench(g,x,3.85,2.6);}
 for(const [x,z] of [[-13,5],[13,5],[-13,-6],[13,-6],[0,5],[0,-5]])plant(g,x,z,1.1);
 // Lift rooftop penthouse (simple enclosed cabin roof).
 box(g,2.45,2.75,3.1,1.45,1.38,-5.8,m.lime,{collide:true});
 box(g,2.7,.18,3.3,1.45,2.81,-5.8,m.forest);
 box(g,1.45,2.16,.08,1.45,1.08,-4.24,m.glassDark);
 wallText(g,'ROOF GARDEN',1.5,3.25,-5.8,.28,'#264e3b');
 for(const x of [-11.5,11.5])for(const z of [-7.0,7.0]){
   cylinder(g,.05,2.6,x,1.30,z,m.steel);
   ball(g,.21,x,2.62,z,glow);
 }
 levels.push({group:g,front:face,contents:g,name:'Roof garden'});
 return g;
}
function landscaping(scene){
 const ground=group(scene);
 const grass=material(0x6e8878,.98);
 box(ground,220,.10,220,0,-.24,0,grass);
 box(ground,48,.11,34,0,-.13,3,m.floor);
 box(ground,6.0,.12,26,0,-.10,16,m.stone);
 // Courtyard pavers.
 for(let x=-22;x<=22;x+=1.8)box(ground,1.20,.025,1.4,x,-.045,11.1,m.stone);
 for(const [x,z] of [[-21,-10],[22,-9],[-21,11],[21,12],[-26,4],[26,1],[-14,18],[14,18]]){
   cylinder(ground,.31,2.7,x,1.35,z,m.darkwood);
   ball(ground,1.5,x,3.25,z,m.leaf);
   ball(ground,1.03,x-.85,3.10,z+.25,m.leaf2);
   ball(ground,.92,x+.68,4.1,z-.1,m.leaf);
 }
 for(const x of [-16,-11,11,16])plant(ground,x,11.4,1.2);
 for(const x of [-7,7]){
  cylinder(ground,.075,3.5,x,1.75,16,m.ink);
  ball(ground,.30,x,3.55,16,glow);
 }
 box(ground,34,.13,.55,0,.05,10.0,m.stone);
 box(ground,32,.1,.16,0,.08,-8.45,m.stone);
}
function ceiling(p,y){
 // Match the structural floor plates: leave the stairwell and lift shafts
 // physically clear so stairs never cut through a fake continuous ceiling.
 const upper=group(p);
 box(upper,12.9,.14,16.1,-9.35,y-.07,0,m.lime);
 box(upper,12.9,.14,16.1,9.35,y-.07,0,m.lime);
 box(upper,5.2,.14,9.65,0,y-.07,3.25,m.lime);
 return upper;
}
function createBuilding(scene){
 landscaping(scene);
 for(let floor=0;floor<LEVELS;floor++){
  const layer=floorShell(scene,floor);
  if(floor===0)groundLobby(layer.contents);
  else {
   const idx=(floor-1)*2;
   apartment(layer.contents,floor,'L',homes[idx],floor*100+1);
   apartment(layer.contents,floor,'R',homes[idx+1],floor*100+2);
   // Shared landing mural on solid wall between entrance and lift.
   rug(layer.contents,0,4.9,3.15,1.8,m.sage,m.white);
   bench(layer.contents,0,6.4,1.60);
   plant(layer.contents,-2.10,6.3,.65);
   roomLight(layer.contents,0,H-.2,4.9,.65);
  }
  if(floor<LEVELS-1) stairwell(layer.contents,floor);
  layer.ceiling=ceiling(layer.contents,H-.01);
  // Stairwell ceiling / floor opening: use cutaway to hide upper ceilings.
 }
 roofGarden(scene);
 scene.updateMatrixWorld(true);
 return {
   levels,interactions,col,supports,lamps,H,homes,
   getNight(){return night},setNight(b){night=b},
   floorAt(x,z,previousY){
     let high=0;
     // Step-up threshold prevents teleporting several storeys when standing under a slab.
     for(const s of supports){
       if(x>=s.x0-.08&&x<=s.x1+.08&&z>=s.z0-.08&&z<=s.z1+.08&&s.y<=previousY+.27 && s.y>high)high=s.y;
     }
     return high;
   },
   refreshCollision(){
     scene.updateMatrixWorld(true);
     return col;
   }
 };
}
export {createBuilding,H,homes};
