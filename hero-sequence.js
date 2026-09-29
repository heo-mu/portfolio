// One native scroll range owns the shared Hero/About stage and every visual phase.
export const clamp=t=>Math.max(0,Math.min(1,t));
export const phase=(p,a,b)=>{const t=clamp((p-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
export function createHeroSequence(host,onChange,onLayout) {
  const chapter=document.querySelector('.hero-chapter'),hero=document.querySelector('.hero');
  const about=document.getElementById('about'),nav=document.getElementById('nav');
  const gsap=window.gsap,ST=window.ScrollTrigger;
  const track=document.createElement('div'),stage=document.createElement('div');
  track.className='hero-sequence__track';stage.className='hero-sequence__stage';
  const state={progress:0},mm=gsap.matchMedia();let trigger=null,score=null,active=false,disposed=false;
  const heroItems=[hero.querySelector('.hero__identity'),...hero.querySelectorAll('.type-mask'),...hero.querySelectorAll('.hero__aside > p,.hero__aside > a')];
  const aboutItems=[about.querySelector('.section-eyebrow'),about.querySelector('.section-title'),...about.querySelectorAll('.about__story > p'),about.querySelector('.about__metrics'),about.querySelector('figcaption')];
  const exits=[[.10,.20,-8,-3],[.14,.28,-28,-4],[.16,.30,-20,5],[.13,.23,-9,5],[.10,.20,-6,4]];
  const starts=[.15,.35,.55,.67,.74,.79,.85,.88];
  const palette=(bg,ink,muted,soft,border)=>({'--hero-scene-bg':bg,'--hero-scene-ink':ink,'--hero-scene-muted':muted,'--hero-scene-soft':soft,'--hero-scene-border':border});
  const light=palette('#F7F7F5','#1B1C19','#626262','#9B9B9B','#B8B8B5');
  const dark=palette('#1B1C19','#F7F7F5','#B8B8B8','#B9B9B7','#575754');
  const headerInk=gsap.utils.interpolate('#1B1C19','#000000'),headerLight=gsap.utils.interpolate('#FFFFFF','#F7F7F5');
  const tone=gsap.timeline({paused:true,defaults:{ease:'none'}})
    .fromTo([chapter,nav],light,{...palette('#E3E2DE','#1B1C19','#525252','#747474','#9A9A97'),duration:.40,immediateRender:false})
    .to([chapter,nav],{...palette('#353535','#F7F7F5','#CECECE','#B9B9B7','#696967'),duration:.38})
    .to([chapter,nav],{...dark,duration:.22});
  const render=()=>{
    const p=state.progress;
    chapter.dataset.sequencePhase=p<.15?'scatter':p<.44?'converge':p<.56?'service-core':p<.685?'peel':p<.78?'sweep':p<.84?'silhouette':p<.896?'detail':p<.912?'portrait':p<.993?'about':'reading';
    chapter.style.setProperty('--sequence-progress',p.toFixed(5));
    // Each role exits once. Intro lives on inner spans, so the two never compete.
    heroItems.forEach((el,i)=>{const [a,b,x,y]=exits[i],v=phase(p,a,b);el.style.opacity=1-v;el.style.transform=`translate3d(${x*v}px,${y*v}px,0) scale(${1-v*.025})`;});
    const movement=phase(p,.912,.993);
    aboutItems.forEach((el,i)=>{const v=phase(movement,starts[i],Math.min(1,starts[i]+.16));el.style.opacity=v;el.style.transform=`translate3d(${(1-v)*(i===1?22:12)}px,0,0)`;el.style.clipPath=`inset(0 ${(1-v)*12}% 0 0)`;});
    hero.inert=p>.30;about.inert=movement<.15;
    hero.style.visibility=p>=.305?'hidden':'visible';about.style.visibility=p>=.912?'visible':'hidden';
    tone.progress(phase(p,.49,.85));
    // Never interpolate through gray ink on the dimming gray background.
    nav.style.setProperty('--hero-scene-ink',p<.697?headerInk(phase(p,.65,.68)):headerLight(phase(p,.705,.74)));
    nav.style.setProperty('--hero-scene-halo','transparent');
    onChange(p,active);
  };
  function measure(){
    const h=innerHeight,small=innerWidth<=768;
    chapter.style.setProperty('--sequence-h',h+'px');
    chapter.style.setProperty('--sequence-run',Math.round(h*(small?3.9:4.8))+'px');
    chapter.style.setProperty('--about-header-h',nav.offsetHeight+'px');
    const extra=Math.max(0,about.getBoundingClientRect().height-h);
    chapter.style.setProperty('--sequence-overflow',extra+'px');
    onLayout();
  }
  mm.add('(prefers-reduced-motion: no-preference)',()=>{
    active=true;chapter.classList.add('is-cinematic');
    const chapterBounds=chapter.getBoundingClientRect();
    if(chapterBounds.top<=nav.offsetHeight&&chapterBounds.bottom>nav.offsetHeight)nav.classList.add('is-hero-scene');
    chapter.append(track);track.append(stage);stage.append(host,hero,about);
    measure();
    score=gsap.timeline({paused:true,onUpdate:render}).to(state,{progress:1,duration:1,ease:'none'});
    trigger=ST.create({id:'hero-sequence',trigger:track,start:'top top',end:'bottom bottom',animation:score,scrub:.22,invalidateOnRefresh:true,
      onRefreshInit:measure,onRefresh:self=>{state.progress=self.progress;render();},
      onUpdate:self=>{if(self.progress>.001)window.portfolioMotion?.revealWithin(hero);if(Math.abs(self.progress-state.progress)>.2){self.getTween()?.progress(1);score.progress(self.progress);}}});
    render();window.portfolioScroll?.refresh();
    return()=>{
      trigger.kill();score.kill();trigger=score=null;active=false;state.progress=0;
      chapter.append(hero,about);hero.prepend(host);track.remove();chapter.classList.remove('is-cinematic');nav.classList.remove('is-hero-scene');
      [hero,about].forEach(el=>{el.inert=false;el.style.removeProperty('visibility');});
      [...heroItems,...aboutItems].forEach(el=>{el.style.removeProperty('opacity');el.style.removeProperty('transform');el.style.removeProperty('clip-path');});
      tone.progress(0);nav.style.setProperty('--hero-scene-ink','#1B1C19');onChange(0,false);onLayout();window.portfolioScroll?.refresh();
    };
  });
  const api={get progress(){return state.progress;},get active(){return active;},get aboutY(){return trigger?trigger.end:null;},get stage(){return active?stage:hero;},measure};
  window.portfolioSequence=api;
  // Refresh callbacks can run before the public owner exists. Reconcile the
  // initial header after publishing it, without waiting for the first scroll.
  const initialBounds=chapter.getBoundingClientRect();
  nav.classList.toggle('is-hero-scene',active&&initialBounds.top<=nav.offsetHeight&&initialBounds.bottom>nav.offsetHeight);
  if(location.hash==='#about'&&active)window.portfolioScroll?.moveTo(api.aboutY,{immediate:true});
  const fonts=()=>{if(disposed)return;measure();window.portfolioScroll?.refresh();};document.fonts?.ready.then(fonts);
  return {...api,get progress(){return state.progress;},get active(){return active;},get stage(){return active?stage:hero;},
    dispose(){if(disposed)return;disposed=true;mm.revert();tone.kill();delete window.portfolioSequence;}};
}
