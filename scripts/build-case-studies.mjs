// Detail pages are generated from case-study-content.json. This renderer owns
// each page's header, table of contents, <main>, stylesheet links and
// description metadata; everything else in the HTML stays as written.
// Every semantic content type maps to one component, whatever the project.
// node scripts/build-case-studies.mjs          reports pages out of sync
// node scripts/build-case-studies.mjs --write  regenerates them
// node scripts/build-case-studies.mjs --patch  prints a patch for review
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {projects}=JSON.parse(fs.readFileSync(path.join(root,'case-study-content.json'),'utf8'));
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
const img=(image,{priority=false,decorative=false}={})=>{
 const {width,height}=size(image.src);
 return `<img src="${esc(image.src)}" alt="${decorative?'':esc(image.alt)}" width="${width}" height="${height}" ${priority?'fetchpriority="high"':'loading="lazy"'} decoding="async">`;
};
// Images carry no captions: the heading and text before them give the context.
const frame=(image,{cls='',...options}={})=>`<div class="study-frame${cls?' '+cls:''}">${img(image,options)}</div>`;
const tokens=values=>values.map(value=>`<span class="study-token">${esc(value)}</span>`).join('');

const LABELS={problem:'문제',judgment:'판단',design:'설계',insight:'설계 관점',
 ai:'AI에 맡긴 일',designer:'직접 판단한 일',capabilities:'이 프로젝트에서 보여준 역량',learning:'다음 작업에 가져갈 기준'};

const titled=item=>`<h3>${esc(item.title)}</h3>${item.body?`<p>${esc(item.body)}</p>`:''}`;
const decision=(item,index,media)=>{
 const body=`<div class="study-decision__body"><p class="study-decision__index"><span>${pad(index)}</span>${item.tag?`<span class="study-decision__tag">${esc(item.tag)}</span>`:''}</p><h3>${esc(item.title)}</h3><dl>`+
  [['problem',item.problem],['judgment',item.judgment],['design',item.design]].map(([key,text])=>`<div class="study-decision__row" data-row="${key}"><dt>${LABELS[key]}</dt><dd>${esc(text)}</dd></div>`).join('')+`</dl></div>`;
 return media?`<article class="study-decision study-decision--media" data-shape="${shape(item.image)}">${body}${frame(item.image)}</article>`:`<article class="study-decision">${body}</article>`;
};
const components={
 cards:b=>`<div class="study-cards" data-count="${b.items.length}">${b.items.map(item=>`<article class="study-card">${titled(item)}</article>`).join('')}</div>`,
 insight:b=>`<div class="study-insight"><p class="study-insight__label">${esc(b.label||LABELS.insight)}</p><p class="study-insight__text">${esc(b.text)}</p></div>`,
 steps:b=>`<ol class="study-steps" data-count="${b.items.length}" data-variant="${esc(b.variant||'sequence')}">${b.items.map((item,i)=>`<li class="study-step"><span class="study-step__index">${pad(i+1)}</span>${titled(item)}</li>`).join('')}</ol>`,
 chains:b=>`<div class="study-chains">${b.rows.map(row=>`<div class="study-chain"${row.emphasis?' data-emphasis':''}><p class="study-chain__label">${esc(row.label)}</p><ol class="study-chain__nodes">${row.nodes.map(node=>typeof node==='string'?`<li>${esc(node)}</li>`:`<li class="is-removed"><s>${esc(node.text)}</s></li>`).join('')}</ol></div>`).join('')}${b.note?`<p class="study-chains__note">${esc(b.note)}</p>`:''}</div>`,
 decisions:b=>{
  // Evidence-backed decisions take a full row; the rest share the column grid.
  const plain=b.items.filter(item=>!item.image).length;
  return `<div class="study-decisions" data-count="${plain}">${b.items.map((item,i)=>decision(item,i+1,!!item.image)).join('')}</div>`;
 },
 features:b=>`<div class="study-features" data-layout="${esc(b.layout||'rows')}" data-count="${b.items.length}">${b.items.map(item=>`<article class="study-feature" data-shape="${shape(item.image)}"><div class="study-feature__text">${titled(item)}</div>${frame(item.image)}</article>`).join('')}</div>`,
 figure:b=>`<figure class="study-figure" data-shape="${shape(b.image)}">${frame(b.image)}</figure>`,
 ai:b=>`<div class="study-ai">${[['ai','AI',b.ai],['designer','Designer',b.designer]].map(([owner,tag,items])=>`<div class="study-ai__col" data-owner="${owner}"><p class="study-ai__owner">${tag}</p><h3>${LABELS[owner]}</h3><ul>${items.map(text=>`<li>${esc(text)}</li>`).join('')}</ul></div>`).join('')}</div>`,
 gallery:b=>b.groups.map(group=>{
  // An odd count leads with one full-width screen; an even count stays paired.
  const featured=group.images.length%2===1;
  return `<div class="study-gallery-group">${group.label?`<h3 class="study-subhead study-gallery__label">${esc(group.label)}</h3>`:''}<div class="study-gallery" data-count="${group.images.length}">${group.images.map((image,i)=>frame(image,{cls:featured&&i===0?'is-featured':''})).join('')}</div></div>`;
 }).join(''),
 points:b=>`<ol class="study-points" data-count="${b.items.length}">${b.items.map((item,i)=>`<li><span class="study-points__index">${pad(i+1)}</span>${titled(item)}</li>`).join('')}</ol>`,
 closing:b=>`<div class="study-closing"><div class="study-closing__col"><h3 class="study-subhead">${LABELS.capabilities}</h3><ul class="study-capabilities">${b.capabilities.map(item=>`<li><strong>${esc(item.title)}</strong><span>${esc(item.body)}</span></li>`).join('')}</ul></div><div class="study-closing__col"><h3 class="study-subhead">${LABELS.learning}</h3><p class="study-learning">${esc(b.learning)}</p></div></div>`
};
function block(b){
 if(!components[b.type])throw Error('Unknown block type: '+b.type);
 const head=(b.heading?`<h3 class="study-subhead">${esc(b.heading)}</h3>`:'')+(b.intro?`<p class="study-block__intro">${esc(b.intro)}</p>`:'');
 return `<div class="study-block" data-type="${b.type}">${head}${components[b.type](b)}</div>`;
}
const tone=(section,i)=>section.tone||(i%2?'soft':'paper');
const sectionHtml=(s,i)=>`<section class="study-section" id="${esc(s.id)}" data-tone="${tone(s,i)}" aria-labelledby="${esc(s.id)}-title"><div class="container"><header class="study-heading"><p class="study-eyebrow"><span>${pad(i+1)}</span>${esc(s.eyebrow)}</p><h2 id="${esc(s.id)}-title">${esc(s.title)}</h2>${s.lead?`<p class="study-heading__lead">${esc(s.lead)}</p>`:''}</header><div class="study-blocks">${s.blocks.map(block).join('')}</div></div></section>`;

