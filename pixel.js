/* Shared sampled-cell renderer for identity type and portrait only. */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function initPixelSurface(host) {
    const source = host.querySelector('img, span');
    const isImage = host.dataset.pixel === 'image';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.className = 'pixel-canvas';
    const ctx = canvas.getContext('2d');
    const sample = document.createElement('canvas');
    const sc = sample.getContext('2d', {willReadFrequently:true});
    if (!source || !ctx || !sc) return;
    host.appendChild(canvas);
    let points = [], w = 0, h = 0, cell = 3, visible = false, raf = 0, last = 0;
    let px = -1000, py = -1000, inside = false, tint = '', rgbEdge = '';
    let assembled = false, assembly = 1;
    const stop = () => { cancelAnimationFrame(raf); raf = 0; last = 0; };
    const request = () => { if (visible && !document.hidden && !raf) raf = requestAnimationFrame(draw); };
    function draw(time) {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = last ? clamp((time-last)/16.667, .4, 2) : 1;
      last = time;
      ctx.clearRect(0,0,w,h);
      const radius = isImage ? 72 : Math.min(105,w*.14);
      assembly = reduce.matches ? 1 : Math.min(1, assembly + dt * 16.667 / 850);
      let moving = assembly < 1;
      for (const p of points) {
        const dx = p.x-px, dy = p.y-py, distance = Math.hypot(dx,dy);
        const fall = inside && !reduce.matches ? Math.pow(Math.max(0,1-distance/radius),2) : 0;
        const tx = distance > .01 ? dx/distance*fall*22 : 0;
        const ty = distance > .01 ? dy/distance*fall*22 : 0;
        p.vx = (p.vx+(tx-p.ox)*.13*dt)*Math.pow(.72,dt);
        p.vy = (p.vy+(ty-p.oy)*.13*dt)*Math.pow(.72,dt);
        p.ox += p.vx*dt; p.oy += p.vy*dt;
        if (Math.abs(p.ox-tx)+Math.abs(p.oy-ty)+Math.abs(p.vx)+Math.abs(p.vy)>.025) moving=true;
        else { p.ox=tx;p.oy=ty;p.vx=0;p.vy=0; }
        const settle = Math.pow(1-clamp((assembly-p.x/w*.22)/.78,0,1),3);
        const size = p.size*(1-fall*.13);
        const x=p.x+p.ox-size/2+settle*(Math.floor(p.y/cell)%2?12:-12);
        const y=p.y+p.oy-size/2+settle*18;
        if (isImage && fall>.05) {
          ctx.fillStyle=rgbEdge; ctx.globalAlpha=fall*.23;
          ctx.fillRect(x-1.2*fall,y,size,size);
          ctx.fillStyle=tint; ctx.fillRect(x+1.2*fall,y,size,size);
        }
        ctx.globalAlpha=p.alpha;
        ctx.fillStyle=p.color;
        ctx.fillRect(x,y,size,size);
      }
      ctx.globalAlpha=1;
      if (moving) request(); else last=0;
    }
    function build() {
      stop();
      // Layout size is stable while the parent scene scales during scrolling.
      const rect={width:host.clientWidth,height:host.clientHeight};
      if (rect.width<20 || rect.height<20 || (isImage && !source.naturalWidth)) return;
      try {
        w=Math.round(rect.width);h=Math.round(rect.height);
        cell=w<600?2.5:3.5;
        if (isImage) cell=3;
        const dpr=Math.min(devicePixelRatio||1,2);
        canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
        ctx.setTransform(dpr,0,0,dpr,0,0);
        sample.width=w;sample.height=h;
        sc.clearRect(0,0,w,h);
        const cs=getComputedStyle(source), hs=getComputedStyle(host);
        tint=hs.getPropertyValue('--c-neon').trim()||'#E0FF4F';
        rgbEdge=hs.getPropertyValue('--c-accent').trim()||'#6544A5';
        if (isImage) {
          const scale=Math.min(w/source.naturalWidth,h/source.naturalHeight);
          const iw=source.naturalWidth*scale,ih=source.naturalHeight*scale;
          sc.drawImage(source,(w-iw)/2,(h-ih)/2,iw,ih);
        } else {
          let size=h*.78;
          sc.font=`${cs.fontWeight} ${size}px ${cs.fontFamily}`;
          size*=Math.min(1,w*.94/sc.measureText(source.textContent.trim()).width);
          sc.font=`${cs.fontWeight} ${size}px ${cs.fontFamily}`;
          const metrics=sc.measureText(source.textContent.trim());
          const ascent=metrics.actualBoundingBoxAscent||size*.7;
          const descent=metrics.actualBoundingBoxDescent||size*.2;
          sc.textAlign='center';sc.fillStyle=cs.color;
          sc.fillText(source.textContent.trim(),w/2,(h+ascent-descent)/2);
        }
        const data=sc.getImageData(0,0,w,h).data;
        points=[];
        for(let y=cell/2;y<h;y+=cell) for(let x=cell/2;x<w;x+=cell) {
          const i=(Math.floor(y)*w+Math.floor(x))*4,a=data[i+3]/255;
          if(a<.12) continue;
          points.push({x,y,ox:0,oy:0,vx:0,vy:0,alpha:a,color:`rgb(${data[i]},${data[i+1]},${data[i+2]})`,size:cell*(isImage?.88:.79)});
        }
        // Do not hide the semantic fallback until a sampled frame exists.
        if (!points.length) {host.classList.remove('pixel-ready');return;}
        const wasVisible=visible;visible=true;draw(performance.now());visible=wasVisible;
        if (!visible) stop();
        host.classList.add('pixel-ready');
      } catch (_) { host.classList.remove('pixel-ready');stop(); }
    }
    host.addEventListener('pointermove', e => {
      if(reduce.matches || !fine.matches || e.pointerType==='touch') return;
      const r=host.getBoundingClientRect();if(!r.width||!r.height)return;px=(e.clientX-r.left)*w/r.width;py=(e.clientY-r.top)*h/r.height;inside=true;request();
    },{passive:true});
    host.addEventListener('pointerleave',()=>{inside=false;request();});
    reduce.addEventListener('change',()=>{inside=false;assembly=1;build();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else request();});
    if('IntersectionObserver' in window) {
      const io=new IntersectionObserver(entries=>{
        visible=entries[0].isIntersecting;
        if(visible){if(!assembled){assembled=true;assembly=reduce.matches||isImage?1:0;}request();}else stop();
      },{threshold:.15});io.observe(host);
    } else visible=true;
    if('ResizeObserver' in window) new ResizeObserver(build).observe(host);
    else addEventListener('resize',build,{passive:true});
    if(isImage && !source.complete) source.addEventListener('load',build,{once:true});
    document.fonts?.ready.then(build);
    build();
  }

  document.querySelectorAll('[data-pixel]').forEach(initPixelSurface);
})();
