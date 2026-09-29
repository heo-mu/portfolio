/* Reading navigation; project restoration shares the main page's existing key. */
(() => {
 'use strict';
 const paths=['project_deurim.html','project01.html','project02.html','project03.html','project04.html'];
 const index=paths.indexOf(location.pathname.split('/').pop());
 const remember=()=>{if(index>=0)try{sessionStorage.setItem('hm:proj',String(index));}catch{}};
 remember();addEventListener('pageshow',remember);
 // Case-study images are reference material, not links or lightbox triggers.
 document.querySelectorAll('.case-image__link').forEach(link=>{
  link.removeAttribute('href');
  link.removeAttribute('target');
  link.removeAttribute('rel');
  link.removeAttribute('aria-label');
  link.setAttribute('aria-disabled','true');
 });
 const nav=document.querySelector('.case-nav'),toc=document.querySelector('.case-index');
 const links=[...document.querySelectorAll('.case-index a')];
 const sections=links.map(a=>document.getElementById(a.hash.slice(1)));
 const progress=document.getElementById('read-progress'),topButton=document.getElementById('scrollToTop');
 const next=document.querySelector('.next-projects');
 const offset=()=> (nav?.offsetHeight||0)+(toc?.offsetHeight||0)+24;
 let frame=0,lastActive=-1;
 const measureChrome=()=>{document.body.style.setProperty('--detail-header',(nav?.offsetHeight||0)+'px');document.body.style.setProperty('--detail-tabs',(toc?.offsetHeight||0)+'px');schedule();};
 const chromeObserver=new ResizeObserver(measureChrome);if(nav)chromeObserver.observe(nav);if(toc)chromeObserver.observe(toc);
 function update(){
  frame=0;
  const y=window.scrollY,limit=next?next.getBoundingClientRect().top+y-innerHeight:document.documentElement.scrollHeight-innerHeight;
  if(progress)progress.style.width=Math.min(100,Math.max(0,y/Math.max(1,limit)*100))+'%';
  let active=0;sections.forEach((s,i)=>{if(s&&s.getBoundingClientRect().top<=offset()+24)active=i;});
  links.forEach((a,i)=>{if(i===active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
  if(active!==lastActive){
   const item=links[active],rail=toc?.querySelector('.container');
   if(item&&rail){const a=item.getBoundingClientRect(),r=rail.getBoundingClientRect();if(a.left<r.left||a.right>r.right)rail.scrollTo({left:rail.scrollLeft+a.left-r.left-(r.width-a.width)/2,behavior:'auto'});}
   lastActive=active;
  }
  topButton?.classList.toggle('visible',y>600);
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(update);}
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});
 addEventListener('load',schedule);addEventListener('pageshow',schedule);document.fonts?.ready.then(schedule);
 document.querySelectorAll('.study-more').forEach(details=>details.addEventListener('toggle',()=>{
  window.portfolioScroll?.refresh();schedule();
 }));
 document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
  const target=document.getElementById(decodeURIComponent(a.hash.slice(1)));if(!target)return;
  e.preventDefault();
  const y=Math.max(0,target.getBoundingClientRect().top+scrollY-offset());
  if(window.portfolioScroll)window.portfolioScroll.moveTo(y);else scrollTo({top:y,behavior:'auto'});
  history.replaceState(null,'',a.hash);target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
 }));
 topButton?.addEventListener('click',()=>{if(window.portfolioScroll)window.portfolioScroll.moveTo(0);else scrollTo(0,0);});
 measureChrome();update();
 initStudyMotion();
})();

/* Reading-paced motion, one step quieter than the main page. Each component
   composes once, as it reaches the lower fifth of the view, and its motion
   follows its meaning: problems settle out of disarray, a flow runs in order,
   a decision resolves left to right, results arrive already still. Nothing is
   scrubbed, nothing hides again on the way back up, and anything already on
   screen when the page opens is left as it is. */