function render(d,index){
 const next=projects[(index+1)%projects.length];
 const live=d.liveUrl?`<a class="study-live" href="${esc(d.liveUrl)}" target="_blank" rel="noopener noreferrer">${esc(d.liveLabel||'서비스 보기')} <span aria-hidden="true">↗</span><span class="sr-only"> (새 창)</span></a>`:'';
 const hero=`<section class="study-hero" aria-labelledby="project-title"><div class="container"><div class="study-hero__grid"><div class="study-hero__intro"><a class="study-back" href="index.html#projects"><span aria-hidden="true">←</span>모든 프로젝트</a><p class="study-eyebrow">${esc(d.category)}</p><h1 id="project-title" class="study-title"><span class="study-title__name">${esc(d.name)}</span><span class="study-title__desc">${esc(d.descriptor)}</span></h1><p class="study-lead">${esc(d.summary)}</p>${live}</div><div class="study-hero__visual">${frame(d.hero,{cls:'study-frame--hero',priority:true})}</div></div><dl class="study-meta">${d.meta.map(m=>`<div class="study-meta__item"><dt>${esc(m.label)}</dt><dd>${tokens(m.values)}</dd></div>`).join('')}</dl></div></section>`;
 const toc=`<nav class="case-index" aria-label="프로젝트 목차"><div class="container">${d.sections.map((s,i)=>`<a href="#${esc(s.id)}"><span>${pad(i+1)}</span>${esc(s.nav)}</a>`).join('')}</div></nav>`;
 const nextTone=tone(d.sections.at(-1),d.sections.length-1)==='soft'?'paper':'soft';
 const nextHtml=`<section class="next-projects study-next" data-tone="${nextTone}" aria-labelledby="next-title"><div class="container"><p class="study-eyebrow">Next Project</p><a class="study-next__link" href="${esc(next.file)}"><div class="study-next__text"><h2 id="next-title">${esc(next.name)}</h2><p>${esc(next.descriptor)}</p></div>${frame(next.hero,{cls:'study-next__visual',decorative:true})}<span class="study-next__arrow" aria-hidden="true">→</span></a></div></section>`;
 return `<main id="main-content">\n${typeset([hero,toc,...d.sections.map(sectionHtml),nextHtml].join('\n'))}\n</main>`;
}
// Separators stay attached to their words, so no line starts with a middle dot
// or an arrow. Only text between tags changes; attributes keep plain text.
const typeset=html=>html.replace(/>([^<]+)</g,(all,text)=>'>'+text.replace(/·/g,'&#8288;·&#8288;').replace(/ → /g,'&nbsp;<span class="study-arrow">→</span> ')+'<');
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
else if(process.argv.includes('--write')){for(const [file,text] of writes)fs.writeFileSync(file,text);console.log(`${projects.length} case studies; ${changed} regenerated.`);}
else {console.log(`${projects.length} case studies; ${changed} out of sync.`);if(changed)process.exitCode=1;}
