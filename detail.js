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
 const walkthroughs=[...document.querySelectorAll('.screen-walkthrough')].map(root=>{
  const steps=[...root.querySelectorAll('.screen-step')],stage=root.querySelector('.screen-walkthrough__visual');
  const controls=[...root.querySelectorAll('.screen-walkthrough__nav a')];
  const media=steps.map(step=>{const copy=step.querySelector('.screen-step__media').cloneNode(true);stage.append(copy);return copy;});
  root.classList.add('is-enhanced');
  return {root,steps,controls,media,active:-1};
 });
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
  for(const walk of walkthroughs){
   const readingLine=offset()+(innerHeight-offset())*.4;
   let selected=0;
   walk.steps.forEach((step,i)=>{if(step.getBoundingClientRect().top<=readingLine)selected=i;});
   if(selected===walk.active)continue;
   walk.active=selected;
   walk.steps.forEach((step,i)=>step.classList.toggle('is-active',i===selected));
   walk.media.forEach((media,i)=>media.classList.toggle('is-active',i===selected));
   walk.controls.forEach((link,i)=>{if(i===selected)link.setAttribute('aria-current','step');else link.removeAttribute('aria-current');});
   // Decode the current and next screen ahead of the next scroll threshold.
   walk.media.slice(selected,selected+2).forEach(media=>{const img=media.querySelector('img');if(img){img.loading='eager';img.decode?.().catch(()=>{});}});
  }
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(update);}
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});
 addEventListener('load',schedule);addEventListener('pageshow',schedule);document.fonts?.ready.then(schedule);
 document.querySelectorAll('.study-more,.study-supporting').forEach(details=>details.addEventListener('toggle',()=>{
  window.portfolioScroll?.refresh();schedule();
 }));
 document.querySelectorAll('.study-supporting').forEach(details=>details.addEventListener('toggle',()=>{window.portfolioScroll?.refresh();schedule();}));
 document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
  const target=document.getElementById(decodeURIComponent(a.hash.slice(1)));if(!target)return;
  e.preventDefault();
  const y=Math.max(0,target.getBoundingClientRect().top+scrollY-offset());
  if(window.portfolioScroll)window.portfolioScroll.moveTo(y);else scrollTo({top:y,behavior:'auto'});
  history.replaceState(null,'',a.hash);target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
 }));
 topButton?.addEventListener('click',()=>{if(window.portfolioScroll)window.portfolioScroll.moveTo(0);else scrollTo(0,0);});
 measureChrome();update();
})();
