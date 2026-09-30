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
    // Case studies are read, not staged: they keep the browser's own scrolling.
    const reading=document.body.classList.contains('detail-page');
    const setup=()=>{
      stop();if(reading||reduce.matches||!fine.matches||!window.Lenis)return;
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
      // Change tone once a dark section reaches the header's midline, the line
      // its logo and links sit on. While an edge crosses the bar the bar is
      // clear, so the text always takes the tone of what lies behind it.
      // A section that owns a live palette (About) sets the header tone itself.
      const bar=nav.getBoundingClientRect(),toneLine=(bar.top+bar.bottom)/2;
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
    $$('.tool-row').forEach(card=>{
      let frame=0,point=null;
      const paint=()=>{
        frame=0;if(!point)return;
        const r=card.getBoundingClientRect();
        const u=clamp((point.x-r.left)/r.width,0,1),v=clamp((point.y-r.top)/r.height,0,1);
        card.style.setProperty('--local-x',u*100+'%');card.style.setProperty('--local-y',v*100+'%');
        card.style.setProperty('--logo-x',(u-.5)*4+'px');card.style.setProperty('--logo-y',(v-.5)*4+'px');
      };
      const reset=()=>{
        cancelAnimationFrame(frame);frame=0;point=null;card.classList.remove('is-pointed');
        ['--local-x','--local-y','--logo-x','--logo-y'].forEach(p=>card.style.removeProperty(p));
      };
      card.addEventListener('pointermove',e=>{
        if(reduce.matches||!fine.matches||e.pointerType==='touch')return;
        card.classList.add('is-pointed');point={x:e.clientX,y:e.clientY};
        if(!frame)frame=requestAnimationFrame(paint);
      },{passive:true});
      card.addEventListener('pointerleave',reset);card.addEventListener('pointercancel',reset);
      // Scrolling invalidates pointer-local coordinates; never leave a stale hotspot.
      addEventListener('scroll',reset,{passive:true});addEventListener('pagehide',reset);
      reduce.addEventListener('change',reset);fine.addEventListener('change',reset);
    });
  }

  const easeOut=t=>1-Math.pow(1-t,3);
  const easeInOut=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  // Each word travels inside its own clipped box, so the change reads at any
  // size and on any background. Progress is a pose: reverse travel retraces it.
  // 'rise' lifts words out of their line; 'converge' slides a two-word display
  // title in from opposite sides. Non-breaking phrases stay one word.
  function createTitleReveal(title,{accent=null,mode='rise',stagger=.07,span=.62}={}) {
    const original=[...title.childNodes],words=[],extras=[];
    for(const node of original){
      if(node.nodeType===Node.TEXT_NODE){
        const fragment=document.createDocumentFragment();
        for(const token of node.textContent.match(/[ \t\r\n]+|[^ \t\r\n]+/g)||[]){
          if(/^[ \t\r\n]+$/.test(token)){fragment.append(document.createTextNode(token));continue;}
          const mask=document.createElement('span');mask.className='title-word';
          const inner=document.createElement('span');inner.className='title-word__inner';inner.textContent=token;
          if(token===accent)mask.classList.add('title-word--accent');
          mask.append(inner);fragment.append(mask);words.push({mask,inner});
        }
        node.replaceWith(fragment);
      }else if(node.nodeType===Node.ELEMENT_NODE&&node.tagName!=='BR')extras.push(node);
    }
    title.classList.add('has-title-motion');title.dataset.titleMotion=mode;
    const step=words.length>1?Math.min(stagger,(1-span)/(words.length-1)):0;
    let previous=-1;
    const render=progress=>{
      if(Math.abs(previous-progress)<.0004)return;previous=progress;
      words.forEach(({mask,inner},i)=>{
        const t=easeOut(clamp((progress-i*step)/span,0,1)),rest=1-t;
        mask.style.setProperty('--word-accent',clamp((t-.55)/.45,0,1).toFixed(3));
        if(rest<.0005){inner.style.transform='';return;}
        const x=mode==='converge'?(i%2?1:-1)*rest*104:0,y=mode==='converge'?0:rest*112,r=mode==='rise'?rest*4:0;
        inner.style.transform='translate3d('+x.toFixed(2)+'%,'+y.toFixed(2)+'%,0) rotate('+r.toFixed(3)+'deg)';
      });
      // Counts and similar marks arrive after the words they annotate.
      const tail=easeOut(clamp((progress-.58)/.42,0,1));
      extras.forEach(el=>{el.style.opacity=tail>.999?'':tail.toFixed(3);el.style.translate=tail>.999?'':'0 '+((1-tail)*.5).toFixed(3)+'em';});
    };
    return {render,restore(){
      title.replaceChildren(...original);title.classList.remove('has-title-motion');delete title.dataset.titleMotion;
      extras.forEach(el=>{el.style.opacity='';el.style.translate='';});
    }};
  }

  // Numbers roll up to their value on digit reels. Assistive technology reads
  // a visually hidden copy of the original text instead of the reel digits.
  function createStatReels(list) {
    const gsap=window.gsap;if(!list||!gsap)return null;
    const reels=[],restores=[];
    $$('dd',list).forEach(dd=>{
      const node=[...dd.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&/^\s*\d/.test(n.textContent));
      if(!node)return;
      const text=node.textContent,label=document.createElement('span'),value=document.createElement('span');
      label.className='sr-only';label.textContent=text;value.className='stat-value';value.setAttribute('aria-hidden','true');
      // Each window is exactly its resting digit's advance (proportional figures,
      // tracking included, in em), so the settled number sets like plain text.
      const probe=document.createElement('span'),size=parseFloat(getComputedStyle(dd).fontSize)||16;dd.append(probe);
      const advance=ch=>{probe.textContent=ch;return (probe.getBoundingClientRect().width/size).toFixed(4)+'em';};
      for(const ch of text){
        if(!/\d/.test(ch)){value.append(ch);continue;}
        const digit=document.createElement('span'),reel=document.createElement('span');
        digit.className='stat-digit';reel.className='stat-reel';digit.style.width=advance(ch);
        for(let d=0;d<10;d++){const cell=document.createElement('span');cell.textContent=String(d);reel.append(cell);}
        digit.append(reel);value.append(digit);reels.push({reel,target:+ch});
      }
      probe.remove();node.replaceWith(label,value);restores.push(()=>{label.remove();value.replaceWith(node);});
    });
    if(!reels.length)return null;
    const tl=gsap.timeline({paused:true});
    reels.forEach(({reel,target},i)=>tl.fromTo(reel,{yPercent:0},{yPercent:-target*10,duration:1.25,ease:'expo.out'},i*.09));
    return {play:()=>tl.play(),progress:v=>tl.progress(v),destroy(){tl.kill();restores.forEach(restore=>restore());}};
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
    const darkScenes=$$('[data-tone="dark"]').filter(scene=>scene!==about);
    const syncHeader=()=>{
      // The header follows the scene directly beneath it, never the trigger:
      // over Hero it stays light; About's palette applies once About reaches
      // the bar's midline. While any tone edge (About's or a dark scene's)
      // crosses the bar, the bar is transparent so the real boundary shows
      // instead of a separate slab.
      const rect=about.getBoundingClientRect(),bar=nav.getBoundingClientRect(),middle=(bar.top+bar.bottom)/2;
      const active=rect.top<=middle&&rect.bottom>middle;
      const edges=[rect.top,rect.bottom];
      for(const scene of darkScenes){const r=scene.getBoundingClientRect();edges.push(r.top,r.bottom);}
      const crossing=edges.some(y=>y>bar.top+1&&y<bar.bottom-1);
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
      // About's content choreography follows the same moment as its colour.
      about.dataset.palette=isDark?'dark':'light';
      about.dispatchEvent(new CustomEvent('aboutscene',{detail:{dark:isDark,immediate}}));
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
      // Scroll length follows the content: about a third of a screen per step.
      section.style.setProperty('--scene-screens',String(1+panels.length*.32));
      const controls=document.createElement('div');controls.className='scene-controls';
      const count=document.createElement('div');count.className='scene-controls__count';count.setAttribute('aria-hidden','true');
      const current=document.createElement('span');count.append(current,document.createTextNode(' / '+String(panels.length).padStart(2,'0')));
      const nav=document.createElement('div');nav.className='scene-controls__nav';nav.setAttribute('role','group');nav.setAttribute('aria-label','AI 업무 방식 살펴보기');
      controls.append(count,nav);controlHost.append(controls);
      const buttons=panels.map((panel,i)=>{
        const button=document.createElement('button');button.type='button';button.textContent=String(i+1).padStart(2,'0');
        button.setAttribute('aria-label',button.textContent+' '+$('h3',panel).textContent);nav.append(button);return button;
      });
      let active=-1,stride=260,entry=1;
      const rise=t=>t*t*(3-2*t);
      const state={position:0};
      const rollCount=direction=>{gsap.killTweensOf(current);gsap.fromTo(current,{yPercent:direction*55,opacity:0},{yPercent:0,opacity:1,duration:.42,ease:'power3.out'});};
      const measure=()=>{
        section.style.setProperty('--services-top',($('#nav')?.offsetHeight||68)+'px');
        stride=Math.max(...panels.map(p=>p.offsetHeight))+12;
      };
      const render=()=>{
        const index=Math.round(state.position);
        if(active>=0&&index!==active)rollCount(index>active?1:-1);
        current.textContent=String(index+1).padStart(2,'0');section.dataset.phase=String(index);
        section.style.setProperty('--scene-index',String(index));section.style.setProperty('--scene-progress',String(state.position/Math.max(1,panels.length-1)));
        // Arriving, the queue is fanned out and gathers as the section lands.
        // On the last step the whole stack settles onto the column's centre,
        // so the final card never leaves the lower half of the column empty.
        const fan=1-entry,settle=clamp(state.position-(panels.length-2),0,1)*stride*.42;
        panels.forEach((panel,i)=>{
          const d=i-state.position;
          // Completed cards compress behind the current card; upcoming cards
          // stay legible below it. Focus changes at the midpoint: until then the
          // next card waits one stride below, drifting with the column, and only
          // afterwards rises over the outgoing card, so the focused card is never
          // covered. Surfaces stay opaque; depth dims content, not the card.
          let y,recede=0;
          if(d>=0){const step=Math.floor(d),u=d-step;y=step*stride+(u>=.5?stride+(u-1)*24:(stride-12)*rise(u/.5))+d*stride*.55*fan;}
          else{y=Math.max(-66,d*24);recede=d>=-.5?0:d>=-1?(-d-.5)*2:-d;}
          gsap.set(panel,{y:y+settle+fan*56,scale:1-Math.min(recede,3)*.035,z:-recede*20,
            '--stack-dim':Math.min(.28,recede*.09+(d>.5?fan*.22:0)),zIndex:i+1,visibility:'visible'});
          if(index!==active){
            panel.classList.toggle('is-active',i===index);
            if(i===index)buttons[i].setAttribute('aria-current','step');else buttons[i].removeAttribute('aria-current');
          }
        });
        active=index;
      };
      measure();render();
      // The section's arrival progress (scene score) fans the queue in.
      section.__stackEntry=value=>{if(Math.abs(value-entry)<.0005)return;entry=value;render();};
      const timeline=gsap.timeline({onUpdate:render});
      timeline.to(state,{position:0,duration:.10}).to(state,{position:panels.length-1,duration:1,ease:'none'}).to(state,{position:panels.length-1,duration:.10});
      // The section keeps one extra screen of pinned stage after the last card
      // (CSS): the stack completes before it, and Tools rises over the stage
      // during it. That screen is the handoff, not more reading.
      const trigger=ST.create({trigger:section,start:()=> 'top '+($('#nav')?.offsetHeight||68),end:()=>'bottom bottom+='+innerHeight,animation:timeline,
        scrub:.20,invalidateOnRefresh:true,onRefreshInit:measure,onRefresh:render});
      const go=index=>moveTo(trigger.start+(.10+index/(panels.length-1))/1.20*(trigger.end-trigger.start));
      const clicks=buttons.map((button,i)=>{const click=()=>go(i);button.addEventListener('click',click);return click;});
      return()=>{
        trigger.kill();timeline.kill();gsap.killTweensOf(current);delete section.__stackEntry;
        buttons.forEach((button,i)=>button.removeEventListener('click',clicks[i]));controls.remove();
        section.classList.remove('is-scene');section.dataset.phase='0';
        ['--scene-screens','--scene-count','--scene-index','--scene-progress','--services-top'].forEach(p=>section.style.removeProperty(p));
        gsap.set(panels,{clearProps:'transform,opacity,visibility,clipPath,zIndex'});
        panels.forEach(panel=>{panel.inert=false;panel.removeAttribute('aria-hidden');panel.classList.remove('is-active');panel.style.removeProperty('--stack-dim');});
      };
    };
    mm.add('(prefers-reduced-motion: no-preference)',()=>{
      const hero=$('.hero');
      // Initial visibility is always usable. Only an installed timeline masks
      // content; the main page's scroll content is owned by the scene scores.
      const records=[],textRestores=[];
      const revealWithin=target=>records.forEach(r=>{if(target.contains(r.element)||r.element.contains(target))r.timeline.progress(1);});
      window.portfolioMotion={revealWithin};
      const focus=e=>revealWithin(e.target);document.addEventListener('focusin',focus);
      const panelShown=e=>revealWithin(e.target);document.addEventListener('portfolio:panel-shown',panelShown);
      const restored=e=>{if(e.persisted){records.forEach(r=>{if(r.element.getBoundingClientRect().top<innerHeight)r.timeline.progress(1);});queueRefresh();}};
      addEventListener('pageshow',restored);
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
            {x:0,opacity:1,letterSpacing:'-.056em',duration:.7},.10)
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
      return()=>{document.removeEventListener('focusin',focus);document.removeEventListener('portfolio:panel-shown',panelShown);removeEventListener('pageshow',restored);delete window.portfolioMotion;textRestores.forEach(restore=>restore());};
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
      const amount=context.conditions.compact?.42:context.conditions.tablet?.7:1,scores=[],scenes=[],cleanups=[],vars=[];
      const about=$('#about'),portraitHost=$('#portrait-stage');
      const headerHeight=()=>$('#nav')?.offsetHeight||80;
      const syncAboutHeight=()=>about?.style.setProperty('--about-header-h',headerHeight()+'px');
      syncAboutHeight();ST.addEventListener('refreshInit',syncAboutHeight);
      const smooth=t=>t*t*(3-2*t);

      // Paused timelines are poses on a 0–1 axis. A scene's arrival or exit
      // progress seeks them, so every scroll frame is a composed state and
      // reverse travel retraces it exactly. Motion lives on content; section
      // backgrounds stay in document flow and meet edge to edge.
      const pose=()=>gsap.timeline({paused:true,defaults:{ease:'none'}}).set({},{},1);
      const drive=(tl,el,name,at,duration,ease)=>{if(!el)return;vars.push([el,name]);tl.fromTo(el,{[name]:0},{[name]:1,duration,ease},at);};
      const wipe=(tl,el,at)=>{if(el)tl.fromTo(el,{clipPath:'inset(-25% 100% -25% 0%)'},{clipPath:'inset(-25% 0% -25% 0%)',duration:.3,ease:'power2.inOut'},at);};
      const lift=(tl,els,at,{y=18,duration=.32,stagger=.06}={})=>{els=els.filter(Boolean);if(els.length)tl.fromTo(els,{y:y*(.5+.5*amount),opacity:0},{y:0,opacity:1,duration,stagger,ease:'power3.out'},at);};
      const entries={
        work:section=>{const tl=pose();wipe(tl,$('.section-eyebrow',section),0);lift(tl,[$('.section-description',section)],.34);return tl;},
        // The process column assembles before its first card takes focus.
        ai:section=>{const tl=pose(),side=$('.section-side',section);if(!side)return tl;
          wipe(tl,$('.section-eyebrow',side),0);lift(tl,[$('.services__intro',side)],.3);lift(tl,[$('.scene-controls',side)],.42,{y:12});return tl;},
        // The surface is the arrival; inside it only the tools settle into
        // their rows, late in the rise. No second rule or heading motion.
        tools:section=>{const tl=pose();wipe(tl,$('.section-eyebrow',section),.2);lift(tl,[$('.section-description',section)],.34);
          $$('.tool-group',section).forEach((group,g)=>$$('.tool-row',group).forEach((row,r)=>{
            const at=.46+g*.07+r*.06;
            drive(tl,row,'--row-in',at,.3,'power3.out');
            drive(tl,row,'--logo-in',at+.04,.32,'back.out(1.7)');
          }));
          return tl;}
      };
      const exits={
        // Leaving, the columns recede in depth under the folding surface.
        tools:section=>{const tl=pose(),head=$('.section-header',section);
          if(head)tl.fromTo(head,{opacity:1,y:0},{opacity:.18,y:-30*amount,duration:.66,ease:'power1.in'},.06);
          $$('.tool-group',section).forEach((group,g)=>drive(tl,group,'--exit',.12+g*.08,.76-g*.08,'power1.in'));
          return tl;}
      };
      // A project row composes while its top travels the lower 55% of the view:
      // the divider draws, the image opens left to right, the copy meets it.
      const workRows=section=>{
        const rows=$$('.work-row',section);let tops=[];
        const measure=()=>{tops=rows.map(row=>{let y=0;for(let node=row;node;node=node.offsetParent)y+=node.offsetTop;return y;});};
        measure();ST.addEventListener('refresh',measure);
        cleanups.push(()=>{ST.removeEventListener('refresh',measure);rows.forEach(row=>{['--row-line','--row-img','--row-copy'].forEach(p=>row.style.removeProperty(p));row.classList.remove('is-revealed');});});
        return (enter,leave,scroll)=>{
          const viewport=innerHeight;
          rows.forEach((row,i)=>{
            const p=clamp((scroll+viewport-tops[i])/(viewport*.55),0,1);
            const image=easeInOut(clamp((p-.06)/.62,0,1));
            row.style.setProperty('--row-line',easeOut(clamp(p/.5,0,1)).toFixed(4));
            row.style.setProperty('--row-img',image.toFixed(4));
            row.style.setProperty('--row-copy',easeOut(clamp((p-.26)/.74,0,1)).toFixed(4));
            row.classList.toggle('is-revealed',image>.999);
          });
        };
      };
      const hooks={
        // The poster leaves on its own axes: the grey line drifts up-left
        // behind the sculpture, the ink line down-right in front, while the
        // sculpture itself is already retracing its cubes home.
        hero:section=>{
          cleanups.push(()=>section.style.removeProperty('--hero-leave'));
          return (enter,leave)=>section.style.setProperty('--hero-leave',smooth(leave).toFixed(4));
        },
        // About lifts off the page: its lower corners round as it leaves.
        about:section=>(enter,leave)=>section.style.setProperty('--about-radius',(44*amount*smooth(leave)).toFixed(2)+'px'),
        // Tools is one surface. It rises over the pinned AI stage as an inset,
        // rounded card and opens to full bleed as its top reaches the header;
        // the stage beneath recedes and dims. Leaving, its lower edge draws in
        // again and rounds, uncovering the light Contact scene.
        tools:section=>{
          const services=$('.services'),nav=$('#nav'),written=new Map();
          let navH=nav?.offsetHeight||80,width=section.clientWidth||innerWidth,clear=false;
          const measure=()=>{navH=nav?.offsetHeight||80;width=section.clientWidth||innerWidth;};ST.addEventListener('refresh',measure);
          // Style writes only when a value changes.
          const put=(el,name,value)=>{if(!el)return;const key=el.id+name;if(written.get(key)!==value){written.set(key,value);el.style.setProperty(name,value);}};
          cleanups.push(()=>{ST.removeEventListener('refresh',measure);nav?.classList.remove('is-scene-handoff');nav?.style.removeProperty('--bar-clip');
            ['--tools-clip','--tools-veil'].forEach(p=>section.style.removeProperty(p));services?.style.removeProperty('--ai-recede');});
          // Geometry comes from the scene's own progress: no layout reads here.
          return (enter,leave,scroll,distance,height,viewport)=>{
            const top=viewport-distance,bottom=top+height,pinned=!!services?.classList.contains('is-scene');
            const rising=top>0&&top<viewport,open=smooth(clamp((viewport-top)/Math.max(1,viewport-navH),0,1));
            const fold=easeInOut(clamp((viewport-bottom)/(viewport*.85),0,1)),folding=fold>.001&&bottom>0&&bottom<viewport;
            // Whole pixels keep the side edges crisp while they move.
            const inset=Math.round(Math.max((1-open)*7,fold*5)*amount*width/100),topR=(1-open)*44*amount,bottomR=fold*44*amount;
            put(section,'--tools-clip',inset<1&&topR<.05&&bottomR<.05?'none':'inset(0 '+inset+'px 0 '+inset+'px round '+topR.toFixed(2)+'px '+topR.toFixed(2)+'px '+bottomR.toFixed(2)+'px '+bottomR.toFixed(2)+'px)');
            put(services,'--ai-recede',(rising?open:top<=0?1:0).toFixed(4));
            put(section,'--tools-veil',(pinned&&rising?open:0).toFixed(4));
            // During a handoff the bar never reads as a separate slab: over the
            // veil it is clear, over the folding surface its fill takes the
            // surface's width, so content still passes beneath an opaque bar.
            const handoff=(pinned&&rising)||folding;
            if(handoff!==clear){clear=handoff;nav?.classList.toggle('is-scene-handoff',handoff);}
            put(nav,'--bar-clip',folding?'inset(0 '+inset+'px)':'inset(0 50%)');
          };
        },
        ai:section=>enter=>section.__stackEntry?.(smooth(enter)),
        work:workRows
      };
      const configurations=[
        {section:hero,kind:'hero'},
        {section:about,kind:'about'},
        {section:$('.work'),kind:'work',title:{mode:'converge',stagger:.16,span:.68}},
        {section:$('.services'),kind:'ai',title:{accent:'AI로',stagger:.08,span:.6}},
        {section:$('.tools'),kind:'tools',title:{stagger:.06,span:.56}}
      ];
      for(const {section,kind,title:options} of configurations){
        if(!section)continue;
        const heading=options&&$('.section-title',section),title=heading?createTitleReveal(heading,options):null;
        section.classList.add('has-scene-transition');section.dataset.scene=kind;
        const entry=entries[kind]?.(section)||null,exit=exits[kind]?.(section)||null,hook=hooks[kind]?.(section)||null;
        const state={progress:0};let trigger=null;
        const render=()=>{
          if(!trigger)return;
          const distance=state.progress*(trigger.end-trigger.start);
          const height=section.offsetHeight,viewport=innerHeight;
          // Arrival completes before reading or pinning; exit starts after release.
          const enter=kind==='hero'?1:clamp(distance/(viewport*.68),0,1);
          const remaining=kind==='hero'?height-distance:height+viewport-distance;
          const leave=clamp((viewport*.9-remaining)/(viewport*.9),0,1);
          title?.render(enter);entry?.progress(enter);exit?.progress(leave);
          hook?.(enter,leave,trigger.start+distance,distance,height,viewport);
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
        render();scenes.push({section,score,trigger,title,entry,exit});
      }

      // Contact is the finale. Once its question is on screen the lines rise,
      // then the two ways to reach out draw their rules and settle: one short
      // composition, played rather than scrubbed, so it always completes. It
      // resets only after the scene has left below the view.
      const contact=$('.contact'),message=$('#contact-message');
      if(contact&&message){
        const tl=gsap.timeline({paused:true}),lines=$$('.contact__line > span',contact);
        wipe(tl,$('.contact__eyebrow',contact),0);
        lines.forEach((line,i)=>tl.fromTo(line,{yPercent:108},{yPercent:0,duration:.95,ease:'power3.out'},.1+i*.16));
        $$('.contact__action',contact).forEach((action,i)=>{drive(tl,action,'--line-in',.55+i*.14,.8,'power2.inOut');drive(tl,action,'--action-in',.72+i*.14,.7,'power3.out');});
        const show=new IntersectionObserver(([item])=>{if(item.isIntersecting&&!tl.isActive()&&tl.progress()<1)tl.play();},{rootMargin:'0px 0px -12% 0px'});
        const reset=new IntersectionObserver(([item])=>{if(!item.isIntersecting&&item.boundingClientRect.top>0)tl.pause(0);});
        show.observe(message);reset.observe(contact);
        cleanups.push(()=>{show.disconnect();reset.disconnect();tl.progress(1).kill();gsap.set(lines,{clearProps:'transform'});});
      }

      // About arrives with its colour: the title rises at the flip; the career
      // path and the numbers compose once each is on screen. Turning back to the
      // Hero resets them, so the next arrival composes again.
      if(about){
        const heading=$('.section-title',about),reveal=heading?createTitleReveal(heading,{stagger:.05,span:.6}):null;
        // Before the flip About shares the Hero's paper, so its heading waits
        // unseen; eyebrow and title arrive together with the colour.
        const proxy={p:0},titleTl=gsap.timeline({paused:true}).to(proxy,{p:1,duration:1.1,ease:'none',onUpdate:()=>reveal?.render(proxy.p)});
        wipe(titleTl,$('.section-eyebrow',about),0);
        reveal?.render(0);
        const stages=$$('.career__stage',about),practice=$('.about__practice',about),career=gsap.timeline({paused:true});
        stages.forEach((stage,i)=>{
          const at=i*.32;
          drive(career,stage,'--node-in',at,.5,'back.out(2.4)');
          drive(career,stage,'--stage-in',at+.06,.62,'power3.out');
          if(i<stages.length-1)drive(career,stage,'--rail-in',at+.26,.42,'power2.inOut');
        });
        if(practice)career.fromTo(practice,{opacity:0,y:12},{opacity:1,y:0,duration:.6,ease:'power2.out'},stages.length*.32);
        const reels=createStatReels($('.about__metrics',about));
        let observers=[];
        const watch=(el,play)=>{if(!el)return null;const io=new IntersectionObserver(items=>{if(items.some(item=>item.isIntersecting)){io.disconnect();play();}},{threshold:.3});io.observe(el);return io;};
        const release=()=>{observers.forEach(io=>io?.disconnect());observers=[];};
        const set=(dark,immediate)=>{
          release();
          if(dark&&immediate){titleTl.progress(1);career.progress(1);reels?.progress(1);return;}
          if(dark){titleTl.play();observers=[watch($('.career',about),()=>career.play()),watch($('.about__metrics',about),()=>reels?.play())];return;}
          if(immediate)titleTl.progress(0);else titleTl.reverse();
          career.pause().progress(0);reels?.progress(0);
        };
        const onScene=event=>set(event.detail.dark,event.detail.immediate);
        about.addEventListener('aboutscene',onScene);set(about.dataset.palette==='dark',true);
        cleanups.push(()=>{about.removeEventListener('aboutscene',onScene);release();titleTl.kill();career.kill();reels?.destroy();reveal?.restore();if(practice)gsap.set(practice,{clearProps:'transform,opacity'});});
      }

      // The portrait gathers only once it is actually in view.
      const portraitState={progress:about?.dataset.activated==='true'?1:0};
      const updatePortrait=()=>{if(portraitHost){portraitHost.__portraitProgress=portraitState.progress;portraitHost.dispatchEvent(new Event('portraitprogress'));}};
      let aboutObserver=null;
      if(about&&about.dataset.activated!=='true'){
        const assembly=gsap.timeline({paused:true,onStart:()=>{about.dataset.activated='true';},onComplete:()=>{about.dataset.complete='true';}});
        assembly.to(portraitState,{progress:1,duration:1.05,ease:'power2.inOut',onUpdate:updatePortrait});
        scores.push(assembly);
        aboutObserver=new IntersectionObserver(items=>{if(items.some(item=>item.isIntersecting)){assembly.play();aboutObserver.disconnect();}},{threshold:.35});
        aboutObserver.observe(portraitHost||about);
      }
      updatePortrait();

      queueRefresh();
      return()=>{
        aboutObserver?.disconnect();
        if(portraitHost){portraitHost.__portraitProgress=1;portraitHost.dispatchEvent(new Event('portraitprogress'));}
        ST.removeEventListener('refreshInit',syncAboutHeight);
        scores.forEach(t=>t.kill());cleanups.forEach(cleanup=>cleanup());
        scenes.forEach(({section,score,trigger,title,entry,exit})=>{
          trigger.kill();score.kill();entry?.progress(1).kill();exit?.progress(0).kill();
          title?.restore();
          section.classList.remove('has-scene-transition');delete section.dataset.scene;
        });
        vars.forEach(([el,name])=>el.style.removeProperty(name));
        gsap.set($$('.section-eyebrow,.section-description,.services__intro,.scene-controls,.section-header'),{clearProps:'clipPath,transform,opacity'});
        about?.style.removeProperty('--about-radius');
        queueRefresh();
      };
    });
    document.fonts?.ready.then(queueRefresh);
    $$('main img[loading="lazy"]').forEach(img=>{if(!img.complete)img.addEventListener('load',queueRefresh,{once:true});});
    addEventListener('load',queueRefresh,{once:true});
    reduce.addEventListener('change',()=>{document.documentElement.classList.remove('intro-pending');queueRefresh();});
  }

  function start(){
    initScroll();initNavigation();initProjectIndex();initToolPointers();initVisualDepth();
    const exp=$('#hero-exp');if(exp){const now=new Date();const months=(now.getFullYear()-2023)*12+now.getMonth()-8;exp.textContent=Math.max(1,Math.floor(months/12)+1)+'년차';}
    // Old detail reveal hooks must never hide information if motion is unavailable.
    $$('.reveal').forEach(el=>el.classList.add('in-view'));
    initMotion();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
