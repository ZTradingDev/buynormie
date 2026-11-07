import { brand, products, findProduct, motion, ROOT } from './config.js';
import { card, esc, image, productInfo, roll } from './components.js';
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const html = document.documentElement;
const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
const storage = { get(key, fallback) {try {return JSON.parse(localStorage.getItem(key)) ?? fallback;}catch{return fallback;}}, set(key,value) {try {localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}} };
let manualReduced = storage.get('normie-motion',false) === true;
let reduced = systemMotion.matches || manualReduced;
let saved = storage.get('normie-shortlist',[]);
if(!Array.isArray(saved)) saved=[];
saved = [...new Set(saved.filter(id=>products.some(p=>p.id===id)))];
let savedPersisted = true;
const live = $('#global-status');
let activeAnimations = new Set();
function animate(el, frames, options) {
  if(!el || reduced || !el.animate) return null;
  const anim=el.animate(frames,{easing:motion.ease,...options});
  activeAnimations.add(anim);
  anim.finished.catch(()=>{}).finally(()=>activeAnimations.delete(anim));
  return anim;
}
for(const [key,value] of Object.entries(motion)) if(typeof value==='number') html.style.setProperty(`--${key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}`,`${value}ms`);
html.style.setProperty('--ease',motion.ease);html.style.setProperty('--interface',motion.interfaceEase);
function announce(text){live.textContent=text;}
function applyMotion(){
  reduced=systemMotion.matches || manualReduced;
  html.dataset.reducedMotion=String(reduced);
  const btn=$('.motion-setting');
  if(btn){btn.setAttribute('aria-pressed',String(reduced));btn.textContent=reduced?'motion reduced':'reduce motion';}
  if(reduced){activeAnimations.forEach(a=>a.finish());$$('.reveal-ready').forEach(el=>el.classList.add('revealed'));$$('[data-parallax] img').forEach(el=>el.style.transform='none');}
}
applyMotion();
systemMotion.addEventListener('change',applyMotion);
$('.motion-setting')?.addEventListener('click',()=>{manualReduced=!manualReduced;storage.set('normie-motion',manualReduced);applyMotion();announce(systemMotion.matches?'Reduced motion follows your system preference.':reduced?'Reduced motion enabled.':'Standard motion enabled.');});

// Image fallbacks preserve both page geometry and readable product identity.
function bindImages(root=document){$$('img',root).forEach(img=>{
  if(img.dataset.bound) return;img.dataset.bound='true';
  const fail=()=>{const fallback=$('.image-error',img.parentElement);if(fallback){fallback.hidden=false;img.style.visibility='hidden';}else{img.alt=img.alt || 'Image unavailable';img.style.background='var(--sage)';}};
  img.addEventListener('error',fail);
  if(img.complete && !img.naturalWidth)fail();
});}
bindImages();

// One still-image hero entrance, initialized after the essential image settles.
const heroImage=$('#hero-image');
if(heroImage){const enter=()=>{
  if(reduced || document.hidden) return;
  animate(heroImage,[{transform:'scale(1.025)'},{transform:'scale(1)'}],{duration:motion.heroMedia});
  const distance=innerWidth<=580?10:20;
  $$('.hero-copy > *').forEach((el,i)=>animate(el,[{opacity:0,transform:`translateY(${distance}px)`},{opacity:1,transform:'translateY(0)'}],{duration:motion.heroText,delay:Math.min(i*motion.heroStagger,240),fill:'backwards'}));
};
  if(heroImage.complete)enter();else {heroImage.addEventListener('load',enter,{once:true});heroImage.addEventListener('error',enter,{once:true});}
}
const header=$('.header');
const sentinel=$('.header-sentinel');
if(sentinel) new IntersectionObserver(([entry])=>header.classList.toggle('solid',!entry.isIntersecting),{rootMargin:`-${header.offsetHeight}px 0px 0px`}).observe(sentinel);

