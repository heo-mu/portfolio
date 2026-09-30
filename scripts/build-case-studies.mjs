// Detail pages are generated from case-study-content.json. This renderer owns
// each page's header, table of contents, <main>, stylesheet links and
// description metadata; everything else in the HTML stays as written.
// Every case study follows one grammar — problem → criteria → before/after →
// solution → screens → AI → outcome — and every content type maps to one
// component, whatever the project; only counts and emphasis change.
// node scripts/build-case-studies.mjs            reports pages out of sync
// node scripts/build-case-studies.mjs --write    regenerates them (drafts shown, marked)
// node scripts/build-case-studies.mjs --write --publish  regenerates without drafts
// node scripts/build-case-studies.mjs --patch    prints a patch for review
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {projects}=JSON.parse(fs.readFileSync(path.join(root,'case-study-content.json'),'utf8'));
// Draft content (placeholders, example text) is shown and marked by default;
// --publish leaves it out, so a page never presents an example as a record.
const publish=process.argv.includes('--publish');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');

// Reserve intrinsic sizes so lazy images never shift the chapter positions.
const sizes=new Map();
function size(src){
 if(sizes.has(src))return sizes.get(src);
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
 const result={width,height};sizes.set(src,result);return result;
}
// Very wide artifacts read better stacked under their text than beside it.
const shape=image=>{const {width,height}=size(image.src);return width/height>=1.9?'wide':'standard';};
// Pages serve a lighter sibling .webp when one exists; the JSON keeps naming
// the original, which also stays the source of the intrinsic dimensions.
const served=src=>{const webp=src.replace(/.(png|jpe?g)$/i,'.webp');return webp!==src&&fs.existsSync(path.join(root,webp))?webp:src;};
const img=(image,{priority=false,decorative=false}={})=>{
 const {width,height}=size(image.src);
 return `<img src="${esc(served(image.src))}" alt="${decorative?'':esc(image.alt)}" width="${width}" height="${height}" ${priority?'fetchpriority="high"':'loading="lazy"'} decoding="async">`;
};
// Images carry no captions: the heading and text around them give the context.
// A screenshot whose border is near-white is flagged edge:'light' in the JSON,
// so only it gets the faint shadow that keeps its boundary against the page.
const frame=(image,{cls='',...options}={})=>`<div class="study-frame${cls?' '+cls:''}"${image.edge==='light'?' data-edge="light"':''}>${img(image,options)}</div>`;
// Example text is a draft cell: {text, draft:true}. Plain strings are records.
const isDraft=value=>!!(value&&typeof value==='object'&&value.draft);
const textOf=value=>typeof value==='string'?value:value?.text;
const DRAFT_TAG='<span class="study-draft">예시</span>';

const LABELS={problem:'문제',judgment:'판단',design:'설계',ai:'AI가 도운 일',designer:'직접 판단한 일',
 capabilities:'이 프로젝트에서 보여준 역량',learning:'다음 작업에 가져갈 기준',brief:{problem:'문제',criteria:'판단 기준',change:'달라진 점'}};

const titled=item=>`<h3>${esc(item.title)}</h3>${item.body?`<p>${esc(item.body)}</p>`:''}`;
const tag=text=>text?`<span class="study-tag">${esc(text)}</span>`:'';
// A decision is one log entry: its head, then a track read left to right,
// problem → judgment → design. Evidence, when there is any, joins the entry.
const decision=(item,index,media)=>{
 const head=`<header class="study-decision__head"><p class="study-decision__index"><span>${pad(index)}</span>${tag(item.tag)}</p><h3>${esc(item.title)}</h3></header>`;
 const body=`<div class="study-decision__body">${head}<dl class="study-decision__track">`+
  [['problem',item.problem],['judgment',item.judgment],['design',item.design]].map(([key,text])=>`<div class="study-decision__row" data-row="${key}"><dt>${LABELS[key]}</dt><dd>${esc(text)}</dd></div>`).join('')+`</dl></div>`;
 return media?`<article class="study-decision study-decision--media" data-shape="${shape(item.image)}">${body}${frame(item.image)}</article>`:`<article class="study-decision">${body}</article>`;
};

