import {phase} from './hero-sequence.js?v=5';

// Roles and composition were chosen after inspecting the supplied PNGs.
// Positions refer to the visible alpha bounds, not the full transparent canvas.
const definitions=[
  ['arrow-button',.84,[.18,.18],-.10,.97],
  ['toggle-status',1.00,[.72,.18],.09,1.10],
  ['analytics',1.12,[.81,.39],-.08,.93],
  ['checkbox',.78,[.20,.83],.08,1.06],
  ['progress-ring',1.02,[.91,.64],-.10,.94],
  ['notification',.83,[.46,.79],.08,1.09],
  ['dropdown',.98,[.55,.43],-.10,1.03],
  ['label-chip',.94,[.45,.15],-.16,1.13],
  ['calendar',.94,[.70,.84],.09,1.02],
  ['profile-panel',1.06,[.69,.57],.06,.97]
];

export async function loadHeroPNGs(T){
  const results=await Promise.allSettled(definitions.map(async([name,optical,anchor,angle,depth],i)=>{
    const file='hero_'+String(i+1).padStart(2,'0')+'.png',url=new URL('./image/hero/'+file,import.meta.url).href;
    const image=new Image();image.decoding='async';image.src=url;
    try{await image.decode();}catch{throw new Error(file+' could not be decoded');}
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
    const data=context.getImageData(0,0,canvas.width,canvas.height).data;
    let x0=canvas.width,y0=canvas.height,x1=-1,y1=-1;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>32){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    if(x1<x0)throw new Error(file+' has no visible pixels');
    const bounds={x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
    const texture=new T.Texture(image);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;texture.needsUpdate=true;
    return {name,file,url,image,texture,bounds,w:1,h:bounds.h/bounds.w,optical,anchor,angle,depth};
  }));
  const errors=results.filter(r=>r.status==='rejected');
  if(errors.length){results.forEach(r=>{if(r.status==='fulfilled')r.value.texture.dispose();});throw new Error(errors.map(r=>r.reason.message).join('; '));}
  return results.map(r=>r.value);
}

export function createHeroPNGVisuals(T,owner,assets){
  const root=new T.Group();root.name='hero-supplied-pngs';owner.add(root);
  const meshes=assets.map(asset=>{
    const {image,bounds:b}=asset;
    const geometry=new T.PlaneGeometry(image.naturalWidth/b.w,image.naturalHeight/b.w);
    geometry.translate((image.naturalWidth/2-b.x-b.w/2)/b.w,(b.y+b.h/2-image.naturalHeight/2)/b.w,0);
    // The artwork already contains shading. No lighting, tone mapping, extra
    // shadow, opaque depth-writing rectangle, recoloring, or crop is applied.
    const material=new T.MeshBasicMaterial({map:asset.texture,transparent:true,depthWrite:false,toneMapped:false,side:T.FrontSide});
    const mesh=new T.Mesh(geometry,material);mesh.name=asset.file;mesh.frustumCulled=false;root.add(mesh);return mesh;
  });
  const euler=new T.Euler(),rotation=new T.Quaternion();
  return {
    update(records,progress){
      root.visible=progress<.445;if(!root.visible)return;
      records.forEach((r,i)=>{
        const mesh=meshes[i],handoff=phase(progress,.335+r.delay*.25,.430+r.delay*.18);
        mesh.position.copy(r.pose);
        // Preserve the baked perspective: PNGs never inherit the slab's
        // quarter-turn. They retire before the core presents its back surface.
        euler.set(-.015,.012,r.ui.angle*(1-phase(progress,.27,.43)));
        rotation.setFromEuler(euler);
        mesh.quaternion.copy(r.floatingRotation).slerp(rotation,phase(progress,.24,.43));
        const width=r.size.x+(r.panelSize.x*.45-r.size.x)*phase(progress,.30,.435);
        mesh.scale.setScalar(width);mesh.material.opacity=1-handoff;
        mesh.visible=handoff<.9999;
      });
    },
    dispose(){meshes.forEach(m=>{m.geometry.dispose();m.material.dispose();});owner.remove(root);}
  };
}

