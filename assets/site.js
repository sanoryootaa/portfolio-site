/* ===== 全ページ共通：GA4・データ読み込み・ヘルパー ===== */

/* ===== GA4 ===== 測定IDの差し替えはここ1か所だけ */
const GA_ID="G-K5GHBEW050";
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag("js",new Date());
/* IP匿名化（互換のため明示）・Google信号は無効。Cookie同意バナーは付けない */
gtag("config",GA_ID,{anonymize_ip:true,allow_google_signals:false});
(function(){const s=document.createElement("script");s.async=true;
  s.src="https://www.googletagmanager.com/gtag/js?id="+GA_ID;document.head.appendChild(s);})();
/* 送信は必ずこれ経由（gtag未読込でも落ちない）*/
function gaEv(name,params){ if(typeof gtag==="function") gtag("event",name,params||{}); }

/* ===== content/*.json（管理画面 Pages CMS で編集）===== */
function loadJSON(name){
  return fetch(`content/${name}.json`,{cache:"no-cache"}).then(r=>r.ok?r.json():{}).catch(()=>({}));
}
function loadContent(...names){return Promise.all(names.map(loadJSON));}

/* ===== helpers ===== */
function esc(s){return (s==null?"":String(s)).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
/* "/media/..." → "media/..."（github.io/portfolio-site 配下でも画像が切れないよう相対パスに）*/
function asset(p){return (p||"").trim().replace(/^\//,"");}
function ytId(s){
  s=(s||"").trim();
  const m=s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{6,})/);return m?m[1]:s;
}
function workURL(w){return "work.html?id="+encodeURIComponent(w.slug);}

/* 色：site.json の colors を CSS 変数へ */
function applyColors(site,{dark}={}){
  const c=(site&&site.colors)||{}, r=document.documentElement.style;
  if(c.accent)r.setProperty("--accent",c.accent);
  if(dark)return;                                  /* 作品・プロフィールは黒地固定 */
  if(c.background)r.setProperty("--bg",c.background);
  if(c.text)r.setProperty("--ink",c.text);
}

/* 作品色：random=候補から重複最小でランダム配分 / fixed=作品ごとの color。
   ホームで決めた色は sessionStorage に保存し、作品ページで同じ色を使う */
const DEFAULT_PALETTE=["#00DD58","#2E7BFF","#FF4D3D","#FFC400","#B16CFF","#FF7A00"];
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];}return a;}
function palette(site){const p=site&&site.colors&&site.colors.work_palette;return p&&p.length?p:DEFAULT_PALETTE;}
function workColors(site,works){
  const pal=palette(site);
  if(((site.colors||{}).mode||"random")==="fixed")
    return works.map((w,i)=>(w.color||"").trim()||pal[i%pal.length]);
  /* 候補を各色できるだけ均等(回数差≤1)に割り当て→シャッフル */
  const ps=shuffle(pal.slice()),n=ps.length,base=Math.floor(works.length/n),extra=works.length%n,bag=[];
  ps.forEach((c,i)=>{const cnt=base+(i<extra?1:0);for(let k=0;k<cnt;k++)bag.push(c);});
  return shuffle(bag);
}
function rememberColors(works,colors){
  try{sessionStorage.setItem("workColors",JSON.stringify(Object.fromEntries(works.map((w,i)=>[w.slug,colors[i]]))));}catch(e){}
}
function colorFor(site,works,idx){
  const w=works[idx];
  try{const m=JSON.parse(sessionStorage.getItem("workColors")||"{}");if(m[w.slug])return m[w.slug];}catch(e){}
  return (w.color||"").trim()||palette(site)[idx%palette(site).length];
}

/* タブ名 */
function setTitle(...parts){document.title=parts.filter(Boolean).join(" — ");}

/* ✕：同じサイトから来たなら「戻る」（ホームのスクロール位置を保つ）、直リンクならホームへ */
function bindClose(el){
  el.addEventListener("click",e=>{
    let same=false;try{same=document.referrer&&new URL(document.referrer).origin===location.origin;}catch(_){}
    if(same&&history.length>1){e.preventDefault();history.back();}
  });
  document.addEventListener("keydown",e=>{if(e.key==="Escape")el.click();});
}
