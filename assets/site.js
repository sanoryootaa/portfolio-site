/* ===== 全ページ共通：GA4・データ読み込み・文字組み・プレビュー・ヘルパー ===== */

/* ホームのURL。公開前は隠しURL（home.html）、公開時に index.html へ差し替えて "./" にする */
const HOME="home.html";
/* プレビュー（管理画面の右側に映すとき）：?preview=1。管理画面が localStorage に置いた編集中データで描画する */
const PREVIEW=new URLSearchParams(location.search).has("preview");

/* ===== GA4 ===== 測定IDの差し替えはここ1か所だけ。プレビュー・管理画面では計測しない */
const GA_ID="G-K5GHBEW050";
const NO_GA=PREVIEW||location.pathname.includes("/admin");
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
if(!NO_GA){
  gtag("js",new Date());
  /* IP匿名化（互換のため明示）・Google信号は無効。Cookie同意バナーは付けない */
  gtag("config",GA_ID,{anonymize_ip:true,allow_google_signals:false});
  const s=document.createElement("script");s.async=true;
  s.src="https://www.googletagmanager.com/gtag/js?id="+GA_ID;document.head.appendChild(s);
}
/* 送信は必ずこれ経由（gtag未読込でも落ちない）*/
function gaEv(name,params){ if(!NO_GA&&typeof gtag==="function") gtag("event",name,params||{}); }

/* ===== content/*.json（管理画面 /admin で編集・公開）===== */
function loadJSON(name){
  if(PREVIEW){
    try{const v=localStorage.getItem("preview:"+name);if(v)return Promise.resolve(JSON.parse(v));}catch(e){}
  }
  return fetch(`content/${name}.json`,{cache:"no-cache"}).then(r=>r.ok?r.json():{}).catch(()=>({}));
}
function loadContent(...names){return Promise.all(names.map(loadJSON));}
/* 読み込んで描画。names の先頭は必ず "site"（文字組みを先に当てる）。
   プレビュー中は管理画面で編集されるたびに描画し直す（first=false のときは計測などの一回きりの処理をしない）*/
function onContent(names,render){
  let busy=false,again=false;
  const run=first=>{
    if(busy){again=true;return;}busy=true;
    loadContent(...names).then(d=>{applyTypography(d[0]);render(d,first);})
      .finally(()=>{busy=false;if(again){again=false;run(false);}});
  };
  run(true);
  if(PREVIEW)addEventListener("storage",e=>{if(e.key&&e.key.startsWith("preview:"))run(false);});
}

/* ===== 文字組み（管理画面の「文字組み」で編集。イラレ/インデザインと同じ単位）=====
   size=px / leading=行送り％（160=1.6倍）/ tracking=1/1000em / kerning: metrics=メトリクス, none=0 / palt=プロポーショナルメトリクス */
const TYPO_AREAS={
  header:     {label:"サイト名・ヘッダー",       page:"home",    sel:"header, .home-link, .botmsg",   d:{size:15,weight:400,leading:150,tracking:0,kerning:"metrics",palt:false}},
  home_label: {label:"ホーム：年・ジャンル",     page:"home",    sel:".label",                         d:{size:15,weight:400,leading:100,tracking:0,kerning:"metrics",palt:false}},
  title:      {label:"作品名・氏名",             page:"work",    sel:".page-title",                    d:{size:20,weight:700,leading:120,tracking:0,kerning:"metrics",palt:false}},
  meta:       {label:"ジャンル/制作年・受賞・肩書き",page:"work", sel:".w-sub, .w-award, .dragon, .p-role", d:{size:15,weight:400,leading:160,tracking:0,kerning:"metrics",palt:false}},
  heading:    {label:"見出し（(About) など）",   page:"work",    sel:".sec > h2",                      d:{size:15,weight:400,leading:160,tracking:0,kerning:"metrics",palt:false}},
  about_ja:   {label:"About 本文（日本語）",     page:"work",    sel:".bi p[lang=ja]",                 d:{size:15,weight:400,leading:160,tracking:0,kerning:"metrics",palt:false}},
  about_en:   {label:"About 本文（英語）",       page:"work",    sel:".bi p[lang=en]",                 d:{size:15,weight:400,leading:160,tracking:0,kerning:"metrics",palt:false}},
  credit:     {label:"クレジット",               page:"work",    sel:".credits",                       d:{size:15,weight:400,leading:160,tracking:0,kerning:"metrics",palt:false}},
  profile:    {label:"プロフィールの経歴・連絡先",page:"profile", sel:".p-list",                        d:{size:15,weight:400,leading:160,tracking:0,kerning:"metrics",palt:false}},
};
function typoValue(site,key){return Object.assign({},TYPO_AREAS[key].d,((site||{}).typography||{})[key]||{});}
function applyTypography(site){
  let css="";
  for(const key in TYPO_AREAS){
    const t=typoValue(site,key), sel=TYPO_AREAS[key].sel.split(",").map(x=>"html "+x.trim()).join(",");
    css+=`${sel}{font-size:${+t.size}px;font-weight:${+t.weight};line-height:${(+t.leading)/100};`+
      `letter-spacing:${(+t.tracking)/1000}em;font-kerning:${t.kerning==="none"?"none":"normal"};`+
      `font-feature-settings:${t.palt?'"palt" 1':"normal"};}`;
  }
  let st=document.getElementById("typo");
  if(!st){st=document.createElement("style");st.id="typo";document.head.appendChild(st);}
  st.textContent=css;
}

