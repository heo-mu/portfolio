import {UI_KIT,uiBounds} from './hero-ui.js?v=e8283723';
// Deterministic occupancy in Hero-local coordinates. Scroll never replans it.
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
// Ease only the ends: stacking full eases made long routes whip past the copy.
const flightProgress=t=>{t=Math.max(0,Math.min(1,t));return 1-Math.pow(1-t,1.65);};
const halton=(i,base)=>{let n=0,f=1;while(i){f/=base;n+=f*(i%base);i=Math.floor(i/base);}return n;};
export function createScatterField(T,camera,group,parts=[]){
  const local=new T.Vector3(),screen=new T.Vector3(),view=new T.Vector3(),inverse=new T.Matrix4();
  const targets=new Map(),occupied=[],nodes=[],zones=[],opening=new Set();
  let width=1,height=1,top=0,mobile=false,slot,anchorDepth=10,core={x:0,y:0,w:0,h:0},planVersion=0,coreReach=1,gap=24,free=false,zoneReach=null;
  const scratch={x:0,y:0,z:0,r:0};
  const routePoint={x:0,y:0};
  let layoutKey='';
  function project(p){
    local.set(p.x,p.y,p.z).applyMatrix4(group.matrixWorld);
    view.copy(local).applyMatrix4(camera.matrixWorldInverse);screen.copy(local).project(camera);
    screen.x=(screen.x+1)*width*.5;screen.y=(1-screen.y)*height*.5;
  }
  function resolve(p,x,y,depth){
    const z=(camera.far+camera.near)/(camera.far-camera.near)-2*camera.far*camera.near/((camera.far-camera.near)*depth);
    local.set(x/width*2-1,1-y/height*2,z).unproject(camera).applyMatrix4(inverse);
    p.x=local.x;p.y=local.y;p.z=local.z;
  }
  function radius(p,depth){
    // Actual module bounding sphere, perspective magnification, hover/float margin.
    const r=Math.hypot(p.bx??p.sx,p.by??p.sy,p.bz??p.sz)*.5;
    return r*height*camera.projectionMatrix.elements[5]/(2*Math.max(.1,depth-r))*1.14+7;
  }
  function sdf(x,y,r,z){
    const corner=28,qx=Math.abs(x-z.x)-Math.max(0,z.w/2+r-corner),qy=Math.abs(y-z.y)-Math.max(0,z.h/2+r-corner);
    return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-corner;
  }
  // Copy zones differ in how far a module may enter them. Caption copy ('meta')
  // is never covered. The front headline line may be grazed, since it paints
  // over the canvas. The back line may be overlapped at its edges — that is the
  // interleave — but never across its central letter band.
  // A collage layout may relax this per kind (LAYOUTS in hero-object.js).
  const reach=z=>zoneReach?.[z.kind]??(z.kind==='back'?.24:z.kind==='front'?.5:.78);
  function available(x,y,r){
    if(x<r+10||x>width-r-10||y<top+r+10||y>height-r-10)return false;
    if(mobile&&(y<slot.top+r+8||y>slot.bottom-r-8))return false;
    if(zones.some(z=>sdf(x,y,r*reach(z)+2,z)<0)||sdf(x,y,r*coreReach+8,core)<0)return false;
    return !occupied.some(q=>Math.hypot(x-q.x,y-q.y)<r+q.r+gap);
  }
  function configure(w,h,anchor,safeZones,headerHeight,layout=null){
    const key=[w,h,anchor.x,anchor.y,anchor.top,anchor.bottom,headerHeight,layout?.name||'',...safeZones.flatMap(z=>[z.x,z.y,z.w,z.h])].join(',');
    if(key===layoutKey)return;
    layoutKey=key;
    width=w;height=h;slot=anchor;mobile=w<=768;top=headerHeight;
    // A back line protects only its letter band; the edges stay open to modules.
    zones.length=0;safeZones.forEach(z=>zones.push(z.kind==='back'?{...z,h:z.h*.5}:{...z}));
    targets.clear();occupied.length=0;nodes.length=0;opening.clear();planVersion++;
    camera.updateMatrixWorld();group.updateMatrixWorld(true);inverse.copy(group.matrixWorld).invert();
    // Rest frame only, never a transient hover rotation or float.
    view.set(0,0,0).applyMatrix4(camera.matrixWorldInverse);anchorDepth=-view.z;
    let l=Infinity,r=-Infinity,t=Infinity,b=-Infinity;
    for(const x of [-1.40,1.40])for(const y of [-1.40,1.40])for(const z of [-1.40,1.40]){
      screen.set(x,y,z).project(camera);const px=(screen.x+1)*w/2,py=(1-screen.y)*h/2;
      l=Math.min(l,px);r=Math.max(r,px);t=Math.min(t,py);b=Math.max(b,py);
    }
    core={x:(l+r)/2,y:(t+b)/2,w:r-l,h:b-t};
    // A collage is composed, not solved: modules may overlap the core and each
    // other (depth keeps them apart) and keep their designed places while floating.
    coreReach=layout?.coreReach??(layout?.slots?.length?.62:1);gap=layout?.gap??(layout?.slots?.length?12:24);
    free=!!layout?.collage;zoneReach=layout?.reach||null;
    if(layout?.slots?.length){planSlots(layout);return;}
    const candidates=parts.filter(p=>p.kind==='shell'&&(p.nx>0||p.ny>0||p.nz>0)).sort((a,b)=>a.r-b.r);
    const selected=[],limit=mobile?6:w<=1088?9:14;
    // Non-adjacent release sites avoid rubbing neighbouring blocks on departure.
    for(const p of candidates){
      if(selected.some(q=>Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)<.49))continue;
      selected.push(p);if(selected.length===limit)break;
    }
    // A few exposed inner planes join the field; the rest remain one deliberate core.
    const inner=parts.filter(p=>p.kind==='core'&&(p.z>.6||p.x>.6||p.y>.6)).sort((a,b)=>a.r-b.r);
    let innerCount=0;
    for(const p of inner){
      if(selected.some(q=>Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)<.48))continue;
      selected.push(p);if(++innerCount===(mobile?1:w<=1088?3:4))break;
    }
    // Polar lanes radiate from the cube, with alternating near/mid/far shells.
    // Lower diagonals are allocated early; these are not viewport grid slots.
    const angles=[.82,2.38,4.55,5.65,1.6,3.8,.08,2.85,5.05,1.12,4.15,6.02,2.02,3.42,5.35,.48,4.85,2.62];
    for(let i=0;i<selected.length;i++){
      // One representative per role; the three chart types carry different shapes.
      const order=mobile?['button','toggle-status','bar-chart','search-field','modal-card','flow-nodes','table-rows']:['bar-chart','search-field','toggle-status','donut-dashboard','modal-card','button','line-area-chart','table-rows','flow-nodes','checkbox-radio','tabs-section','select-input','calendar','slider-range','list-notification','kanban-board','filter-badge','progress-pagination'];
      const p=selected[i],foreground=!mobile&&i<2,base=UI_KIT.find(ui=>ui.name===order[occupied.length]);
      const tier=i%3,angle=angles[i%angles.length];
      const scale=mobile?.64:[1.28,1.12,.96][tier],ui={...base,w:base.w*scale,h:base.h*scale,d:base.d*scale,scale};
      // Camera-facing basis with distinct, restrained yaw/pitch: readable fronts,
      // visible sidewalls, and no wall of identically oriented billboards.
      ui.rx=camera.rotation.x+Math.sin(angle)*[.16,.25,.34][tier];
      ui.ry=camera.rotation.y+Math.cos(angle)*[.24,.34,.42][tier];
      ui.rz=camera.rotation.z+Math.sin(angle*1.7)*[.10,.15,.21][tier];
      ui.depthFade=mobile?0:[0,.04,.10][tier];
      // A few smaller, deeper modules use outer whitespace; the main mass stays central.
      const region=mobile?'core':foreground?'core':i%6===4?'periphery':i%6>=2?'bridge':'core';
      const depth=anchorDepth*(mobile?1.12+p.r*.24:[.86,1.08,1.36][tier]);
      const rad=radius(uiBounds(ui),depth),band=Math.sin(angle)>.35?2:Math.sin(angle)<-.35?0:1;let best=null,bestScore=Infinity;
      const dx=Math.cos(angle),dy=Math.sin(angle);
      const edgeX=(dx>0?w-rad-14-core.x:rad+14-core.x)/dx;
      const edgeY=(dy>0?(mobile?slot.bottom:h)-rad-14-core.y:(mobile?slot.top:top)+rad+14-core.y)/dy;
      const far=Math.max(0,Math.min(edgeX,edgeY));
      const near=Math.min((core.w/2+rad+14)/Math.max(.01,Math.abs(dx)),(core.h/2+rad+14)/Math.max(.01,Math.abs(dy)));
      const reach=near+Math.max(0,far-near)*[.18,.52,.86][tier];
      for(let k=1;k<=720;k++){
        const x=(.035+.93*halton(k,2))*w;
        const minY=mobile?slot.top:top,maxY=mobile?slot.bottom:h;
        const y=minY+(.045+.91*halton(k,3))*(maxY-minY);
        if(!available(x,y,rad))continue;
        const vx=x-core.x,vy=y-core.y,distance=Math.hypot(vx,vy);
        const angular=1-(vx*dx+vy*dy)/Math.max(1,distance);
        // Reserve early lower-diagonal modules for the outer whitespace.
        const lowerAnchor=!mobile&&i<2;
        const lowerTargetX=i===0?w*.85:w*.16,lowerTargetY=h*.84;
        const lowerScore=lowerAnchor?Math.hypot(x-lowerTargetX,y-lowerTargetY)/h*2.8:0;
        const score=angular*(lowerAnchor?.5:2.2)+Math.abs(distance-reach)/Math.max(1,h)*1.4+lowerScore+halton(k+i+1,5)*.025;
        if(score<bestScore){bestScore=score;best={x,y,r:rad,depth,foreground,region,band,index:i,part:p,ui};}
      }
      if(!best)continue; // Insufficient space leaves the module in its coherent mass.
      // Only the destination is copy-safe. Travel may cross the text naturally.
      const clearance=p.kind==='shell'?.68:1.02;
      project({x:p.x+p.nx*clearance,y:p.y+p.ny*clearance,z:p.z+p.nz*clearance});
      best.route=planRoute(screen.x,screen.y,best);
      if(!best.route)continue;
      targets.set(p,best);occupied.push(best);
    }
  }
  // Art-directed constellation. Each slot is a place in the poster, given in
  // units of the projected structure (u, v from its centre), with a depth tier
  // and a module. The free part whose release lane points most nearly at the
  // slot flies there, so every departure still radiates from the cube.
  function planSlots(layout){
    const size=Math.max(core.w,core.h),used=[];
    const release=p=>{const c=p.kind==='shell'?.68:1.02;project({x:p.x+p.nx*c,y:p.y+p.ny*c,z:p.z+p.nz*c});return {p,x:screen.x,y:screen.y};};
    const lanes=[...parts.filter(p=>p.kind==='shell'&&(p.nx>0||p.ny>0||p.nz>0)),
      ...parts.filter(p=>p.kind==='core'&&(p.z>.6||p.x>.6||p.y>.6))].map(release);
    const depths=layout.depths||[.86,1.08,1.36],GRID=.36;
    // A slot may name the face cell its module leaves through ([face, u, v]),
    // so the openings in the cube are composed too: front (+z), right (+x), top (+y).
    const cell=([face,u,v])=>parts.find(p=>p.kind==='shell'&&(face==='z'?Math.round(p.x/GRID)===u&&Math.round(p.y/GRID)===v&&Math.round(p.z/GRID)===3
      :face==='x'?Math.round(p.x/GRID)===3&&Math.round(p.z/GRID)===u&&Math.round(p.y/GRID)===v:Math.round(p.y/GRID)===3&&Math.round(p.x/GRID)===u&&Math.round(p.z/GRID)===v));
    // Cells of an opening that no module leaves through fold into the core as it
    // opens, so the interior — planes, rails and the accent signals — shows.
    for(const c of layout.opening||[]){const p=cell(c);if(p)opening.add(p);}
    const tilt=layout.tilt??1;
    layout.slots.forEach((s,index)=>{
      const tier={front:0,mid:1,back:2}[s.tier]??s.tier??1,base=UI_KIT.find(ui=>ui.name===s.ui);if(!base)return;
      const scale=(s.scale??1)*(layout.scale??1),ui={...base,w:base.w*scale,h:base.h*scale,d:base.d*scale,scale,theme:s.theme};
      const angle=Math.atan2(s.v,s.u);
      ui.rx=camera.rotation.x+Math.sin(angle)*[.16,.25,.34][tier]*tilt+(s.rx||0);
      ui.ry=camera.rotation.y+Math.cos(angle)*[.24,.34,.42][tier]*tilt+(s.ry||0);
      ui.rz=camera.rotation.z+Math.sin(angle*1.7)*[.10,.15,.21][tier]*tilt+(s.rz||0);
      ui.depthFade=mobile?0:[0,.04,.10][tier];
      const depth=anchorDepth*(s.depth??depths[tier]),rad=radius(uiBounds(ui),depth);
      // The slot itself, or the nearest free point on a widening spiral.
      const gx=core.x+s.u*size,gy=core.y+s.v*size;let best=null;
      for(let k=0;k<=160&&!best;k++){
        const d=k?Math.ceil(k/8)*9:0,a=k*2.39996,x=gx+Math.cos(a)*d,y=gy+Math.sin(a)*d;
        if(available(x,y,rad))best={x,y,r:rad,depth,foreground:tier===0,region:'slot',band:1,index,ui};
      }
      if(!best)return;
      let lane=null,score=Infinity;
      const named=s.from&&cell(s.from);
      if(named&&!used.includes(named))lane=release(named);
      else for(const l of lanes){
        // Non-adjacent release sites avoid rubbing neighbouring blocks on departure.
        if(used.some(q=>Math.hypot(l.p.x-q.x,l.p.y-q.y,l.p.z-q.z)<.49))continue;
        const ax=l.x-core.x,ay=l.y-core.y,bx=best.x-core.x,by=best.y-core.y;
        const value=1-(ax*bx+ay*by)/Math.max(1,Math.hypot(ax,ay)*Math.hypot(bx,by))+l.p.r*.02;
        if(value<score){score=value;lane=l;}
      }
      if(!lane||used.includes(lane.p))return;
      used.push(lane.p);best.part=lane.p;best.route=planRoute(lane.x,lane.y,best);
      targets.set(lane.p,best);occupied.push(best);
    });
  }
  function planRoute(sx,sy,target){
    // A shallow outward arc, independent of text rectangles. No detour corners.
    const dx=target.x-sx,dy=target.y-sy,distance=Math.hypot(dx,dy)||1;
    const bend=Math.min(24,distance*.035)*(target.index%2?1:-1);
    const cx=(sx+target.x)/2-dy/distance*bend;
    const cy=(sy+target.y)/2+dx/distance*bend;
    const points=[];let length=0;
    for(let i=0;i<=32;i++){
      const t=i/32,u=1-t,x=u*u*sx+2*u*t*cx+t*t*target.x,y=u*u*sy+2*u*t*cy+t*t*target.y;
      if(i)length+=Math.hypot(x-points[i-1].x,y-points[i-1].y);
      points.push({x,y,length});
    }
    return {points,length};
  }
  function along(route,t){
    const distance=t*route.length,points=route.points;
    let i=1;while(i<points.length-1&&points[i].length<distance)i++;
    const a=points[i-1],b=points[i],f=(distance-a.length)/(b.length-a.length||1);
    routePoint.x=a.x+(b.x-a.x)*f;routePoint.y=a.y+(b.y-a.y)*f;
  }
  function begin(){inverse.copy(group.matrixWorld).invert();nodes.length=0;}
  function scatter(p,part,travel,floatWindow,clock){
    const target=targets.get(part);if(!target||!travel)return;
    // Face-normal release precedes lateral travel. Return retraces the same curve.
    const release=smooth(travel/.28),flight=flightProgress((travel-.20)/.80),clearance=(part.kind==='shell'?.68:1.02)*release;
    scratch.x=part.x+part.nx*clearance;scratch.y=part.y+part.ny*clearance;scratch.z=part.z+part.nz*clearance;
    project(scratch);
    const startX=screen.x,startY=screen.y,startDepth=-view.z;
    const drift=travel*floatWindow;along(target.route,flight);
    // One small outward pulse resolves while floating; reverse retraces the lane.
    // Hero can hold the float indefinitely, so the idle bob stays a few pixels.
    const pulse=Math.sin(Math.PI*floatWindow)*travel*(2+part.r*3);
    const radialLength=Math.hypot(target.x-core.x,target.y-core.y)||1;
    const first=target.route.points[0];
    const x=routePoint.x+(startX-first.x)*(1-flight)+(target.x-core.x)/radialLength*pulse+Math.sin(clock*(1.05+part.r*.25)+part.phase)*(2.2+part.r*1.4)*drift;
    const y=routePoint.y+(startY-first.y)*(1-flight)+(target.y-core.y)/radialLength*pulse+Math.cos(clock*(.85+part.r*.2)+part.phase)*(3+part.r*2)*drift;
    const depth=startDepth+(target.depth-startDepth)*flight+Math.sin(Math.PI*flight)*(.3+target.index%3*.36)+Math.sin(clock+part.phase)*.025*drift;
    resolve(p,x,y,depth);
  }
  function constrain(n,strength){
    for(let pass=0;pass<2;pass++)for(let i=0;i<=zones.length;i++){
      const z=i===zones.length?core:zones[i],r=i===zones.length?n.r*coreReach+8:n.r*reach(z)+2,dx=n.x-z.x,dy=n.y-z.y,corner=28;
      const qx=Math.abs(dx)-Math.max(0,z.w/2+r-corner),qy=Math.abs(dy)-Math.max(0,z.h/2+r-corner);
      const ax=Math.max(qx,0),ay=Math.max(qy,0),len=Math.hypot(ax,ay);
      const distance=len+Math.min(Math.max(qx,qy),0)-corner;
      if(distance>=3)continue;
      let nx=0,ny=0;
      if(len>.001){nx=Math.sign(dx)*ax/len;ny=Math.sign(dy)*ay/len;}
      else if(qx>qy)nx=Math.sign(dx)||1;else ny=Math.sign(dy)||-1;
      const push=distance<0?-distance+4:(3-distance)**2/12,weight=i===zones.length?strength:1;
      n.x+=nx*push*weight;n.y+=ny*push*weight;
    }
    n.x=Math.max(n.r+8,Math.min(width-n.r-8,n.x));
    n.y=Math.max((mobile?slot.top:top)+n.r+8,Math.min((mobile?slot.bottom:height)-n.r-8,n.y));
  }
  function solve(poses){
    nodes.length=0;
    if(free)return;
    for(const target of occupied){
      const p=poses[target.part.id];if(!p||p.travel<.001)continue;
      project(p);
      // Reuse plan records as scratch; no per-frame arrays or bounding volumes.
      target.p=p;target.px=screen.x;target.py=screen.y;target.d=-view.z;
      target.radius=radius(p,target.d);nodes.push(target);
    }
    // Screen-space bounding spheres separate both silhouettes and physical volumes.
    // The margin also reserves room for additive hover and floating.
    for(let pass=0;pass<8;pass++)for(let i=0;i<nodes.length;i++){
      const a=nodes[i],weight=smooth((a.p.travel-.94)/.06);
      for(let j=0;j<i;j++){
        const b=nodes[j],dx=a.px-b.px,dy=a.py-b.py,len=Math.hypot(dx,dy);
        const gap=a.radius+b.radius+7,blend=Math.min(weight,smooth((b.p.travel-.94)/.06));
        if(len>=gap||blend===0)continue;
        const nx=len>.001?dx/len:Math.cos(i*2.4),ny=len>.001?dy/len:Math.sin(i*2.4);
        const push=(gap-len)*blend,share=b.foreground?.9:.5;
        a.px+=nx*push*share;a.py+=ny*push*share;b.px-=nx*push*(1-share);b.py-=ny*push*(1-share);
      }
      if(weight){scratch.x=a.px;scratch.y=a.py;scratch.r=a.radius;constrain(scratch,weight);a.px+=(scratch.x-a.px)*weight;a.py+=(scratch.y-a.py)*weight;}
    }
    for(const n of nodes)resolve(n.p,n.px,n.py,n.d);
  }
  function inspect(){return {version:planVersion,targets:occupied.map(t=>({id:t.part.id,x:t.x,y:t.y,r:t.r,depth:t.depth,foreground:t.foreground,region:t.region,kind:t.part.kind,band:t.band,ui:t.ui.name})),core:{...core}};}
  return {configure,begin,scatter,solve,has:p=>targets.has(p),profile:p=>targets.get(p)?.ui,folds:p=>opening.has(p)&&!targets.has(p),
    duration:p=>targets.has(p)?Math.min(1.22,.88+targets.get(p).route.length/4000):p.departDuration,
    objects:()=>occupied,get version(){return planVersion;},inspect};
}
