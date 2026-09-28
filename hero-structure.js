import {applyUIVolume,createUIRelief} from './hero-ui.js?v=4';
// Rest, assembly and pointer displacement are independent motion layers.
export const CYCLE=4.2;
export const PITCH=.36;
const HALF=1.26;
const STILL={strength:0};
// World-space motion limits: one shell cell is .36 units wide.
export const CORE_MOTION=Object.freeze({loosen:.052,float:.009,depth:.042,rotation:.036,scale:.014,innerWeight:.72});
const seed=(x,y,z,salt)=>{const n=Math.sin(x*127.1+y*311.7+z*74.7+salt*19.19)*43758.5453;return n-Math.floor(n);};
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
export function assemblyState(time,out={}){
  const phase=((time%CYCLE)+CYCLE)%CYCLE;
  out.phase=phase;
  out.open=ease((phase-.80)/.30)*(1-ease((phase-3.90)/.30));
  out.assembled=out.open===0;
  out.stage=phase<.80?'assembled':phase<1.10?'loosen':phase<2?'disperse':phase<2.75?'float':phase<3.90?'return':'resolve';
  return out;
}
export const PARTS=[];
function part(x,y,z,sx,sy,sz,kind,band){
  const r=seed(x,y,z,1),shell=kind==='shell';
  // Face coordinates define reusable lanes, rather than a particle explosion.
  const ix=Math.round(x/PITCH),iy=Math.round(y/PITCH),iz=Math.round(z/PITCH);
  const face=Math.abs(iz)===3?2:Math.abs(ix)===3?0:1;
  const u=face===0?iz:ix,v=face===1?iz:iy;
  const selector=((u*3+v*5+face*2)%11+11)%11;
  let cohort=!shell?'core':selector<2&&Math.abs(u)<3&&Math.abs(v)<3?'far':selector<6?'mid':selector<9?'near':'anchor';
  if(shell&&z<-.7&&y<0)cohort='anchor';
  const nx=shell&&Math.abs(ix)===3?Math.sign(ix):0;
  const ny=shell&&Math.abs(iy)===3?Math.sign(iy):0;
  const nz=shell&&Math.abs(iz)===3?Math.sign(iz):0;
  const length=Math.hypot(nx,ny,nz)||1;
  const distance=(cohort==='far'?.90+r*.14:cohort==='mid'?.40+r*.13:cohort==='near'?.12+r*.08:0)*(ny<0?.82:1);
  const delay=.12*(v+3)/6+.15*r+.045*face;
  const departAt=1.05+delay*.45;
  const departDuration=cohort==='far'?.74:cohort==='mid'?.68:.60;
  const returnAt=2.75+delay*.35;
  const returnDuration=cohort==='far'?1.08:cohort==='mid'?.98:.88;
  PARTS.push({id:PARTS.length,x,y,z,sx,sy,sz,kind,band,r,cohort,nx:nx/length,ny:ny/length,nz:nz/length,
    // Tangents stay within each face; drift/rotation engage only after clearance.
    tx:face===0?0:1,ty:face===1?0:1,tz:face===0?1:0,
    distance,departAt,departDuration,returnAt,returnDuration,
    lane:((ix*7+iy*11+iz*13)%16+16)%16,
    spin:(seed(x,y,z,2)-.5)*.72,phase:r*Math.PI*2,
    depthBias:(seed(x,y,z,3)-.5)*.085,tempo:1.2+seed(x,y,z,4)*1.1,
    drift:cohort==='far'?.085:cohort==='mid'?.038:.008});
}
// Uniform exterior subdivisions; inside, alternating information planes and columns.
for(let z=-3;z<=3;z++)for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++){
  if(Math.max(Math.abs(x),Math.abs(y),Math.abs(z))===3)
    part(x*PITCH,y*PITCH,z*PITCH,PITCH,PITCH,PITCH,'shell',y);
}
for(let y=-2;y<=2;y++)for(let z=-2;z<=2;z++)for(let x=-2;x<=2;x++){
  const plate=(y+2)%2===0;
  part(x*PITCH,y*PITCH,z*PITCH,plate?.326:.11,plate?.125:.33,plate?.326:.11,'core',y);
}
for(let y=-2;y<=2;y+=2)for(let z=-2;z<=2;z++)for(let x=-1;x<=1;x++)
  part(x*.54,y*PITCH+.09,z*PITCH,.44,.025,.035,'rail',y);