/* ===== helpers ===== */
function esc(s){return (s==null?"":String(s)).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
/* "/media/..." → "media/..."（github.io/portfolio-site 配下でも画像が切れないよう相対パスに）*/
function asset(p){return (p||"").trim().replace(/^\//,"");}
function ytId(s){
  s=(s||"").trim();
  const m=s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{6,})/);return m?m[1]:s;
}
function workURL(w){return "work.html?id="+encodeURIComponent(w.slug);}

/* タブ名 */
function setTitle(...parts){document.title=parts.filter(Boolean).join(" — ");}

/* data-home のリンクをホームへ。プレビュー中はサイト内リンクに ?preview=1 を引き継ぐ */
document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll("a[data-home]").forEach(a=>a.href=HOME);
});
if(PREVIEW)document.addEventListener("click",e=>{
  const a=e.target.closest&&e.target.closest("a[href]");if(!a)return;
  const u=new URL(a.href,location.href);
  if(u.origin===location.origin&&!u.searchParams.has("preview")){u.searchParams.set("preview","1");a.href=u.href;}
},true);

/* ✕：同じサイトから来たなら「戻る」（ホームのスクロール位置を保つ）、直リンクならホームへ */
function bindClose(el){
  wanderClose(el);
  el.addEventListener("click",e=>{
    let same=false;try{same=document.referrer&&new URL(document.referrer).origin===location.origin;}catch(_){}
    if(same&&history.length>1){e.preventDefault();history.back();}
  });
  document.addEventListener("keydown",e=>{if(e.key==="Escape")el.click();});
}