// Explicit desktop menu; no accidental hover opening or unreachable menu links.
const menuToggle=$('[data-nav-toggle]'), mega=$('#collection-menu');
let menuAnimation;
async function closeNav(restore=false){
  if(!mega || mega.hidden)return;
  menuToggle.setAttribute('aria-expanded','false');
  menuAnimation?.cancel();
  menuAnimation=animate(mega,[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-8px)'}],{duration:180});
  if(menuAnimation)await menuAnimation.finished.catch(()=>{});
  if(menuToggle.getAttribute('aria-expanded')==='false')mega.hidden=true;
  if(restore)menuToggle.focus();
}
menuToggle?.addEventListener('click',()=>{
  if(menuToggle.getAttribute('aria-expanded')==='true'){closeNav();return;}
  menuAnimation?.cancel();mega.hidden=false;menuToggle.setAttribute('aria-expanded','true');
  menuAnimation=animate(mega,[{opacity:0,transform:'translateY(-8px)'},{opacity:1,transform:'translateY(0)'}],{duration:240});
});
document.addEventListener('click',e=>{if(!e.target.closest('.nav-dropdown'))closeNav();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!dialog.open)closeNav(true);});
document.addEventListener('focusin',e=>{if(!e.target.closest('.nav-dropdown'))closeNav();});
matchMedia('(max-width:800px)').addEventListener('change',e=>{if(e.matches)closeNav();});

// Editorial entrances remain visible if initialization fails and reveal only once.
if('IntersectionObserver' in window){
  const revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('revealed');revealObserver.unobserve(entry.target);}}),{rootMargin:'0px 0px -15% 0px'});
  $$('[data-reveal]').forEach(el=>{if(!reduced && el.getBoundingClientRect().top>innerHeight && !location.hash){el.classList.add('reveal-ready');revealObserver.observe(el);}});
  document.addEventListener('focusin',e=>e.target.closest('.reveal-ready')?.classList.add('revealed'));
}

// Native rail retains touch/trackpad behavior; arrow controls move exactly one card.
const rail=$('[data-rail]');
if(rail){const prev=$('[data-rail-prev]'),next=$('[data-rail-next]');const update=()=>{prev.disabled=rail.scrollLeft<=2;next.disabled=rail.scrollLeft+rail.clientWidth>=rail.scrollWidth-2;};
  const move=direction=>rail.scrollBy({left:direction*(rail.firstElementChild.getBoundingClientRect().width+parseFloat(getComputedStyle(rail).gap)),behavior:reduced?'instant':'smooth'});
  prev.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));rail.addEventListener('scroll',update,{passive:true});new ResizeObserver(update).observe(rail);update();
}

// Local chapter links, measured moving pill, ordinary document scrolling.
const pills=$('.section-pills');
if(pills){const links=$$('a',pills), indicator=$('.pill-indicator',pills);let active=links[0];
 const position=()=>{indicator.style.width=`${active.offsetWidth}px`;indicator.style.transform=`translateX(${active.offsetLeft}px)`;};
 const select=link=>{active=link;links.forEach(a=>a===link?a.setAttribute('aria-current','location'):a.removeAttribute('aria-current'));position();};
 const chapters=$$('.story-chapter');const observer=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio);if(visible[0])select(links.find(a=>a.hash===`#${visible[0].target.id}`));},{rootMargin:'-20% 0px -35% 0px',threshold:[0,.15,.4,.7]});chapters.forEach(el=>observer.observe(el));links.forEach(a=>a.addEventListener('click',()=>select(a)));new ResizeObserver(position).observe(pills);document.fonts.ready.then(position);position();
}
const parallax=$('[data-parallax]');
if(parallax){let visible=false,scheduled=false;const img=$('img',parallax);const update=()=>{scheduled=false;if(!visible || reduced || innerWidth<=800 || document.hidden){img.style.transform='none';return;}const rect=parallax.getBoundingClientRect();const progress=Math.max(0,Math.min(1,(innerHeight-rect.top)/(innerHeight+rect.height)));img.style.transform=`translateY(${(progress-.5)*6}%)`;};const request=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update);}};new IntersectionObserver(([e])=>{visible=e.isIntersecting;request();}).observe(parallax);window.addEventListener('scroll',request,{passive:true});window.addEventListener('resize',request,{passive:true});document.addEventListener('visibilitychange',request);systemMotion.addEventListener('change',request);}