// Sparse internal signals, never a luminous outer skin.
for(let y=-2;y<=2;y+=2)for(let x=-1;x<=1;x++){
  part(x*.54,y*PITCH+.095,.745,.20,.026,.024,'signal',y);
  part(.745,y*PITCH+.095,x*.54,.024,.026,.20,'signal',y);
}
export function modulePose(time,p,pointer=STILL,state=assemblyState(time),out={},field){
  const {phase,open}=state;
  const departDuration=field?.duration(p)??p.departDuration;
  const departure=ease((phase-p.departAt)/departDuration);
  const returnProgress=ease(Math.pow(Math.max(0,(phase-p.returnAt)/p.returnDuration),.86));
  const travel=departure*(1-returnProgress);
  const floatWindow=ease((phase-p.departAt-departDuration*.8)/.28)*(1-ease((phase-p.returnAt)/.32));
  const driftDepth=(p.cohort==='far'?.045:p.cohort==='mid'?.022:p.cohort==='near'?.012:0)*Math.sin(phase*(1.9+p.r*.4)+p.phase)*travel*floatWindow;
  const detached=field?.has(p);
  const reach=(field&&p.kind==='shell'&&!detached) ? 0 : p.distance*travel+driftDepth;
  const clearance=p.cohort==='far'?ease((reach-.84)/.16):p.cohort==='mid'?.045*ease((reach-.32)/.2):0;
  // A short 2–6px release exposes the structure before individual lanes depart.
  const release=p.kind==='shell'?(field&&!detached?0:.025*open):0;
  const offset=release+reach;
  const arc=Math.sin(Math.PI*travel)*clearance;
  const drift=p.drift*clearance*floatWindow;
  const side=Math.sin(p.phase+phase*(1.8+p.r*.4))*drift+p.spin*.12*arc;
  const rise=Math.sin(p.phase*.7+phase*(2.2-p.r*.3))*drift*.65;
  let x=p.x+p.nx*offset+p.tx*side;
  let y=p.y+p.ny*offset+p.ty*rise;
  let z=p.z+p.nz*offset+p.tz*side;
  if(field&&detached){
    out.x=x;out.y=y;out.z=z;
    field.scatter(out,p,travel,floatWindow,phase);
    x=out.x;y=out.y;z=out.z;
  }
  // Each retained module has a stable phase; the assembly envelope removes every
  // offset and rotation at rest, in either time direction, without accumulated noise.
  const breathing=field&&!detached?open*ease(travel):0;
  const weight=p.kind==='shell'?1:CORE_MOTION.innerWeight;
  const breathPhase=phase*p.tempo+p.phase;
  if(breathing){
    // Two low-frequency waves give a smooth irregular rhythm with no frame noise.
    // Depth stays normal to each face, preserving the grid's lateral clearances.
    const wave=.68*Math.sin(breathPhase)+.32*Math.sin(breathPhase*.61+p.phase*1.7);
    const depth=(CORE_MOTION.loosen+p.depthBias+wave*CORE_MOTION.depth)*breathing;
    const inner=p.kind==='shell'?0:weight;
    x+=p.nx*depth+Math.sin(breathPhase*.83)*CORE_MOTION.float*weight*breathing;
    y+=p.ny*depth+Math.sin(breathPhase*.71+p.phase)*CORE_MOTION.float*weight*breathing;
    z+=p.nz*depth+wave*CORE_MOTION.depth*inner*breathing;
  }
  let activation=0;
  // Hover is additive to the moving home/loop position in every state.
  if(pointer.strength>0&&!detached){
    const dx=x-pointer.x,dy=y-pointer.y,dz=z-pointer.z,radius=.67+.12*open;
    const falloff=Math.max(0,1-(dx*dx+dy*dy+dz*dz)/(radius*radius));
    activation=falloff*falloff*Math.min(1,pointer.strength);
    const length=Math.hypot(pointer.nx,pointer.ny,pointer.nz)||1;
    const boundary=Math.max(Math.abs(p.x),Math.abs(p.y),Math.abs(p.z))>1;
    const amount=activation*(boundary?.22+(detached?-.08:.02)*open:.06*open);
    x+=pointer.nx/length*amount;y+=pointer.ny/length*amount;z+=pointer.nz/length*amount;
  }
  const turn=field&&!detached?0:p.spin*clearance*(travel+floatWindow*.10*Math.sin(phase*2+p.phase));
  const shrink=p.kind==='shell'?1-(field&&!detached?.105+p.r*.04:.07)*open:1;
  out.x=x;out.y=y;out.z=z;out.sx=p.sx*shrink;out.sy=p.sy*shrink;out.sz=p.sz*shrink;
  out.rx=turn*(.5+p.r);out.ry=turn;out.rz=turn*.35;out.activation=activation;out.travel=travel;
  if(breathing){
    const micro=CORE_MOTION.rotation*(.55+.45*p.r)*weight*breathing;
    out.rx+=Math.sin(breathPhase*.83)*micro;
    out.ry+=Math.cos(breathPhase*.91+p.phase)*micro;
    out.rz+=Math.sin(breathPhase*.7)*micro*.45;
    const scale=1+Math.sin(breathPhase*.67+p.phase)*CORE_MOTION.scale*weight*breathing;
    out.sx*=scale;out.sy*=scale;out.sz*=scale;
  }
  if(detached){
    const freeTurn=ease((travel-.28)/.4);
    out.rx+=p.spin*freeTurn*.65;out.ry+=Math.sin(phase+p.phase)*freeTurn*.12;
  }
  applyUIVolume(out,field?.profile(p));
  return out;
}
function stone(T,color,roughness,metalness=0){
  const material=new T.MeshStandardMaterial({color,roughness,metalness});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vStonePosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvStonePosition=position;');
    shader.fragmentShader='varying vec3 vStonePosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\nfloat grain=fract(sin(dot(floor(vStonePosition*240.0),vec3(12.9898,78.233,37.719)))*43758.5453)-.5;\nroughnessFactor=clamp(roughnessFactor+grain*.055,.55,.98);\ndiffuseColor.rgb*=1.0+grain*.018;');
  };
  material.customProgramCacheKey=()=> 'structured-porcelain-v3';
  return material;
}
function bevelBox(T){
  const bevel=.016,shape=new T.Shape(),v=.5-bevel;
  shape.moveTo(-v,-v);shape.lineTo(v,-v);shape.lineTo(v,v);shape.lineTo(-v,v);shape.closePath();
  const geometry=new T.ExtrudeGeometry(shape,{depth:1-2*bevel,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:bevel,bevelThickness:bevel});
  geometry.translate(0,0,-.5+bevel);return geometry;
}
export function createStructure(T,{accent='#C94324',ink='#1B1C19'}={}){
  const group=new T.Group(),shellGeometry=bevelBox(T),innerGeometry=bevelBox(T);
  const basePositions=shellGeometry.attributes.position.array.slice();
  const materials={shell:stone(T,0xe9e9e2,.77),core:stone(T,0x888e83,.81),rail:stone(T,ink,.67,.16),
    signal:new T.MeshStandardMaterial({color:accent,roughness:.64,metalness:.06})};
  const batches=Object.entries(materials).map(([kind,material])=>{
    const parts=PARTS.filter(p=>p.kind===kind);
    const mesh=new T.InstancedMesh(kind==='shell'?shellGeometry:innerGeometry,material,parts.length);
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.castShadow=kind!=='signal';mesh.receiveShadow=true;mesh.frustumCulled=false;
    group.add(mesh);
    return {kind,mesh,parts,inverses:parts.map(()=>new T.Matrix4()),matrices:parts.map(()=>new T.Matrix4())};
  });
  const solidGeometry=new T.BoxGeometry(HALF*2,HALF*2,HALF*2),solid=new T.Mesh(solidGeometry,materials.shell);
  solid.castShadow=true;solid.receiveShadow=true;group.add(solid);
  const dummy=new T.Object3D(),color=new T.Color(),motionState={},poses=PARTS.map(()=>({}));
  const uiMaterials={white:materials.shell,surface:stone(T,0xd3d2ce,.78),soft:stone(T,0xb6b5b1,.79),ink:materials.rail,accent:materials.signal};
  const relief=createUIRelief(T,group,innerGeometry,uiMaterials);
  const shellColor=materials.shell.color,coreColor=materials.core.color;
  const unitBox=new T.Box3(new T.Vector3(-.5,-.5,-.5),new T.Vector3(.5,.5,.5));
  const solidBox=new T.Box3(new T.Vector3(-HALF,-HALF,-HALF),new T.Vector3(HALF,HALF,HALF));
  const pickRay=new T.Ray(),candidate=new T.Vector3(),worldHit=new T.Vector3(),faceNormal=new T.Vector3();
  let previousOpen=-1,wasResting=null,spreadAmount=0;
  for(const b of batches)b.parts.forEach((p,i)=>b.mesh.setColorAt(i,color.setScalar(b.kind==='shell'?1:.93+p.r*.07)));
  function update(time,pointer=STILL,field){
    const state=assemblyState(time,motionState),open=state.open,resting=state.assembled&&pointer.strength<.00001;
    solid.visible=resting;for(const b of batches)b.mesh.visible=!resting;
    const changed=wasResting!==resting;wasResting=resting;
    spreadAmount=0;
    if(resting){relief.update(poses,field,true);return changed;}
    if(Math.abs(open-previousOpen)>1e-8){
      const positions=shellGeometry.attributes.position.array;
      for(let i=0;i<positions.length;i++)positions[i]=Math.sign(basePositions[i])*.5*(1-open)+basePositions[i]*open;
      shellGeometry.attributes.position.needsUpdate=true;previousOpen=open;
    }
    for(const part of PARTS){
      modulePose(time,part,pointer,state,poses[part.id],field);
      if(field?.has(part))spreadAmount=Math.max(spreadAmount,poses[part.id].travel);
    }
    field?.solve(poses);
    // Resolve against the final, collision-safe position, including UI satellites.
    // The old rest-space falloff could miss a panel once the layout solver moved it.
    if(field&&pointer.strength>0)for(const target of field.objects()){
      const p=poses[target.part.id],radius=Math.max(.55,Math.hypot(p.sx,p.sy)*.65);
      const distance=(p.x-pointer.x)**2+(p.y-pointer.y)**2+(p.z-pointer.z)**2;
      const activation=Math.max(0,1-distance/(radius*radius))**2*Math.min(1,pointer.strength);
      const length=Math.hypot(pointer.nx,pointer.ny,pointer.nz)||1,offset=activation*(.15+.035*p.ui);
      p.x+=pointer.nx/length*offset;p.y+=pointer.ny/length*offset;p.z+=pointer.nz/length*offset;
      p.rx-=activation*.045;p.ry+=activation*.065;p.activation=activation;
    }
    for(const b of batches){
      for(let i=0;i<b.parts.length;i++){
        const p=poses[b.parts[i].id];
        dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(p.rx,p.ry,p.rz);dummy.scale.set(p.sx,p.sy,p.sz);dummy.updateMatrix();
        // Picking uses the complete UI envelope; the original voxel becomes its
        // inner substrate as a shaped, layered casing grows around it.
        b.matrices[i].copy(dummy.matrix);b.inverses[i].copy(dummy.matrix).invert();
        if(p.ui){dummy.scale.set(p.bodySX,p.bodySY,p.bodySZ);dummy.updateMatrix();}
        b.mesh.setMatrixAt(i,dummy.matrix);
        if(b.kind==='core'){
          // Inner planes become the same porcelain as the exterior UI bodies.
          const m=p.ui||0;
          color.setRGB(1+(shellColor.r/coreColor.r-1)*m,1+(shellColor.g/coreColor.g-1)*m,1+(shellColor.b/coreColor.b-1)*m).multiplyScalar(.93+b.parts[i].r*.07);
          b.mesh.setColorAt(i,color);
        }
      }
      b.mesh.instanceMatrix.needsUpdate=true;
      if(b.kind==='core')b.mesh.instanceColor.needsUpdate=true;
    }
    relief.update(poses,field,false);
    return changed;
  }
  function normalAt(point,box,result){
    let edge=Infinity;result.set(0,0,0);
    for(const axis of ['x','y','z'])for(const sign of [-1,1]){
      const distance=Math.abs(point[axis]-(sign<0?box.min[axis]:box.max[axis]));
      if(distance<edge){edge=distance;result.set(0,0,0);result[axis]=sign;}
    }
  }
  function pickSurface(ray,point,normal){
    let nearest=Infinity,uiHit=false;
    if(solid.visible){
      if(!ray.intersectBox(solidBox,point))return false;
      normalAt(point,solidBox,normal);return true;
    }
    // Intersect rotated module boxes, including the exposed inner planes.
    for(const b of batches){
      if(b.kind==='rail'||b.kind==='signal')continue;
      for(let i=0;i<b.parts.length;i++){
        pickRay.copy(ray).applyMatrix4(b.inverses[i]);
        if(!pickRay.intersectBox(unitBox,candidate))continue;
        worldHit.copy(candidate).applyMatrix4(b.matrices[i]);
        const distance=ray.origin.distanceToSquared(worldHit);
        if(distance>=nearest)continue;
        nearest=distance;point.copy(worldHit);normalAt(candidate,unitBox,faceNormal);
        uiHit=poses[b.parts[i].id].ui>0;
        normal.copy(faceNormal).transformDirection(b.matrices[i]);
      }
    }
    if(nearest===Infinity){
      if(!ray.intersectBox(solidBox,point))return false;
      normalAt(point,solidBox,normal);
    }
    // Gap walls still respond outward from the mass.
    if(!uiHit&&normal.dot(point)<-.01)normal.negate();
    return true;
  }
  shellGeometry.attributes.position.setUsage(T.DynamicDrawUsage);update(0);
  return {group,update,pickSurface,get spread(){return spreadAmount;},dispose(){shellGeometry.dispose();innerGeometry.dispose();solidGeometry.dispose();
    relief.dispose();uiMaterials.soft.dispose();uiMaterials.surface.dispose();Object.values(materials).forEach(m=>m.dispose());batches.forEach(b=>b.mesh.dispose());}};
}
