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