// Before / after: one pair is two sides and one statement. A side is a
// screenshot, a flow, a text specimen or — while no record exists — an image
// slot sized like the side it will be compared with. A wide screenshot, or a
// screenshot facing an empty slot, gives the after side the larger share;
// everything else compares at equal width.
const ratio=image=>{const {width,height}=size(image.src);return `${width} / ${height}`;};
const visual=(data,other)=>{
 if(data.image)return ['image',frame(data.image)];
 if(data.placeholder)return ['placeholder',`<div class="study-slot"${other?.image?` style="--ratio:${ratio(other.image)}"`:' data-fill'}><span class="study-slot__tag">교체할 이미지</span><span class="study-slot__text">${esc(data.placeholder)}</span></div>`];
 if(data.flow)return ['flow',`<ol class="study-flow">${data.flow.map(node=>typeof node==='string'?`<li>${esc(node)}</li>`:`<li class="is-removed"><s>${esc(node.text)}</s><span class="sr-only"> (없앤 단계)</span></li>`).join('')}</ol>`];
 if(data.specimen)return ['specimen',`<dl class="study-specimen" data-count="${data.specimen.length}">${data.specimen.map(row=>`<div><dt>${esc(row.value)}</dt><dd>${esc(row.note)}</dd></div>`).join('')}</dl>`];
 throw Error('Unknown compare side');
};
const pair=(item,index)=>{
 const sides=[['before',item.before,item.after],['after',item.after,item.before]].filter(([,data])=>!(publish&&data.placeholder));
 const wide=[item.before,item.after].some(data=>data.image&&shape(data.image)==='wide');
 const slotted=[item.before,item.after].some(data=>data.placeholder)&&[item.before,item.after].some(data=>data.image);
 const layout=sides.length<2?'single':wide||slotted?'lead':'even';
 const html=sides.map(([side,data,other])=>{const [kind,body]=visual(data,other);
  return `<div class="study-pair__side" data-side="${side}" data-kind="${kind}"><p class="study-pair__label">${side==='before'?'Before':'After'}</p>${body}</div>`;}).join('');
 return `<li class="study-pair" data-layout="${layout}"><div class="study-pair__sides">${html}</div><div class="study-pair__text"><p class="study-pair__index"><span>${pad(index)}</span>${tag(item.tag)}</p><h3>${esc(item.title)}</h3><p class="study-pair__why">${esc(item.why)}</p></div></li>`;
};

// AI and designer lanes: each stage of the work shows what AI helped with and
// what was decided directly, side by side, so the final judgment stays visible.
const cell=(owner,value)=>{
 if(publish&&isDraft(value))value=null;
 const label=`<span class="study-lane__owner">${LABELS[owner]}</span>`;
 if(!value)return `<p class="study-lane__cell" data-owner="${owner}" data-empty>${label}<span aria-hidden="true">—</span><span class="sr-only">해당 없음</span></p>`;
 return `<p class="study-lane__cell" data-owner="${owner}"${isDraft(value)?' data-draft':''}>${label}${isDraft(value)?DRAFT_TAG:''}${esc(textOf(value))}</p>`;
};

