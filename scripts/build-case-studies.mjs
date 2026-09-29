// Static HTML remains readable without JavaScript. Content and placeholders live
// in case-study-content.json; this renderer owns only the detail TOC and <main>.
// --patch prints a patch for review and application; it never writes files.
// node scripts/build-case-studies.mjs --check
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {projects}=JSON.parse(fs.readFileSync(path.join(root,'case-study-content.json'),'utf8'));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=i=>i==null?'':String(i).padStart(2,'0');
const p=s=>`<p>${esc(s)}</p>`;
const tag=(text='내용 준비 중')=>`<span class="study-status">${esc(text)}</span>`;
const imageRole=(image,hero)=>image.role||(hero?'hero':/_sub\d/.test(image.src)?'mobile':/_(system|guide|figma|case|ocr)/.test(image.src)?'detail':'screen');
// Reserve source aspect ratios before lazy images load, so chapter positions stay stable.
const dimensions=new Map();
function imageDimensions(src){
 if(dimensions.has(src))return dimensions.get(src);
 const b=fs.readFileSync(path.join(root,src));let width,height;
 if(b.subarray(1,4).toString()==='PNG'){width=b.readUInt32BE(16);height=b.readUInt32BE(20);}
 else if(b[0]===0xff&&b[1]===0xd8){
  let offset=2;
  while(offset+8<b.length){
   if(b[offset]!==0xff){offset++;continue;}
   const marker=b[offset+1];
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){height=b.readUInt16BE(offset+5);width=b.readUInt16BE(offset+7);break;}
   if(marker===0xda||marker===0xd9)break;
   if(marker===0xff||marker===0x01||(marker>=0xd0&&marker<=0xd7)){offset+=2;continue;}
   offset+=2+b.readUInt16BE(offset+2);
  }
 }
 if(!width||!height)throw Error('Missing image dimensions: '+src);
 const attrs=`width="${width}" height="${height}"`;dimensions.set(src,attrs);return attrs;
}
const visual=(image,{hero=false,context=''}={})=>`<figure class="study-visual" data-content-status="existing" data-image-role="${imageRole(image,hero)}"><div class="study-image-slot"><img src="${esc(image.src)}" alt="${esc(image.caption)}" ${imageDimensions(image.src)} ${hero?'fetchpriority="high"':'loading="lazy"'} decoding="async"></div><figcaption>${esc(image.caption)}${context?`<span>${esc(context)}</span>`:''}</figcaption></figure>`;
const placeholder=(title,copy,role='screen')=>`<figure class="study-visual" data-content-status="placeholder" data-image-role="${esc(role)}" data-image-slot="${esc(title)}"><div class="study-image-slot study-placeholder"><div class="study-placeholder__frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div>${tag('예시 이미지 영역')}<strong>${esc(title)}</strong>${p(copy)}</div></div><figcaption>실제 프로젝트 화면이 아니에요. 확정된 이미지로 교체할 영역이에요.</figcaption></figure>`;
const section=(id,n,label,title,lead,body,extra='')=>`<section class="study-section ${extra}" id="${id}" aria-labelledby="${id}-title"><div class="container"><header class="study-heading"><span class="study-kicker"><span>${number(n)}</span>${label}</span><div><h2 id="${id}-title">${esc(title)}</h2>${lead?p(lead):''}</div></header>${body}</div></section>`;
const toc=`<nav class="case-index" aria-label="프로젝트 목차"><div class="container">${[['overview','문제와 관점'],['structure','정보 구조'],['strategy','설계 판단'],['system','시스템·협업'],['workflow','AI 활용'],['showcase','주요 화면'],['capabilities','역량'],['learning','결과·배움']].map(([id,title],i)=>`<a href="#${id}"><span>${number(i+1)}</span>${title}</a>`).join('')}</div></nav>`;
// Associations below pair explicitly captioned, existing assets with their subject.
const placements={
 'project01.html':{observation:'bees_system.png',main:'bees_main01.png',system:'bees_figma01.png',decisions:[null,'bees_agent.png']},
 'project02.html':{main:'edk_main01.png',system:'edk_system.png',decisions:['edk_goal.png','edk_guida.png']},
 'project03.html':{main:'ax_main01.jpg',system:'ax_case01.png',decisions:['ax_ocr.png'],ai:'ax_ai.png'},
 'project04.html':{main:'groupware_user01.png',system:'groupware_system.png',decisions:['groupware_admin04.png']}
};
function render(d,index){
 const next=projects[(index+1)%projects.length],used=new Set(),layout=placements[d.file]||{};
 const pick=name=>{const im=name&&d.images.find(im=>im.src.split('/').pop()===name);if(im)used.add(im.src);return im;};
 const observationImage=d.observationImage||pick(layout.observation);
 const decisionImages=d.decisions.map((_,i)=>pick(layout.decisions?.[i]));
 const aiImage=pick(layout.ai),structureImage=pick(layout.main),systemImage=pick(layout.system);
 const liveLink=d.liveUrl?`<a class="study-live-link" href="${esc(d.liveUrl)}" target="_blank" rel="noopener noreferrer">프로젝트 보기 <span aria-hidden="true">↗</span><span class="sr-only"> (새 창)</span></a>`:'';
 const hero=`<section class="study-hero" aria-labelledby="project-title"><div class="container">
 <div class="study-intro"><a class="study-back-link" href="index.html#projects">← 모든 프로젝트</a><h1 id="project-title"><span>${esc(d.name)}</span>${esc(d.subtitle)}</h1><p class="study-summary">${esc(d.summary)}</p>
 <dl class="study-meta">${d.meta.filter(([k])=>k!=='Type').map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v.replace(' (100%)',''))}</dd></div>`).join('')}<div data-content-status="${d.year?'existing':'placeholder'}"><dt>Year</dt><dd>${esc(d.year||'확인 후 공개')}</dd></div><div data-content-status="${d.contribution?'existing':'placeholder'}"><dt>Contribution</dt><dd>${esc(d.contribution||'범위 확인 중')}</dd></div></dl>${liveLink}</div>
 ${visual({src:d.hero,caption:d.title+' · 대표 화면'},{hero:true})}
 </div></section>`;
 const challenge=section('overview',1,'CONTEXT & CHALLENGE',d.challenge,d.focus,`<div class="study-tensions">${d.tensions.map(([title,copy])=>`<article><h3>${esc(title)}</h3>${p(copy)}</article>`).join('')}</div>
 <div class="study-observation" id="observation"><div class="study-context"><span class="study-kicker">USER CONTEXT</span><h3>${esc(d.saw[0])}</h3>${p(d.saw[1])}</div><div class="study-perspective"><span class="study-kicker">DESIGN PERSPECTIVE</span><blockquote>${esc(d.saw[2])}</blockquote><p class="study-evidence-note">기존 설계 기록에 담긴 관점이에요. 별도의 사용자 조사 결과는 아직 확인되지 않았어요.</p></div></div>
 ${observationImage?visual({...observationImage,role:'detail'}):''}`);
 const structure=section('structure',2,'INFORMATION ARCHITECTURE',d.structure.title,'',`<ol class="study-flow study-flow--${esc(d.structure.kind)}">${d.structure.nodes.map(([title,copy],i)=>`<li><span class="study-flow__index">${number(i+1)}</span><h3>${esc(title)}</h3>${p(copy)}</li>`).join('')}</ol><p class="study-evidence-note">기존 설계 설명에서 정보의 관계와 이동 순서를 요약했어요.</p>${structureImage?visual(structureImage):placeholder('USER FLOW','제품 흐름을 확인할 실제 설계 자료가 들어갈 영역이에요.','flow')}`,'study-section--soft');
 const decisions=section('strategy',3,'DESIGN DECISIONS','이렇게 판단하고, 설계했어요.','',`<div class="study-decisions">${d.decisions.map(([title,why,criterion,design],i)=>`<article class="study-decision" data-content-status="existing"><header><span class="study-decision__number">${number(i+1)}</span><h3>${esc(title)}</h3></header><dl><div><dt>문제</dt><dd>${esc(why)}</dd></div><div><dt>판단 기준</dt><dd>${esc(criterion)}</dd></div><div class="study-decision__resolution"><dt>설계</dt><dd>${esc(design)}</dd></div></dl></article>`).join('')}</div>${decisionImages.some(Boolean)?`<div class="study-decision-evidence">${decisionImages.map((im,i)=>im?visual({...im,role:'detail'},{context:d.decisions[i][0]}):'').join('')}</div>`:''}`);
 const isScreen=im=>['screen','mobile'].includes(im.role)||/_(main|sub|user|admin)\d/.test(im.src);
 const evidence=d.images.filter(im=>!isScreen(im)&&!used.has(im.src));
 const rules=section('system',4,'DESIGN SYSTEM','화면을 넘어, 일관된 기준으로.','반복되는 화면과 예외 상태를 같은 기준으로 다루기 위한 규칙이에요.',`<div class="study-system"><div class="study-rules">${d.rules.map(([title,copy])=>`<article><h3>${esc(title)}</h3>${p(copy)}</article>`).join('')}</div>${systemImage?visual({...systemImage,role:'detail'}):placeholder('DESIGN SYSTEM','컴포넌트와 상태별 설계 기준을 보여줄 자료가 들어갈 영역이에요.','detail')}</div>`);
 const process=evidence.length?section('process',null,'PROCESS & COLLABORATION','설계 기준을 함께 읽을 수 있도록.','프로젝트에 남아 있는 설계·협업 자료예요.',`<div class="study-process">${evidence.slice(0,2).map(im=>visual({...im,role:'detail'})).join('')}</div>${evidence.length>2?`<details class="study-more"><summary>설계·협업 자료 더 보기 <span>${number(evidence.length-2)}</span></summary><div class="study-gallery">${evidence.slice(2).map(im=>visual({...im,role:'detail'})).join('')}</div></details>`:''}`):'';
 const aiBody=d.ai.status==='existing'?`${aiImage?visual({...aiImage,role:'detail'}):placeholder('AI WORKFLOW','탐색·비교·검토에 활용한 실제 작업 기록을 연결할 영역이에요.','flow')}<div class="study-ai-grid" data-content-status="existing">${[['작업의 출발점',d.ai.input],['AI가 도운 범위',d.ai.assist],['직접 내린 판단',d.ai.human]].map(([title,copy],i)=>`<article><span class="study-kicker">${number(i+1)}</span><h3>${title}</h3>${p(copy)}</article>`).join('')}</div><p class="study-evidence-note">${esc(d.ai.evidence)}</p>`:`<div class="study-ai-draft" data-content-status="placeholder">${tag('내용 준비 중 · 실제 활용 내역 미확인')}${p(d.ai.note)}</div>`;
 const ai=section('workflow',5,'AI IN THE PROCESS',d.ai.title,'',aiBody,d.ai.status==='existing'?'study-section--soft':'study-section--compact study-section--soft');
 const screens=d.images.filter(im=>isScreen(im)&&!used.has(im.src));
 const screenBody=screens.length?`<div class="study-featured">${screens.slice(0,2).map(im=>visual(im)).join('')}</div>${screens.length>2?`<details class="study-more"><summary>다른 화면과 상태 보기 <span>${number(screens.length-2)}</span></summary><div class="study-gallery">${screens.slice(2).map(im=>visual(im)).join('')}</div></details>`:''}`:`<div class="study-gallery">${placeholder('제품과 공간을 함께 확인하는 화면','제품 선택과 공간 설정의 관계를 보여줄 화면이에요.')}${placeholder('설치 조건을 읽는 결과 화면','결과와 확인할 조건이 연결되는 화면을 넣을 예정이에요.')}</div>`;
 const screenSection=section('showcase',6,'PRODUCT IN USE','구조가 화면이 되는 순간.',screens.length?'앞에서 읽은 구조와 설계 기준을 실제 프로젝트 화면에 연결해 보세요.':'대표 이미지 외의 상세 화면은 준비 중이에요. 아래는 실제 화면으로 교체할 영역이에요.',screenBody,'study-section--soft');
 const skills=section('capabilities',7,'DESIGN CONTRIBUTION','이 프로젝트에서 맡은 설계의 역할.','',`<ol class="study-skills">${d.skills.map(([title,copy],i)=>`<li><span>${number(i+1)}</span><div><h3>${esc(title)}</h3>${p(copy)}</div></li>`).join('')}</ol>`);
 const learning=section('learning',8,'REFLECTION','다음 설계에도 가져갈 기준.','',`<p class="study-takeaway">${esc(d.learning)}</p><div class="study-learning"><div data-content-status="placeholder">${tag('검증 결과 · 내용 준비 중')}<h3>실제 사용 이후의 변화</h3>${p(d.verify)}</div><p class="study-evidence-note">성과 수치·사용자 반응·검증 방법과 기간은 자료 확인 후 추가해요. 이 페이지는 기존 프로젝트 기록을 바탕으로 구성했으며, 확인되지 않은 조사·성과를 추정하지 않았어요.</p></div>`,'study-section--soft');
 const nextSection=`<section class="next-projects study-next" data-tone="light"><div class="container"><span class="next-projects__label">NEXT PROJECT</span><a class="study-next__link" href="${next.file}"><div><h2>${esc(next.name)}</h2>${p(next.subtitle)}</div><span class="study-next__arrow" aria-hidden="true">↗</span><img src="${next.hero}" alt="${esc(next.name)} 프로젝트 미리보기" loading="lazy" decoding="async"></a></div></section>`;
 return `<main id="main-content">\n${[hero,toc,challenge,structure,decisions,rules,ai,process,screenSection,skills,learning,nextSection].join('\n')}\n</main>`;
}
let changed=0;const patches=[];
projects.forEach((d,i)=>{
 if(process.argv.includes('--file')&&process.argv[process.argv.indexOf('--file')+1]!==d.file)return;
 const file=path.join(root,d.file),before=fs.readFileSync(file,'utf8');
 if(!before.includes('<main id="main-content">')||!before.includes('<nav class="case-index"'))throw Error('Missing document contract: '+d.file);
 let after=before.replace(/<nav class="case-index"[\s\S]*?<\/nav>\s*/, '').replace(/<main id="main-content">[\s\S]*?<\/main>/,render(d,i));
 const globalHeader=`<header class="case-nav"><div class="container case-nav__inner"><a href="index.html" class="case-nav__name" aria-label="허창무 포트폴리오 홈">heo_mu.</a><a href="index.html#projects" class="case-back">Projects</a><a href="index.html#contact" class="study-nav-contact">Contact ↗</a><span class="case-nav__index">${number(i+1)} / 05</span></div><div class="read-progress" id="read-progress" aria-hidden="true"></div></header>`;
 after=after.replace(/<header class="case-nav">[\s\S]*?<\/header>/,globalHeader);
 // Asset ?v= values belong to scripts/asset-versions.mjs; a new link gets a placeholder it replaces.
 if(!after.includes('css/case-study.css'))after=after.replace('</head>','  <link rel="stylesheet" href="css/case-study.css?v=0">\n</head>');
 if(before!==after){
  changed++;
  const a=before.trimEnd().split(/\r?\n/),b=after.trimEnd().split(/\r?\n/);
  let start=0,endA=a.length,endB=b.length;
  while(start<endA&&start<endB&&a[start]===b[start])start++;
  while(endA>start&&endB>start&&a[endA-1]===b[endB-1]){endA--;endB--;}
  patches.push(`*** Update File: ${d.file}\n@@\n`+(start?' '+a[start-1]+'\n':'')+a.slice(start,endA).map(l=>'-'+l).join('\n')+'\n'+b.slice(start,endB).map(l=>'+'+l).join('\n')+(endA<a.length?'\n '+a[endA]:''));
 }
});
if(process.argv.includes('--patch'))console.log('*** Begin Patch\n'+patches.join('\n')+'\n*** End Patch');
else {console.log(`${projects.length} case studies; ${changed} out of sync.`);if(changed)process.exitCode=1;}
