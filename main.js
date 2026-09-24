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
      const toneLine=nav.getBoundingClientRect().bottom;
      nav.classList.toggle('is-dark',tones.some(s=>{const r=s.getBoundingClientRect();return s.dataset.tone==='dark'&&r.top<=toneLine&&r.bottom>toneLine;}));
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
    const rows=$$('.work-row'), preview=$('.work-preview');
    if(!rows.length)return;
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
    if(!preview)return;
    const visual=$('.work-preview__visual',preview),cache=new Map();
    let x=0,y=0,tx=0,ty=0,frame=0,last=0,active=null,token=0,pointer=null,scrollFrame=0;
    // Decode off-screen; only the latest hovered row may commit an image.
    const load=src=>{
      if(!cache.has(src))cache.set(src,new Promise(resolve=>{
        const img=new Image();img.alt='';img.width=1920;img.height=1080;
        img.onload=async()=>{try{await img.decode();}catch{}resolve(img.naturalWidth?img:null);};
        img.onerror=()=>{cache.delete(src);resolve(null);};img.src=src;
      }));return cache.get(src);
    };
    function draw(time){
      frame=0;const mix=reduce.matches?1:1-Math.exp(-Math.min(40,last?time-last:16.67)/65);last=time;
      x+=(tx-x)*mix;y+=(ty-y)*mix;preview.style.setProperty('--preview-x',x+'px');preview.style.setProperty('--preview-y',y+'px');
      if(active&&(Math.abs(tx-x)+Math.abs(ty-y)>.1))frame=requestAnimationFrame(draw);else last=0;
    }
    const place=e=>{const r=preview.getBoundingClientRect();tx=clamp(e.clientX-r.width*.55,16,Math.max(16,innerWidth-r.width-16));ty=clamp(e.clientY+26,88,Math.max(88,innerHeight-r.height-16));};
    const hide=()=>{active=null;token++;preview.classList.remove('is-visible');delete preview.dataset.project;cancelAnimationFrame(frame);frame=last=0;};
    const show=async(row,e)=>{
      if(!fine.matches||innerWidth<641||e.pointerType==='touch')return;
      pointer={clientX:e.clientX,clientY:e.clientY};place(pointer);
      if(active===row){if(!frame)frame=requestAnimationFrame(draw);return;}
      window.portfolioMotion?.revealWithin(row);
      active=row;const request=++token;preview.classList.remove('is-visible');preview.dataset.project=row.dataset.project;
      x=tx;y=ty;draw(performance.now());
      const img=await load(row.dataset.preview);
      if(request!==token||active!==row)return;
      if(!img){hide();return;}
      visual.replaceChildren(img);preview.classList.add('is-visible');
    };
    rows.forEach(row=>{
      row.addEventListener('pointerenter',e=>show(row,e));
      row.addEventListener('pointermove',e=>show(row,e),{passive:true});
      row.addEventListener('pointerleave',hide);row.addEventListener('click',hide);
    });
    addEventListener('scroll',()=>{
      if(!active||!pointer||scrollFrame)return;
      scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;const row=document.elementFromPoint(pointer.clientX,pointer.clientY)?.closest('.work-row');if(row)show(row,pointer);else hide();});
    },{passive:true});
    addEventListener('resize',hide,{passive:true});addEventListener('pageshow',hide);addEventListener('pagehide',()=>{hide();cancelAnimationFrame(scrollFrame);scrollFrame=0;});fine.addEventListener('change',hide);
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
        const preview=$('.work-preview');if(preview&&preview.dataset.project===surface.dataset.project&&surface.classList.contains('work-row')){preview.style.setProperty('--tilt-x',(x*.6).toFixed(3)+'deg');preview.style.setProperty('--tilt-y',(y*.6).toFixed(3)+'deg');}
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


  function initMotion() {
    if(!window.gsap||!window.ScrollTrigger){document.documentElement.classList.remove('intro-pending');return;}
    const gsap=window.gsap,ST=window.ScrollTrigger;gsap.registerPlugin(ST);
    const mm=gsap.matchMedia();
    // A reversible score: each pose has a reading hold, then a scrubbed
    // transition. The same playhead owns text, depth and graphic geometry.
    const createScene=(section,panels,controlHost)=>{
      section.classList.add('is-scene');
      section.style.setProperty('--scene-count',String(panels.length));
      section.style.setProperty('--scene-screens',String(1.24+(panels.length-1)*.46));
      const controls=document.createElement('div');controls.className='scene-controls';
      const count=document.createElement('div');count.className='scene-controls__count';count.setAttribute('aria-hidden','true');
      const current=document.createElement('span');count.append(current,document.createTextNode(' / '+String(panels.length).padStart(2,'0')));
      const nav=document.createElement('div');nav.className='scene-controls__nav';nav.setAttribute('role','group');
      nav.setAttribute('aria-label','디자인 과정 살펴보기');controls.append(count,nav);controlHost.append(controls);
      const bodies=panels.map(p=>$('p',p));
      const headings=panels.map(p=>$('h3',p));
      const buttons=panels.map((panel,i)=>{
        const button=document.createElement('button');button.type='button';button.textContent=String(i+1).padStart(2,'0');
        button.setAttribute('aria-label',button.textContent+' '+headings[i].textContent);nav.append(button);return button;
      });
      const pose=(i,index)=>{
        const delta=i-index,distance=Math.abs(delta),active=delta===0;
        return {x:0,y:clamp(delta,-2,2)*175,z:-Math.min(distance,2)*40,scale:active?1:.97,
          rotationX:0,autoAlpha:active?1:distance===1?.55:0};
      };
      let active=-1;
      const select=index=>{
        if(index===active)return;active=index;current.textContent=String(index+1).padStart(2,'0');
        section.dataset.phase=String(index);section.style.setProperty('--scene-index',String(index));
        panels.forEach((panel,i)=>{
          const selected=i===index;panel.classList.toggle('is-active',selected);panel.inert=!selected;
          if(selected){panel.removeAttribute('aria-hidden');buttons[i].setAttribute('aria-current','step');}
          else{panel.setAttribute('aria-hidden','true');buttons[i].removeAttribute('aria-current');}
          gsap.set(panel,{zIndex:selected?10:Math.max(0,5-Math.abs(i-index))});
        });
      };
      const duration=.4+(panels.length-1)*1.2;
      const score=gsap.timeline({paused:true,defaults:{ease:MOTION.sceneEase},onUpdate:()=>{
        select(clamp(Math.floor((score.time()+.475)/1.2),0,panels.length-1));
        section.style.setProperty('--scene-progress',String(score.progress()));
      }});
      panels.forEach((panel,i)=>{
        gsap.set(panel,pose(i,0));
        gsap.set(bodies[i],{opacity:i===0?1:0,y:0});
      });
      for(let index=1;index<panels.length;index++){
        const at=.4+(index-1)*1.2;
        panels.forEach((panel,i)=>{
          score.to(panel,{...pose(i,index),duration:MOTION.scene},at)
            .to(bodies[i],{opacity:i===index?1:0,y:0,duration:i===index?.3:.2,ease:MOTION.standardEase},at+(i===index?.4:0));
        });
      }
      score.to({hold:0},{hold:1,duration},0);
      select(0);
      const trigger=ST.create({trigger:section,start:'top 68px',end:'bottom bottom',animation:score,scrub:MOTION.scrub,invalidateOnRefresh:true});
      const clicks=buttons.map((button,i)=>{
        const click=()=>moveTo(trigger.start+((i===0?.2:i*1.2+.1)/duration)*(trigger.end-trigger.start));
        button.addEventListener('click',click);return click;
      });
      const restored=()=>{score.progress(trigger.progress);queueRefresh();};
      addEventListener('pageshow',restored);
      return()=>{
        trigger.kill();score.kill();removeEventListener('pageshow',restored);
        buttons.forEach((button,i)=>button.removeEventListener('click',clicks[i]));controls.remove();
        section.classList.remove('is-scene');section.dataset.phase='0';
        ['--scene-screens','--scene-count','--scene-index','--scene-progress'].forEach(p=>section.style.removeProperty(p));
        gsap.set([...panels,...headings,...bodies],{clearProps:'transform,opacity,visibility,clipPath,zIndex'});
        panels.forEach((panel,i)=>{panel.inert=false;panel.removeAttribute('aria-hidden');panel.classList.toggle('is-active',false);});
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
          onComplete:()=>{gsap.set(targets,{clearProps:'transform,opacity,clipPath'});release();}});
        intro.fromTo('.site-nav__inner',{opacity:0,y:-4},{opacity:1,y:0,duration:MOTION.fast},0)
          .fromTo('.hero__identity',{opacity:0,x:-8},{opacity:1,x:0,duration:MOTION.fast},.06)
          .fromTo(lines,{x:i=>i===0?-20:20,clipPath:'inset(-12% 100% -20% -4%)'},
            {x:0,clipPath:'inset(-12% -4% -20% -4%)',duration:.62,stagger:.09},.14)
          .fromTo('.hero__aside > p:first-child',{opacity:0,x:10},{opacity:1,x:0,duration:MOTION.standard},.4)
          .fromTo('.hero__desc',{opacity:0,x:6},{opacity:1,x:0,duration:MOTION.standard},.51)
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
    mm.add('(min-width: 961px) and (min-height: 700px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',()=>{
      const section=$('.tools'),viewport=$('.tools__viewport'),track=$('.tools__track');
      if(!section||!viewport||!track)return;
      const items=$$('.tool-item',track),progress=$('.tools__progress > span');
      const state={position:0};let distance=0,travel=0,top=68,centers=[],width=0;
      section.classList.add('is-horizontal');viewport.scrollLeft=0;
      const measure=()=>{
        top=Math.ceil($('#nav')?.getBoundingClientRect().height||68);
        width=viewport.clientWidth;
        distance=Math.max(0,track.scrollWidth-width);
        // The movement occupies 76% of the scroll range; both ends hold for 12%.
        travel=Math.max(innerHeight*.8,distance/.76);
        centers=items.map(item=>item.offsetLeft+item.offsetWidth/2);
        section.style.setProperty('--tools-top',top+'px');
        section.style.setProperty('--tools-run',travel+'px');
      };
      const render=()=>{
        const offset=distance*state.position;
        gsap.set(track,{x:-offset});
        items.forEach((item,i)=>{
          const proximity=1-clamp(Math.abs(centers[i]-offset-width/2)/(width*.65),0,1);
          gsap.set(item,{scale:.985+.015*proximity,opacity:.9+.1*proximity});
        });
        if(progress)gsap.set(progress,{scaleX:state.position});
      };
      measure();
      const score=gsap.timeline({paused:true,onUpdate:render});
      score.to(state,{position:1,duration:.76,ease:'none'},.12).to({hold:0},{hold:1,duration:1},0);
      const trigger=ST.create({trigger:section,start:()=>`top ${top}px`,end:()=>'+='+travel,
        animation:score,scrub:MOTION.scrub,invalidateOnRefresh:true,onRefreshInit:measure,onRefresh:render});
      const key=e=>{
        if(e.target!==viewport||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
        e.preventDefault();
        const step=items.length>1?centers[1]-centers[0]:width;
        const next=e.key==='Home'?0:e.key==='End'?distance:clamp(distance*state.position+(e.key==='ArrowRight'?step:-step),0,distance);
        const p=next===0?.06:next===distance?.94:.12+.76*(next/Math.max(1,distance));
        moveTo(trigger.start+p*(trigger.end-trigger.start));
      };
      viewport.addEventListener('keydown',key);
      const focusCard=e=>{
        const i=items.findIndex(item=>item.contains(e.target));if(i<0)return;
        viewport.scrollLeft=0;
        const next=clamp(centers[i]-width/2,0,distance);
        const p=next===0?.06:next===distance?.94:.12+.76*(next/Math.max(1,distance));
        moveTo(trigger.start+p*(trigger.end-trigger.start),{immediate:true});
      };
      viewport.addEventListener('focusin',focusCard);
      // Transforms do not change these layout dimensions, avoiding refresh loops.
      let previous='';
      const resized=()=>{
        const signature=[viewport.clientWidth,track.scrollWidth,$('#nav')?.offsetHeight,innerHeight].join(':');
        if(signature!==previous){previous=signature;queueRefresh();}
      };
      const observer='ResizeObserver' in window?new ResizeObserver(resized):null;
      [viewport,track,$('#nav')].filter(Boolean).forEach(el=>observer?.observe(el));
      addEventListener('resize',resized,{passive:true});render();queueRefresh();
      return()=>{
        observer?.disconnect();removeEventListener('resize',resized);viewport.removeEventListener('keydown',key);viewport.removeEventListener('focusin',focusCard);
        trigger.kill();score.kill();section.classList.remove('is-horizontal');
        section.style.removeProperty('--tools-top');section.style.removeProperty('--tools-run');
        gsap.set([track,...items,...(progress?[progress]:[])],{clearProps:'transform,opacity'});
        viewport.scrollLeft=0;queueRefresh();
      };
    });
    mm.add({
      desktop:'(min-width: 961px) and (min-height: 740px) and (prefers-reduced-motion: no-preference)',
      compact:'(max-width: 960px) and (prefers-reduced-motion: no-preference), (max-height: 739px) and (prefers-reduced-motion: no-preference)'
    },context=>{
      const hero=$('.hero');if(!hero)return;
      const amount=context.conditions.compact?.45:1,scores=[];
      const profile=$('.about__profile'),work=$('.work'),contact=$('.contact');
      // Section boundaries no longer animate both whole sections and their
      // children. Each score owns one primary surface and one supporting layer.
      const scene=(trigger,compose,end='clamp(top 28%)')=>{
        if(!trigger)return;
        const t=gsap.timeline({defaults:{ease:MOTION.sceneEase},scrollTrigger:{
          trigger,start:'clamp(top 94%)',end,scrub:MOTION.scrub,invalidateOnRefresh:true
        }});
        compose(t);t.to({hold:0},{hold:1,duration:1},0);scores.push(t);return t;
      };
      const settle=(t,target,from,at=0,duration=MOTION.scene)=>{
        if(target)t.fromTo(target,from,{x:0,y:0,z:0,scale:1,duration,ease:MOTION.standardEase},at);
      };
      let introFinished=false;
      const heroScore=gsap.timeline({defaults:{ease:MOTION.sceneEase},scrollTrigger:{
        trigger:hero,start:'top top',end:()=>'+='+hero.offsetHeight*.85,
        scrub:MOTION.scrub,invalidateOnRefresh:true,
        onUpdate:self=>{if(self.progress>.015&&!introFinished){introFinished=true;window.portfolioMotion?.revealWithin(hero);}}
      }});
      $$('.type-mask',hero).forEach((line,i)=>heroScore.fromTo(line,{x:0,y:0,scale:1},
        {x:()=>innerWidth*(i===0?-1.04:1.04),y:(i===0?-12:12)*amount,scale:.98,duration:MOTION.scene},.04));
      heroScore.fromTo($('.hero__aside',hero),{y:0,opacity:1},{y:32*amount,opacity:.35,duration:.7},.2);
      heroScore.fromTo(hero,{'--field-scroll':1,'--field-y':'0px'},{'--field-scroll':.15,'--field-y':'-24px',duration:.9},.1);
      heroScore.to({hold:0},{hold:1,duration:1},0);scores.push(heroScore);

      const portraitHost=$('#portrait-stage');
      const about=$('#about');
      // Resolve the scene first, then leave a short reading hold before release.
      const headerHeight=()=>Math.ceil($('#nav')?.getBoundingClientRect().height||80);
      const canPin=!context.conditions.compact&&about&&about.offsetHeight<=innerHeight-headerHeight()+2;
      const aboutPin=canPin?ST.create({trigger:about,pin:true,start:()=> 'top '+headerHeight()+'px',
        end:()=>'+='+Math.min(560,innerHeight*.58),pinSpacing:true,anticipatePin:1,
        refreshPriority:2,invalidateOnRefresh:true}):null;
      const profileScore=scene(profile,t=>{
        settle(t,$('.portrait'),{y:40*amount,z:-24,scale:.98},0);
        t.fromTo($('.about__copy > .section-label'),{opacity:0,x:10*amount},{opacity:1,x:0,duration:MOTION.fast},.28);
        const copy=$$('.about__copy > :not(.section-label):not(.about__metrics)');
        t.fromTo(copy,{opacity:0,x:18*amount},{opacity:1,x:0,duration:MOTION.standard,stagger:.035},.4);
      },()=>{
        // Use layout coordinates, not the portrait's animated bounding box.
        if(aboutPin)return aboutPin.start+(aboutPin.end-aboutPin.start)*.62;
        let top=0,node=portraitHost;
        while(node){top+=node.offsetTop;node=node.offsetParent;}
        const headerHeight=$('#nav')?.getBoundingClientRect().height||0;
        const readingCenter=headerHeight+(innerHeight-headerHeight)*.43;
        return Math.max(1,top+(portraitHost?.offsetHeight||360)*.5-readingCenter);
      });
      const updatePortrait=()=>{
        if(!portraitHost)return;
        portraitHost.__portraitProgress=profileScore?.progress()??1;
        portraitHost.dispatchEvent(new Event('portraitprogress'));
      };
      ST.sort();
      profileScore?.eventCallback('onUpdate',updatePortrait);
      ST.addEventListener('refresh',updatePortrait);
      updatePortrait();

      // What I Do has its own focus score. No competing section entrance.
      // Tools' horizontal score is primary; only its stationary heading settles.
      scene($('.tools'),t=>{
        settle(t,$('.tools .section-head h2'),{x:-24*amount},0,MOTION.scene);
        settle(t,$('.tools .section-head p'),{x:8*amount},.12,MOTION.standard);
      });

      // One project score replaces the header + five independent row triggers.
      // Cache layout reads on refresh; scroll updates only write transforms.
      if(work){
        const rows=$$('.work-row',work),heading=$('.section-head',work);
        const layers=rows.map(row=>({row,image:$('.work-row__reveal',row),copy:$('.work-row__copy',row),top:0,bottom:0}));
        const state={progress:0};let trigger=null;
        const ease=gsap.parseEase(MOTION.standardEase);
        const measure=()=>layers.forEach(layer=>{
          const r=layer.row.getBoundingClientRect();layer.top=r.top+scrollY;layer.bottom=r.bottom+scrollY;
        });
        const render=()=>{
          if(!trigger)return;
          const position=trigger.start+(trigger.end-trigger.start)*state.progress;
          const headerProgress=clamp((position-trigger.start)/(innerHeight*.35),0,1);
          gsap.set(heading,{x:-40*amount*(1-ease(headerProgress))});
          layers.forEach(layer=>{
            const enter=ease(clamp((position+innerHeight*.94-layer.top)/(innerHeight*.34),0,1));
            const leave=ease(clamp((position+innerHeight*.18-layer.bottom)/(innerHeight*.3),0,1));
            const y=(32*(1-enter)-24*leave)*amount;
            gsap.set(layer.image,{y,z:-40*(1-enter),scale:.96+.04*enter});
            gsap.set(layer.copy,{y:y*.6});
          });
        };
        measure();
        const score=gsap.timeline({paused:true,onUpdate:render});
        score.to(state,{progress:1,duration:1,ease:'none'});
        trigger=ST.create({trigger:work,start:'clamp(top 94%)',end:'clamp(bottom 12%)',
          animation:score,scrub:MOTION.scrub,onRefreshInit:measure,onRefresh:render,invalidateOnRefresh:true});
        score.scrollTrigger=trigger;scores.push(score);render();
      }
      // Closing scenes play on visibility, so a short mobile page always resolves.
      const contactEntries=new Map();
      const contactObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
        if(entry.isIntersecting){contactEntries.get(entry.target)?.play();contactObserver.unobserve(entry.target);}
      }),{threshold:.08});
      const closingScene=(element,compose)=>{
        if(!element)return;
        const t=gsap.timeline({paused:true,defaults:{ease:MOTION.standardEase}});
        compose(t);scores.push(t);contactEntries.set(element,t);contactObserver.observe(element);
      };
      closingScene($('.contact__invitation',contact),t=>{
        t.fromTo($('#contact-message'),{clipPath:'inset(0 100% 0 0)',x:-12*amount},
          {clipPath:'inset(0 0% 0 0)',x:0,duration:.7,ease:MOTION.standardEase},0);
        settle(t,$('.contact__email'),{x:10*amount},.2,.55);
      });
      closingScene($('.contact__plane',contact),t=>{
        settle(t,$('.contact__information'),{x:12*amount},0,.55);
        settle(t,$('.contact__wordmark > span'),{y:45*amount},.2,.7);
      });
      const focus=e=>{
        const row=e.target.closest('.work-row');
        if(row)gsap.set([$('.work-row__reveal',row),$('.work-row__copy',row)],{x:0,y:0,z:0,scale:1});
      };
      document.addEventListener('focusin',focus);queueRefresh();
      return()=>{
        document.removeEventListener('focusin',focus);
        contactObserver.disconnect();
        ST.removeEventListener('refresh',updatePortrait);aboutPin?.kill();
        if(portraitHost){portraitHost.__portraitProgress=1;portraitHost.dispatchEvent(new Event('portraitprogress'));}
        scores.forEach(t=>{t.scrollTrigger?.kill();t.kill();});queueRefresh();
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