// Shared modal: native focus containment/inert background, explicit close and restoration.
const dialog=$('#overlay'),overlayBody=$('#overlay-body'),overlayTitle=$('#overlay-title');
let opener=null,lastOverlayTrigger=null,closeTimer=null,overlayEpoch=0,quickId=null,lightboxState=null;
function openOverlay(kind,title,content,focusSelector){
  closeNav();clearTimeout(closeTimer);overlayEpoch++;
  if(!dialog.open){opener=lastOverlayTrigger || document.activeElement;lastOverlayTrigger=null;document.body.style.overflow='hidden';dialog.showModal();}
  dialog.classList.remove('closing');dialog.dataset.kind=kind;overlayTitle.textContent=title;overlayBody.innerHTML=content;overlayBody.scrollTop=0;
  bindImages(overlayBody);initAccordions(overlayBody);syncSaveButtons();
  const epoch=overlayEpoch;requestAnimationFrame(()=>{if(epoch!==overlayEpoch||!dialog.open)return;dialog.classList.add('visible');(focusSelector?$(focusSelector,dialog):$('[data-close]',dialog))?.focus({preventScroll:true});});
}
function closeOverlay(){if(!dialog.open)return;dialog.classList.add('closing');dialog.classList.remove('visible');overlayEpoch++;
 const finish=()=>{dialog.close();overlayBody.innerHTML='';document.body.style.overflow='';dialog.classList.remove('closing');if(opener?.isConnected)opener.focus({preventScroll:true});};
 clearTimeout(closeTimer);if(reduced)finish();else closeTimer=setTimeout(finish,motion.close);
}
dialog.addEventListener('cancel',e=>{e.preventDefault();closeOverlay();});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeOverlay();}});
$('[data-close]').addEventListener('click',closeOverlay);
function renderSaved(){const chosen=saved.map(findProduct);return chosen.length?`<p class="small muted">Your flavors, for later. Saved on this device.</p>${chosen.map(p=>`<div class="saved-item"><a href="${p.url}"><img src="${p.image}" alt="${esc(p.name)} concept stick" width="90" height="110"></a><div><a href="${p.url}"><h3>${esc(p.name)}</h3></a><p>6- or 12-packs · in development</p></div><button data-remove="${p.id}" aria-label="Remove ${esc(p.name)} from your shortlist">remove</button></div>`).join('')}<div class="saved-summary">This is a personal shortlist. No items are reserved, no payment is taken, and no order is placed.</div><a class="text-link" href="${ROOT}collection/index.html">keep exploring ↗</a>`:`<div class="saved-empty"><p class="eyebrow">your next little ritual</p><h3>something<br>to look forward to.</h3><p>Save a flavor that catches your eye. It’ll be here when you come back on this device.</p><a class="button" href="${ROOT}collection/index.html">explore the flavors ↗</a></div>`;}
function openSaved(){openOverlay('saved','your shortlist.',renderSaved());}
function syncSaveButtons(){
 $$('.save-count').forEach(el=>el.textContent=saved.length);
 $$('[data-save]').forEach(btn=>{const exists=saved.includes(btn.dataset.save);btn.innerHTML=`${roll(exists?'saved to your shortlist':'save this flavor')}<span aria-hidden="true" class="arrow">${exists?'✓':'↗'}</span>`;btn.setAttribute('aria-pressed',String(exists));});
}
function saveFlavor(id){if(!products.some(p=>p.id===id))return;if(saved.includes(id)){announce(`${findProduct(id).name} is already in your shortlist.`);return;}
 saved.push(id);savedPersisted=storage.set('normie-shortlist',saved);syncSaveButtons();
 $$('.save-count').forEach(el=>animate(el,[{transform:'scale(1)'},{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:240}));
 announce(`${findProduct(id).name} saved ${savedPersisted?'on this device':'for this visit only because browser storage is unavailable'}. No order placed.`);
 if(!savedPersisted){const explanation=$('.shortlist-explainer',dialog.open?dialog:document);if(explanation)explanation.textContent='Saved for this visit only. Browser storage is unavailable. No order is placed.';}
}
function removeFlavor(id){saved=saved.filter(v=>v!==id);storage.set('normie-shortlist',saved);syncSaveButtons();overlayBody.innerHTML=renderSaved();bindImages(overlayBody);($('[data-remove]',overlayBody)||$('a',overlayBody)||$('[data-close]')).focus();announce(`${findProduct(id).name} removed from your shortlist.`);}
syncSaveButtons();
function openQuick(id){quickId=id;const p=findProduct(id);openOverlay('quick',`a closer look.`,`<div class="quick-image" style="background:${p.color}"><img src="${p.image}" alt="${esc(p.gallery[0].alt)}" width="1024" height="1280"><span class="image-error" hidden>Image unavailable</span></div>${productInfo(p,'quick',true).replace('<h1','<h2').replace('</h1>','</h2>')}`);}
function openMenu(){openOverlay('menu','a little normie.',`<nav class="mobile-menu-links" aria-label="Mobile navigation"><a href="${ROOT}index.html#order">order the box</a><a href="${ROOT}index.html#account" data-account-open>sign in · my account</a><a href="${ROOT}index.html#rewards">rewards</a><a href="${ROOT}collection/index.html">the collection</a><a href="${ROOT}about/index.html">our story</a><a href="${ROOT}help/index.html">good to know</a></nav><p class="eyebrow">find your flavor</p><div class="mobile-menu-flavors">${products.map(p=>`<a href="${p.url}">${image(p)}<span>${p.name} ↗</span></a>`).join('')}</div>`);}
function searchMarkup(list){return list.map(p=>`<a class="search-result" href="${p.url}"><img src="${p.image}" alt="" width="90" height="110"><div><h3>${esc(p.name)}</h3><p>${esc(p.descriptor)}</p></div><span aria-hidden="true">↗</span></a>`).join('');}
let searchTimer;
function openSearch(){openOverlay('search','find your normie.',`<label for="search-input" class="sr-only">Search flavors or ingredients</label><input class="search-input" id="search-input" type="search" placeholder="a flavor, an ingredient…" autocomplete="off"><p class="search-help">Try “matcha”, “collagen”, or “coffee”.</p><p class="search-status" role="status" aria-live="polite">3 flavors to explore</p><div id="search-results">${searchMarkup(products)}</div>`,'#search-input');}
overlayBody.addEventListener('input',e=>{if(e.target.id==='search-input'){const q=e.target.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),epoch=overlayEpoch;clearTimeout(searchTimer);$('.search-status').textContent='Searching flavors…';$('#search-results').setAttribute('aria-busy','true');searchTimer=setTimeout(()=>{if(epoch!==overlayEpoch)return;const found=products.filter(p=>[p.name,p.descriptor,...p.ingredients.flat()].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q));$('#search-results').innerHTML=found.length?searchMarkup(found):'<p>No flavors found. Try a flavor name or an ingredient.</p><button class="text-link" data-reset-search>clear search</button>';$('#search-results').removeAttribute('aria-busy');$('.search-status').textContent=`${found.length} ${found.length===1?'flavor':'flavors'} found`;bindImages(overlayBody);},120);}});

