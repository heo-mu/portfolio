// A shallow, sampled relief made only from the supplied portrait pixels.
const host = document.getElementById('portrait-stage');
if (host) {
  const start=()=>initPortrait(host).catch(()=>host.classList.remove('is-ready','is-assembling'));
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)host.classList.add('is-assembling');
  if('IntersectionObserver' in window){const loader=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){loader.disconnect();start();}},{rootMargin:'320px'});loader.observe(host);}else start();
}
async function initPortrait(host) {
  const THREE=await import('./vendor/three.module.js');
  const image=host.querySelector('img');if(!image)return;await image.decode();
  const reduce=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
  let renderer;try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:true});}catch{host.classList.remove("is-assembling");return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden','true');host.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,20);camera.position.z=5.1;
  const group=new THREE.Group();scene.add(group);
  const texture=new THREE.Texture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
  const sampling=document.createElement('canvas');sampling.width=sampling.height=128;
  const context=sampling.getContext('2d',{willReadFrequently:true});if(!context){texture.dispose();renderer.dispose();renderer.domElement.remove();host.classList.remove("is-assembling");return;}
  context.drawImage(image,0,0,128,128);const rgba=context.getImageData(0,0,128,128).data;
  // Each tile retains the original 96-by-96 relief lattice at rest.
  const tileCount=matchMedia('(max-width: 640px)').matches?16:24;
  const geometry=createPortraitTiles(THREE,rgba,tileCount);
  const uniforms={uImage:{value:texture},uPointer:{value:new THREE.Vector2(.5,.5)},uStrength:{value:0},uAssembly:{value:reduce.matches?1:(host.__portraitProgress??1)},uGhost:{value:0}};
  const vertexShader=`uniform vec2 uPointer;uniform float uStrength;uniform float uAssembly;
    attribute vec2 aCenter;attribute vec3 aOffset;attribute float aDelay;
    varying vec2 vUv;varying vec2 vCenter;varying float vGather;varying float vSeed;
    void main(){
      vUv=uv;vCenter=aCenter;vSeed=step(.78,fract(aCenter.x*7.0+aCenter.y*11.0));
      float localProgress=clamp((uAssembly-aDelay)/(1.0-aDelay),0.0,1.0);
      float gather=localProgress*localProgress*(3.0-2.0*localProgress);vGather=gather;
      float remaining=1.0-gather;
      vec3 p=position;vec2 center=(aCenter-.5)*2.85;
      p.xy=center+(p.xy-center)*mix(.42,1.0,gather);
      p+=aOffset*remaining;
      // One coherent, shallow curved current; depth collapses into the relief.
      p.x+=sin(localProgress*3.14159265)*aOffset.y*.18;
      p.y+=sin(localProgress*3.14159265)*.035;
      float local=exp(-dot(uv-uPointer,uv-uPointer)*22.0)*uStrength;
      p.z+=local*.15;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
    }`;
  const fragmentShader=`uniform sampler2D uImage;uniform vec2 uPointer;uniform float uStrength;uniform float uAssembly;uniform float uGhost;varying vec2 vUv;varying vec2 vCenter;varying float vGather;varying float vSeed;
    void main(){
      if(vGather<.002&&vSeed<.5)discard;
      float local=exp(-dot(vUv-uPointer,vUv-uPointer)*24.0)*uStrength;
      vec2 resolvedUv=mix(vUv,(floor(vUv*210.0)+.5)/210.0,.5);
      vec2 sampleUv=mix(vCenter,resolvedUv,smoothstep(.42,.96,vGather));
      vec4 source=texture2D(uImage,sampleUv);if(source.a<.08)discard;
      float shift=.0015*local;
      vec3 c=vec3(texture2D(uImage,sampleUv+vec2(shift,0.)).r,source.g,texture2D(uImage,sampleUv-vec2(shift,0.)).b);
      float gray=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(gray),c,.64);
      float cell=step(.12,fract(vUv.x*210.0))*step(.12,fract(vUv.y*210.0));
      c*=.85+.15*cell;c+=vec3(.055,.068,.025)*local;
      if(uGhost>.5){float screen=step(.74,fract(vUv.y*125.0));c=vec3(.36,.45,.20);source.a*=screen*.22*smoothstep(.94,1.0,uAssembly);}
      gl_FragColor=vec4(c,source.a*max(.14*vSeed*(1.0-vGather),smoothstep(.0,.22,vGather)));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  const material=new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,transparent:true,side:THREE.DoubleSide});
  const face=new THREE.Mesh(geometry,material);group.add(face);
  const ghostUniforms={...uniforms,uGhost:{value:1}};
  const ghostMaterial=new THREE.ShaderMaterial({uniforms:ghostUniforms,vertexShader,fragmentShader,transparent:true,depthWrite:false,side:THREE.DoubleSide});
  const ghost=new THREE.Mesh(geometry,ghostMaterial);ghost.position.set(-.11,.055,-.22);ghost.rotation.y=-.08;group.add(ghost);
  let frame=0,last=0,visible=false,disposed=false,lost=false,tx=-.045,ty=.025,strength=0,width=0,height=0,assembly=reduce.matches?1:(host.__portraitProgress??1);
  const stop=()=>{cancelAnimationFrame(frame);frame=last=0;};
  const request=()=>{if(visible&&!document.hidden&&!disposed&&!lost&&!frame)frame=requestAnimationFrame(draw);};
  function draw(time){
    frame=0;if(!visible||document.hidden||disposed||lost)return;
    const dt=last?Math.min(40,time-last):16.67;last=time;const mix=1-Math.exp(-dt/110);
    group.rotation.y+=(tx-group.rotation.y)*mix;group.rotation.x+=(ty-group.rotation.x)*mix;
    uniforms.uStrength.value+=(strength-uniforms.uStrength.value)*mix;
    uniforms.uAssembly.value=assembly;ghost.visible=assembly>=.94;
    host.closest(".portrait")?.style.setProperty("--portrait-rest",String(Math.max(0,Math.min(1,(assembly-.72)/.28))));
    ghost.position.x=-.11-group.rotation.y*.25;
    renderer.render(scene,camera);host.classList.add('is-ready');
    if(Math.abs(tx-group.rotation.y)+Math.abs(ty-group.rotation.x)+Math.abs(strength-uniforms.uStrength.value)>.001)request();else last=0;
  }
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(w<1||h<1||w===width&&h===height)return;width=w;height=h;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();request();};
  const reset=()=>{tx=-.045;ty=.025;strength=0;if(reduce.matches){assembly=1;group.rotation.set(ty,tx,0);uniforms.uStrength.value=0;}request();};
  const move=e=>{if(reduce.matches||assembly<1||!fine.matches||e.pointerType==='touch')return;const r=host.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;tx=(x-.5)*.3-.045;ty=(y-.5)*.2+.025;uniforms.uPointer.value.set(x,1-y);strength=1;request();};
  host.addEventListener('pointermove',move,{passive:true});host.addEventListener('pointerleave',reset);reduce.addEventListener('change',reset);fine.addEventListener('change',reset);
  const syncAssembly=()=>{
    assembly=reduce.matches?1:Math.max(0,Math.min(1,host.__portraitProgress??1));
    uniforms.uAssembly.value=assembly;
    if(assembly<1){tx=-.045;ty=.025;strength=0;}
    request();
  };
  host.addEventListener('portraitprogress',syncAssembly);
  reduce.addEventListener('change',syncAssembly);
  const visibility=()=>document.hidden?stop():syncAssembly();document.addEventListener('visibilitychange',visibility);
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){resize();syncAssembly();}else stop();},{rootMargin:'40px'});observer.observe(host);
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);resize();
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;stop();host.classList.remove('is-ready','is-assembling');});renderer.domElement.addEventListener('webglcontextrestored',()=>{lost=false;host.classList.add('is-assembling');syncAssembly();});
  addEventListener('pagehide',e=>{stop();if(e.persisted)return;disposed=true;observer.disconnect();resizeObserver.disconnect();host.removeEventListener('pointermove',move);host.removeEventListener('pointerleave',reset);reduce.removeEventListener('change',reset);fine.removeEventListener('change',reset);document.removeEventListener('visibilitychange',visibility);host.removeEventListener('portraitprogress',syncAssembly);reduce.removeEventListener('change',syncAssembly);host.closest(".portrait")?.style.removeProperty("--portrait-rest");host.classList.remove('is-ready','is-assembling');geometry.dispose();material.dispose();ghostMaterial.dispose();texture.dispose();renderer.dispose();});
  addEventListener('pageshow',()=>{resize();syncAssembly();});
}

function createPortraitTiles(THREE,rgba,count) {
  const positions=[],uvs=[],centers=[],offsets=[],delays=[],indices=[];
  const subdivisions=96/count;
  for(let row=0;row<count;row++)for(let col=0;col<count;col++){
    const cx=(col+.5)/count,cy=1-(row+.5)/count;
    // Face first (above the laptop), then hair/outline and the lower plane.
    const radius=Math.min(1,Math.hypot((cx-.5)*1.65,(cy-.57)*1.35));
    const band=(col+row)%3;
    const delay=.035+radius*.30+band*.035;
    const ox=(cx-.5)*.34+(row/count-.5)*.12;
    const oy=.12+(cy-.5)*.3+band*.025;
    const oz=(band-1)*.13;
    const base=positions.length/3;
    for(let y=0;y<=subdivisions;y++)for(let x=0;x<=subdivisions;x++){
      const u=(col+x/subdivisions)/count,v=1-(row+y/subdivisions)/count;
      const sx=Math.min(127,Math.floor(u*128)),sy=Math.min(127,Math.floor((1-v)*128)),i=(sy*128+sx)*4;
      const brightness=(rgba[i]*.2126+rgba[i+1]*.7152+rgba[i+2]*.0722)/255;
      const dx=u-.5,dy=v-.52;
      const z=(brightness*.13+Math.exp(-(dx*dx+dy*dy)*10)*.2)*(rgba[i+3]/255);
      positions.push((u-.5)*2.85,(v-.5)*2.85,z);uvs.push(u,v);
      centers.push(cx,cy);offsets.push(ox,oy,oz);delays.push(delay);
    }
    for(let y=0;y<subdivisions;y++)for(let x=0;x<subdivisions;x++){
      const i=base+y*(subdivisions+1)+x,j=i+subdivisions+1;
      indices.push(i,j,i+1,j,j+1,i+1);
    }
  }
  const geometry=new THREE.BufferGeometry();
  for(const [name,data,size] of [['position',positions,3],['uv',uvs,2],['aCenter',centers,2],['aOffset',offsets,3],['aDelay',delays,1]])
    geometry.setAttribute(name,new THREE.Float32BufferAttribute(data,size));
  geometry.setIndex(indices);geometry.computeBoundingSphere();
  // Dispersal extends beyond the resting bounds; the host observer gates drawing.
  geometry.boundingSphere.radius+=.5;
  return geometry;
}
