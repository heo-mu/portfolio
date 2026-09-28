import {UI_KIT,uiBounds} from './hero-ui.js?v=4';
// Deterministic occupancy in Hero-local coordinates. Scroll never replans it.
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
// Ease only the ends: stacking full eases made long routes whip past the copy.
const flightProgress=t=>{t=Math.max(0,Math.min(1,t));const edge=.12;return (t<edge?t*t/(2*edge):t>1-edge?1-edge-(1-t)**2/(2*edge):t-edge/2)/(1-edge);};
const halton=(i,base)=>{let n=0,f=1;while(i){f/=base;n+=f*(i%base);i=Math.floor(i/base);}return n;};
export function createScatterField(T,camera,group,parts=[]){
  const local=new T.Vector3(),screen=new T.Vector3(),view=new T.Vector3(),inverse=new T.Matrix4();
  const targets=new Map(),occupied=[],nodes=[],zones=[];
  let width=1,height=1,top=0,mobile=false,slot,anchorDepth=10,core={x:0,y:0,w:0,h:0},planVersion=0;
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
  function available(x,y,r){
    if(x<r+10||x>width-r-10||y<top+r+10||y>height-r-10)return false;
    if(mobile&&(y<slot.top+r+8||y>slot.bottom-r-8))return false;
    if(zones.some(z=>sdf(x,y,r+5,z)<0)||sdf(x,y,r+12,core)<0)return false;
    return !occupied.some(q=>Math.hypot(x-q.x,y-q.y)<r+q.r+24);
  }
  function configure(w,h,anchor,safeZones,headerHeight){
    const key=[w,h,anchor.x,anchor.y,anchor.top,anchor.bottom,headerHeight,...safeZones.flatMap(z=>[z.x,z.y,z.w,z.h])].join(',');
    if(key===layoutKey)return;
    layoutKey=key;
    width=w;height=h;slot=anchor;mobile=w<=768;top=headerHeight;
    zones.length=0;safeZones.forEach(z=>zones.push({...z}));
    targets.clear();occupied.length=0;nodes.length=0;planVersion++;
    camera.updateMatrixWorld();group.updateMatrixWorld(true);inverse.copy(group.matrixWorld).invert();
    // Rest frame only, never a transient hover rotation or float.
    view.set(0,0,0).applyMatrix4(camera.matrixWorldInverse);anchorDepth=-view.z;
    let l=Infinity,r=-Infinity,t=Infinity,b=-Infinity;
    for(const x of [-1.40,1.40])for(const y of [-1.40,1.40])for(const z of [-1.40,1.40]){
      screen.set(x,y,z).project(camera);const px=(screen.x+1)*w/2,py=(1-screen.y)*h/2;
      l=Math.min(l,px);r=Math.max(r,px);t=Math.min(t,py);b=Math.max(b,py);
    }
    core={x:(l+r)/2,y:(t+b)/2,w:r-l,h:b-t};
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
    const bands=[0,1,0,2,1,0,1,2];
    for(let i=0;i<selected.length;i++){
      // One representative per role; the three chart types carry different shapes.
      const order=mobile?['button','toggle-status','bar-chart','search-field','modal-card','flow-nodes','table-rows']:['button','toggle-status','bar-chart','line-area-chart','donut-dashboard','search-field','modal-card','table-rows','flow-nodes','filter-badge','wireframe-layout','select-input','document-sheet','slider-range','permission-lock','user-organisation','tabs-section','list-notification'];
      const p=selected[i],foreground=!mobile&&i<2,base=UI_KIT.find(ui=>ui.name===order[occupied.length]);
      const scale=mobile?.64:1,ui={...base,w:base.w*scale,h:base.h*scale,d:base.d*scale,scale};
      // Density fades toward the copy: small distant satellites, not a text-shaped hole.
      const region=mobile?'core':foreground||i%7<4?'core':i%7<6?'bridge':'periphery';
      const depth=anchorDepth*(foreground?[.78,.9][i]:region==='periphery'?1.8+p.r*.28:region==='bridge'?1.42+p.r*.22:1.08+p.r*.28);
      const rad=radius(uiBounds(ui),depth),band=bands[i%bands.length];let best=null,bestScore=Infinity;
      for(let k=1;k<=720;k++){
        const x=(.035+.93*halton(k,2))*w;
        const minY=mobile?slot.top:top,maxY=mobile?slot.bottom:h;
        const y=minY+(.045+.91*halton(k,3))*(maxY-minY);
        if(!available(x,y,rad))continue;
        const yn=(y-minY)/(maxY-minY),desired=[.22,.49,.77][band]+(p.r-.5)*.09;
        screen.set(p.x,p.y,p.z).project(camera);
        const sourceX=(screen.x+1)*w/2,sourceY=(1-screen.y)*h/2;
        const order=Math.hypot((x-sourceX)/w,(y-sourceY)/h);
        const desiredX=region==='periphery'?.10+p.r*.26:region==='bridge'?.44+p.r*.20:.72+p.r*.24;
        const density=Math.abs(x/w-desiredX)*(mobile?0:2.8);
        const score=density+Math.abs(yn-desired)*1.35+order*.08+halton(k+i+1,5)*.12;
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
  function planRoute(sx,sy,target){
    // A shallow outward arc, independent of text rectangles. No detour corners.
    const dx=target.x-sx,dy=target.y-sy,distance=Math.hypot(dx,dy)||1;
    const bend=Math.min(42,distance*.075)*(target.index%2?1:-1);
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
  function scatter(p,part,travel,floatWindow,phase){
    const target=targets.get(part);if(!target||!travel)return;
    // Face-normal release precedes lateral travel. Return retraces the same curve.
    const release=smooth(travel/.28),flight=flightProgress((travel-.20)/.80),clearance=(part.kind==='shell'?.68:1.02)*release;
    scratch.x=part.x+part.nx*clearance;scratch.y=part.y+part.ny*clearance;scratch.z=part.z+part.nz*clearance;
    project(scratch);
    const startX=screen.x,startY=screen.y,startDepth=-view.z;
    const drift=travel*floatWindow;along(target.route,flight);
    const first=target.route.points[0];
    const x=routePoint.x+(startX-first.x)*(1-flight)+Math.sin(phase*(1.05+part.r*.25)+part.phase)*(1.6+part.r*.9)*drift;
    const y=routePoint.y+(startY-first.y)*(1-flight)+Math.cos(phase*(.85+part.r*.2)+part.phase)*(1.2+part.r*.8)*drift;
    const depth=startDepth+(target.depth-startDepth)*flight+Math.sin(Math.PI*flight)*(.3+target.index%3*.36)+Math.sin(phase+part.phase)*.025*drift;
    resolve(p,x,y,depth);
  }
  function constrain(n,strength){
    for(let pass=0;pass<2;pass++)for(let i=0;i<=zones.length;i++){
      const z=i===zones.length?core:zones[i],r=n.r+(i===zones.length?10:4),dx=n.x-z.x,dy=n.y-z.y,corner=28;
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
  return {configure,begin,scatter,solve,has:p=>targets.has(p),profile:p=>targets.get(p)?.ui,
    duration:p=>targets.has(p)?Math.min(1.22,.88+targets.get(p).route.length/4000):p.departDuration,
    objects:()=>occupied,get version(){return planVersion;},inspect};
}