// Gallery/variant state is authoritative; late image loads cannot replace a newer choice.
let selectedId=$('[data-product-page]')?.dataset.productPage || 'matcha',galleryIndex=0,variantEpoch=0,lightboxEpoch=0;
async function swapImage(img,src,alt,epochCheck){
 const next=new Image();next.src=src;
 try{await next.decode();}catch{if(epochCheck()){announce('That image could not load. The previous image is still shown.');}return false;}
 if(!epochCheck())return false;
 const parent=img.parentElement;$$('.image-transition-layer',parent).forEach(el=>el.remove());
 let old;if(!reduced){old=img.cloneNode(false);old.removeAttribute('id');old.alt='';old.setAttribute('aria-hidden','true');old.classList.add('image-transition-layer');old.style.objectFit=getComputedStyle(img).objectFit;parent.append(old);}
 img.src=src;img.alt=alt;img.style.visibility='';const fallback=$('.image-error',parent);if(fallback)fallback.hidden=true;
 if(old){const fade=animate(old,[{opacity:1},{opacity:0}],{duration:motion.variant});if(fade)fade.finished.catch(()=>{}).finally(()=>old.remove());else old.remove();}return true;
}
async function changeVariant(id,quick=false){const p=findProduct(id);const epoch=++variantEpoch;
 if(quick){quickId=id;const info=$('[data-info]',overlayBody);info.outerHTML=productInfo(p,'quick',true).replace('<h1','<h2').replace('</h1>','</h2>');initAccordions(overlayBody);syncSaveButtons();$(`[data-variant="${id}"]`,overlayBody).focus({preventScroll:true});$('.quick-image',overlayBody).style.background=p.color;await swapImage($('.quick-image img',overlayBody),p.image,p.gallery[0].alt,()=>epoch===variantEpoch&&dialog.open&&dialog.dataset.kind==='quick');}
 else {selectedId=id;galleryIndex=0;history.replaceState(null,'',p.url);document.title=`${p.descriptor} — normie.`;const related=$('.related .product-grid');if(related){related.innerHTML=products.filter(v=>v.id!==id).map(card).join('');bindImages(related);}$('#product-details').innerHTML=productInfo(p);initAccordions($('#product-details'));syncSaveButtons();$(`[data-variant="${id}"]`,$('#product-details')).focus({preventScroll:true});$('[data-product-page]').dataset.productPage=id;$('.gallery-main').style.background=p.color;$('.gallery-main').classList.remove('study');$('.gallery-main').dataset.lightbox=id;$('.gallery-main').setAttribute('aria-label',`Enlarge ${p.name} product image`);$$('[data-gallery-index]').forEach((el,i)=>{el.classList.toggle('selected',!i);el.setAttribute('aria-pressed',String(!i));if(i===0)$('img',el).src=p.image;});const updated=await swapImage($('#product-image'),p.image,p.gallery[0].alt,()=>epoch===variantEpoch);if(updated)$('.gallery-caption').textContent='Concept imagery. Final packaging may change.';else if(epoch===variantEpoch)$('.gallery-caption').textContent='New image unavailable; the previous flavor image is shown.';}
 if(epoch===variantEpoch)announce(`${p.name} selected. In development; not available to purchase.`);
}
function gallerySelect(index){galleryIndex=index;const p=findProduct(selectedId),g=p.gallery[index],epoch=++variantEpoch;swapImage($('#product-image'),g.src,g.alt,()=>epoch===variantEpoch).then(ok=>{if(!ok)return;$('.gallery-main').classList.toggle('study',index===1);});$$('[data-gallery-index]').forEach((el,i)=>{el.classList.toggle('selected',i===index);el.setAttribute('aria-pressed',String(i===index));});}
function lightbox(){const p=findProduct(selectedId);lightboxState={id:selectedId,index:galleryIndex};const g=p.gallery[galleryIndex];openOverlay('lightbox',`${p.name} — ${g.label}`,`<div class="lightbox-image"><img src="${g.src}" alt="${esc(g.alt)}" width="1024" height="1280"></div><div class="lightbox-controls"><span class="lightbox-caption">${galleryIndex+1} / ${p.gallery.length} · concept artwork</span><div><button class="circle-button" data-light-prev aria-label="Previous image">←</button><button class="circle-button" data-light-next aria-label="Next image">→</button></div></div>`);}
async function lightboxMove(dir){if(!lightboxState)return;const p=findProduct(lightboxState.id);lightboxState.index=(lightboxState.index+dir+p.gallery.length)%p.gallery.length;const g=p.gallery[lightboxState.index],epoch=++lightboxEpoch;const ok=await swapImage($('.lightbox-image img'),g.src,g.alt,()=>epoch===lightboxEpoch&&dialog.open&&dialog.dataset.kind==='lightbox');if(ok){overlayTitle.textContent=`${p.name} — ${g.label}`;$('.lightbox-caption').textContent=`${lightboxState.index+1} / ${p.gallery.length} · concept artwork`;}}

