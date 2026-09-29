import {phase} from './hero-sequence.js?v=5';

// Motion board (normalized scroll): wide / attraction / service core / separation /
// assembled portrait / editorial. Every position derives from scroll + idle time;
// there is no accumulated simulation state to break reverse scrolling.
export function createHeroEnvironment(T,scene,compact){
  const root=new T.Group();root.name='hero-spatial-environment';scene.add(root);
  const white=new T.Color('#C9C9C5'),charcoal=new T.Color('#777973');
  let width=1,height=1,worldHeight=6.8,distance=11,worldWidth=10;
  const random=i=>{const n=Math.sin(i*127.1+17.3)*43758.5453;return n-Math.floor(n);};
  const amount=compact?70:150,positions=new Float32Array(amount*3),seeds=[];
  const dotsGeometry=new T.BufferGeometry();dotsGeometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
  const dotsMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{color:{value:charcoal.clone()},opacity:{value:.12},pixelRatio:{value:1}},
    vertexShader:'uniform float pixelRatio;varying float vDepth;void main(){vec4 eye=modelViewMatrix*vec4(position,1.);vDepth=clamp(12./-eye.z,.4,1.5);gl_PointSize=clamp(1.6*pixelRatio*vDepth,1.,3.);gl_Position=projectionMatrix*eye;}',
    fragmentShader:'uniform vec3 color;uniform float opacity;varying float vDepth;void main(){float r=length(gl_PointCoord-.5)*2.;float a=(1.-smoothstep(.25,1.,r))*opacity*vDepth;gl_FragColor=vec4(color,a);}'});
  const dots=new T.Points(dotsGeometry,dotsMaterial);dots.frustumCulled=false;root.add(dots);
  const count=compact?9:18,fragmentGeometry=new T.BoxGeometry(1,1,1),fragmentMaterial=new T.MeshStandardMaterial({color:0xb1b2ac,roughness:.62,metalness:.12,transparent:true,opacity:.15,depthWrite:false});
  const fragments=new T.InstancedMesh(fragmentGeometry,fragmentMaterial,count);fragments.frustumCulled=false;fragments.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(fragments);
  const pose=new T.Object3D();
  // Screen-wide, low-contrast light field. Its off-center lobes move at different
  // speeds, lending depth without a visible portal, horizon line, or bloom pass.
  const fieldGeometry=new T.PlaneGeometry(2,2),fieldMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,
    uniforms:{progress:{value:0},time:{value:0},aspect:{value:1}},
    vertexShader:'varying vec2 vUV;void main(){vUV=uv;gl_Position=vec4(position.xy,.9999,1.);}',
    fragmentShader:`varying vec2 vUV;uniform float progress,time,aspect;
      float stage(float p,float a,float b){float t=clamp((p-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
      void main(){
        float event=stage(progress,.14,.43),release=stage(progress,.56,.70),quiet=1.-stage(progress,.86,.993);
        float dark=stage(progress,.53,.84);
        vec2 uv=vUV-.5;uv.x*=aspect;
        vec2 light=vec2(mix(.52,-.28,release)+sin(time*.10)*.025,mix(.30,.14,event));
        float halo=exp(-dot(uv-light,uv-light)*2.3);
        float flank=exp(-pow((uv.x+aspect*.39)*1.8,2.)-pow((uv.y+.28)*2.,2.));
        float vignette=smoothstep(.34,1.08,length(vec2(uv.x/max(aspect,.1),uv.y)*1.8));
        vec3 color=mix(vec3(.49,.48,.46),vec3(.65,.67,.63),dark);
        float alpha=(halo*(.018+.045*event)+flank*.026+vignette*.035)*quiet;
        alpha*=1.2*mix(.5,1.,dark);gl_FragColor=vec4(color,alpha);
      }`});
  const field=new T.Mesh(fieldGeometry,fieldMaterial);field.frustumCulled=false;field.renderOrder=-5;root.add(field);
  const floorGeometry=new T.PlaneGeometry(36,36),floorMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{opacity:{value:0},color:{value:charcoal.clone()}},
    vertexShader:'varying vec2 vGrid;void main(){vGrid=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vGrid;uniform float opacity;uniform vec3 color;
      void main(){vec2 c=vGrid/1.3;vec2 d=abs(fract(c-.5)-.5)/max(fwidth(c),vec2(.0001));float line=1.-min(min(d.x,d.y),1.);float falloff=exp(-dot(vGrid,vGrid)*.018);gl_FragColor=vec4(color,line*falloff*opacity);}`});
  const floor=new T.Mesh(floorGeometry,floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.set(0,-1.46,-5);root.add(floor);
  function layout(w,h,wh,d,dpr){
    width=w;height=h;worldHeight=wh;distance=d;worldWidth=wh*w/h;fieldMaterial.uniforms.aspect.value=w/h;dotsMaterial.uniforms.pixelRatio.value=dpr;
    seeds.length=0;
    for(let i=0;i<amount+count;i++){
      let x=random(i*3+1)*2-1,y=random(i*3+2)*1.8-.9;
      // Reserve Hero copy and the central actor. The environment lives in the
      // peripheral field and becomes more legible only after the copy exits.
      if(x<-.15&&y>-.55&&y<.50)y=y>0?.65:-.70;
      if(Math.abs(x)<.25&&Math.abs(y)<.40)x+=(x<0?-.48:.48);
      const foreground=i>=amount+count-4,z=foreground?2.2+random(i+3)*1.2:-3-random(i+4)*5;
      const projection=(distance-z)/distance;
      seeds.push({x:x*worldWidth*.49*projection,y:y*worldHeight*.50*projection,z,seed:random(i+7)*6.283,near:foreground});
    }
  }
  function update(p,time,enabled){
    root.visible=enabled&&p<.993;if(!root.visible)return;
    const attract=phase(p,.13,.42),release=phase(p,.56,.70),quiet=1-phase(p,.79,.965),dark=phase(p,.53,.84);
    const turn=release*.22*(1-phase(p,.73,.89)),inward=1-.14*attract+.10*release;
    fieldMaterial.uniforms.progress.value=p;fieldMaterial.uniforms.time.value=time;
    floorMaterial.uniforms.opacity.value=1.2*(.009+.036*phase(p,.17,.44))*(1-phase(p,.72,.86));
    floorMaterial.uniforms.color.value.copy(charcoal).lerp(white,dark);
    floor.position.z=-5+attract*.55;floor.rotation.z=(attract*.045-release*.09)*(1-phase(p,.76,.89))+Math.sin(time*.08)*.002*quiet;
    dotsMaterial.uniforms.color.value.copy(charcoal).lerp(white,dark);dotsMaterial.uniforms.opacity.value=1.2*(.09+.17*phase(p,.18,.44))*quiet;
    for(let i=0;i<amount;i++){
      const s=seeds[i],angle=turn+Math.sin(time*.10+s.seed)*.006*quiet;
      positions[i*3]=(s.x*Math.cos(angle)-s.y*Math.sin(angle))*inward+Math.sin(time*.14+s.seed)*.024*quiet;
      positions[i*3+1]=(s.x*Math.sin(angle)+s.y*Math.cos(angle))*inward+Math.cos(time*.12+s.seed)*.027*quiet;
      positions[i*3+2]=s.z+attract*.45+Math.sin(time*.11+s.seed)*.06*quiet;
    }
    dotsGeometry.attributes.position.needsUpdate=true;
    fragmentMaterial.color.copy(charcoal).lerp(white,dark);fragmentMaterial.opacity=1.2*(.075+.19*phase(p,.16,.42))*quiet;
    for(let i=0;i<count;i++){
      const s=seeds[amount+i],a=turn*(s.near?1.3:.8),pass=Math.sin(phase(p,.15,.49)*Math.PI)+.65*Math.sin(phase(p,.525,.82)*Math.PI);
      pose.position.set((s.x*Math.cos(a)-s.y*Math.sin(a))*inward,(s.x*Math.sin(a)+s.y*Math.cos(a))*inward,s.z);
      pose.position.x+=Math.sin(time*.18+s.seed)*.022*quiet+(s.near?Math.sign(s.x)*pass*.25:0);
      pose.position.y+=Math.cos(time*.15+s.seed)*.035*quiet;pose.position.z+=pass*(s.near?.45:.18);
      pose.rotation.set(s.seed+time*.016*quiet,s.seed*.7+a,s.seed*.3+time*.012*quiet);
      const size=s.near?.025:.032+random(i+80)*.032;pose.scale.set(size*(i%3===0?2.8:1),size,size*.5);pose.updateMatrix();fragments.setMatrixAt(i,pose.matrix);
    }
    fragments.instanceMatrix.needsUpdate=true;
  }
  return {layout,update,dispose(){scene.remove(root);dotsGeometry.dispose();dotsMaterial.dispose();fragmentGeometry.dispose();fragmentMaterial.dispose();fragments.dispose();fieldGeometry.dispose();fieldMaterial.dispose();floorGeometry.dispose();floorMaterial.dispose();}};
}
