// Studio scene lifecycle and input; geometry and deterministic motion are separate.
const host=document.getElementById('hero-object');
if(host) startObject(host).catch(()=>host.classList.remove('is-ready'));

async function startObject(host) {
  if(navigator.connection?.saveData)return;
  const [T,{createStructure,PARTS},{createContactShadow},{createScatterField}]=await Promise.all([import('./vendor/three.module.js'),import('./hero-structure.js?v=17'),import('./hero-shadow.js?v=4'),import('./hero-field.js?v=10')]);
  const hero=host.closest('.hero'),anchor=document.getElementById('hero-object-anchor');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const compact=matchMedia('(max-width: 640px)');
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden','true');host.append(renderer.domElement);
  const scene=new T.Scene();
  const camera=new T.PerspectiveCamera(34,1,.1,160);
  camera.position.set(5.8,4.5,8.5);camera.lookAt(0,-.13,.1);
  scene.add(new T.HemisphereLight(0xf7f7f5,0x52574e,.74));
  const key=new T.DirectionalLight(0xfffaf2,3.8);key.position.set(-3.6,6.8,4.2);
  key.castShadow=true;key.shadow.mapSize.set(compact.matches?1024:2048,compact.matches?1024:2048);
  Object.assign(key.shadow.camera,{left:-3.5,right:3.5,top:3.5,bottom:-3.5,near:.5,far:20});
  key.shadow.radius=3.5;key.shadow.normalBias=.006;key.shadow.bias=-.000045;scene.add(key);
  const fill=new T.DirectionalLight(0xe1e6ed,.85);fill.position.set(4,.5,6);scene.add(fill);
  const rim=new T.DirectionalLight(0xffffff,2.3);rim.position.set(3,4,-4);scene.add(rim);
  const palette=getComputedStyle(host);
  const sculpture=createStructure(T,{accent:palette.getPropertyValue('--c-neon').trim()||'#C94324',ink:palette.getPropertyValue('--c-ink').trim()||'#1B1C19'});scene.add(sculpture.group);
  const field=createScatterField(T,camera,sculpture.group,PARTS);
  // One ground receiver. The directional light still supplies object self-shadow.
  const shadowExclusions=[];
  const contact=createContactShadow(T,renderer,scene,{resolution:compact.matches?256:512,floorY:-2.72});
  renderer.shadowMap.autoUpdate=false;
  let visible=false,dead=false,lost=false,raf=0,last=0,elapsed=0,intro=0;
  let hovering=false,aspect=1,layoutDirty=true;
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
  function request(){if(!raf&&visible&&!document.hidden&&!dead&&!lost)raf=requestAnimationFrame(draw);}
  function frame(){
    const r=host.getBoundingClientRect(),a=anchor.getBoundingClientRect();
    anchorX=a.left-r.left+a.width/2;anchorY=a.top-r.top+a.height/2;anchorWidth=a.width;anchorHeight=a.height;
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
        textWidth=Math.min(textWidth,measure.measureText(el.textContent.trim()).width+tracking*(el.textContent.trim().length-1)+12);
      }
      // Reserve the headline's existing horizontal scroll travel, not the whole column.
      const scrollRoom=heading?r.width*.012:0;
      return {x:x+textWidth/2,y:y+el.offsetHeight/2,w:textWidth+scrollRoom*2,h:el.offsetHeight+(heading?10:18)};
    });
    const header=document.getElementById('nav');
    // Header height is constant in stage coordinates. Subtracting the scrolling
    // stage's viewport top here used to push every target downward on scroll.
    field.configure(r.width,r.height,{x:anchorX,y:anchorY,top:a.top-r.top,bottom:a.bottom-r.top},safeZones,header.offsetHeight);
    layoutDirty=false;
  }
  function draw(now){
    raf=0;
    const delta=last?Math.min((now-last)/1000,.06):0;
    if(last&&compact.matches&&delta<1/30){request();return;}
    last=now;elapsed+=delta;intro=Math.min(1,intro+delta/.85);
    const sceneTime=reduce.matches?0:elapsed;
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
    sculpture.update(sceneTime,influence,reduce.matches?undefined:field);
    const scatter=sculpture.spread;
    const shadowExtent=3.5+scatter*12;
    Object.assign(key.shadow.camera,{left:-shadowExtent,right:shadowExtent,top:shadowExtent,bottom:-shadowExtent});
    key.shadow.camera.updateProjectionMatrix();
    // Capture the just-updated instances on every rendered frame. No old pose or
    // separately throttled ground layer can remain during a return/hover transition.
    contact.update(shadowExclusions,float,scatter);renderer.shadowMap.needsUpdate=true;
    renderer.render(scene,camera);host.classList.add('is-ready');
    if(!reduce.matches)request();
  }
  function resize(){
    const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
    const shadowSize=compact.matches?1024:2048;
    if(key.shadow.mapSize.x!==shadowSize){key.shadow.mapSize.set(shadowSize,shadowSize);key.shadow.map?.dispose();key.shadow.map=null;}
    contact.resize(compact.matches?256:512);
    // Full-bleed pixel budget is capped independently from viewport size.
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,compact.matches?1.25:1.5,Math.sqrt(2800000/(w*h))));renderer.setSize(w,h,false);
    aspect=w/h;frame();request();
  }
  function move(e){
    if(reduce.matches||e.pointerType==='touch')return;
    const r=host.getBoundingClientRect();
    if(e.target.closest('a,button')){reset();return;}
    pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
    hovering=true;aim.x=Math.max(-1,Math.min(1,(e.clientY-r.top-anchorY)/(anchorHeight*.5)))*.24;aim.y=Math.max(-1,Math.min(1,(e.clientX-r.left-anchorX)/(anchorWidth*.5)))*.36;request();
  }
  function reset(){hovering=false;aim.x=aim.y=0;target.strength=0;request();}
  function mode(){reset();orientation.x=orientation.y=0;Object.assign(target,neutral);Object.assign(influence,neutral);influenceAxes.forEach(axis=>velocity[axis]=0);stop();resize();}
  function visibility(){document.hidden?stop():request();}
  function contextLost(e){e.preventDefault();lost=true;stop();host.classList.remove('is-ready');}
  function contextRestored(){lost=false;resize();}
  const io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;visible?request():stop();});io.observe(host);
  const ro=new ResizeObserver(resize);ro.observe(host);ro.observe(anchor);
  hero.addEventListener('pointermove',move,{passive:true});hero.addEventListener('pointerleave',reset);hero.addEventListener('pointercancel',reset);
  function refreshLayout(){layoutDirty=true;request();}
  const introTimer=setTimeout(refreshLayout,2600);
  document.fonts?.ready.then(()=>{if(!dead)refreshLayout();});
  reduce.addEventListener('change',mode);compact.addEventListener('change',mode);
  document.addEventListener('visibilitychange',visibility);
  renderer.domElement.addEventListener('webglcontextlost',contextLost);renderer.domElement.addEventListener('webglcontextrestored',contextRestored);
  function pageShow(){resize();}
  function cleanup(e){
    stop();if(e.persisted)return;dead=true;
    io.disconnect();ro.disconnect();hero.removeEventListener('pointermove',move);hero.removeEventListener('pointerleave',reset);hero.removeEventListener('pointercancel',reset);
    clearTimeout(introTimer);
    reduce.removeEventListener('change',mode);compact.removeEventListener('change',mode);
    document.removeEventListener('visibilitychange',visibility);removeEventListener('pageshow',pageShow);removeEventListener('pagehide',cleanup);
    renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.domElement.removeEventListener('webglcontextrestored',contextRestored);
    sculpture.dispose();contact.dispose();key.shadow.dispose();renderer.dispose();renderer.domElement.remove();
  }
  addEventListener('pagehide',cleanup);addEventListener('pageshow',pageShow);resize();
}
