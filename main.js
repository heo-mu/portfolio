/* Shared runtime. Content and links remain usable without animation libraries. */
let lenis = null;
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const MOTION=Object.freeze({fast:.24,standard:.45,scene:.8,scrub:.65,
    microEase:'power2.out',standardEase:'power3.out',sceneEase:'power3.inOut'});

  let refreshTimer=0;
  function queueRefresh() {
    clearTimeout(refreshTimer);
    const flush=()=>{
      if(lenis?.isScrolling){refreshTimer=setTimeout(flush,120);return;}
      lenis?.resize();window.ScrollTrigger?.refresh(true);
    };
    refreshTimer=setTimeout(flush,140);
  }
  function moveTo(target,options={}) {
    if(lenis){lenis.scrollTo(target,{offset:typeof target==='number'?0:-84,...options});return;}
    const top=typeof target==='number'?target:target.getBoundingClientRect().top+scrollY-84;
    scrollTo({top,behavior:reduce.matches||options.immediate?'auto':'smooth'});
  }
  window.portfolioScroll={moveTo,refresh:queueRefresh};
  function initScroll() {
    if(!window.gsap||!window.ScrollTrigger)return;
    const gsap=window.gsap,ST=window.ScrollTrigger;
    gsap.registerPlugin(ST);
    let tick=null;
    const stop=()=>{if(tick)gsap.ticker.remove(tick);tick=null;if(lenis){lenis.destroy();lenis=null;}};
    const setup=()=>{
      stop();if(reduce.matches||!fine.matches||!window.Lenis)return;
      lenis=new window.Lenis({autoRaf:false,lerp:.16,smoothWheel:true,wheelMultiplier:1,syncTouch:false,anchors:false});
      lenis.on('scroll',ST.update);
      tick=time=>lenis?.raf(time*1000);
      gsap.ticker.lagSmoothing(0);gsap.ticker.add(tick);
    };
    setup();reduce.addEventListener('change',setup);fine.addEventListener('change',setup);
    addEventListener('pagehide',stop);addEventListener('pageshow',e=>{if(e.persisted){setup();queueRefresh();}});
    document.addEventListener('visibilitychange',()=>document.documentElement.classList.toggle('motion-paused',document.hidden));
  }

  function initNavigation() {
    const nav = $('#nav'), menu = $('#nav-links'), toggle = $('#hamburger');
    if (!nav) return;
    const close = () => { menu?.classList.remove('open'); toggle?.setAttribute('aria-expanded','false'); toggle?.setAttribute('aria-label','메뉴 열기'); };
    toggle?.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded',String(open));
      toggle.setAttribute('aria-label',open?'메뉴 닫기':'메뉴 열기');
    });
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu?.classList.contains('open')){close();toggle.focus();}});
    document.addEventListener('pointerdown',e=>{if(!nav.contains(e.target))close();});
    $$('.site-menu a').forEach(a=>a.addEventListener('click',close));
    const links = $$('.site-menu a'), sections = $$('main > section[id],footer[id]');
    const tones = $$('[data-tone]');
    let pending = false;
    const update = () => {
      pending=false;
      nav.classList.toggle('is-scrolled',scrollY>70);
      // Change tone as soon as a dark section reaches the header's lower edge.
      // This keeps the full-width bar visually attached to the scene beneath it.
      // A section that owns a live palette (About) sets the header tone itself.
      const toneLine=nav.getBoundingClientRect().bottom;
      nav.classList.toggle('is-dark',tones.some(s=>{if(s.classList.contains('has-color-scene'))return false;const r=s.getBoundingClientRect();return s.dataset.tone==='dark'&&r.top<=toneLine&&r.bottom>toneLine;}));
      window.portfolioAboutTheme?.syncHeader();
      const active=sections.find(s=>{const r=s.getBoundingClientRect();return r.top<=innerHeight*.4&&r.bottom>innerHeight*.4;});
      links.forEach(a=>{if(active&&a.hash==='#'+active.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
      $('#scrollToTop')?.classList.toggle('visible',scrollY>600);
    };
    addEventListener('scroll',()=>{if(!pending){pending=true;requestAnimationFrame(update);}},{passive:true});
    addEventListener('resize',update,{passive:true});update();
    $$('.back-top,#scrollToTop').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();moveTo(0);}));
    $$('a[href^="#"]').filter(a=>a.hash.length>1).forEach(a=>a.addEventListener('click',e=>{
      const target=document.getElementById(decodeURIComponent(a.hash.slice(1)));
      if(!target)return;e.preventDefault();close();
      moveTo(target);
      history.replaceState(null,'',a.hash);
      // Keyboard navigation has a matching focus destination.
      target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
    }));
  }

  function initProjectIndex() {
    const rows=$$('.work-row');
    if(!rows.length)return;
    const preview=$('.work-preview'),previewVisual=preview&&$('.work-preview__visual',preview);
    rows.forEach(row=>row.addEventListener('click',()=>{try{sessionStorage.setItem('hm:proj',row.dataset.project);}catch{}}));
    const restore=()=>{
      if(location.hash!=='#projects')return;
      let index;try{index=sessionStorage.getItem('hm:proj');}catch{return;}
      if(index===null)return;
      const row=rows.find(r=>r.dataset.project===index);
      if(row)moveTo(row.getBoundingClientRect().top+scrollY-innerHeight/2+row.offsetHeight/2,{immediate:true});
    };
    // Use native history restoration on browser Back; explicit Projects links restore the chosen row.
    if(performance.getEntriesByType?.('navigation')[0]?.type!=='back_forward') requestAnimationFrame(restore);
    // Preview lives inside the existing thumbnail; scroll owns only the outer reveal.
    const cache=new Map();
    const load=src=>{
      if(!cache.has(src))cache.set(src,new Promise(resolve=>{
        const img=new Image();img.alt='';img.width=1920;img.height=1080;
        img.onload=async()=>{try{await img.decode();}catch{}resolve(img.naturalWidth?img:null);};
        img.onerror=()=>{cache.delete(src);resolve(null);};img.src=src;
      }));return cache.get(src);
    };
    let previewFrame=0,previewToken=0,previewPointer=null,previewRow=null,previewX=0,previewY=0,previewTX=0,previewTY=0;
    const drawPreview=time=>{
      previewFrame=0;const dt=previewX||previewY?Math.min(40,time-(preview._last||time)):16.67;preview._last=time;
      const mix=1-Math.exp(-dt/70);previewX+=(previewTX-previewX)*mix;previewY+=(previewTY-previewY)*mix;
      preview.style.setProperty('--preview-x',previewX.toFixed(2)+'px');preview.style.setProperty('--preview-y',previewY.toFixed(2)+'px');
      if(Math.abs(previewTX-previewX)+Math.abs(previewTY-previewY)>.08)previewFrame=requestAnimationFrame(drawPreview);else{previewX=previewTX;previewY=previewTY;preview._last=0;}
    };
    const placePreview=e=>{
      if(!previewPointer)return;
      const w=Math.min(clamp(innerWidth*.29,280,440),innerWidth-32,(innerHeight-176)*16/9),h=w*9/16;
      let x=e.clientX+28,y=e.clientY-h*.45;
      if(x+w>innerWidth-16)x=e.clientX-w-28;
      y=clamp(y,88,innerHeight-h-24);
      preview.style.width=w+'px';preview.style.height=h+'px';previewTX=x;previewTY=y;
      if(!previewFrame)previewFrame=requestAnimationFrame(drawPreview);
    };
    const hidePreview=()=>{previewRow=null;previewPointer=null;previewToken++;if(preview)preview.classList.remove('is-visible');if(previewFrame){cancelAnimationFrame(previewFrame);previewFrame=0;}if(preview)preview._last=0;};
    const showPreview=async(row,e)=>{
      if(!preview||!previewVisual||!fine.matches||innerWidth<641||e.pointerType==='touch')return;
      previewPointer={x:e.clientX,y:e.clientY};previewRow=row;placePreview(e);const token=++previewToken;const img=await load(row.dataset.preview);
      if(token!==previewToken||previewRow!==row||!img)return;
      previewVisual.replaceChildren(img.cloneNode());preview.setAttribute('data-project',row.dataset.project);preview.classList.add('is-visible');
    };
    rows.forEach(row=>{
      const thumb=$('.work-row__thumb',row);
      let request=0,inside=false,ready=false;
      const reset=()=>{inside=false;request++;row.classList.remove('is-previewing');thumb.style.setProperty('--preview-local-x','0px');thumb.style.setProperty('--preview-local-y','0px');};
      const show=async e=>{
        if(!fine.matches||innerWidth<641||e.pointerType==='touch')return;
        inside=true;const token=++request;
        window.portfolioMotion?.revealWithin(row);
        if(!ready){
          const img=await load(row.dataset.preview);
          if(!img||token!==request||!inside)return;
          const layer=document.createElement('div');layer.className='work-row__hover';layer.setAttribute('aria-hidden','true');
          const inner=document.createElement('div');inner.className='work-row__hover-inner';inner.append(img.cloneNode());layer.append(inner);thumb.append(layer);ready=true;
          // Commit the closed mask before revealing a newly decoded layer.
          layer.getBoundingClientRect();
        }
        if(inside&&token===request)row.classList.add('is-previewing');
      };
      row.addEventListener('pointerenter',e=>{show(e);showPreview(row,e);});
      row.addEventListener('pointermove',e=>{
        if(!fine.matches||innerWidth<641||e.pointerType==='touch')return;
        if(!inside)show(e);
        showPreview(row,e);
        previewPointer={x:e.clientX,y:e.clientY};placePreview(e);
        const r=row.getBoundingClientRect();
        thumb.style.setProperty('--preview-local-x',(-clamp((e.clientX-r.left)/r.width-.5,-.5,.5)*12)+'px');
        thumb.style.setProperty('--preview-local-y',(-clamp((e.clientY-r.top)/r.height-.5,-.5,.5)*9)+'px');
      },{passive:true});
      row.addEventListener('pointerleave',()=>{reset();hidePreview();});row.addEventListener('pointercancel',()=>{reset();hidePreview();});row.addEventListener('click',()=>{reset();hidePreview();});
      addEventListener('resize',()=>{reset();hidePreview();},{passive:true});addEventListener('pageshow',()=>{reset();hidePreview();});addEventListener('pagehide',()=>{reset();hidePreview();});fine.addEventListener('change',()=>{reset();hidePreview();});
    });
    addEventListener('scroll',()=>{if(!previewRow||!previewPointer)return;const hit=document.elementFromPoint(previewPointer.x,previewPointer.y)?.closest?.('.work-row');if(hit!==previewRow)hidePreview();},{passive:true});
    if('IntersectionObserver' in window){const preload=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){load(e.target.dataset.preview);preload.unobserve(e.target);}}),{rootMargin:'300px'});rows.forEach(row=>preload.observe(row));}
  }

  function initVisualDepth() {
    $$('.work-row').forEach(surface=>{
      const target=$('.work-row__thumb',surface)||surface;
      let x=0,y=0,z=0,tx=0,ty=0,tz=0,frame=0,last=0;
      const draw=time=>{
        frame=0;const dt=last?Math.min(40,time-last):16.67;last=time;const mix=1-Math.exp(-dt/85);
        x+=(tx-x)*mix;y+=(ty-y)*mix;z+=(tz-z)*mix;
        const settled=Math.abs(tx-x)+Math.abs(ty-y)+Math.abs(tz-z)<.015;
        if(settled){x=tx;y=ty;z=tz;last=0;}
        target.style.setProperty('--tilt-x',x.toFixed(3)+'deg');target.style.setProperty('--tilt-y',y.toFixed(3)+'deg');target.style.setProperty('--lift',z.toFixed(3)+'px');
        if(!settled)frame=requestAnimationFrame(draw);
      };
      const request=()=>{if(!frame)frame=requestAnimationFrame(draw);};
      const reset=()=>{tx=ty=tz=0;request();};
      surface.addEventListener('pointermove',e=>{if(reduce.matches||!fine.matches||e.pointerType==='touch')return;const r=surface.getBoundingClientRect();tx=-clamp((e.clientY-r.top)/r.height-.5,-.5,.5)*3;ty=clamp((e.clientX-r.left)/r.width-.5,-.5,.5)*3;tz=8;request();},{passive:true});
      surface.addEventListener('pointerleave',reset);surface.addEventListener('blur',reset,true);
      const clear=()=>{cancelAnimationFrame(frame);frame=last=0;x=y=z=tx=ty=tz=0;['--tilt-x','--tilt-y','--lift'].forEach(k=>target.style.removeProperty(k));};
      reduce.addEventListener('change',clear);fine.addEventListener('change',clear);addEventListener('pagehide',clear);
    });
  }

  function initToolPointers() {
    $$('.tool').forEach(card=>{
      let frame=0,point=null;
      const paint=()=>{
        frame=0;if(!point)return;
        const r=card.getBoundingClientRect();
        const u=clamp((point.x-r.left)/r.width,0,1),v=clamp((point.y-r.top)/r.height,0,1);
        card.style.setProperty('--local-x',u*100+'%');card.style.setProperty('--local-y',v*100+'%');
        card.style.setProperty('--logo-x',(u-.5)*4+'px');card.style.setProperty('--logo-y',(v-.5)*4+'px');
        card.style.setProperty('--name-x',(u-.5)*1.2+'px');card.style.setProperty('--name-y',(v-.5)*1.2+'px');
      };
      const reset=()=>{
        cancelAnimationFrame(frame);frame=0;point=null;card.classList.remove('is-pointed');
        ['--local-x','--local-y','--logo-x','--logo-y','--name-x','--name-y'].forEach(p=>card.style.removeProperty(p));
      };
      card.addEventListener('pointermove',e=>{
        if(reduce.matches||!fine.matches||e.pointerType==='touch')return;
        card.classList.add('is-pointed');point={x:e.clientX,y:e.clientY};
        if(!frame)frame=requestAnimationFrame(paint);
      },{passive:true});
      card.addEventListener('pointerleave',reset);card.addEventListener('pointercancel',reset);
      // A moving track invalidates pointer-local coordinates; never leave a stale hotspot.
      addEventListener('scroll',reset,{passive:true});addEventListener('pagehide',reset);
      reduce.addEventListener('change',reset);fine.addEventListener('change',reset);
    });
  }

  function initToolsScroll() {
    const section=$('.tools'),viewport=$('.tools__viewport'),track=$('.tools__track');
    if(!section||!viewport||!track||!window.gsap||!window.ScrollTrigger)return;
    gsap.registerPlugin(ScrollTrigger);
    const items=$$('.tool-item',track),progress=$('.tools__progress > span');
    viewport.removeAttribute('data-lenis-prevent-touch');
    const mm=gsap.matchMedia();
    mm.add('(min-width: 769px) and (min-height: 660px) and (prefers-reduced-motion: no-preference)',()=>{
      section.classList.add('is-scroll-deck');
      const state={position:0};let step=300,active=-1,trigger;
      const measure=()=>{
        section.style.setProperty('--tools-top',($('#nav')?.offsetHeight||68)+'px');
        section.style.setProperty('--tools-run',Math.round(innerHeight*2.8)+'px');
        step=items[0].offsetWidth*.88;
      };
      const render=()=>{
        const index=Math.round(state.position);
        items.forEach((item,i)=>{
          const d=i-state.position,a=Math.abs(d);
          gsap.set(item,{x:d*step,y:Math.min(a,3)*20,scale:1-Math.min(a,3)*.085,
            rotationY:clamp(d,-2,2)*-9,z:-Math.min(a,3)*65,
            opacity:clamp(2.6-a,0,1),zIndex:20-Math.round(a*4)});
          if(index!==active){item.classList.toggle('is-current',i===index);item.inert=i!==index;}
        });
        active=index;
        if(progress)progress.style.transform='scaleX('+((state.position+1)/items.length)+')';
      };
      measure();
      const timeline=gsap.timeline({onUpdate:render});
      timeline.to(state,{position:0,duration:.12}).to(state,{position:items.length-1,duration:1,ease:'none'}).to(state,{position:items.length-1,duration:.12});
      trigger=ScrollTrigger.create({trigger:section,start:()=> 'top '+($('#nav')?.offsetHeight||68),end:'bottom bottom',
        animation:timeline,scrub:.22,invalidateOnRefresh:true,onRefreshInit:measure,onRefresh:render});
      const go=index=>moveTo(trigger.start+(.12+clamp(index,0,items.length-1)/(items.length-1))/1.24*(trigger.end-trigger.start));
      const key=e=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
        e.preventDefault();go(e.key==='Home'?0:e.key==='End'?items.length-1:active+(e.key==='ArrowRight'?1:-1));
      };
      viewport.addEventListener('keydown',key);render();queueRefresh();
      return()=>{
        trigger.kill();timeline.kill();viewport.removeEventListener('keydown',key);
        section.classList.remove('is-scroll-deck');['--tools-top','--tools-run'].forEach(p=>section.style.removeProperty(p));
        gsap.set(items,{clearProps:'transform,opacity,zIndex'});items.forEach(item=>{item.inert=false;item.classList.remove('is-current');});
        if(progress)progress.style.removeProperty('transform');queueRefresh();
      };
    });
  }
  function createSectionTitle(section,kind,amount) {
    const title=$('.section-title',section);if(!title)return null;
    const original=[...title.childNodes],words=[];
    // Preserve spaces, explicit line breaks, the work count and accessible text.
    for(const node of original){
      if(node.nodeType!==Node.TEXT_NODE)continue;
      const fragment=document.createDocumentFragment();
      for(const token of node.textContent.match(/\s+|\S+/g)||[]){
        if(/^\s+$/.test(token)){fragment.append(document.createTextNode(token));continue;}
        const word=document.createElement('span');word.className='title-word';word.textContent=token;
        if((kind==='about'&&token==='구조를')||(kind==='ai'&&token==='AI로'))word.classList.add('title-word--accent');
        fragment.append(word);words.push(word);
      }
      node.replaceWith(fragment);
    }
    title.classList.add('has-title-motion');title.dataset.titleMotion=kind;
    let previous=-1;
    const smooth=t=>t*t*(3-2*t);
    const render=progress=>{
      if(Math.abs(previous-progress)<.0001)return;previous=progress;
      words.forEach((word,i)=>{
        // Phrase order, rather than random letter delays, carries the meaning.
        const delay=kind==='about'?(i<3?i*.018:.16+(i-3)*.025):
          kind==='ai'?(i<2?i*.035:.16+(i-2)*.055):
          kind==='contact'?(i<3?i*.02:.18+(i-3)*.035):i*.065;
        const p=smooth(clamp((progress-delay)/(1-delay),0,1)),rest=1-p;
        const presence=(kind==='about'&&i<3)||(kind==='ai'&&i<2)||(kind==='contact'&&i<3)?.55:1;
        const blur=(kind==='about'?1.1:kind==='ai'?1.35:kind==='work'&&i===0?1.25:0)*amount*rest*presence;
        const x=(kind==='tools'?-3:kind==='work'?(i===0?-7:5):kind==='ai'?3:0)*amount*rest;
        const y=(kind==='about'?4:kind==='contact'?3:kind==='ai'?2:0)*amount*rest;
        const sx=1-(kind==='tools'?.045:kind==='work'?.015:0)*amount*rest;
        const sy=1-(kind==='about'?.018:0)*amount*rest;
        const rotate=(kind==='ai'?(i%2?-.35:.35):0)*amount*rest;
        word.style.transform=rest<.0001?'none':
          'translate('+x.toFixed(3)+'px,'+y.toFixed(3)+'px) scale('+sx.toFixed(5)+','+sy.toFixed(5)+') rotate('+rotate.toFixed(3)+'deg)';
        word.style.opacity=String(1-(kind==='tools'?.12:.28)*amount*rest*presence);
        word.style.filter=blur<.015?'none':'blur('+blur.toFixed(3)+'px)';
        word.style.setProperty('--word-accent',String(smooth(clamp((p-.55)/.45,0,1))));
      });
    };
    return {render,restore(){title.replaceChildren(...original);title.classList.remove('has-title-motion');delete title.dataset.titleMotion;}};
  }

  function initAboutTheme(gsap,ST) {
    const about=$('#about'),hero=$('.hero'),nav=$('#nav');
    if(!about||!hero||!nav)return;
    const original=getComputedStyle(about),light=getComputedStyle(hero).backgroundColor;
    const dark=original.backgroundColor,lineDark=getComputedStyle($('.about__metrics',about)).borderTopColor;
    const primaryDark=getComputedStyle($('.section-title',about)).color;
    const secondaryDark=getComputedStyle($('.about__story p',about)).color;
    const mutedDark=getComputedStyle($('.about__metrics dt',about)).color;
    const mix=gsap.utils.interpolate,state={progress:0};
    let palette={},trigger,tween,target,initialized=false,sceneHidden=null;
    const syncHeader=()=>{
      // The header follows the scene directly beneath it, never the trigger:
      // over Hero it stays light; About's palette applies once About reaches
      // the bar's midline. While an About edge crosses the bar, the bar is
      // transparent so the real boundary shows instead of a separate slab.
      const rect=about.getBoundingClientRect(),bar=nav.getBoundingClientRect(),middle=(bar.top+bar.bottom)/2;
      const active=rect.top<=middle&&rect.bottom>middle;
      const crossing=(rect.top>bar.top&&rect.top<bar.bottom)||(rect.bottom>bar.top&&rect.bottom<bar.bottom);
      nav.classList.toggle('is-about-theme',active);
      nav.classList.toggle('is-scene-crossing',crossing);
      if(active)for(const [key,value] of Object.entries(palette))nav.style.setProperty(key,value);
    };
    const render=()=>{
      const p=state.progress;
      palette={'--about-bg':mix(light,dark,p),'--about-text':mix('#1B1C19',primaryDark,p),
        '--about-muted':mix('#626262',secondaryDark,p),'--about-caption':mix('#626262',mutedDark,p),
        '--about-line':mix('#B8B8B5',lineDark,p)};
      for(const [key,value] of Object.entries(palette))about.style.setProperty(key,value);
      hero.style.setProperty('--hero-scene-opacity',String(1-p));
      hero.style.setProperty('--hero-scene-visibility',p===1?'hidden':'visible');
      // The Hero renderer idles only once the scene is fully hidden; any reverse
      // tween step reveals it again, so fresh frames exist before it is seen.
      if(sceneHidden!==(p===1)){sceneHidden=p===1;hero.toggleAttribute('data-scene-hidden',sceneHidden);hero.dispatchEvent(new Event('heroscenechange'));}
      syncHeader();
    };
    const setTheme=(isDark,immediate=false)=>{
      const next=isDark?1:0;
      if(target===next&&!immediate)return;
      target=next;tween?.kill();
      if(immediate||matchMedia('(prefers-reduced-motion: reduce)').matches){
        state.progress=next;render();return;
      }
      tween=gsap.to(state,{progress:next,duration:.45,ease:'power2.inOut',onUpdate:render,onComplete:syncHeader});
    };
    about.classList.add('has-color-scene');
    render();
    trigger=ST.create({id:'about-color',trigger:about,start:'top 67%',end:'bottom top',
      onEnter:()=>setTheme(true),onLeaveBack:()=>setTheme(false),
      onRefresh:self=>{setTheme(self.scroll()>=self.start,!initialized);initialized=true;}});
    if(!initialized){setTheme(trigger.scroll()>=trigger.start,true);initialized=true;}
    window.portfolioAboutTheme={syncHeader};
    addEventListener('pagehide',event=>{
      if(event.persisted)return;
      tween?.kill();trigger.kill();about.classList.remove('has-color-scene');nav.classList.remove('is-about-theme','is-scene-crossing');
      hero.style.removeProperty('--hero-scene-opacity');hero.style.removeProperty('--hero-scene-visibility');hero.removeAttribute('data-scene-hidden');
      for(const key of Object.keys(palette)){about.style.removeProperty(key);nav.style.removeProperty(key);}
      delete window.portfolioAboutTheme;
    });
  }

  function initMotion() {
    if(!window.gsap||!window.ScrollTrigger){document.documentElement.classList.remove('intro-pending');return;}
    const gsap=window.gsap,ST=window.ScrollTrigger;gsap.registerPlugin(ST);
    initAboutTheme(gsap,ST);
    const mm=gsap.matchMedia();
    // Native scroll continuously controls a layered reading stack.
    const createScene=(section,panels,controlHost)=>{
      section.classList.add('is-scene');
      section.style.setProperty('--scene-count',String(panels.length));
      section.style.setProperty('--scene-screens',String(1+panels.length*.50));
      const controls=document.createElement('div');controls.className='scene-controls';
      const count=document.createElement('div');count.className='scene-controls__count';count.setAttribute('aria-hidden','true');
      const current=document.createElement('span');count.append(current,document.createTextNode(' / '+String(panels.length).padStart(2,'0')));
      const nav=document.createElement('div');nav.className='scene-controls__nav';nav.setAttribute('role','group');nav.setAttribute('aria-label','AI 업무 방식 살펴보기');
      controls.append(count,nav);controlHost.append(controls);
      const buttons=panels.map((panel,i)=>{
        const button=document.createElement('button');button.type='button';button.textContent=String(i+1).padStart(2,'0');
        button.setAttribute('aria-label',button.textContent+' '+$('h3',panel).textContent);nav.append(button);return button;
      });
      let active=-1,stride=260;
      const rise=t=>t*t*(3-2*t);
      const state={position:0};
      const measure=()=>{
        section.style.setProperty('--services-top',($('#nav')?.offsetHeight||68)+'px');
        stride=Math.max(...panels.map(p=>p.offsetHeight))+12;
      };
      const render=()=>{
        const index=Math.round(state.position);
        current.textContent=String(index+1).padStart(2,'0');section.dataset.phase=String(index);
        section.style.setProperty('--scene-index',String(index));section.style.setProperty('--scene-progress',String(state.position/Math.max(1,panels.length-1)));
        panels.forEach((panel,i)=>{
          const d=i-state.position;
          // Completed cards compress behind the current card; upcoming cards
          // stay legible below it. Focus changes at the midpoint: until then the
          // next card waits one stride below, drifting with the column, and only
          // afterwards rises over the outgoing card, so the focused card is never
          // covered. Surfaces stay opaque; depth dims content, not the card.
          let y,recede=0;
          if(d>=0){const step=Math.floor(d),u=d-step;y=step*stride+(u>=.5?stride+(u-1)*24:(stride-12)*rise(u/.5));}
          else{y=Math.max(-66,d*24);recede=d>=-.5?0:d>=-1?(-d-.5)*2:-d;}
          gsap.set(panel,{y,scale:1-Math.min(recede,3)*.035,z:-recede*20,
            '--stack-dim':Math.min(.28,recede*.09),zIndex:i+1,visibility:'visible'});
          if(index!==active){
            panel.classList.toggle('is-active',i===index);
            if(i===index)buttons[i].setAttribute('aria-current','step');else buttons[i].removeAttribute('aria-current');
          }
        });
        active=index;
      };
      measure();render();
      const timeline=gsap.timeline({onUpdate:render});
      timeline.to(state,{position:0,duration:.10}).to(state,{position:panels.length-1,duration:1,ease:'none'}).to(state,{position:panels.length-1,duration:.10});
      const trigger=ST.create({trigger:section,start:()=> 'top '+($('#nav')?.offsetHeight||68),end:'bottom bottom',animation:timeline,
        scrub:.20,invalidateOnRefresh:true,onRefreshInit:measure,onRefresh:render});
      const go=index=>moveTo(trigger.start+(.10+index/(panels.length-1))/1.20*(trigger.end-trigger.start));
      const clicks=buttons.map((button,i)=>{const click=()=>go(i);button.addEventListener('click',click);return click;});
      return()=>{
        trigger.kill();timeline.kill();
        buttons.forEach((button,i)=>button.removeEventListener('click',clicks[i]));controls.remove();
        section.classList.remove('is-scene');section.dataset.phase='0';
        ['--scene-screens','--scene-count','--scene-index','--scene-progress','--services-top'].forEach(p=>section.style.removeProperty(p));
        gsap.set(panels,{clearProps:'transform,opacity,visibility,clipPath,zIndex'});
        panels.forEach(panel=>{panel.inert=false;panel.removeAttribute('aria-hidden');panel.classList.remove('is-active');panel.style.removeProperty('--stack-dim');});
      };
    };
    mm.add('(prefers-reduced-motion: no-preference)',()=>{
      const hero=$('.hero');
      const records=[],wrappers=[],textRestores=[];
      // Initial visibility is always usable. Only an installed timeline masks content.
      const once=(element,compose)=>{
        if(!element||element.getBoundingClientRect().bottom<0)return;
        // Main-page content is owned by the reversible scene score below.
        if(hero)return;
        const timeline=gsap.timeline({paused:true,defaults:{ease:'power3.out'}});
        compose(timeline);
        const record={element,timeline};records.push(record);
        ST.create({trigger:element,start:hero?'top 84%':'top 91%',end:'bottom top',once:true,
          onEnter:()=>timeline.play(),onLeave:()=>timeline.progress(1),onEnterBack:()=>timeline.play()});
      };
      const revealWithin=target=>records.forEach(r=>{if(target.contains(r.element)||r.element.contains(target))r.timeline.progress(1);});
      window.portfolioMotion={revealWithin};
      const focus=e=>revealWithin(e.target);document.addEventListener('focusin',focus);
      const panelShown=e=>revealWithin(e.target);document.addEventListener('portfolio:panel-shown',panelShown);
      const restored=e=>{if(e.persisted){records.forEach(r=>{if(r.element.getBoundingClientRect().top<innerHeight)r.timeline.progress(1);});queueRefresh();}};
      addEventListener('pageshow',restored);
      const clip=(el,duration=.55)=>once(el,t=>t.fromTo(el,{clipPath:'inset(0 0 100% 0)'},{clipPath:'inset(0 0 0% 0)',duration,clearProps:'clipPath'}));
      const body=el=>once(el,t=>t.fromTo(el,{opacity:.3},{opacity:1,duration:.4,clearProps:'opacity'}));
      if(hero&&!location.hash&&scrollY<80&&performance.getEntriesByType?.('navigation')[0]?.type!=='back_forward'){
        const lines=$$('.type-mask > span',hero);
        const targets=[...lines,...$$('.site-nav__inner,.hero__identity,.hero__aside > p,.hero__aside > a')];
        let disposed=false,started=false,fontTimer;
        const release=()=>{clearTimeout(window.introSafety);document.documentElement.classList.remove('intro-pending');};
        // Construct inside matchMedia's context; delayed playback never creates orphan tweens.
        const intro=gsap.timeline({paused:true,defaults:{ease:MOTION.standardEase},
          onComplete:()=>{gsap.set(targets,{clearProps:'transform,opacity,clipPath,letterSpacing'});release();}});
        intro.fromTo('.site-nav__inner',{opacity:0,y:-4},{opacity:1,y:0,duration:MOTION.fast},0)
          .fromTo('.hero__identity',{opacity:0,x:-8},{opacity:1,x:0,duration:MOTION.fast},.06)
          .fromTo(lines[0],{x:-10,opacity:.65,letterSpacing:'.005em'},
            {x:0,opacity:1,letterSpacing:'-.045em',duration:.7},.10)
          .fromTo(lines[1],{x:8,clipPath:'inset(-12% 100% -20% -4%)'},
            {x:0,clipPath:'inset(-12% -4% -20% -4%)',duration:.72},.24)
          .fromTo('.hero__aside > p:first-child',{opacity:0,x:10},{opacity:1,x:0,duration:MOTION.standard},.4)
          .fromTo('.hero__aside > a',{opacity:0,scale:.98},{opacity:1,scale:1,duration:MOTION.standard},.65);
        records.push({element:hero,timeline:intro});
        const play=()=>{
          if(disposed||started)return;started=true;clearTimeout(fontTimer);release();
          if(scrollY>=80||location.hash||intro.progress()===1)intro.progress(1);
          else intro.play();
        };
        // Slow font requests must never hold the first screen indefinitely.
        fontTimer=setTimeout(play,180);
        Promise.resolve(document.fonts?.ready).then(play);
        textRestores.push(()=>{disposed=true;clearTimeout(fontTimer);intro.kill();release();});
      }else{
        clearTimeout(window.introSafety);document.documentElement.classList.remove('intro-pending');
      }
      if(!hero){
        $$('[data-reveal]').forEach(el=>clip(el));
        $$('.section-head > p,.contact__top p').forEach(body);
        $$('.section-label,.cs-label').forEach(el=>once(el,t=>t.fromTo(el,{clipPath:'inset(0 100% 0 0)',letterSpacing:'.06em'},{clipPath:'inset(0 0% 0 0)',letterSpacing:'0em',duration:.4,clearProps:'clipPath,letterSpacing'})));
      }
      // Details use shorter masks and separate image wrappers so hover owns its transform.
      $$('.detail-page .dh-hero__title,.detail-page .cs-title,.detail-page .dr-qa-group__title').forEach(el=>clip(el,.42));
      $$('.detail-page .case-image').forEach(el=>{
        const image=$('img',el);if(!image)return;
        // Hidden tab panels retain their fully visible resting state when opened.
        if(image.closest('.cs-tab-panel:not(.active)'))return;
        const mask=document.createElement('div');mask.className='motion-image-mask';image.before(mask);mask.appendChild(image);wrappers.push([mask,image]);
        once(el,t=>t.fromTo(mask,{clipPath:'inset(0 0 100% 0)'},{clipPath:'inset(0 0 0% 0)',duration:.48,clearProps:'clipPath'},0)
          .fromTo(image,{scale:1.018},{scale:1,duration:.58,clearProps:'transform'},0));
      });
      return()=>{document.removeEventListener('focusin',focus);document.removeEventListener('portfolio:panel-shown',panelShown);removeEventListener('pageshow',restored);delete window.portfolioMotion;wrappers.forEach(([mask,image])=>{mask.before(image);mask.remove();});textRestores.forEach(restore=>restore());};
    });
    // Pointer response belongs to the Hero sculpture; typography stays stable.
    mm.add('(min-width: 961px) and (min-height: 740px) and (prefers-reduced-motion: no-preference)',()=>{
      const cleanups=[];
      const services=$('.services');
      if(services){
        const stage=document.createElement('div');stage.className='services__stage';
        const children=[...services.children];services.append(stage);children.forEach(child=>stage.append(child));
        cleanups.push(createScene(services,$$('.service',services),$('.section-side',services)));
        cleanups.push(()=>{children.forEach(child=>stage.before(child));stage.remove();});
      }
      queueRefresh();
      return()=>{cleanups.forEach(cleanup=>cleanup());queueRefresh();};
    });
    // Short and touch-sized viewports stay in document flow. Focus still follows
    // the reading position in both directions, without hiding the other copy.
    mm.add('(max-width: 960px) and (prefers-reduced-motion: no-preference), (max-height: 739px) and (prefers-reduced-motion: no-preference)',()=>{
      const cleanups=[];
      [[$('.services'),'.service']].forEach(([section,selector])=>{
        if(!section)return;
        const rows=$$(selector,section);let centers=[],active=-1;
        section.classList.add('is-tracked');
        const measure=()=>{centers=rows.map(row=>{const r=row.getBoundingClientRect();return r.top+scrollY+r.height/2;});};
        const update=self=>{
          const position=self.scroll()+innerHeight*.52;let index=0;
          for(let i=1;i<centers.length;i++)if(position>=(centers[i-1]+centers[i])/2)index=i;
          if(index===active)return;active=index;section.dataset.phase=String(index);
          rows.forEach((row,i)=>row.classList.toggle('is-active',i===index));
        };
        measure();const trigger=ST.create({trigger:section,start:'top bottom',end:'bottom top',onUpdate:update,onRefresh:self=>{measure();update(self);}});update(trigger);
        cleanups.push(()=>{trigger.kill();section.classList.remove('is-tracked');section.dataset.phase='0';rows.forEach((row,i)=>row.classList.toggle('is-active',false));});
      });
      return()=>cleanups.forEach(cleanup=>cleanup());
    });
    mm.add({
      desktop:'(min-width: 1201px) and (min-height: 740px) and (prefers-reduced-motion: no-preference)',
      tablet:'(min-width: 769px) and (max-width: 1200px) and (min-height: 740px) and (prefers-reduced-motion: no-preference)',
      compact:'(max-width: 768px) and (prefers-reduced-motion: no-preference), (max-height: 739px) and (prefers-reduced-motion: no-preference)'
    },context=>{
      const hero=$('.hero');if(!hero)return;
      const amount=context.conditions.compact?.42:context.conditions.tablet?.7:1,scores=[],scenes=[];
      const about=$('#about'),portraitHost=$('#portrait-stage');
      const headerHeight=()=>$('#nav')?.offsetHeight||80;
      const syncAboutHeight=()=>about?.style.setProperty('--about-header-h',headerHeight()+'px');
      syncAboutHeight();ST.addEventListener('refreshInit',syncAboutHeight);

      // Backgrounds stay in document flow and always meet edge-to-edge.
      // Only content moves; sticky stages retain their native geometry.
      const configurations=[
        {section:hero,kind:'hero',recede:0,arrive:0},
        {section:about,kind:'about',recede:0,arrive:0},
        {section:$('.services'),kind:'ai',recede:.022,arrive:.018},
        {section:$('.tools'),kind:'tools',recede:.045,arrive:.028},
        {section:$('.work'),kind:'work',recede:.012,arrive:.012},
        {section:$('.contact'),kind:'contact',recede:0,arrive:.018}
      ];
      const smooth=t=>t*t*(3-2*t);
      for(const {section,kind,recede,arrive} of configurations){
        if(!section)continue;
        const titleMotion=kind==='hero'||kind==='about'?null:createSectionTitle(section,kind,amount);
        section.classList.add('has-scene-transition');section.dataset.scene=kind;
        const state={progress:0};let trigger=null;
        const render=()=>{
          if(!trigger)return;
          const distance=state.progress*(trigger.end-trigger.start);
          const height=section.offsetHeight,viewport=innerHeight;
          // Settle before reading/pinning. Exit starts only after sticky release.
          const entrySpan=kind==='contact'?Math.min(viewport*.68,height*.85):viewport*.68;
          const enter=kind==='hero'?1:smooth(clamp(distance/entrySpan,0,1));
          titleMotion?.render(enter);
          const remaining=kind==='hero'?height-distance:height+viewport-distance;
          const leave=kind==='contact'?0:smooth(clamp((viewport*.9-remaining)/(viewport*.9),0,1));
          if(kind!=='hero'&&kind!=='about')section.style.setProperty('--scene-scale',(1-amount*(arrive*(1-enter)+recede*leave)).toFixed(5));
          section.style.setProperty('--scene-y',(amount*((1-enter)*24-leave*16)).toFixed(3)+'px');
          section.style.setProperty('--scene-depth',(amount*((1-enter)*10-leave*10)).toFixed(3)+'px');
        };
        const score=gsap.timeline({paused:true,onUpdate:render})
          .to(state,{progress:1,duration:1,ease:'none'});
        trigger=ST.create({id:'scene-'+kind,trigger:section,
          start:kind==='hero'?'top top':'top bottom',end:'bottom top',
          animation:score,scrub:.18,invalidateOnRefresh:true,
          onRefresh:self=>{state.progress=self.progress;render();},
          // Snap after a large jump, rather than replay a delayed transition.
          onUpdate:self=>{
            if(Math.abs(self.progress-state.progress)>.18){
              self.getTween()?.progress(1);score.progress(self.progress);
            }
            if(kind==='hero'&&self.progress>.005)window.portfolioMotion?.revealWithin(hero);
          }
        });
        render();scenes.push({section,score,trigger,titleMotion});
      }

      // Keep the portrait's existing assembly, independent of scene parallax.
      const portraitState={progress:about?.dataset.activated==='true'?1:0};
      const updatePortrait=()=>{if(portraitHost){portraitHost.__portraitProgress=portraitState.progress;portraitHost.dispatchEvent(new Event('portraitprogress'));}};
      let aboutObserver=null;
      if(about&&about.dataset.activated!=='true'){
        const assembly=gsap.timeline({paused:true,onStart:()=>{about.dataset.activated='true';},onComplete:()=>{about.dataset.complete='true';}});
        assembly.to(portraitState,{progress:1,duration:1.05,ease:'power2.inOut',onUpdate:updatePortrait});
        scores.push(assembly);
        aboutObserver=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){assembly.play();aboutObserver.disconnect();}},
          {rootMargin:'0px 0px -12% 0px',threshold:0});
        aboutObserver.observe(about);
      }
      updatePortrait();

      // Keep sticky coordinates intact; only the nested Tools scene recedes.
      const tools=$('.tools');let toolsExit=null;
      if(tools){
        const exit=gsap.timeline({paused:true}).fromTo(tools,
          {'--tools-scene-scale':1,'--tools-scene-y':'0px','--tools-scene-radius':'0px'},
          {'--tools-scene-scale':1-.05*amount,'--tools-scene-y':(-36*amount)+'px',
            '--tools-scene-radius':(20*amount)+'px',duration:1,ease:'power1.inOut'});
        toolsExit=ST.create({id:'tools-handoff',trigger:tools,start:'bottom 110%',end:'bottom 35%',
          animation:exit,scrub:.18,invalidateOnRefresh:true,
          onUpdate:self=>{if(Math.abs(self.progress-exit.progress())>.18){self.getTween()?.progress(1);exit.progress(self.progress);}}});
        scores.push(exit);
      }

      queueRefresh();
      return()=>{
        aboutObserver?.disconnect();
        if(portraitHost){portraitHost.__portraitProgress=1;portraitHost.dispatchEvent(new Event('portraitprogress'));}
        toolsExit?.kill();
        if(tools)['--tools-scene-scale','--tools-scene-y','--tools-scene-radius'].forEach(p=>tools.style.removeProperty(p));
        ST.removeEventListener('refreshInit',syncAboutHeight);
        scores.forEach(t=>t.kill());
        scenes.forEach(({section,score,trigger,titleMotion})=>{
          trigger.kill();score.kill();
          titleMotion?.restore();
          section.classList.remove('has-scene-transition');delete section.dataset.scene;
          ['--scene-y','--scene-depth','--scene-scale','--scene-origin-y'].forEach(p=>section.style.removeProperty(p));
        });queueRefresh();
      };
    });
    document.fonts?.ready.then(queueRefresh);
    $$('main img[loading="lazy"]').forEach(img=>{if(!img.complete)img.addEventListener('load',queueRefresh,{once:true});});
    addEventListener('load',queueRefresh,{once:true});
    reduce.addEventListener('change',()=>{document.documentElement.classList.remove('intro-pending');queueRefresh();});
  }

  function start(){
    initScroll();initNavigation();initProjectIndex();initToolPointers();initVisualDepth();initToolsScroll();
    const exp=$('#hero-exp');if(exp){const now=new Date();const months=(now.getFullYear()-2023)*12+now.getMonth()-8;exp.textContent=Math.max(1,Math.floor(months/12)+1)+'년차';}
    // Old detail reveal hooks must never hide information if motion is unavailable.
    $$('.reveal').forEach(el=>el.classList.add('in-view'));
    initMotion();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
