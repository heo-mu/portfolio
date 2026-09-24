// Geometry-derived contact shadow. One depth pass and two separable blur passes.
// Captured from below so the closest surface sets the local contact density.
export function createContactShadow(T,renderer,scene,{resolution=512,floorY=-1.72}={}){
  const span=7;
  const camera=new T.OrthographicCamera(-span/2,span/2,span/2,-span/2,.01,5);
  camera.position.set(0,floorY,.4);camera.up.set(0,0,1);camera.lookAt(0,floorY+1,.4);camera.updateMatrixWorld();
  const target=new T.WebGLRenderTarget(resolution,resolution,{minFilter:T.LinearFilter,magFilter:T.LinearFilter});
  const scratch=new T.WebGLRenderTarget(resolution,resolution,{depthBuffer:false,minFilter:T.LinearFilter,magFilter:T.LinearFilter});
  const depthMaterial=new T.ShaderMaterial({side:T.DoubleSide,uniforms:{floorY:{value:floorY}},
    vertexShader:'varying float height; uniform float floorY; void main(){vec4 p=vec4(position,1.0);\n#ifdef USE_INSTANCING\np=instanceMatrix*p;\n#endif\nvec4 world=modelMatrix*p;height=max(0.,world.y-floorY);gl_Position=projectionMatrix*viewMatrix*world;}',
    fragmentShader:'varying float height; void main(){float density=exp(-height*.8)*.66;gl_FragColor=vec4(.16,.18,.15,density);}'
  });
  const blurMaterial=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{map:{value:target.texture},step:{value:new T.Vector2()}},
    vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:'varying vec2 uv0;uniform sampler2D map;uniform vec2 step;void main(){vec4 c=texture2D(map,uv0)*.227027;c+=(texture2D(map,uv0+step*1.384615)+texture2D(map,uv0-step*1.384615))*.316216;c+=(texture2D(map,uv0+step*3.230769)+texture2D(map,uv0-step*3.230769))*.070270;gl_FragColor=c;}'
  });
  const blurScene=new T.Scene(),quadGeometry=new T.PlaneGeometry(2,2);
  blurScene.add(new T.Mesh(quadGeometry,blurMaterial));
  const planeGeometry=new T.PlaneGeometry(span,span);
  const planeMaterial=new T.MeshBasicMaterial({map:target.texture,transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,opacity:.9});
  const plane=new T.Mesh(planeGeometry,planeMaterial);
  plane.rotation.x=Math.PI/2;plane.position.set(0,floorY,.4);scene.add(plane);
  const clearColor=new T.Color();
  function update(excluded=[],lift=0){
    const previousTarget=renderer.getRenderTarget(),previousOverride=scene.overrideMaterial;
    const previousAlpha=renderer.getClearAlpha(),shadows=renderer.shadowMap.enabled;
    renderer.getClearColor(clearColor);
    const hidden=[plane,...excluded],visibility=hidden.map(mesh=>mesh.visible);
    try{
      hidden.forEach(mesh=>mesh.visible=false);scene.overrideMaterial=depthMaterial;renderer.shadowMap.enabled=false;
      renderer.setClearColor(0x292e26,0);renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);
      scene.overrideMaterial=null;
      // Small penumbra retains the sculptural silhouette, widening with the float.
      const radius=(3.2+Math.max(0,lift)*6)/resolution;
      blurMaterial.uniforms.map.value=target.texture;blurMaterial.uniforms.step.value.set(radius,0);
      renderer.setRenderTarget(scratch);renderer.clear();renderer.render(blurScene,camera);
      blurMaterial.uniforms.map.value=scratch.texture;blurMaterial.uniforms.step.value.set(0,radius);
      renderer.setRenderTarget(target);renderer.clear();renderer.render(blurScene,camera);
    }finally{
      scene.overrideMaterial=previousOverride;renderer.shadowMap.enabled=shadows;
      hidden.forEach((mesh,i)=>mesh.visible=visibility[i]);
      renderer.setRenderTarget(previousTarget);renderer.setClearColor(clearColor,previousAlpha);
    }
  }
  function resize(size){if(size===resolution)return;resolution=size;target.setSize(size,size);scratch.setSize(size,size);}
  return {update,resize,dispose(){scene.remove(plane);target.dispose();scratch.dispose();depthMaterial.dispose();blurMaterial.dispose();quadGeometry.dispose();planeGeometry.dispose();planeMaterial.dispose();}};
}
