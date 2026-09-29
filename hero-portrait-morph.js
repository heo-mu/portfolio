import {createHeroPNGVisuals} from './hero-png-ui.js?v=1';
import {phase} from './hero-sequence.js?v=5';

// Each supplied PNG owns one trajectory and one following core surface.
// The image hands off to its aligned slab late in convergence, then the slab unfolds.
// .00–.14 float; .14–.44 align; .44–.56 hold; .56–.69 peel;
// .69–.84 reconstruct; .84–.90 resolve; .912–.993 editorial.
export function createHeroTransformation(T,image,environment,accent,compact=false,assets){
  const count=assets.length,records=[],poses=[],centerV=.385;
  const coreRotation=new T.Quaternion().setFromEuler(new T.Euler(.32,-.54,-.035));
  const panelRotation=coreRotation.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(-Math.PI/2,0,0)));
  for(let id=0;id<count;id++){
    const level=id/(count-1)*2-1;
    const center=new T.Vector3(Math.sin(level*1.6)*.045,level*.60,(Math.cos(level*1.5)-1)*.065);
    const target=center.clone().applyQuaternion(coreRotation),cover=id===0||id===count-1;
    records.push({part:{id},ui:{...assets[id],scale:1},center,target,
      coreSize:new T.Vector3(2.06+.10*Math.cos(level*Math.PI/2),1.37+.12*Math.cos(level*Math.PI/2),cover?.076:.041),
      start:new T.Vector3(),floatingStart:new T.Vector3(),size:new T.Vector3(),rotation:new T.Quaternion(),floatingRotation:new T.Quaternion(),
      pose:new T.Vector3(),poseRotation:new T.Quaternion(),panelSize:new T.Vector3(),arc:new T.Vector3(),delay:0,unit:0,speed:1});
    poses.push({x:0,y:0,z:0,rx:0,ry:0,rz:0,ui:1});
  }
  // Enough subdivisions for smooth rounded edges and a broad sheet bend.
  // Ten core surfaces stay invisible throughout the initial PNG scene.
  const template=new T.BoxGeometry(1,1,1,compact?20:28,compact?12:18,4),per=template.attributes.position.count,total=per*count;
  const positions=new Float32Array(total*3),normals=new Float32Array(total*3),ids=new Float32Array(total);
  const indices=new Uint32Array(template.index.count*count);
  for(let id=0;id<count;id++){
    positions.set(template.attributes.position.array,id*per*3);normals.set(template.attributes.normal.array,id*per*3);ids.fill(id,id*per,(id+1)*per);
    for(let j=0;j<template.index.count;j++)indices[id*template.index.count+j]=template.index.array[j]+id*per;
  }
  template.dispose();
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('normal',new T.BufferAttribute(normals,3));geometry.setAttribute('aModule',new T.BufferAttribute(ids,1));geometry.setIndex(new T.BufferAttribute(indices,1));
  const texture=new T.Texture(image);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;texture.needsUpdate=true;
  const uniforms={uProgress:{value:0},uTime:{value:0},uPortraitSize:{value:5},uPortraitCenter:{value:centerV},
    uPortrait:{value:texture},uPose:{value:records.map(r=>r.pose)},uPanelSize:{value:records.map(r=>r.panelSize)},uPoseRotation:{value:records.map(r=>r.poseRotation)},
    uStart:{value:records.map(r=>r.floatingStart)},uSize:{value:records.map(r=>r.size)},uRotation:{value:records.map(r=>r.floatingRotation)},
    uHandoff:{value:new Float32Array(count)}};
  const material=new T.MeshPhysicalMaterial({color:0xf5f4f1,roughness:.29,metalness:.055,clearcoat:.28,clearcoatRoughness:.25,envMap:environment,envMapIntensity:.62,transparent:true,depthWrite:true});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=`
      attribute float aModule;uniform float uProgress,uPortraitSize,uPortraitCenter;
      uniform vec3 uPose[${count}],uPanelSize[${count}];uniform vec4 uPoseRotation[${count}];
      varying vec2 vPortraitUV;varying float vAssembly,vModule;
      float stage(float p,float a,float b){float t=clamp((p-a)/(b-a),0.,1.);return t*t*t*(t*(t*6.-15.)+10.);}
      vec3 rotateQ(vec3 p,vec4 q){return p+2.*cross(q.xyz,cross(q.xyz,p)+q.w*p);}
      vec3 roundedPanel(vec3 p,vec3 size){
        vec3 point=p*size;float radius=min(size.x,size.y)*.16,bevel=min(size.z*.25,radius*.35);
        vec2 inner=clamp(point.xy,-size.xy*.5+radius,size.xy*.5-radius),delta=point.xy-inner;
        float dz=max(0.,abs(point.z)-(size.z*.5-bevel));
        float edge=radius-bevel+sqrt(max(0.,bevel*bevel-dz*dz));
        if(length(delta)>edge)point.xy=inner+normalize(delta)*edge;
        return point;
      }
      vec3 panelNormal(vec3 p,vec3 size,vec3 base){
        vec3 point=roundedPanel(p,size);float radius=min(size.x,size.y)*.16,bevel=min(size.z*.25,radius*.35);
        vec2 inner=clamp(point.xy,-size.xy*.5+radius,size.xy*.5-radius),delta=point.xy-inner;
        float radial=length(delta);if(radial<radius-bevel-.00001)return base;
        vec3 n=vec3(delta/max(.00001,radial)*max(0.,radial-(radius-bevel)),sign(point.z)*max(0.,abs(point.z)-(size.z*.5-bevel)));
        return dot(n,n)>.00000001?normalize(n):base;
      }
      float arrival(float id){float delay=(1.-id/${count-1}.)*.024;return stage(uProgress,.675+delay,.813+delay);}
      ${shader.vertexShader}`;
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`
      int ni=int(aModule+.5);float landing=arrival(aModule);
      vec4 orient=normalize(mix(uPoseRotation[ni],vec4(0.,0.,0.,1.),stage(uProgress,.61,.79)));
      vec3 objectNormal=normalize(mix(rotateQ(panelNormal(position,uPanelSize[ni],normal),orient),normal,landing));
    `);
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
      int id=int(aModule+.5);float p=uProgress,level=aModule/${count-1}.*2.-1.;
      float opening=stage(p,.56,.685),assembled=arrival(aModule);
      vec4 facing=normalize(mix(uPoseRotation[id],vec4(0.,0.,0.,1.),stage(p,.61,.79)));
      vec3 origin=uPose[id];
      vec3 fan=vec3(sin(level*2.4)*${compact?.43:.90},level*.46,cos(level*2.5)*.46);
      origin+=fan*opening;
      float band=(aModule+.5)/${count}.;
      vec3 destination=vec3(0.,(band-uPortraitCenter)*uPortraitSize,0.);
      vec3 ribbonSize=vec3(uPortraitSize,uPortraitSize/${count}.,.001);
      vec3 panel=roundedPanel(position,uPanelSize[id]);
      vec3 ribbon=vec3(position.xy*ribbonSize.xy,position.z*.045*(1.-stage(p,.81,.87)));
      vec3 sheet=mix(panel,ribbon,stage(p,.65,.825));
      // Sheets peel as broad curved surfaces, then close their seams exactly.
      sheet.z+=sin((position.x+.5)*3.14159265)*sin(opening*3.14159265)*.24;
      vec3 transformed=mix(origin,destination,assembled)+rotateQ(sheet,facing);
      transformed.z+=sin(assembled*3.14159265)*sin(level*2.8)*.38;
      vPortraitUV=vec2(position.x+.5,(aModule+position.y+.5)/${count}.);
      vAssembly=assembled;vModule=aModule;
    `);
    shader.fragmentShader=`uniform sampler2D uPortrait;uniform float uProgress;uniform float uHandoff[${count}];
      varying vec2 vPortraitUV;varying float vAssembly,vModule;
      float stage(float p,float a,float b){float t=clamp((p-a)/(b-a),0.,1.);return t*t*t*(t*(t*6.-15.)+10.);}
      ${shader.fragmentShader}`;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec4 portrait=texture2D(uPortrait,vPortraitUV);
      float resolved=stage(uProgress,.838,.896),detail=stage(uProgress,.805,.878);
      vec4 broad=textureLod(uPortrait,vPortraitUV,mix(4.,0.,detail));
      float pigment=stage(uProgress,.80,.865);
      diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(dot(broad.rgb,vec3(.2126,.7152,.0722))),broad.rgb,detail),pigment*.94);
      float silhouette=stage(vAssembly,.70,1.);
      float body=uHandoff[int(vModule+.5)];
      diffuseColor.a=mix(1.,portrait.a,silhouette)*body;
      if(diffuseColor.a<.004)discard;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>',`
      #include <tonemapping_fragment>
      gl_FragColor.rgb=mix(gl_FragColor.rgb,portrait.rgb,resolved);
    `);
  };
  material.customProgramCacheKey=()=>`continuous-interface-sheets-${count}-v1`;
  const mesh=new T.Mesh(geometry,material);mesh.name='continuous-interface-sheets';mesh.frustumCulled=false;
  const group=new T.Group();group.add(mesh);
  const visuals=createHeroPNGVisuals(T,group,assets);
  const drift=new T.Quaternion();
  const quat=new T.Quaternion(),euler=new T.Euler(),point=new T.Vector3();
  const halton=(i,base)=>{let n=0,f=1;while(i){f/=base;n+=f*(i%base);i=Math.floor(i/base);}return n;};

  // Large data panels anchor the composition; compact controls stay secondary.
  function layout({width,height,header,zones,cameraDistance,worldHeight,centerX,centerY}){
    const placed=[],minY=header+30;
    for(let i=0;i<count;i++){
      const r=records[i],depth=cameraDistance*(compact?1:r.ui.depth);
      const baseWidth=(compact?Math.min(58,width*.145):Math.min(width*.074,138))*r.ui.optical;
      let best=null;
      for(const fit of [1,.87,.74,.62]){
        const pw=baseWidth*fit,ph=pw*r.ui.h/r.ui.w,pad=compact?7:16;
        for(let j=0;j<280;j++){
          const prefer=r.ui.anchor,x=j===0&&!compact?width*prefer[0]:pad+pw*.6+halton(j+1+i*19,2)*(width-2*pad-pw*1.2);
          const y=j===0&&!compact?height*prefer[1]:minY+ph*.6+halton(j+1+i*19,3)*(height-minY-pad-ph*1.2);
          if(x-pw*.62<8||x+pw*.62>width-8||y-ph*.7<header+10||y+ph*.7>height-12)continue;
          if(zones.some(q=>Math.abs(x-q.x)<q.w/2+pw*.57+14&&Math.abs(y-q.y)<q.h/2+ph*.65+16))continue;
          if(placed.some(q=>Math.abs(x-q.x)<(pw+q.w)*.59+pad&&Math.abs(y-q.y)<(ph+q.h)*.64+pad))continue;
          const score=j===0?-10:Math.hypot((x/width-prefer[0])*1.1,y/height-prefer[1]);
          if(!best||score<best.score)best={x,y,w:pw,h:ph,score};
        }
        if(best)break;
      }
      if(!best)best={x:width*(.60+(i%3)*.14),y:minY+(height-minY)*(.2+Math.floor(i/3)/Math.ceil(count/3)*.7),w:baseWidth*.52,h:baseWidth*.52*r.ui.h/r.ui.w};
      placed.push(best);
      const unit=worldHeight/height*depth/cameraDistance,scale=best.w*unit/r.ui.w;
      r.unit=unit;r.speed=cameraDistance/depth;
      r.start.set((best.x-centerX)*unit,(centerY-best.y)*unit,cameraDistance-depth);
      r.size.set(best.w*unit,best.h*unit,.084*scale);r.ui.scale=scale;r.ui.pixelWidth=best.w;
      r.rotation.setFromEuler(euler.set(-.015+Math.sin(i*2.3)*.018,.012+Math.cos(i*1.8)*.018,r.ui.angle));
      r.floatingStart.copy(r.start);r.floatingRotation.copy(r.rotation);
      const distance=Math.hypot(best.x-centerX,best.y-centerY)/Math.hypot(width,height);
      r.delay=.006+(1-distance)*.024+(i%3)*.009;
      const dx=r.target.x-r.start.x,dy=r.target.y-r.start.y,len=Math.hypot(dx,dy)||1,arc=(i%2?1:-1)*Math.min(.82,len*.20);
      r.arc.set(-dy/len*arc,dx/len*arc,(i%4===0?1.00:i%4===1?-.85:.30));
    }
  }

  function update(progress,size,settle,time=0,motion=true){
    uniforms.uProgress.value=progress;uniforms.uTime.value=motion?time:0;uniforms.uPortraitSize.value=size;
    uniforms.uPortraitCenter.value=centerV+(.5-centerV)*settle;
    const floating=motion?1-phase(progress,.12,.31):0;
    for(let i=0;i<count;i++){
      const r=records[i],p=poses[i],t=phase(progress,.14+r.delay,.433+r.delay*.20),s=phase(progress,.235+r.delay,.432+r.delay*.20);
      const clock=time*(.38+(i%4)*.025)*r.speed,seed=i*2.39996;
      r.floatingStart.copy(r.start);
      r.floatingStart.x+=Math.sin(clock*.71+seed)*1.4*r.unit*floating;
      r.floatingStart.y+=(Math.sin(clock+seed)*3.4+Math.sin(clock*.43+seed*1.7)*1.1)*r.unit*floating;
      r.floatingStart.z+=Math.sin(clock*.63+seed)*r.unit*1.5*floating;
      drift.setFromEuler(euler.set(Math.sin(clock*.81+seed)*.009*floating,Math.sin(clock*.67+seed)*.014*floating,Math.sin(clock*.53+seed)*.008*floating));
      r.floatingRotation.copy(r.rotation).multiply(drift);
      point.copy(r.floatingStart).lerp(r.target,t).addScaledVector(r.arc,Math.sin(t*Math.PI));
      point.y+=Math.sin(time*.5+i*.18)*.004*phase(progress,.43,.46)*(1-phase(progress,.56,.59))*(motion?1:0);
      quat.copy(r.floatingRotation).slerp(panelRotation,s);euler.setFromQuaternion(quat);
      r.pose.copy(point);r.poseRotation.copy(quat);r.panelSize.copy(r.size).lerp(r.coreSize,s);
      uniforms.uHandoff.value[i]=phase(progress,.335+r.delay*.25,.430+r.delay*.18);
      p.x=point.x;p.y=point.y;p.z=point.z;p.rx=euler.x;p.ry=euler.y;p.rz=euler.z;
    }
    visuals.update(records,progress);
  }
  return {group,mesh,layout,update,count,inspect:()=>({modules:count,surfaces:count,vertices:total,triangles:indices.length/3,targets:records.map(r=>({start:r.start.toArray(),center:r.target.toArray(),size:r.size.toArray()}))}),
    dispose(){visuals.dispose();geometry.dispose();material.dispose();texture.dispose();}};
}