/* ===== 動き ===== */
const REDUCED=matchMedia("(prefers-reduced-motion: reduce)").matches;
/* 角度の差を -π〜π に */
function angDiff(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
/* 画面端に近づいたら中央へ向き直る（漂う系の共通処理）*/
function steerInside(x,y,heading,margin,dt){
  if(x>margin&&x<innerWidth-margin&&y>margin&&y<innerHeight-margin)return heading;
  const toCenter=Math.atan2(innerHeight/2-y,innerWidth/2-x);
  return heading+angDiff(toCenter,heading)*Math.min(1,2.2*dt);
}

/* ✕：開いた瞬間は右上の所定位置。少し止まってから、ゆっくり回りながら画面内を漂う（クリックで閉じるのはそのまま）*/
function wanderClose(el){
  if(REDUCED)return;
  const r=el.getBoundingClientRect(), w=r.width;
  let x=r.left, y=r.top, heading=Math.PI*(0.65+Math.random()*0.3), rot=0;   /* 最初は左下方向へ */
  const p1=Math.random()*6, p2=Math.random()*6, t0=performance.now();
  let last=t0;
  el.style.top=el.style.left="0";el.style.right="auto";
  const frame=now=>{
    const dt=Math.min(.05,(now-last)/1000), t=(now-t0)/1000; last=now;
    const ramp=Math.min(1,Math.max(0,(t-1)/2.5));                 /* 1秒止まってから2.5秒かけて加速 */
    heading+=(0.35*Math.sin(t*0.37+p1)+0.2*Math.sin(t*0.91+p2))*dt; /* ゆるく向きを変える */
    heading=steerInside(x+w/2,y+w/2,heading,40,dt);
    x+=Math.cos(heading)*26*ramp*dt; y+=Math.sin(heading)*26*ramp*dt;   /* 26px/秒 */
    x=Math.min(Math.max(x,0),innerWidth-w); y=Math.min(Math.max(y,0),innerHeight-w);
    rot+=18*ramp*dt;                                                   /* 18°/秒 */
    el.style.transform=`translate(${x}px,${y}px) rotate(${rot}deg)`;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/* 受賞歴：文字列が龍のように連なって飛びまわる。
   最初は元の位置に一列で並んでいて、先頭（文末）から飛び立ち、残りの文字が軌跡をなぞって付いていく */
let _dragonStop=null;
function flyDragon(el){
  if(_dragonStop)_dragonStop();                                 /* プレビューで描き直すとき前の龍を消す */
  const text=el.textContent.trim();
  if(REDUCED||!text)return;
  const r=el.getBoundingClientRect(), y0=r.top+r.height/2, x0=r.left;
  const layer=document.createElement("div");layer.className="dragon";layer.setAttribute("aria-hidden","true");
  let alive=true;_dragonStop=()=>{alive=false;layer.remove();_dragonStop=null;};
  const spans=[...text].map(ch=>{const s=document.createElement("span");s.textContent=ch;
    if(/\p{Extended_Pictographic}/u.test(ch))s.className="emoji";layer.appendChild(s);return s;});
  document.body.appendChild(layer);
  /* 各文字の幅 → 文頭からの中心位置 */
  let acc=0;
  const chars=spans.map(s=>{const b=s.getBoundingClientRect(),c={s,w:b.width,h:b.height,at:acc+b.width/2};acc+=b.width;return c;});
  const L=acc;
  el.classList.add("sr-only");                                  /* 元の行は読み上げ用に残して見た目は消す */
  /* 軌跡：最初は元の行そのもの（文頭→文末へ一直線）*/
  const trail=[];
  for(let d=0;d<=L;d+=4)trail.push({x:x0+d,y:y0,d});
  let hx=x0+L, hy=y0, D=L, heading=0;
  const p1=Math.random()*6, p2=Math.random()*6, t0=performance.now();
  let last=t0;
  const at=d=>{                                                 /* 軌跡上の距離 d の位置と向き */
    let lo=0,hi=trail.length-1;
    if(d<=trail[0].d)return {x:trail[0].x,y:trail[0].y,a:Math.atan2(trail[1].y-trail[0].y,trail[1].x-trail[0].x)};
    while(hi-lo>1){const m=(lo+hi)>>1;if(trail[m].d<d)lo=m;else hi=m;}
    const A=trail[lo],B=trail[hi],k=(d-A.d)/((B.d-A.d)||1);
    return {x:A.x+(B.x-A.x)*k,y:A.y+(B.y-A.y)*k,a:Math.atan2(B.y-A.y,B.x-A.x)};
  };
  const frame=now=>{
    const dt=Math.min(.05,(now-last)/1000), t=(now-t0)/1000; last=now;
    const ramp=Math.min(1,Math.max(0,(t-0.8)/1.5));             /* 少し止まってから飛び立つ */
    heading+=(1.1*Math.sin(t*0.8+p1)+0.7*Math.sin(t*1.7+p2))*dt*ramp;   /* うねり */
    heading=steerInside(hx,hy,heading,60,dt);
    const step=120*ramp*dt;                                     /* 120px/秒 */
    if(step>0.3){
      hx+=Math.cos(heading)*step;hy+=Math.sin(heading)*step;D+=step;
      trail.push({x:hx,y:hy,d:D});
      while(trail.length>2&&trail[1].d<D-L-40)trail.shift();
    }
    for(const c of chars){
      const p=at(D-(L-c.at));
      c.s.style.transform=`translate(${p.x-c.w/2}px,${p.y-c.h/2}px) rotate(${p.a}rad)`;
    }
    if(alive)requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