const components={
 // Context facts: the recorded frame of the project (platform, scope, period,
 // axes). Values are words from the record, never dressed-up numbers. A value
 // listing several tokens breaks between them, never before a separator.
 facts:b=>`<dl class="study-facts" data-count="${b.items.length}">${b.items.map(f=>`<div class="study-facts__item"><dt>${esc(f.label)}</dt>${f.value.includes(' · ')?`<dd class="study-facts__tokens">${f.value.split(' · ').map(v=>`<span class="study-token">${esc(v)}</span>`).join('')}</dd>`:`<dd>${esc(f.value)}</dd>`}${f.note?`<dd class="study-facts__note">${esc(f.note)}</dd>`:''}</div>`).join('')}</dl>`,
 // One reading of the problem, set large; the marked phrase is the pivot the
 // rest of the study follows.
 statement:b=>{const text=esc(b.text);const marked=b.mark?text.replace(esc(b.mark),`<mark>${esc(b.mark)}</mark>`):text;
  return `<div class="study-statement">${b.label?`<p class="study-statement__label">${esc(b.label)}</p>`:''}<p class="study-statement__text">${marked}</p></div>`;},
 walkthrough:b=>`<div class="screen-walkthrough"><div class="screen-walkthrough__steps">${b.items.map((item,i)=>`<article class="screen-step" id="screen-${pad(i+1)}" aria-labelledby="screen-${pad(i+1)}-title"><div class="screen-step__copy"><span class="screen-step__number">${pad(i+1)} / ${pad(b.items.length)}</span><h3 id="screen-${pad(i+1)}-title">${esc(item.title)}</h3><p class="screen-step__purpose">${esc(item.purpose)}</p></div><div class="screen-step__media">${item.image?frame(item.image):`<div class="screen-slot"><span>화면 준비 중</span><strong>${esc(item.title)}</strong><p>${esc(item.placeholder)}</p></div>`}</div><p class="screen-step__decision">${esc(item.decision)}</p></article>`).join('')}</div><div class="screen-walkthrough__stage"><nav class="screen-walkthrough__nav" aria-label="주요 화면 탐색">${b.items.map((item,i)=>`<a href="#screen-${pad(i+1)}" aria-label="${pad(i+1)} ${esc(item.title)}">${pad(i+1)}</a>`).join('')}</nav><div class="screen-walkthrough__visual" aria-hidden="true"></div></div></div>`,
 supporting:b=>`<details class="study-supporting"><summary>추가 화면 살펴보기 <span>${pad(b.images.length)}</span></summary><div class="study-supporting__grid">${b.images.map(image=>frame(image)).join('')}</div></details>`,
 // Problems are statements, not cards: numbered, ruled and unresolved in tone.
 issues:b=>`<ol class="study-issues" data-count="${b.items.length}">${b.items.map((item,i)=>`<li class="study-issue"><span class="study-issue__index">문제 ${pad(i+1)}</span>${titled(item)}</li>`).join('')}</ol>`,
 // Criteria read as priorities: what was put aside, then what came first.
 criteria:b=>`<ol class="study-criteria" data-count="${b.items.length}">${b.items.map((item,i)=>`<li><span class="study-criteria__index">${pad(i+1)}</span><p class="study-criteria__instead">${esc(item.instead)}</p><p class="study-criteria__first">${esc(item.first)}</p></li>`).join('')}</ol>`,
 compare:b=>`<ol class="study-compare" data-count="${b.pairs.length}">${b.pairs.map((item,i)=>pair(item,i+1)).join('')}</ol>`,
 steps:b=>`<ol class="study-steps" data-count="${b.items.length}" data-variant="${esc(b.variant||'sequence')}">${b.items.map((item,i)=>`<li class="study-step"><span class="study-step__index">${pad(i+1)}</span>${titled(item)}</li>`).join('')}</ol>`,
 chains:b=>`<div class="study-chains">${b.rows.map(row=>`<div class="study-chain"${row.emphasis?' data-emphasis':''}><p class="study-chain__label">${esc(row.label)}</p><ol class="study-chain__nodes">${row.nodes.map(node=>typeof node==='string'?`<li>${esc(node)}</li>`:`<li class="is-removed"><s>${esc(node.text)}</s></li>`).join('')}</ol></div>`).join('')}${b.note?`<p class="study-chains__note">${esc(b.note)}</p>`:''}</div>`,
 decisions:b=>`<div class="study-decisions" data-count="${b.items.length}">${b.items.map((item,i)=>decision(item,i+1,!!item.image)).join('')}</div>`,
 features:b=>`<div class="study-features" data-layout="${esc(b.layout||'rows')}" data-count="${b.items.length}">${b.items.map(item=>`<article class="study-feature" data-shape="${shape(item.image)}"><div class="study-feature__text">${titled(item)}</div>${frame(item.image)}</article>`).join('')}</div>`,
 figure:b=>`<figure class="study-figure" data-shape="${shape(b.image)}">${frame(b.image)}</figure>`,
 lanes:b=>`<div class="study-lanes" data-count="${b.stages.length}"><div class="study-lanes__head" aria-hidden="true"><span>단계</span><span data-owner="ai">${LABELS.ai}</span><span data-owner="designer">${LABELS.designer}</span></div><ol class="study-lanes__rows">${b.stages.map((stage,i)=>`<li class="study-lane"><p class="study-lane__stage"><span>${pad(i+1)}</span>${esc(stage.stage)}</p>${cell('ai',stage.ai)}${cell('designer',stage.designer)}</li>`).join('')}</ol></div>`,
 gallery:b=>b.groups.map(group=>{
  // An odd count leads with one full-width screen; an even count stays paired.
  const featured=group.images.length%2===1;
  return `<div class="study-gallery-group">${group.label?`<h3 class="study-subhead study-gallery__label">${esc(group.label)}</h3>`:''}<div class="study-gallery" data-count="${group.images.length}">${group.images.map((image,i)=>frame(image,{cls:featured&&i===0?'is-featured':''})).join('')}</div></div>`;
 }).join(''),
 points:b=>`<ol class="study-points" data-count="${b.items.length}">${b.items.map((item,i)=>`<li><span class="study-points__index">${pad(i+1)}</span>${titled(item)}</li>`).join('')}</ol>`,
 // The closing is the case study's last scene: one principle set large, then
 // the capabilities it rests on, on a dark full-bleed band.
 closing:b=>`<div class="study-takeaway"><div class="study-takeaway__lead"><h3 class="study-takeaway__label">${LABELS.learning}</h3><p class="study-takeaway__text">${esc(b.learning)}</p></div><div class="study-takeaway__skills"><h3 class="study-takeaway__label">${LABELS.capabilities}</h3><ol class="study-skills" data-count="${b.capabilities.length}">${b.capabilities.map((item,i)=>`<li><span class="study-skills__index">${pad(i+1)}</span><strong>${esc(item.title)}</strong><span>${esc(item.body)}</span></li>`).join('')}</ol></div></div>`
};
function block(b){
 if(!components[b.type])throw Error('Unknown block type: '+b.type);
 const head=(b.heading?`<h3 class="study-subhead">${esc(b.heading)}</h3>`:'')+(b.intro?`<p class="study-block__intro">${esc(b.intro)}</p>`:'');
 return `<div class="study-block" data-type="${b.type}">${head}${components[b.type](b)}</div>`;
}
// One editorial grid for every chapter: the label rail keeps its column and
// stays in view while the chapter scrolls; everything else lives in the main
// column. Tone is the section's own (the core problem reads as a dark band);
// rhythm comes from the content, not from alternating backgrounds.
const tone=s=>s.tone||'paper';
const sectionHtml=(s,i)=>`<section class="study-section" id="${esc(s.id)}" data-tone="${tone(s)}"${s.draft?' data-draft':''}${s.blocks.at(-1)?.type==='closing'?' data-ends="takeaway"':''} aria-labelledby="${esc(s.id)}-title"><div class="container study-grid"><p class="study-eyebrow study-rail"><span>${pad(i+1)}</span>${esc(s.eyebrow)}${s.draft?DRAFT_TAG:''}</p><div class="study-main"><header class="study-heading"><h2 id="${esc(s.id)}-title">${esc(s.title)}</h2>${s.lead?`<p class="study-heading__lead">${esc(s.lead)}</p>`:''}</header><div class="study-blocks">${s.blocks.map(block).join('')}</div></div></div></section>`;

