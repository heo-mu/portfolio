import {phase} from './hero-sequence.js?v=4';

// Dimensions are local UI units, independent of screen placement and core targets.
export const PRODUCT_UI=Object.freeze([
  {name:'pointer',w:.62,h:.78,tier:2,standalone:true},
  {name:'progress-ring',w:.64,h:.64,tier:1,standalone:true},
  {name:'toggle-status',w:.68,h:.32,tier:1},
  {name:'image-picker',w:.66,h:.54,tier:2},
  {name:'layer-panel',w:.66,h:.76,tier:1,standalone:true},
  {name:'line-chart',w:.84,h:.56,tier:2},
  {name:'calendar',w:.58,h:.64,tier:1},
  {name:'search-field',w:1.02,h:.25,tier:0},
  {name:'avatar-group',w:.72,h:.32,tier:1},
  {name:'checkbox',w:.42,h:.42,tier:0},
  {name:'segmented',w:.81,h:.32,tier:1},
  {name:'slider-range',w:.94,h:.25,tier:0},
  {name:'arrow-button',w:.58,h:.30,tier:0},
  {name:'menu-button',w:.42,h:.42,tier:0}
]);

export function createProductUI(T,owner,environment,profiles){
  const root=new T.Group();root.name='product-ui-visuals';owner.add(root);
  const parents=profiles.map(()=>new T.Object3D()),frames={value:parents.map(p=>p.matrix)};
  const materials={
    white:new T.MeshPhysicalMaterial({color:0xf9f8f5,roughness:.27,metalness:.025,clearcoat:.34,clearcoatRoughness:.24}),
    inset:new T.MeshPhysicalMaterial({color:0xe2e1de,roughness:.49,metalness:.02}),
    gray:new T.MeshPhysicalMaterial({color:0xb8b7b4,roughness:.43,metalness:.03}),
    ink:new T.MeshPhysicalMaterial({color:0x242523,roughness:.40,metalness:.04,clearcoat:.12,clearcoatRoughness:.4}),
    orange:new T.MeshPhysicalMaterial({color:0xcd5235,roughness:.32,metalness:.015,clearcoat:.20,clearcoatRoughness:.32}),
    glass:new T.MeshPhysicalMaterial({color:0xf7f6f3,roughness:.16,metalness:0,transmission:.78,thickness:.085,ior:1.42,clearcoat:.25,clearcoatRoughness:.20})
  };
  Object.values(materials).forEach(m=>{m.envMap=environment;m.envMapIntensity=.65;});
  materials.contact=new T.ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{uUIFrame:frames},
    vertexShader:`attribute float aModule;uniform mat4 uUIFrame[${profiles.length}];varying vec2 vUV;void main(){vUV=uv;gl_Position=projectionMatrix*modelViewMatrix*uUIFrame[int(aModule+.5)]*vec4(position,1.);}`,
    fragmentShader:'varying vec2 vUV;void main(){vec2 d=abs(vUV-.5)*2.;float a=(1.-smoothstep(.5,1.,max(d.x,d.y)))*.12;gl_FragColor=vec4(.16,.15,.14,a);}'});
  const geometryCache=new Map(),buckets=new Map();
  const local=new T.Object3D();
  const cache=(key,build)=>{if(!geometryCache.has(key))geometryCache.set(key,build());return geometryCache.get(key);};
  function rounded(w,h,d,r=Math.min(w,h)*.12){
    r=Math.min(r,Math.min(w,h)*.49);const bevel=Math.min(.023,d*.23,r*.30);
    return cache(`rect/${w}/${h}/${d}/${r}`,()=>{
      const x=w/2-bevel,y=h/2-bevel,a=Math.max(.001,r-bevel),s=new T.Shape();
      s.moveTo(-x+a,-y);s.lineTo(x-a,-y);s.quadraticCurveTo(x,-y,x,-y+a);s.lineTo(x,y-a);s.quadraticCurveTo(x,y,x-a,y);s.lineTo(-x+a,y);s.quadraticCurveTo(-x,y,-x,y-a);s.lineTo(-x,-y+a);s.quadraticCurveTo(-x,-y,-x+a,-y);
      const g=new T.ExtrudeGeometry(s,{depth:d-2*bevel,steps:1,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:5,curveSegments:12});g.translate(0,0,-d/2+bevel);return g;
    });
  }
  function disk(r,d){return cache(`disk/${r}/${d}`,()=>{const g=new T.CylinderGeometry(r,r,d,48,1);g.rotateX(Math.PI/2);return g;});}
  function outline(points,depth=.016){
    return cache(`outline/${JSON.stringify(points)}/${depth}`,()=>{
      const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();
      const b=Math.min(.019,depth*.22),g=new T.ExtrudeGeometry(s,{depth:depth-2*b,bevelEnabled:true,bevelSize:b,bevelThickness:b,bevelSegments:5,curveSegments:12});g.translate(0,0,-depth/2+b);return g;
    });
  }
  function tube(points,r=.011,curved=false){
    return cache(`stroke/${JSON.stringify(points)}/${r}/${curved}`,()=>{
      const v=points.map(([x,y])=>new T.Vector3(x,y,0));let curve;
      if(curved)curve=new T.CatmullRomCurve3(v,false,'centripetal');
      else {curve=new T.CurvePath();for(let i=1;i<v.length;i++)curve.add(new T.LineCurve3(v[i-1],v[i]));}
      return new T.TubeGeometry(curve,curved?64:Math.max(12,points.length*8),r,8,false);
    });
  }
  const ring=(r,thickness=.014,arc=Math.PI*2)=>cache(`ring/${r}/${thickness}/${arc}`,()=>new T.TorusGeometry(r,thickness,12,64,arc));
  function add(id,g,tone,x=0,y=0,z=0,rotation=0){
    const key=g.uuid+'/'+tone;if(!buckets.has(key))buckets.set(key,{geometry:g,material:materials[tone],items:[]});
    local.position.set(x,y,z);local.rotation.set(0,0,rotation);local.scale.set(1,1,1);local.updateMatrix();
    buckets.get(key).items.push({id,matrix:local.matrix.clone()});
  }
  for(let id=0;id<profiles.length;id++){
    const p=profiles[id];
    // The continuous surface owns casings; this batch carries only raised controls.
    const contact=(x,y,w,h)=>add(id,cache(`contact/${w}/${h}`,()=>new T.PlaneGeometry(w+.03,h+.03)),'contact',x+.003,y-.008,.046);
    const box=(x,y,w,h,tone='inset',z=.066,d=.026,r=.012)=>{if(d>.025&&h>.04)contact(x,y,w,h);add(id,rounded(w,h,d,r),tone,x,y,z);};
    const dot=(x,y,r,tone='orange',z=.073,d=.028)=>{if(r>.025)contact(x,y,r*2,r*2);add(id,disk(r,d),tone,x,y,z);};
    const stroke=(points,tone='ink',width=.018,z=.074,curved=false)=>add(id,tube(points,width/2,curved),tone,0,0,z);
    const arrow=(x,y,tone='orange')=>add(id,outline([[-.071,-.011],[.017,-.011],[-.014,-.043],[.001,-.058],[.060,0],[.001,.058],[-.014,.043],[.017,.011],[-.071,.011]]),tone,x,y,.077);
    const check=(x,y,tone='white',scale=1)=>stroke([[x-.027*scale,y],[x-.006*scale,y-.023*scale],[x+.034*scale,y+.025*scale]],tone,.016*scale,.125);
    switch(p.name){
      case 'pointer': {
        const cursor=[[-.26,.35],[-.24,-.26],[-.085,-.12],[.065,-.34],[.19,-.265],[.035,-.04],[.265,-.01]];
        add(id,outline(cursor,.12),'white',0,0,0);
        add(id,outline(cursor.map(([x,y])=>[x*.79,y*.79]),.045),'ink',0,.012,.075);
        break;
      }
      case 'progress-ring':
        add(id,ring(.235,.060),'white',0,0,0);
        add(id,ring(.235,.061,Math.PI*1.25),'orange',0,0,.007,Math.PI*.24);break;
      case 'toggle-status':
        box(0,0,.48,.20,'inset',.069,.045,.098);
        box(.075,0,.30,.172,'orange',.081,.048,.084);
        add(id,rounded(.154,.154,.060,.077),'white',.148,0,.116);break;
      case 'image-picker':
        add(id,outline([[-.20,-.14],[-.085,.085],[-.01,-.035],[.085,.135],[.225,-.14]],.047),'gray',0,-.005,.079);
        dot(.165,.142,.036,'orange',.087,.035);break;
      case 'layer-panel':
        for(let n=0;n<3;n++)add(id,rounded(.40,.40,.066,.062),n===2?'inset':'white',0,(n-1)*.08,n*.054,Math.PI/4);break;
      case 'line-chart':
        [-.30,-.24,-.18].forEach((x,i)=>dot(x,.195,.015,i?'gray':'orange',.062,.018));
        stroke([[-.29,-.14],[-.18,-.08],[-.09,.08],[.06,-.025],[.19,.12],[.29,.17]],'orange',.032,.087,true);break;
      case 'calendar':
        [-.17,.17].forEach(x=>box(x,.275,.037,.092,'gray',.061,.041,.017));
        for(let y=0;y<3;y++)for(let x=0;x<3;x++)box(-.16+x*.16,.105-y*.135,.079,.075,y===1&&x===2?'orange':'inset',.069,.035,.020);break;
      case 'search-field':
        add(id,ring(.040,.011),'ink',-.366,.007,.074);stroke([[-.337,-.023],[-.306,-.055]],'ink',.022,.074);
        box(.045,0,.40,.024,'inset');break;
      case 'avatar-group':
        [-.15,.15].forEach((x,i)=>{dot(x,0,.101,i?'inset':'gray',.075,.043);dot(x,.025,.032,'white',.106,.023);add(id,outline([[-.06,-.064],[-.052,-.029],[-.024,-.014],[.024,-.014],[.052,-.029],[.06,-.064]],.019),'white',x,0,.107);});break;
      case 'checkbox':
        box(0,0,.245,.245,'orange',.079,.059,.051);check(0,0,'white',2.05);break;
      case 'segmented':
        [-.25,0,.25].forEach((x,i)=>box(x,0,.20,.17,i===1?'orange':'inset',.071,.047,.044));break;
      case 'slider-range':
        box(0,0,.73,.023,'inset');box(-.245,0,.24,.026,'orange');
        add(id,rounded(.082,.118,.058,.035),'white',-.115,0,.101);break;
      case 'arrow-button':
        add(id,outline([[-.15,-.022],[.07,-.022],[.007,-.085],[.041,-.118],[.16,0],[.041,.118],[.007,.085],[.07,.022],[-.15,.022]],.040),'orange',0,0,.077);break;
      case 'menu-button':
        [-.077,0,.077].forEach(y=>box(0,y,.22,.025,'ink',.071,.037,.012));break;
    }
  }

  // Merge by material, with the module's matrix selected on the GPU. Hundreds of
  // small bevels/icons still use only six surface draws plus contact.
  const byMaterial=new Map();
  for(const b of buckets.values()){
    if(!byMaterial.has(b.material))byMaterial.set(b.material,[]);
    for(const item of b.items){const g=b.geometry.index?b.geometry.toNonIndexed():b.geometry.clone();g.applyMatrix4(item.matrix);byMaterial.get(b.material).push({g,id:item.id});}
  }
  const batches=[];
  for(const [material,pieces] of byMaterial){
    const total=pieces.reduce((n,p)=>n+p.g.attributes.position.count,0),position=new Float32Array(total*3),normal=new Float32Array(total*3),uv=new Float32Array(total*2),ids=new Float32Array(total);
    let offset=0;for(const {g,id} of pieces){const n=g.attributes.position.count;position.set(g.attributes.position.array,offset*3);normal.set(g.attributes.normal.array,offset*3);uv.set(g.attributes.uv.array,offset*2);ids.fill(id,offset,offset+n);offset+=n;g.dispose();}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(position,3));geometry.setAttribute('normal',new T.BufferAttribute(normal,3));geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.setAttribute('aModule',new T.BufferAttribute(ids,1));
    if(material!==materials.contact){
      material.onBeforeCompile=shader=>{shader.uniforms.uUIFrame=frames;shader.vertexShader=`attribute float aModule;uniform mat4 uUIFrame[${profiles.length}];\n`+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','vec3 objectNormal=mat3(uUIFrame[int(aModule+.5)])*normal;').replace('#include <begin_vertex>','vec3 transformed=(uUIFrame[int(aModule+.5)]*vec4(position,1.)).xyz;');};
      material.customProgramCacheKey=()=>`product-ui-surface-${profiles.length}`;
    }
    const mesh=new T.Mesh(geometry,material);mesh.name='product-ui-solid';mesh.frustumCulled=false;root.add(mesh);batches.push({mesh,geometry});
  }
  function update(poses,records,progress){
    root.visible=progress<.40;if(!root.visible)return;
    records.forEach((r,i)=>{
      const p=poses[i],fold=phase(progress,.255+r.delay,.36+r.delay*.3),scale=r.ui.scale*Math.max(.00001,1-fold),parent=parents[i];
      parent.position.set(p.x,p.y,p.z);parent.rotation.set(p.rx,p.ry,p.rz);parent.scale.setScalar(scale);parent.updateMatrix();
    });

  }
  return {update,dispose(){batches.forEach(b=>b.geometry.dispose());geometryCache.forEach(g=>g.dispose());Object.values(materials).forEach(m=>m.dispose());owner.remove(root);}};
}
