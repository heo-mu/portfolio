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
 let frame=0;
 function update(){
  frame=0;
  const y=window.scrollY,limit=next?next.getBoundingClientRect().top+y-innerHeight:document.documentElement.scrollHeight-innerHeight;
  if(progress)progress.style.width=Math.min(100,Math.max(0,y/Math.max(1,limit)*100))+'%';
  let active=-1;sections.forEach((s,i)=>{if(s&&s.getBoundingClientRect().top<=offset()+24)active=i;});
  links.forEach((a,i)=>{if(i===active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
  topButton?.classList.toggle('visible',y>600);
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(update);}
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});
 addEventListener('load',schedule);addEventListener('pageshow',schedule);document.fonts?.ready.then(schedule);
 document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
  const target=document.getElementById(decodeURIComponent(a.hash.slice(1)));if(!target)return;
  e.preventDefault();
  const y=Math.max(0,target.getBoundingClientRect().top+scrollY-offset());
  if(window.portfolioScroll)window.portfolioScroll.moveTo(y);else scrollTo({top:y,behavior:'auto'});
  history.replaceState(null,'',a.hash);target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
 }));
 topButton?.addEventListener('click',()=>{if(window.portfolioScroll)window.portfolioScroll.moveTo(0);else scrollTo(0,0);});
 update();
})();