function render(d,index){
 const next=projects[(index+1)%projects.length];
 const sections=d.sections.filter(s=>!(publish&&s.draft));
 const live=d.liveUrl?`<a class="study-live" href="${esc(d.liveUrl)}" target="_blank" rel="noopener noreferrer">${esc(d.liveLabel||'서비스 보기')} <span aria-hidden="true">↗</span><span class="sr-only"> (새 창)</span></a>`:'';
 // Identity and role stay in the hero; the record's facts open the body as
 // the CONTEXT chapter, so the hero is an introduction, not a data sheet.
 const role=d.meta.find(m=>m.label==='Role')?.values[0]||'';
 const hero=`<section class="study-hero" aria-labelledby="project-title"><div class="container"><a class="study-back" href="index.html#projects"><span aria-hidden="true">←</span>모든 프로젝트</a><div class="study-hero__grid"><div class="study-hero__intro"><p class="study-eyebrow">${esc(d.category)}</p><h1 id="project-title" class="study-title"><span class="study-title__name">${esc(d.name)}</span></h1><p class="study-title__desc">${esc(d.descriptor)}</p><p class="study-hero__role">${esc(role)}</p>${live}</div><div class="study-hero__visual">${frame(d.hero,{cls:'study-frame--hero',priority:true})}</div></div></div></section>`;
 const toc=`<nav class="case-index" aria-label="프로젝트 목차"><div class="container">${sections.map((s,i)=>`<a href="#${esc(s.id)}"><span>${pad(i+1)}</span>${esc(s.nav)}</a>`).join('')}</div></nav>`;
 const nextHtml=`<section class="next-projects study-next" data-tone="soft" aria-labelledby="next-title"><div class="container"><p class="study-eyebrow">Next Project</p><a class="study-next__link" href="${esc(next.file)}"><div class="study-next__text"><h2 id="next-title">${esc(next.name)}</h2><p>${esc(next.descriptor)}</p></div>${frame(next.hero,{cls:'study-next__visual',decorative:true})}<span class="study-next__arrow" aria-hidden="true">→</span></a></div></section>`;
 return `<main id="main-content">\n${typeset([hero,toc,...sections.map(sectionHtml),nextHtml].join('\n'))}\n</main>`;
}
// Line breaks follow meaning. Only text between tags changes; attributes keep
// plain text. Separators stay attached to their words, so no line starts with
// a middle dot or an arrow; Korean bound phrases (…할 수 있다/없다) and ranges
// stay whole; a short Latin or numeric token (AI, 3D, PC, UI) keeps the word
// after it, so no line ends on it alone. So do determiners (한, 같은, 다음…)
// and the word before a dependent noun (볼 때, 하는 것), and a closing quote
// keeps its particle, so no line starts with ‘라는’.
const typeset=html=>html.replace(/>([^<]+)</g,(all,text)=>'>'+text
 .replace(/·/g,'&#8288;·&#8288;')
 .replace(/ → /g,'&nbsp;<span class="study-arrow">→</span> ')
 .replace(/(\S) 수 (있|없)/g,'$1&nbsp;수&nbsp;$2')
 .replace(/ – /g,'&nbsp;– ')
 .replace(/(^|[\s(‘])([A-Za-z0-9]{1,3}) (?=\S)/g,'$1$2&nbsp;')
 .replace(/(^|[\s(])(두|세|네|한|각|이|그|새|첫|모든|여러|다른|같은|다음|실제|현재) (?=[가-힣A-Za-z0-9‘])/g,'$1$2&nbsp;')
 .replace(/(\S) (때|수|것|줄|뿐|듯)(?=[가-힣\s,.])/g,'$1&nbsp;$2')
 .replace(/(다고|라고|어야|여야) (봤|했)(?=어요)/g,'$1&nbsp;$2')
 .replace(/([’”)])(?=[가-힣])/g,'$1&#8288;')+'<');
const header=i=>`<header class="case-nav"><div class="container case-nav__inner"><a href="index.html" class="case-nav__logo" aria-label="허창무 포트폴리오 홈">heo_mu<span aria-hidden="true">.</span></a><nav class="case-nav__links" aria-label="사이트 메뉴"><a href="index.html#projects">Projects</a><a href="index.html#contact">Contact<span aria-hidden="true">↗</span></a></nav><span class="case-nav__index"><span class="sr-only">프로젝트 </span>${pad(i+1)} / ${pad(projects.length)}</span></div><div class="read-progress" id="read-progress" aria-hidden="true"></div></header>`;

let changed=0;const patches=[],writes=[];
projects.forEach((d,i)=>{
 if(process.argv.includes('--file')&&process.argv[process.argv.indexOf('--file')+1]!==d.file)return;
 const file=path.join(root,d.file),before=fs.readFileSync(file,'utf8');
 if(!before.includes('<main id="main-content">')||!before.includes('<header class="case-nav">'))throw Error('Missing document contract: '+d.file);
 let after=before.replace(/<nav class="case-index"[\s\S]*?<\/nav>\s*/,'').replace(/<main id="main-content">[\s\S]*?<\/main>/,()=>render(d,i));
 after=after.replace(/<header class="case-nav">[\s\S]*?<\/header>/,()=>header(i));
 // One detail stylesheet: the legacy detail.css layer is no longer linked.
 after=after.replace(/[ \t]*<link rel="stylesheet" href="css\/detail\.css[^>]*>\r?\n?/,'');
 // Asset ?v= values belong to scripts/asset-versions.mjs; a new link gets a placeholder it replaces.
 if(!after.includes('css/case-study.css'))after=after.replace('</head>','  <link rel="stylesheet" href="css/case-study.css?v=0">\n</head>');
 for(const attr of ['name="description"','property="og:description"','property="twitter:description"'])
  after=after.replace(new RegExp(`(<meta ${attr} content=")[^"]*(")`),(all,open,close)=>open+esc(d.summary)+close);
 if(before!==after){
  changed++;writes.push([file,after]);
  const a=before.trimEnd().split(/\r?\n/),b=after.trimEnd().split(/\r?\n/);
  let start=0,endA=a.length,endB=b.length;
  while(start<endA&&start<endB&&a[start]===b[start])start++;
  while(endA>start&&endB>start&&a[endA-1]===b[endB-1]){endA--;endB--;}
  patches.push(`*** Update File: ${d.file}\n@@\n`+(start?' '+a[start-1]+'\n':'')+a.slice(start,endA).map(l=>'-'+l).join('\n')+'\n'+b.slice(start,endB).map(l=>'+'+l).join('\n')+(endA<a.length?'\n '+a[endA]:''));
 }
});
if(process.argv.includes('--patch'))console.log('*** Begin Patch\n'+patches.join('\n')+'\n*** End Patch');
else if(process.argv.includes('--write')){for(const [file,text] of writes)fs.writeFileSync(file,text);console.log(`${projects.length} case studies; ${changed} regenerated${publish?' (publish: drafts left out)':''}.`);}
else {console.log(`${projects.length} case studies; ${changed} out of sync.`);if(changed)process.exitCode=1;}
