// A single, text-free interface kit. Every relief folds into its owning voxel.
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
export const uiMorph=travel=>smooth((travel-.38)/.50);
export const uiRelief=travel=>smooth((travel-.58)/.38);
const recipes=[];
function recipe(name,w,h,draw){
  const parts=[];
  const box=(x,y,sx,sy,tone='soft',z=.12,sz=.04,rz=0,shape='box')=>parts.push({x,y,z,sx,sy,sz,rz,tone,shape});
  const bar=(x,y,w,h,tone='soft',z=.11)=>box(x,y,w,h,tone,z,.06,0,'control');
  const dot=(x,y,r,tone='ink',z=.15)=>box(x,y,r,r,tone,z,.05,0,'disc');
  const ring=(x,y,r,tone='ink')=>box(x,y,r,r,tone,.12,.045,0,'ring');
  const line=(x,y,a,b,tone='ink',thickness=.022)=>box((x+a)/2,(y+b)/2,Math.hypot(a-x,b-y),thickness,tone,.165,.022,Math.atan2(b-y,a-x));
  const lines=(x,y,width,count=2)=>{for(let i=0;i<count;i++)box(x-(i%2)*width*.12,y-i*.075,width*(i%2?.76:1),.021,'soft',.16,.022);};
  const arrow=(x,y)=>{line(x-.06,y,x+.06,y);line(x+.01,y+.05,x+.06,y);line(x+.01,y-.05,x+.06,y);};
  const open=['flow-nodes','user-organisation','stepper-flow'].includes(name);
  const chart=['bar-chart','line-area-chart','donut-dashboard','kpi-counter','dashboard-composite','range-chart'].includes(name);
  if(!open){
    const baseShape=h>=.52?'panelLarge':'panelMedium';
    // One recessed sidewall and a thin face. Both have real depth and cast shadow.
    box(0,0,w*.94,h*.94,'surface',-.013,.105,0,baseShape);
    box(0,0,w,h,'white',.043,.047,0,baseShape);
    if(chart)box(0,-.015,w-.10,h-.10,'surface',.075,.018,0,'panelMedium');
  }
  parts.forEach(part=>{part.volume=true;});
  draw({box,bar,dot,ring,line,lines,arrow});
  recipes.push(Object.freeze({name,w,h,d:.13,open,parts:Object.freeze(parts)}));
}
recipe('button',.76,.32,({bar,arrow,box})=>{bar(-.05,0,.56,.19,'accent');box(-.10,0,.20,.024,'white',.16,.024);arrow(.23,0);});
recipe('toggle-status',.76,.37,({bar,box,lines})=>{bar(.16,0,.30,.17,'accent');box(.23,0,.105,.12,'white',.15,.055);lines(-.17,.035,.19);});
recipe('bar-chart',.76,.58,({box,line})=>{line(-.26,-.19,.27,-.19,'soft');[.14,.25,.21,.37].forEach((h,i)=>box(-.21+i*.14,-.17+h/2,.077,h,i===3?'accent':'ink'));});
recipe('flow-nodes',.82,.52,({box,line,dot})=>{line(-.25,0,0,0,'soft');line(0,0,0,.15,'soft');line(0,0,0,-.15,'soft');line(0,.15,.25,.15,'soft');line(0,-.15,.25,-.15,'soft');box(-.25,0,.21,.23,'white',.06,.18,0,'panel');box(.25,.15,.19,.16,'white',.075,.15,0,'panel');box(.25,-.15,.19,.16,'white',.075,.15,0,'panel');box(-.25,0,.09,.10,'ink',.16);box(.25,.15,.09,.05,'accent',.17);box(.25,-.15,.09,.05,'soft',.17);dot(0,0,.055);});
recipe('search-field',.86,.32,({ring,line,box})=>{ring(-.28,.025,.10);line(-.25,-.015,-.20,-.065);box(.04,0,.33,.028);line(.31,-.065,.31,.065,'accent');});
recipe('donut-dashboard',.78,.60,({ring,box,dot,lines})=>{ring(-.14,0,.34,'soft');box(-.14,0,.34,.34,'accent',.153,.032,0,'arc');lines(.19,.09,.17,3);dot(.13,-.15,.045,'accent');});
recipe('tabs-section',.82,.52,({box,bar,lines})=>{box(0,.09,.65,.015);bar(-.21,.15,.18,.085,'ink');bar(0,.15,.16,.085);bar(.20,.15,.16,.085);box(-.21,.09,.18,.021,'accent');lines(-.03,-.035,.52);});
recipe('checkbox-radio',.64,.48,({box,line,ring,dot})=>{box(-.17,.09,.125,.125,'accent');line(-.21,.09,-.18,.06,'white');line(-.18,.06,-.13,.12,'white');ring(-.17,-.105,.13,'soft');dot(-.17,-.105,.055,'ink');box(.10,.09,.23,.025);box(.10,-.105,.23,.025);});
recipe('line-area-chart',.80,.56,({box,line,dot})=>{box(0,-.015,.55,.31,'soft',.083,.018,0,'area');const p=[[-.27,-.14],[-.11,.025],[.055,-.035],[.25,.18]];p.slice(1).forEach((b,i)=>line(...p[i],...b,'accent',.024));dot(.25,.18,.055,'accent');});
recipe('progress-pagination',.80,.40,({bar,dot})=>{bar(0,.065,.60,.07);bar(-.11,.065,.38,.07,'accent',.125);[-.12,0,.12].forEach((x,i)=>dot(x,-.08,.05,i===1?'ink':'soft'));});
recipe('filter-badge',.75,.37,({bar,box,line,dot})=>{bar(-.07,0,.48,.18);box(-.12,0,.19,.025,'ink',.16);line(.055,-.03,.115,.03);line(.055,.03,.115,-.03);dot(.27,0,.12,'accent');});
recipe('modal-card',.76,.66,({box,line,lines,bar})=>{box(0,.18,.60,.016);line(.22,.265,.27,.215);line(.22,.215,.27,.265);lines(-.02,.08,.49,3);bar(.16,-.205,.21,.10,'accent');bar(-.095,-.205,.21,.10);});
recipe('table-rows',.84,.56,({box,line,dot})=>{box(0,.16,.68,.09,'ink');[-.02,-.16].forEach(y=>{dot(-.265,y,.048,'accent');line(-.19,y,.0,y,'soft');line(.10,y,.27,y,'soft');});line(.06,-.21,.06,.105,'soft',.013);});
recipe('list-notification',.78,.53,({box,dot,lines})=>{dot(-.25,.105,.115,'accent');lines(.075,.135,.32);dot(-.25,-.12,.085,'soft');lines(.075,-.09,.32);box(0,-.01,.60,.012);});
recipe('kpi-counter',.74,.57,({box,line,lines})=>{lines(-.075,.18,.40,1);[[-.18,.085],[-.07,.16],[.05,.24]].forEach(([x,h])=>box(x,-.13+h/2,.075,h,'ink'));line(.17,-.11,.28,.015,'accent');line(.22,.015,.28,.015,'accent');line(.28,-.045,.28,.015,'accent');});
recipe('select-input',.83,.35,({box,line,dot})=>{box(-.08,0,.38,.025,'ink');line(.22,.03,.27,-.02,'accent');line(.27,-.02,.32,.03,'accent');dot(-.30,0,.06,'soft');});
recipe('wireframe-layout',.78,.65,({box,line})=>{box(0,.215,.62,.075,'ink');box(-.235,-.035,.14,.32);box(.09,.035,.38,.18);box(-.005,-.15,.18,.11,'accent');box(.205,-.15,.15,.11);line(-.12,-.22,-.12,.145,'soft',.014);});
recipe('timeline',.85,.43,({line,dot,box})=>{line(-.30,0,.30,0,'soft');[-.27,-.08,.10,.29].forEach((x,i)=>{dot(x,0,.065,i===2?'accent':'ink');box(x,i%2?.115:-.115,.105,.025);});});
recipe('location-chip',.61,.51,({ring,line,dot,box})=>{ring(0,.06,.23,'ink');line(-.105,.025,0,-.155);line(0,-.155,.105,.025);dot(0,.06,.065,'accent');box(0,-.195,.25,.018);});
recipe('document-sheet',.58,.73,({lines,box})=>{box(-.13,.21,.12,.11,'accent');lines(0,.045,.38,4);box(.12,.22,.12,.025,'ink');});
recipe('folder-module',.76,.56,({box,lines})=>{box(-.16,.18,.29,.10,'ink');box(0,-.035,.61,.28,'soft');lines(-.06,-.015,.32);});
recipe('permission-lock',.58,.58,({ring,box,dot})=>{ring(0,.10,.25,'ink');box(0,-.065,.33,.24,'accent',.12,.075);dot(0,-.055,.052,'white',.17);box(0,-.105,.022,.07,'white',.165);});
recipe('user-organisation',.81,.57,({line,dot,box})=>{dot(0,.18,.11,'ink');box(0,.085,.17,.075,'ink');line(0,.045,0,-.045,'soft');line(-.24,-.045,.24,-.045,'soft');[-.24,0,.24].forEach((x,i)=>{line(x,-.045,x,-.10,'soft');dot(x,-.155,.10,i===1?'accent':'soft');});});
recipe('navigation-rail',.42,.76,({box,dot})=>{box(-.13,.10,.017,.39);[.245,.085,-.075,-.235].forEach((y,i)=>{box(0,y,.14,.10,i===1?'accent':'soft');if(i!==1)dot(0,y,.042,'ink');});});
recipe('tooltip-helper',.76,.42,({box,lines,dot})=>{box(.16,-.12,.105,.105,'soft',.088,.03,Math.PI/4);box(0,.035,.60,.18,'soft');dot(-.21,.035,.065,'ink',.13);lines(.045,.065,.29);});
recipe('slider-range',.82,.32,({bar,box})=>{bar(0,0,.64,.04);bar(-.12,0,.40,.04,'accent',.11);box(.08,0,.10,.15,'white',.14,.055);box(.08,0,.022,.075,'accent',.17,.022);});
recipe('dashboard-composite',.84,.64,({box,lines})=>{box(-.265,0,.14,.49,'ink',.10,.04,0,'panel');[-.13,0,.13].forEach(y=>box(-.265,y,.055,.025,'white',.14));box(.075,.17,.42,.14,'white',.11,.035,0,'panel');lines(.035,.18,.26,1);[.14,.24,.19].forEach((h,i)=>box(-.08+i*.15,-.20+h/2,.085,h,i===1?'accent':'soft',.125,.065));});
recipe('segmented-control',.84,.33,({bar,box,dot})=>{bar(0,0,.69,.19,'surface');bar(-.22,0,.21,.16,'ink',.135);[-.22,0,.22].forEach((x,i)=>{box(x,0,.075,.024,i===0?'white':'soft',.18,.018);});});
recipe('range-chart',.78,.57,({box,line,dot})=>{[-.14,0,.14].forEach((y,i)=>{line(-.26,y,.27,y,'soft',.012);box(-.11+i*.07,y,.23+i*.035,.058,i===1?'accent':'ink',.13,.055);dot(-.24,y,.035,'soft');});});
recipe('info-panel',.74,.57,({ring,dot,box,lines})=>{ring(-.22,.15,.13,'accent');dot(-.22,.185,.027,'accent');box(-.22,.135,.018,.052,'accent',.16,.022);lines(.085,.185,.24,2);lines(0,-.045,.52,2);box(.17,-.21,.18,.03,'ink');});
recipe('stepper-flow',.82,.32,({line,box})=>{line(-.26,0,.27,0,'soft');[-.27,0,.27].forEach((x,i)=>{box(x,0,.20,.20,'white',.065,.05);box(x,0,.11,.11,i===1?'accent':'ink',.11,.05);if(i===0){line(x-.025,0,x-.005,-.025,'white',.016);line(x-.005,-.025,x+.035,.025,'white',.016);}});});
export const UI_KIT=Object.freeze(recipes);
export function uiBounds(profile,out={}){out.sx=profile.w*1.03;out.sy=profile.h*1.03;out.sz=.42*(profile.scale||1);return out;}
export function applyUIVolume(p,profile){
  const morph=profile?uiMorph(p.travel):0;p.ui=morph;
  if(!profile||!morph){p.bx=p.sx;p.by=p.sy;p.bz=p.sz;return;}
  p.sx+=(profile.w-p.sx)*morph;p.sy+=(profile.h-p.sy)*morph;p.sz+=(profile.d-p.sz)*morph;
  p.rx+=(-.22)*morph;p.ry+=.30*morph;p.rz+=.035*morph;
  // Keep the voxel inside the new casing; open node structures retain only a
  // small junction. The original dimensions return exactly as morph reaches zero.
  const substrate=1-(profile.open?.86:.34)*morph;
  p.bodySX=p.sx*substrate;p.bodySY=p.sy*substrate;p.bodySZ=p.sz*(1-.28*morph);
  p.bx=p.sx*(1+.03*morph);p.by=p.sy*(1+.03*morph);p.bz=p.sz+.29*(profile.scale||1)*uiRelief(p.travel);
}
function panelGeometry(T,r=.025,soft=true){
  const s=new T.Shape(),v=.5;
  s.moveTo(-v+r,-v);s.lineTo(v-r,-v);s.quadraticCurveTo(v,-v,v,-v+r);s.lineTo(v,v-r);s.quadraticCurveTo(v,v,v-r,v);s.lineTo(-v+r,v);s.quadraticCurveTo(-v,v,-v,v-r);s.lineTo(-v,-v+r);s.quadraticCurveTo(-v,-v,-v+r,-v);
  // Keep the same unit depth; curved edge normals soften highlights without
  // changing the layers, contact-shadow setup, or motion envelope.
  const g=new T.ExtrudeGeometry(s,{depth:.94,steps:1,bevelEnabled:true,bevelThickness:.03,bevelSize:soft?.006:.003,bevelSegments:soft?2:1,curveSegments:soft?5:1});g.translate(0,0,-.47);return g;
}
export function createUIRelief(T,group,boxGeometry,materials){
  const disc=new T.CylinderGeometry(.5,.5,1,20);disc.rotateX(Math.PI/2);
  const ring=new T.TorusGeometry(.385,.115,6,28);ring.scale(1,1,1/.23);
  const arc=new T.TorusGeometry(.385,.115,6,20,Math.PI*1.22);arc.scale(1,1,1/.23);arc.rotateZ(-.3);
  const areaShape=new T.Shape();areaShape.moveTo(-.5,-.5);areaShape.lineTo(-.5,-.40);areaShape.lineTo(-.20,.10);areaShape.lineTo(.1,-.09);areaShape.lineTo(.5,.5);areaShape.lineTo(.5,-.5);areaShape.closePath();
  const area=new T.ExtrudeGeometry(areaShape,{depth:1,bevelEnabled:false});area.translate(0,0,-.5);
  const geometries={box:boxGeometry,control:panelGeometry(T,.006,false),panel:panelGeometry(T),panelMedium:panelGeometry(T,.045),panelLarge:panelGeometry(T,.075),disc,ring,arc,area};
  const root=new T.Group();root.name='hero-ui-relief';group.add(root);
  const parent=new T.Object3D(),child=new T.Object3D(),matrix=new T.Matrix4();
  let version=-1,batches=[];
  function clear(){for(const b of batches){root.remove(b.mesh);b.mesh.dispose();}batches=[];}
  function update(poses,field,resting){
    root.visible=!resting&&!!field;if(!root.visible)return;
    if(version!==field.version){
      clear();version=field.version;const records=new Map();
      for(const target of field.objects())for(const detail of target.ui.parts){
        const key=detail.shape+':'+detail.tone;
        if(!records.has(key))records.set(key,[]);records.get(key).push({id:target.part.id,detail,scale:target.ui.scale||1});
      }
      for(const [key,items] of records){
        const [shape,tone]=key.split(':'),mesh=new T.InstancedMesh(geometries[shape],materials[tone],items.length);
        mesh.name='ui-'+key;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);batches.push({mesh,items});
      }
    }
    for(const b of batches){
      let visible=false;
      b.items.forEach(({id,detail:d,scale},i)=>{
        const p=poses[id],relief=d.volume?p.ui:uiRelief(p.travel),size=Math.max(.00001,relief);visible||=relief>0;
        parent.position.set(p.x,p.y,p.z);parent.rotation.set(p.rx,p.ry,p.rz);parent.updateMatrix();
        // Relief starts buried inside the volume; there is no alpha swap or pop.
        child.position.set(d.x*relief*scale,d.y*relief*scale,(p.sz/2-.012)*(1-relief)+d.z*relief*scale);
        child.rotation.set(0,0,d.rz);child.scale.set(d.sx*size*scale,d.sy*size*scale,d.sz*size*scale);child.updateMatrix();
        matrix.multiplyMatrices(parent.matrix,child.matrix);b.mesh.setMatrixAt(i,matrix);
      });
      b.mesh.visible=visible;b.mesh.instanceMatrix.needsUpdate=true;
    }
  }
  return {update,dispose(){clear();Object.entries(geometries).forEach(([key,g])=>{if(key!=='box')g.dispose();});group.remove(root);}};
}