// Accordions use a measured-free grid row transition; closed regions are inert.
function initAccordions(root=document){$$('.accordion-panel',root).forEach(el=>el.inert=!el.classList.contains('open'));}
initAccordions();
document.addEventListener('click',e=>{
 const btn=e.target.closest('button');if(!btn)return;
 if(btn.dataset.open||btn.dataset.quick||btn.hasAttribute('data-lightbox'))lastOverlayTrigger=btn;
 if(btn.dataset.open){({menu:openMenu,search:openSearch,saved:openSaved,filters:openFilters})[btn.dataset.open]?.();}
 if(btn.dataset.quick)openQuick(btn.dataset.quick);
 if(btn.dataset.save)saveFlavor(btn.dataset.save);
 if(btn.dataset.remove)removeFlavor(btn.dataset.remove);
 if(btn.hasAttribute('data-variant'))changeVariant(btn.dataset.variant,!!btn.closest('#overlay'));
 if(btn.hasAttribute('data-gallery-index'))gallerySelect(Number(btn.dataset.galleryIndex));
 if(btn.hasAttribute('data-lightbox'))lightbox();
 if(btn.hasAttribute('data-light-prev'))lightboxMove(-1);
 if(btn.hasAttribute('data-light-next'))lightboxMove(1);
 if(btn.hasAttribute('data-reset-search')){openSearch();}
 if(btn.hasAttribute('data-accordion')){const open=btn.getAttribute('aria-expanded')!=='true';btn.setAttribute('aria-expanded',String(open));const panel=document.getElementById(btn.getAttribute('aria-controls'));panel.classList.toggle('open',open);panel.inert=!open;}
 if(btn.hasAttribute('data-clear-local')){saved=[];storage.set('normie-shortlist',saved);syncSaveButtons();btn.textContent='saved flavors cleared';announce('Your saved flavors have been cleared.');}
});
dialog.addEventListener('keydown',e=>{if(e.key==='Tab'){const focusable=$$('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',dialog).filter(el=>!el.closest('[inert]')&&el.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeOverlay();return;}if(dialog.dataset.kind==='lightbox'&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();lightboxMove(e.key==='ArrowLeft'?-1:1);}});

// Collection filters keep controls/focus stable while cards update.
let filter='all',sort='featured',collectionQuery='',filterTimer;
function updateCollection(){const grid=$('#product-grid');if(!grid)return;const list=products.filter(p=>(filter==='all'||p.category===filter)&&`${p.name} ${p.descriptor}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(collectionQuery)).sort((a,b)=>sort==='az'?a.name.localeCompare(b.name):sort==='za'?b.name.localeCompare(a.name):a.order-b.order);grid.classList.add('results-loading');grid.setAttribute('aria-busy','true');clearTimeout(filterTimer);
 $$('[data-filter]').forEach(btn=>{const active=btn.dataset.filter===filter;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));});$('#filter-chips').innerHTML=filter==='all'?'':`<button class="filter-chip" data-filter="all" aria-label="Remove ${esc(filter)} filter">${filter==='fruit'?'fruit + collagen':esc(filter)} ×</button>`;
 filterTimer=setTimeout(()=>{grid.innerHTML=list.map(card).join('');$('#collection-empty').hidden=!!list.length;$('#result-count').textContent=`${list.length} ${list.length===1?'flavor':'flavors'}`;grid.classList.remove('results-loading');grid.removeAttribute('aria-busy');bindImages(grid);},reduced?0:80);
}
function openFilters(){openOverlay('filters','your kind of flavor.',`<fieldset class="filter-drawer"><legend class="sr-only">Choose a flavor category</legend>${[['all','all flavors'],['tea','matcha'],['fruit','açaí + collagen'],['coffee','coffee']].map(([v,n])=>`<label><input type="radio" name="flavor-filter" value="${v}" ${filter===v?'checked':''}>${n}</label>`).join('')}</fieldset><div class="filter-actions"><button class="button" data-apply-filters>show flavors ↗</button><button class="text-link" data-reset-filters>reset</button></div>`);}
document.addEventListener('click',e=>{const btn=e.target.closest('button');if(!btn)return;if(btn.hasAttribute('data-filter')){filter=btn.dataset.filter;if(btn.closest('#collection-empty')){collectionQuery='';$('#collection-search').value='';}updateCollection();}if(btn.hasAttribute('data-apply-filters')){filter=$('input[name=flavor-filter]:checked',dialog).value;updateCollection();closeOverlay();}if(btn.hasAttribute('data-reset-filters')){$('input[value=all]',dialog).checked=true;}});
$('#collection-search')?.addEventListener('input',e=>{collectionQuery=e.target.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();updateCollection();});
$('#sort')?.addEventListener('change',e=>{sort=e.target.value;updateCollection();});

// Proper editorial tab semantics, roving tabindex, and latest-selection-wins fading.
$$('.editorial-tabs').forEach(container=>{const tabs=$$('[role=tab]',container);let sequence=0;
 async function selectTab(next){const ticket=++sequence;const current=$('[role=tabpanel]:not([hidden])',container);tabs.forEach(t=>{t.setAttribute('aria-selected',String(t===next));t.tabIndex=t===next?0:-1;});const panel=document.getElementById(next.getAttribute('aria-controls'));if(panel===current)return;const exit=animate(current,[{opacity:1},{opacity:0}],{duration:120});if(exit)await exit.finished.catch(()=>{});if(ticket!==sequence)return;$$('[role=tabpanel]',container).forEach(p=>p.hidden=p!==panel);animate(panel,[{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:200});}
 tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>selectTab(tab));tab.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=tabs[(i+1)%tabs.length];if(e.key==='ArrowLeft')next=tabs[(i-1+tabs.length)%tabs.length];if(e.key==='Home')next=tabs[0];if(e.key==='End')next=tabs.at(-1);if(next){e.preventDefault();next.focus();selectTab(next);}});});
});

// No simulated signup. A live endpoint must explicitly confirm accepted data.
$$('[data-form]').forEach(form=>{
 const kind=form.dataset.form,endpoint=kind==='contact'?brand.contactEndpoint:brand.waitlistEndpoint;
 const isDemo=brand.demoMode||!endpoint;
 if(!isDemo){$('.form-disclosure',form).textContent='Your information will be sent to normie when you submit.';const button=$('[type=submit]',form);button.setAttribute('aria-label',kind==='contact'?'Send message':'Join the waitlist');if(kind==='contact')button.innerHTML=roll('send message')+' ↗';}
 form.addEventListener('submit',async e=>{e.preventDefault();if(form.dataset.pending)return;const status=$('.form-status',form);status.classList.remove('error');$$('[aria-invalid]',form).forEach(el=>el.removeAttribute('aria-invalid'));const invalid=$$('input,textarea',form).find(el=>!el.checkValidity());if(invalid){invalid.setAttribute('aria-invalid','true');status.textContent=invalid.type==='email'?'Please enter a valid email address.':'Please complete the highlighted field.';status.classList.add('error');invalid.focus();return;}
 if(isDemo){status.textContent='Preview only — no data was sent. The live form is not connected yet.';return;}
 const button=$('[type=submit]',form);const label=button.innerHTML;form.dataset.pending='true';button.disabled=true;button.textContent='sending…';status.textContent='Sending your information…';status.classList.add('pending');const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
 try{const url=new URL(endpoint,location.origin);if(url.origin!==location.origin)throw new Error('Only same-origin form endpoints are supported.');const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form))),signal:controller.signal});const payload=await response.json();if(!response.ok||payload.ok!==true)throw new Error('Submission was not confirmed.');status.textContent=kind==='contact'?'Your message was received. Thank you.':'You’re on the list. Thank you.';}catch{status.textContent='We couldn’t send that. Your details are still here — please try again.';status.classList.add('error');}finally{clearTimeout(timeout);delete form.dataset.pending;button.disabled=false;button.innerHTML=label;status.classList.remove('pending');}
 });
});