function initStudyMotion() {
 const gsap=window.gsap,reduce=matchMedia('(prefers-reduced-motion: reduce)');
 if(!gsap||reduce.matches||!('IntersectionObserver' in window))return;
 const $$=(s,root=document)=>[...root.querySelectorAll(s)];
 const timelines=new Map(),cleared=[];
 const drive=(tl,el,name,at,duration,ease='power2.inOut')=>{if(!el)return;cleared.push([el,name]);tl.fromTo(el,{[name]:0},{[name]:1,duration,ease},at);};
 const rise=(tl,els,at,{y=14,duration=.7,stagger=.05,ease='power3.out'}={})=>{els=[els].flat().filter(Boolean);if(els.length)tl.fromTo(els,{y,opacity:0},{y:0,opacity:1,duration,stagger,ease},at);};
 // Artifacts open top-down inside their frame while the image settles in scale.
 const reveal=(tl,frame,at)=>{
  if(!frame)return;
  tl.fromTo(frame,{clipPath:'inset(0% 0% 100% 0% round 12px)'},{clipPath:'inset(0% 0% 0% 0% round 12px)',duration:.9,ease:'power3.inOut'},at);
  const image=frame.querySelector('img');if(image)tl.fromTo(image,{scale:1.05},{scale:1,duration:1.1,ease:'power3.out'},at);
 };
 const recipes=[
  ['.study-heading',(el,tl)=>{
   const eyebrow=el.querySelector('.study-eyebrow');
   if(eyebrow)tl.fromTo(eyebrow,{clipPath:'inset(-25% 100% -25% 0%)'},{clipPath:'inset(-25% 0% -25% 0%)',duration:.5,ease:'power2.inOut'},0);
   rise(tl,el.querySelector('h2'),.08,{y:22,duration:.8});rise(tl,el.querySelector('.study-heading__lead'),.2);
  }],
  // Problems start slightly out of line and settle into one.
  ['.study-issues',(el,tl)=>$$('.study-issue',el).forEach((item,i)=>{
   tl.fromTo(item,{y:[22,-10,16,-6][i%4],rotation:[-1.4,1,-.8,.6][i%4],opacity:0},{y:0,rotation:0,opacity:1,duration:.9,ease:'power3.out'},i*.1);
   drive(tl,item,'--rule',.25+i*.1,.6);
  })],
  ['.study-insight',(el,tl)=>{
   tl.fromTo(el.querySelector('.study-insight__label'),{opacity:0},{opacity:1,duration:.4},0);
   rise(tl,el.querySelector('.study-insight__text'),.05,{y:16,duration:.8});
  }],
  // A flow runs in order: each rule draws, then its step follows it.
  ['.study-steps',(el,tl)=>$$('.study-step',el).forEach((step,i)=>{
   drive(tl,step,'--rule',i*.18,.45);
   tl.fromTo([...step.children],{x:-12,opacity:0},{x:0,opacity:1,duration:.6,stagger:.05,ease:'power3.out'},i*.18+.12);
  })],
  // Before and after: nodes arrive in reading order; a removed step is struck.
  ['.study-chains',(el,tl)=>{
   let at=0;
   $$('.study-chain',el).forEach(chain=>{
    const track=chain.querySelector('.study-chain__nodes');
    tl.fromTo(chain.querySelector('.study-chain__label'),{opacity:0},{opacity:1,duration:.4},at);
    if(chain.hasAttribute('data-emphasis'))tl.fromTo(track,{clipPath:'inset(0% 100% 0% 0% round 10px)'},{clipPath:'inset(0% 0% 0% 0% round 10px)',duration:.7,ease:'power3.inOut'},at);
    $$('li',track).forEach((node,i)=>{
     tl.fromTo(node,{x:-8,opacity:0},{x:0,opacity:1,duration:.45,ease:'power2.out'},at+.1+i*.08);
     drive(tl,node.querySelector('s'),'--strike',at+.35+i*.08,.4);
    });
    at+=.35;
   });
   rise(tl,el.querySelector('.study-chains__note'),at+.1,{y:10,duration:.6});
  }],
  // A decision resolves left to right: problem, judgment, then design.
  ['.study-decision',(el,tl)=>{
   rise(tl,el.querySelector('.study-decision__head'),0,{duration:.6});
   $$('.study-decision__row',el).forEach((row,i)=>{
    drive(tl,row,'--rule',.15+i*.16,.5);
    rise(tl,[...row.children],.22+i*.16,{y:10,duration:.55,stagger:.04});
   });
   reveal(tl,el.querySelector(':scope > .study-frame'),.3);
  }],
  ['.study-feature',(el,tl)=>{rise(tl,el.querySelector('.study-feature__text'),0,{y:16});reveal(tl,el.querySelector(':scope > .study-frame'),.08);}],
  ['.study-figure',(el,tl)=>reveal(tl,el.querySelector('.study-frame'),0)],
  ['.study-gallery',(el,tl)=>$$(':scope > .study-frame',el).forEach((frame,i)=>reveal(tl,frame,i*.1))],
  // What AI handled first; the designer's judgment then takes focus.
  ['.study-ai',(el,tl)=>{
   const [ai,designer]=$$('.study-ai__col',el);
   rise(tl,ai,0,{y:12,duration:.6});
   if(designer)tl.fromTo(designer,{opacity:0,y:28,scale:.98},{opacity:1,y:0,scale:1,duration:.9,ease:'expo.out'},.18);
  }],
  // Results arrive already still: no travel, only presence.
  ['.study-points',(el,tl)=>$$(':scope > li',el).forEach((item,i)=>tl.fromTo(item,{opacity:0},{opacity:1,duration:.7,ease:'power1.out'},i*.12))],
  // The principle rises; the capabilities it rests on assemble beneath it.
  ['.study-takeaway',(el,tl)=>{
   tl.fromTo(el.querySelector('.study-takeaway__lead .study-takeaway__label'),{opacity:0},{opacity:1,duration:.4},0);
   rise(tl,el.querySelector('.study-takeaway__text'),.08,{y:26,duration:1,ease:'expo.out'});
   tl.fromTo(el.querySelector('.study-takeaway__skills .study-takeaway__label'),{opacity:0},{opacity:1,duration:.4},.45);
   const skills=$$('.study-skills > li',el),middle=(skills.length-1)/2;
   skills.forEach((skill,i)=>tl.fromTo(skill,{x:(i-middle)*-28,opacity:0},{x:0,opacity:1,duration:.8,ease:'power3.out'},.5+i*.08));
  }]
 ];
 const settle=(el,tl)=>{
  // The resting state carries no inline motion styles.
  tl.eventCallback('onComplete',()=>{
   gsap.set([el,...el.querySelectorAll('*')],{clearProps:'transform,opacity,clipPath'});
   cleared.filter(([node])=>el.contains(node)).forEach(([node,name])=>node.style.removeProperty(name));
  });
 };
 const threshold=innerHeight*.82;
 const io=new IntersectionObserver(entries=>entries.forEach(entry=>{
  if(!entry.isIntersecting)return;io.unobserve(entry.target);timelines.get(entry.target)?.play();
 }),{rootMargin:'0px 0px -18% 0px'});
 for(const [selector,compose] of recipes){
  for(const el of document.querySelectorAll('main '+selector)){
   if(el.getBoundingClientRect().top<threshold)continue;
   const tl=gsap.timeline({paused:true});compose(el,tl);settle(el,tl);
   timelines.set(el,tl);io.observe(el);
  }
 }
 // A later preference for reduced motion shows everything at rest at once.
 reduce.addEventListener('change',()=>{if(reduce.matches){io.disconnect();timelines.forEach(tl=>tl.progress(1));}});
}
