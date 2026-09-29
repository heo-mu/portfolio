// Studio scene lifecycle and input; geometry and deterministic motion are separate.
const host=document.getElementById('hero-object');
if(host) startObject(host).catch(()=>host.classList.remove('is-ready'));

async function startObject(host) {
  if(navigator.connection?.saveData)return;
  const [T,{createStructure,PARTS,retrace},{createContactShadow},{createScatterField}]=await Promise.all([import('./vendor/three.module.js'),import('./hero-structure.js?v=a00c86a7'),import('./hero-shadow.js?v=dc2f0992'),import('./hero-field.js?v=46545e23')]);
  const hero=host.closest('.hero'),anchor=document.getElementById('hero-object-anchor');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const compact=matchMedia('(max-width: 640px)');
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
  renderer.transmissionResolutionScale=.5;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden','true');host.append(renderer.domElement);
  const scene=new T.Scene();
  const camera=new T.PerspectiveCamera(34,1,.1,160);
  const renderCamera=new T.PerspectiveCamera();
  camera.position.set(5.8,4.5,8.5);camera.lookAt(0,-.13,.1);
  scene.add(new T.HemisphereLight(0xf7f7f7,0x535353,.74));
  const key=new T.DirectionalLight(0xffffff,3.8);key.position.set(-3.6,6.8,4.2);
  key.castShadow=true;key.shadow.mapSize.set(compact.matches?1024:2048,compact.matches?1024:2048);
  Object.assign(key.shadow.camera,{left:-3.5,right:3.5,top:3.5,bottom:-3.5,near:.5,far:20});
  key.shadow.radius=3.5;key.shadow.normalBias=.006;key.shadow.bias=-.000045;scene.add(key);
  const fill=new T.DirectionalLight(0xe5e5e5,.85);fill.position.set(4,.5,6);scene.add(fill);
  const rim=new T.DirectionalLight(0xffffff,2.3);rim.position.set(3,4,-4);scene.add(rim);
  // Bake neutral studio softboxes once. Only UI materials use the environment;
  // there are no per-frame reflection captures or additional point lights.
  const studio=new T.Scene();studio.background=new T.Color(.18,.18,.18);
  const softboxGeometry=new T.PlaneGeometry(1,1),softboxes=[];
  for(const [x,y,z,w,h,intensity] of [[-3,5,4,5,3,4],[4,2,1,1.5,5,2.2],[0,4,-5,4,2,3]]){
    const material=new T.MeshBasicMaterial({color:new T.Color().setScalar(intensity),side:T.DoubleSide});
    const plane=new T.Mesh(softboxGeometry,material);plane.position.set(x,y,z);plane.scale.set(w,h,1);plane.lookAt(0,0,0);studio.add(plane);softboxes.push(material);
  }
  const pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(studio,.035,.1,30);
  pmrem.dispose();softboxGeometry.dispose();softboxes.forEach(m=>m.dispose());
  const palette=getComputedStyle(host);
  const sculpture=createStructure(T,{accent:palette.getPropertyValue('--c-neon').trim()||'#C94324',ink:palette.getPropertyValue('--c-ink').trim()||'#1B1C19',environment:environment.texture,transmission:compact.matches?0:.18});scene.add(sculpture.group);
  const field=createScatterField(T,camera,sculpture.group,PARTS);
  // One ground receiver. The directional light still supplies object self-shadow.
  const shadowExclusions=[];
  const contact=createContactShadow(T,renderer,scene,{resolution:compact.matches?256:512,floorY:-2.72});
  renderer.shadowMap.autoUpdate=false;
  let visible=false,dead=false,lost=false,raf=0,last=0,elapsed=0,intro=0;
  // About owns the fade; a fully hidden scene needs no frames after the first.
  let sceneHidden=hero.hasAttribute('data-scene-hidden'),primed=false;
  let hovering=false,aspect=1,layoutDirty=true;
  // Structural phase: opens once after load, then follows scroll (see draw).
  let structure=0,heroTop=0,assemblySpan=1;
  const pageTop=el=>{let y=0;for(let node=el;node;node=node.offsetParent)y+=node.offsetTop;return y;};
  let anchorX=0,anchorY=0,anchorWidth=1,anchorHeight=1;
  const cameraDirection=new T.Vector3(5.8,4.63,8.4).normalize(),cameraTarget=new T.Vector3(0,-.13,.1);
  const neutral={x:0,y:0,z:1.26,nx:0,ny:0,nz:1,strength:0};
  const influence={...neutral},target={...neutral};
  const velocity={x:0,y:0,z:0,nx:0,ny:0,nz:0,strength:0};
  const influenceAxes=Object.keys(velocity);
  const orientation={x:0,y:0},aim={x:0,y:0};
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),hit=new T.Vector3(),hitNormal=new T.Vector3();
  const localRay=new T.Ray(),inverseWorld=new T.Matrix4();
  function stop(){cancelAnimationFrame(raf);raf=0;last=0;}
  function request(){if(!raf&&visible&&(!sceneHidden||!primed)&&!document.hidden&&!dead&&!lost)raf=requestAnimationFrame(draw);}
  function frame(){
    // Scene receding is a CSS presentation transform, not a new camera frame.
    // Recover layout coordinates so refresh during a transition cannot zoom or
    // replan the sculpture around a temporarily scaled bounding rectangle.
    const container=hero.querySelector('.hero__container'),c=container.getBoundingClientRect(),visual=anchor.getBoundingClientRect();
    const sx=c.width/container.offsetWidth,sy=c.height/container.offsetHeight;
    const r={width:hero.clientWidth,height:hero.clientHeight};
    // The cube must be whole before About takes the scene; its colour flip
    // starts once About's top reaches 67% of the viewport.
    const about=document.getElementById('about');heroTop=pageTop(hero);
    assemblySpan=Math.max(1,((about?pageTop(about)-innerHeight*.67:heroTop+r.height*.33)-heroTop)*.9);
    const a={left:container.offsetLeft+(visual.left-c.left)/sx,top:container.offsetTop+(visual.top-c.top)/sy,width:visual.width/sx,height:visual.height/sy};
    anchorX=a.left+a.width/2;anchorY=a.top+a.height/2;anchorWidth=a.width;anchorHeight=a.height;
    const halfH=3.28*Math.max(1,a.height/a.width)*r.height/a.height;
    camera.aspect=aspect;
    camera.position.copy(cameraDirection).multiplyScalar(halfH/Math.tan(camera.fov*Math.PI/360)).add(cameraTarget);
    camera.lookAt(cameraTarget);
    camera.setViewOffset(r.width,r.height,r.width/2-anchorX,r.height/2-anchorY,r.width,r.height);
    camera.updateMatrixWorld();sculpture.group.updateMatrixWorld(true);
    const measure=document.createElement('canvas').getContext('2d');
    const safeZones=[...hero.querySelectorAll('.hero__identity,h1 .type-mask,.hero__aside > p,.hero__aside > a')].map(el=>{
      // Layout coordinates ignore GSAP's transient entrance/scroll transforms.
      let x=0,y=0,node=el;
      while(node&&node!==hero){x+=node.offsetLeft;y+=node.offsetTop;node=node.offsetParent;}
      const heading=el.classList.contains('type-mask'),textStyle=getComputedStyle(el.firstElementChild||el);
      let textWidth=el.offsetWidth;
      if(heading&&measure){
        measure.font=textStyle.font;
        const tracking=parseFloat(textStyle.letterSpacing)||0;
        const label=el.textContent.trim();
        textWidth=Math.min(textWidth,measure.measureText(label).width+tracking*(label.length-1)+12);
      }
      // Protect the resting text only. Transit and scroll travel remain unconstrained.
      return {x:x+textWidth/2,y:y+el.offsetHeight/2,w:textWidth+12,h:el.offsetHeight+12,headline:heading};
    });
    const header=document.getElementById('nav');
    // Header height is constant in stage coordinates. Subtracting the scrolling
    // stage's viewport top here used to push every target downward on scroll.
    field.configure(r.width,r.height,{x:anchorX,y:anchorY,top:a.top,bottom:a.top+a.height},safeZones,header.offsetHeight);
    // Project the field's ground footprints, including penumbra, into the
    // original camera frame. Extend only the render window, never the layout
    // or the camera used by the scatter solver and pointer interaction.
    let bottom=r.height;
    const world=new T.Vector3(),ground=new T.Vector3();
    for(const item of field.objects()){
      const depth=item.depth;
      const z=(camera.far+camera.near)/(camera.far-camera.near)-2*camera.far*camera.near/((camera.far-camera.near)*depth);
      world.set(item.x/r.width*2-1,1-item.y/r.height*2,z).unproject(camera);
      const margin=item.r*2*depth/(r.height*camera.projectionMatrix.elements[5])+1;
      for(const dx of [-margin,margin])for(const dz of [-margin,margin]){
        ground.set(world.x+dx,-2.72,world.z+dz).project(camera);
        if(ground.z<1)bottom=Math.max(bottom,(1-ground.y)*r.height/2);
      }
    }
    const renderHeight=Math.ceil(bottom+32);
    host.style.height=renderHeight+'px';
    renderCamera.copy(camera);
    renderCamera.setViewOffset(r.width,r.height,r.width/2-anchorX,r.height/2-anchorY,r.width,renderHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,compact.matches?1.25:1.5,Math.sqrt(2800000/(r.width*renderHeight))));
    renderer.setSize(r.width,renderHeight,false);
    layoutDirty=false;
  }
  function draw(now){
    raf=0;
    const delta=last?Math.min((now-last)/1000,.06):0;
    if(last&&compact.matches&&delta<1/30){request();return;}
    last=now;elapsed+=delta;intro=Math.min(1,intro+delta/.85);
    const response=1-Math.exp(-delta*10);
    orientation.x+=(aim.x-orientation.x)*response;orientation.y+=(aim.y-orientation.y)*response;
    const float=reduce.matches?0:Math.sin(elapsed*1.3)*.036;
    sculpture.group.position.y=reduce.matches?0:float-Math.pow(1-intro,3)*.10;
    sculpture.group.rotation.set(reduce.matches?0:orientation.x+Math.sin(elapsed*.52)*.007,
      reduce.matches?0:orientation.y+Math.sin(elapsed*.39)*.009,reduce.matches?0:Math.sin(elapsed*.47)*.004);
    if(layoutDirty)frame();
    sculpture.group.updateMatrixWorld(true);field.begin();
    // Pointer coordinates stay in sculpture space as the mass tilts and floats.
    if(hovering&&!reduce.matches){
      camera.updateMatrixWorld();sculpture.group.updateMatrixWorld(true);
      raycaster.setFromCamera(pointer,camera);inverseWorld.copy(sculpture.group.matrixWorld).invert();
      localRay.copy(raycaster.ray).applyMatrix4(inverseWorld);
      if(sculpture.pickSurface(localRay,hit,hitNormal)){
        const acquired=target.strength===0&&influence.strength<.02;
        Object.assign(target,{x:hit.x,y:hit.y,z:hit.z,nx:hitNormal.x,ny:hitNormal.y,nz:hitNormal.z,strength:1});
        // Start the pop-out at the actual hit, not at the last hover's location.
        if(acquired)for(const axis of influenceAxes)if(axis!=='strength'){influence[axis]=target[axis];velocity[axis]=0;}
      }else target.strength=0;
    }
    const steps=Math.max(1,Math.ceil(delta/.008)),dt=delta/steps;
    for(let i=0;i<steps;i++)for(const axis of influenceAxes){
      velocity[axis]+=((target[axis]-influence[axis])*760-velocity[axis]*55)*dt;
      influence[axis]+=velocity[axis]*dt;
    }
    // The kit opens once after load, then holds its dispersed plateau. Scroll
    // alone retraces the departure lanes into the cube and releases it again
    // in reverse; the ambient clock keeps the held modules floating.
    const assembly=Math.min(1,Math.max(0,(scrollY-heroTop)/assemblySpan));
    const goal=Math.min(elapsed,retrace(assembly));
    structure+=(goal-structure)*(1-Math.exp(-delta*12));
    sculpture.update(reduce.matches?0:structure,influence,reduce.matches?undefined:field,elapsed);
    const scatter=sculpture.spread;
    const shadowExtent=3.5+scatter*12;
    Object.assign(key.shadow.camera,{left:-shadowExtent,right:shadowExtent,top:shadowExtent,bottom:-shadowExtent});
    key.shadow.camera.updateProjectionMatrix();
    // Capture the just-updated instances on every rendered frame. No old pose or
    // separately throttled ground layer can remain during a return/hover transition.
    contact.update(shadowExclusions,float,scatter);renderer.shadowMap.needsUpdate=true;
    renderer.render(scene,renderCamera);host.classList.add('is-ready');primed=true;
    if(!reduce.matches)request();
  }
  function resize(){
    const w=hero.clientWidth,h=hero.clientHeight;if(!w||!h)return;
    const shadowSize=compact.matches?1024:2048;
    if(key.shadow.mapSize.x!==shadowSize){key.shadow.mapSize.set(shadowSize,shadowSize);key.shadow.map?.dispose();key.shadow.map=null;}
    contact.resize(compact.matches?256:512);
    aspect=w/h;frame();request();
  }
  function move(e){
    if(reduce.matches||e.pointerType==='touch')return;
    const r=host.getBoundingClientRect();
    if(e.target.closest('a,button')){reset();return;}
    const u=(e.clientX-r.left)/hero.clientWidth,v=(e.clientY-r.top)/hero.clientHeight;
    pointer.set(u*2-1,-v*2+1);
    hovering=true;aim.x=Math.max(-1,Math.min(1,(v*hero.clientHeight-anchorY)/(anchorHeight*.5)))*.24;aim.y=Math.max(-1,Math.min(1,(u*hero.clientWidth-anchorX)/(anchorWidth*.5)))*.36;request();
  }
  function reset(){hovering=false;aim.x=aim.y=0;target.strength=0;request();}
  function mode(){reset();orientation.x=orientation.y=0;Object.assign(target,neutral);Object.assign(influence,neutral);influenceAxes.forEach(axis=>velocity[axis]=0);stop();resize();}
  function visibility(){document.hidden?stop():request();}
  function sceneChange(){sceneHidden=hero.hasAttribute('data-scene-hidden');sceneHidden?stop():request();}
  function contextLost(e){e.preventDefault();lost=true;stop();host.classList.remove('is-ready');}
  function contextRestored(){lost=false;resize();}
  const io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;visible?request():stop();});io.observe(host);
  const ro=new ResizeObserver(resize);ro.observe(hero);ro.observe(anchor);
  hero.addEventListener('pointermove',move,{passive:true});hero.addEventListener('pointerleave',reset);hero.addEventListener('pointercancel',reset);
  function refreshLayout(){layoutDirty=true;request();}
  const introTimer=setTimeout(refreshLayout,2600);
  document.fonts?.ready.then(()=>{if(!dead)refreshLayout();});
  reduce.addEventListener('change',mode);compact.addEventListener('change',mode);
  document.addEventListener('visibilitychange',visibility);hero.addEventListener('heroscenechange',sceneChange);
  renderer.domElement.addEventListener('webglcontextlost',contextLost);renderer.domElement.addEventListener('webglcontextrestored',contextRestored);
  function pageShow(){resize();}
  function cleanup(e){
    stop();if(e.persisted)return;dead=true;
    io.disconnect();ro.disconnect();hero.removeEventListener('pointermove',move);hero.removeEventListener('pointerleave',reset);hero.removeEventListener('pointercancel',reset);
    clearTimeout(introTimer);
    reduce.removeEventListener('change',mode);compact.removeEventListener('change',mode);
    document.removeEventListener('visibilitychange',visibility);hero.removeEventListener('heroscenechange',sceneChange);removeEventListener('pageshow',pageShow);removeEventListener('pagehide',cleanup);
    renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.domElement.removeEventListener('webglcontextrestored',contextRestored);
    sculpture.dispose();environment.dispose();contact.dispose();key.shadow.dispose();renderer.dispose();renderer.domElement.remove();
  }
  addEventListener('pagehide',cleanup);addEventListener('pageshow',pageShow);resize();
}
