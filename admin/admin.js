/* ===== 管理画面（sanoryota.com/admin）=====
   GitHub API で content/*.json を直接読み書きする。
   - 編集中（W）    … この端末だけ。localStorage に自動保存。右のプレビューに即反映
   - 確認用（DRAFT）… renewal ブランチの content/*.json。確認用ページ /stage/ で見られる（本公開サイトには出ない）
   - 本公開（LIVE） … main ブランチの content/*.json。GitHub Pages が1〜2分で反映
   画像はアップロード時に main の media/ へ直接保存（参照されるまでサイトには出ない）。 */

const GH={owner:"sanoryootaa",repo:"portfolio-site",live:"main",draft:"renewal"};
const R=`/repos/${GH.owner}/${GH.repo}`;
const NAMES=["works","profile","site"];
const TOKEN_URL="https://github.com/settings/personal-access-tokens/new?name=portfolio+admin&description=sanoryota.com+admin&target_name="+GH.owner+"&expires_in=365&contents=write";

const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const clone=o=>JSON.parse(JSON.stringify(o));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const getPath=(o,p)=>p.split(".").reduce((x,k)=>x==null?x:x[k],o);
function setPath(o,p,v){
  const ks=p.split(".");let x=o;
  ks.slice(0,-1).forEach((k,i)=>{if(x[k]==null)x[k]=/^\d+$/.test(ks[i+1])?[]:{};x=x[k];});
  x[ks[ks.length-1]]=v;
}
function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}

let TOKEN="";try{TOKEN=localStorage.getItem("admin:token")||"";}catch(e){}
let LIVE=null, DRAFT=null, W=null;
const BLOBS={};                       /* "/media/…" → blob URL（アップロード直後でまだサイトに出ていない画像）*/
let BUSY="";
let pvMode="pc", pvPage=null, pvSrc="", openTypo=null;

/* ===== GitHub API ===== */
async function gh(path,opt={}){
  const headers={Authorization:"Bearer "+TOKEN,Accept:opt.raw?"application/vnd.github.raw+json":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
  if(opt.body)headers["Content-Type"]="application/json";
  const r=await fetch("https://api.github.com"+path,{method:opt.method||"GET",headers,body:opt.body&&JSON.stringify(opt.body),cache:"no-store"});
  if(!r.ok){const e=new Error(`GitHub ${r.status}`);e.status=r.status;throw e;}
  return opt.raw?r.text():r.status===204?null:r.json();
}
async function readContent(branch){
  const out={};
  for(const n of NAMES)out[n]=JSON.parse(await gh(`${R}/contents/content/${n}.json?ref=${branch}`,{raw:true}));
  return out;
}
/* 複数ファイルを1コミットで。files: [{path, content, base64?}] */
async function commit(branch,files,message){
  for(let i=0;i<3;i++){
    let ref;
    try{ref=await gh(`${R}/git/ref/heads/${branch}`);}
    catch(e){
      if(e.status!==404||branch===GH.live)throw e;
      const m=await gh(`${R}/git/ref/heads/${GH.live}`);                /* 確認用ブランチが無ければ main から作る */
      ref=await gh(`${R}/git/refs`,{method:"POST",body:{ref:"refs/heads/"+branch,sha:m.object.sha}});
    }
    const base=await gh(`${R}/git/commits/${ref.object.sha}`);
    const tree=[];
    for(const f of files){
      const b=await gh(`${R}/git/blobs`,{method:"POST",body:{content:f.content,encoding:f.base64?"base64":"utf-8"}});
      tree.push({path:f.path,mode:"100644",type:"blob",sha:b.sha});
    }
    const t=await gh(`${R}/git/trees`,{method:"POST",body:{base_tree:base.tree.sha,tree}});
    const c=await gh(`${R}/git/commits`,{method:"POST",body:{message,tree:t.sha,parents:[ref.object.sha]}});
    try{await gh(`${R}/git/refs/heads/${branch}`,{method:"PATCH",body:{sha:c.sha}});return c.sha;}
    catch(e){if(e.status===422&&i<2)continue;throw e;}         /* 他で更新されていたらやり直す */
  }
}
const jsonFile=(n,data)=>({path:`content/${n}.json`,content:JSON.stringify(data,null,2)+"\n"});
function errText(e){
  if(e.status===401)return "鍵が無効か期限切れです。ログインし直してください";
  if(e.status===403||e.status===404)return "鍵の権限が足りません（Contents を Read and write に）";
  return "通信エラー："+(e.message||e);
}

/* ===== 状態 ===== */
function normalize(d){
  d.works=d.works||{};d.works.works=d.works.works||[];
  /* 画像は {src,size} に揃える（古いデータは "パス" の文字列）*/
  d.works.works.forEach(w=>{w.images=(w.images||[]).map(x=>typeof x==="string"?{src:x,size:"full"}:x);});
  d.profile=d.profile||{};["career","awards","skills"].forEach(k=>d.profile[k]=d.profile[k]||[]);
  d.site=d.site||{};d.site.typography=d.site.typography||{};
  return d;
}
const saveLocal=debounce(()=>{try{localStorage.setItem("admin:work",JSON.stringify({data:W,base:DRAFT}));}catch(e){}},300);
function withBlobs(o){
  let s=JSON.stringify(o);
  for(const k in BLOBS)s=s.split(JSON.stringify(k)).join(JSON.stringify(BLOBS[k]));
  return JSON.parse(s);
}
function pushPreview(){
  try{for(const n of NAMES)localStorage.setItem("preview:"+n,JSON.stringify(withBlobs(W[n])));}catch(e){}
}
const pushPreviewSoon=debounce(pushPreview,120);
function changed(){saveLocal();pushPreviewSoon();updateStatus();syncPreviewPage();}
function imgSrc(p){return p?(BLOBS[p]||"../"+asset(p)):"";}

/* ===== 起動 ===== */
boot();
async function boot(){
  if(!TOKEN)return renderLogin();
  $("#app").innerHTML=`<div class="login"><p class="note">読み込み中…</p></div>`;
  try{
    await gh(R);
    LIVE=normalize(await readContent(GH.live));
    try{DRAFT=normalize(await readContent(GH.draft));}
    catch(e){if(e.status!==404)throw e;DRAFT=clone(LIVE);}   /* 確認用がまだ無い */
  }catch(e){
    if(e.status===401||e.status===404){try{localStorage.removeItem("admin:token");}catch(_){}TOKEN="";return renderLogin(errText(e));}
    $("#app").innerHTML=`<div class="login"><p>${esc(errText(e))}</p><br><button class="btn" onclick="location.reload()">再読み込み</button></div>`;
    return;
  }
  /* この端末に保存していない編集が残っていれば続きから */
  let local=null;try{local=JSON.parse(localStorage.getItem("admin:work")||"null");}catch(e){}
  W=clone(DRAFT);
  if(local&&local.data&&!same(local.data,DRAFT)){
    if(local.base&&same(local.base,DRAFT))W=normalize(local.data);
    else{
      const pick=await ask("反映していない編集があります",
        "この端末に、確認用に反映していない編集が残っています。その後に別の端末で確認用が更新されています。どちらを使いますか？",
        [["latest","最新の確認用"],["local","この端末の編集",true]]);
      if(pick==="local")W=normalize(local.data);
    }
  }
  pushPreview();
  renderShell();
  addEventListener("hashchange",renderEditor);
  renderEditor();
}

/* ===== ログイン ===== */
function renderLogin(msg){
  $("#app").innerHTML=`<div class="login">
    <h1 class="h">(Admin)</h1><p class="sub">Sano Ryota Works Archives の管理画面</p>
    ${msg?`<p style="color:var(--danger);margin-bottom:12px">${esc(msg)}</p>`:""}
    <p>最初に一度だけ、GitHub で「このサイト専用の鍵」を作って貼り付けてください。</p>
    <ol>
      <li><a href="${TOKEN_URL}" target="_blank" rel="noopener">GitHub の鍵の作成ページ</a>を開く（GitHub にログイン）</li>
      <li>Token name・Expiration（期限）はそのままでOK。期限が切れたら作り直し</li>
      <li>Repository access：<b>Only select repositories</b> → <code>portfolio-site</code> を選ぶ</li>
      <li>Permissions の <b>Contents</b> を <b>Read and write</b> に（自動で入っていればそのまま）</li>
      <li>一番下の <b>Generate token</b> → 表示された <code>github_pat_…</code> をコピーして下に貼る</li>
    </ol>
    <div class="field"><label>鍵（トークン）</label><input class="in" id="tok" type="password" autocomplete="off" placeholder="github_pat_…"></div>
    <button class="btn primary" id="login">ログイン</button>
    <p class="note" style="margin-top:20px">鍵はこの端末のブラウザにだけ保存されます。このサイトの中身の編集以外には使えません。<br>
    スマホも同じ手順でログインできます（スマホで鍵を作るか、メモアプリなどで受け渡し）。</p>
  </div>`;
  const go=()=>{const v=$("#tok").value.trim();if(!v)return;TOKEN=v;try{localStorage.setItem("admin:token",v);}catch(e){}boot();};
  $("#login").onclick=go;
  $("#tok").onkeydown=e=>{if(e.key==="Enter")go();};
}
function logout(){
  try{localStorage.removeItem("admin:token");}catch(e){}
  location.reload();
}

/* ===== 画面の枠 ===== */
const ICON={
  works:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 15l5-4 4 3 3-2 6 4"/></svg>',
  profile:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  site:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
  typo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7V5h12v2M10 5v14M7 19h6M15 13h6M18 13v6"/></svg>',
  eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
};
const NAV=[["works","作品"],["profile","プロフィール"],["site","サイト設定"],["typo","文字組み"]];
function renderShell(){
  $("#app").innerHTML=`
  <header class="top">
    <span class="brand">(Admin)</span><span class="status" id="status"></span><span class="sp"></span>
    <a class="btn ghost" id="stageLink" href="../stage/" target="_blank" rel="noopener"><span class="l">確認用を見る</span><span class="s">確認用</span></a>
    <button class="btn" id="save"><span class="l">確認用に反映</span><span class="s">反映</span></button>
    <button class="btn primary" id="pub"><span class="l">本公開…</span><span class="s">本公開</span></button>
  </header>
  <div class="shell">
    <nav class="nav" id="nav">
      ${NAV.map(([k,l])=>`<a href="#${k}" data-nav="${k}">${l}</a>`).join("")}
      <div class="foot">
        <a href="../stage/" target="_blank" rel="noopener">確認用ページ</a>
        <a href="../${HOME}" target="_blank" rel="noopener">本公開中のサイト</a>
        <a href="#" id="logout">ログアウト</a>
      </div>
    </nav>
    <main class="editor" id="editor"></main>
    <section class="preview" id="pv">
      <div class="pv-bar">
        <button class="iconbtn pv-close" id="pvClose" aria-label="閉じる">✕</button>
        <select id="pvPage"></select><span class="sp" style="flex:1"></span>
        <div class="seg" id="pvMode"><button data-m="pc">PC</button><button data-m="sp">スマホ</button></div>
        <button class="iconbtn" id="pvReload" title="再読み込み" aria-label="再読み込み">↻</button>
      </div>
      <div class="pv-stage" id="pvStage"><iframe class="pv-frame" id="pvFrame" title="プレビュー"></iframe></div>
    </section>
  </div>
  <nav class="tabs" id="tabs">
    ${NAV.map(([k,l])=>`<a href="#${k}" data-nav="${k}">${ICON[k]}${l}</a>`).join("")}
    <button id="pvOpen">${ICON.eye}プレビュー</button>
  </nav>`;
  $("#save").onclick=saveDraft;
  $("#pub").onclick=publish;
  $("#logout").onclick=e=>{e.preventDefault();logout();};
  $("#pvOpen").onclick=()=>{$("#pv").classList.add("open");fitPreview();};
  $("#pvClose").onclick=()=>$("#pv").classList.remove("open");
  $("#pvReload").onclick=()=>{pushPreview();const u=new URL(pvSrc,location.href);u.searchParams.set("t",Date.now().toString(36));$("#pvFrame").src=u.href;};
  $("#pvMode").onclick=e=>{const m=e.target.dataset.m;if(m){pvMode=m;fitPreview();}};
  $("#pvPage").onchange=e=>{pvPage=e.target.value;setPreview();};
  addEventListener("resize",fitPreview);
  new ResizeObserver(fitPreview).observe($("#pvStage"));
  updateStatus();
}

function updateStatus(){
  const st=$("#status");if(!st)return;
  const dirty=!same(W,DRAFT), unpub=!same(DRAFT,LIVE);
  st.className="status"+(BUSY?" busy":dirty?" dirty":unpub?" unpub":"");
  st.textContent=BUSY||(dirty?"未反映の変更あり":unpub?"確認用に反映済み（本公開前）":"本公開と同じ");
  $("#save").disabled=!!BUSY||!dirty;
  $("#pub").disabled=!!BUSY||(!dirty&&!unpub);
}
function setBusy(t){BUSY=t;updateStatus();}

/* ===== プレビュー ===== */
function previewOptions(){
  return [["home","ホーム"],["profile","プロフィール"],...W.works.works.map((w,i)=>["work:"+i,"作品："+(w.title||"（無題）")])];
}
function routePage(){
  const r=route();
  if(r.name==="work")return "work:"+r.i;
  if(r.name==="profile")return "profile";
  if(r.name==="typo"&&openTypo){
    const p=TYPO_AREAS[openTypo].page;
    if(p==="work")return pvPage&&pvPage.startsWith("work:")?pvPage:"work:0";
    return p;
  }
  return pvPage||"home";
}
/* t= は管理画面を開くたびに変わる値。ページ本体の古いキャッシュ（Pages は最大10分）を使わせない */
const PV_T=Date.now().toString(36);
function pageURL(p){
  if(p==="profile")return `../profile.html?preview=1&t=${PV_T}`;
  if(p&&p.startsWith("work:")){const w=W.works.works[+p.slice(5)];if(w)return `../work.html?id=${encodeURIComponent(w.slug)}&preview=1&t=${PV_T}`;}
  return `../${HOME}?preview=1&t=${PV_T}`;
}
function setPreview(){
  const sel=$("#pvPage");if(!sel)return;
  sel.innerHTML=previewOptions().map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join("");
  if(!previewOptions().some(o=>o[0]===pvPage))pvPage="home";
  sel.value=pvPage;
  const url=pageURL(pvPage);
  if(url!==pvSrc){pvSrc=url;$("#pvFrame").src=url;}
  fitPreview();
}
const syncPreviewPage=debounce(()=>setPreview(),500);
function fitPreview(){
  const st=$("#pvStage"),f=$("#pvFrame");if(!st||!f)return;
  $$("#pvMode button").forEach(b=>b.classList.toggle("on",b.dataset.m===pvMode));
  const W0=st.clientWidth,H0=st.clientHeight;if(!W0||!H0)return;
  if(pvMode==="pc"){
    const fw=1280,s=Math.min(1,W0/fw);
    f.style.width=fw+"px";f.style.height=(H0/s)+"px";f.style.top="0";f.style.transform=`translateX(-50%) scale(${s})`;
  }else{
    const fw=390,fh=844,s=Math.min(1,(H0-24)/fh,(W0-24)/fw);
    f.style.width=fw+"px";f.style.height=fh+"px";f.style.top="12px";f.style.transform=`translateX(-50%) scale(${s})`;
  }
}

/* ===== ルーティング ===== */
function route(){
  const h=location.hash.slice(1)||"works";
  const m=h.match(/^work\/(\d+)$/);
  if(m)return {name:"work",i:+m[1]};
  return {name:["works","profile","site","typo"].includes(h)?h:"works"};
}
function renderEditor(){
  const r=route(), ed=$("#editor");
  $$("[data-nav]").forEach(a=>a.classList.toggle("on",a.dataset.nav===(r.name==="work"?"works":r.name)));
  if(r.name==="work"&&!W.works.works[r.i]){location.hash="#works";return;}
  ed.innerHTML=r.name==="works"?viewWorks():r.name==="work"?viewWork(r.i):r.name==="profile"?viewProfile():r.name==="site"?viewSite():viewTypo();
  bindEditor(ed);
  if(r.name!=="typo"||openTypo)pvPage=routePage();
  setPreview();
  if(innerWidth>900)ed.scrollTop=0;else scrollTo(0,0);
}

/* ===== 部品 ===== */
const val=k=>{const v=getPath(W,k);return v==null?"":v;};
const hintL=(l,h)=>`<label>${l}${h?`<span class="hint">${h}</span>`:""}</label>`;
const txt=(k,l,o={})=>`<div class="field">${hintL(l,o.hint)}<input class="in" data-k="${k}" value="${esc(val(k))}"${o.ph?` placeholder="${esc(o.ph)}"`:""}${o.type?` type="${o.type}"`:""}${o.inputmode?` inputmode="${o.inputmode}"`:""}></div>`;
const area=(k,l,o={})=>`<div class="field">${hintL(l,o.hint)}<textarea class="in" data-k="${k}" rows="${o.rows||5}"${o.ph?` placeholder="${esc(o.ph)}"`:""}>${esc(val(k))}</textarea></div>`;
const tog=(k,l)=>`<div class="field"><label class="toggle"><input type="checkbox" data-k="${k}" data-type="bool"${val(k)?" checked":""}> ${l}</label></div>`;
const single=(k,l,dir,o={})=>{
  const p=val(k);
  return `<div class="field">${hintL(l,o.hint)}<div class="single${o.portrait?" portrait":""}">
    <div class="ph" style="${p?`background-image:url('${esc(imgSrc(p))}')`:""}"></div>
    <div style="display:grid;gap:8px;justify-items:start">
      <button class="btn small" data-upload="${k}" data-dir="${dir}">${p?"画像を差し替え":"画像を選ぶ"}</button>
      ${p?`<button class="btn small ghost" data-clear="${k}">外す</button>`:""}
    </div></div></div>`;
};
/* 作品の画像：1枚ごとの大きさ（12分割グリッド）＋ 間隔・切り抜き比率。一覧はサイトと同じ並び方で見せる */
const G_SIZES=[["full","フル",12],["2/3","2/3",8],["1/2","1/2",6],["1/3","1/3",4],["1/4","1/4",3]];
const G_RATIOS=[["original","元の比率"],["16:9","16:9"],["3:2","3:2"],["4:3","4:3"],["1:1","1:1"],["4:5","4:5"]];
const gallery=(k,gk,dir)=>{
  const list=val(k)||[], g=val(gk)||{}, ratio=g.ratio||"original", gap=g.gap??12;
  const span=sz=>(G_SIZES.find(x=>x[0]===sz)||G_SIZES[0])[2];
  return `<div class="group"><div class="gt"><span>画像（動画の下に並ぶ）</span><span class="hint">ドラッグで並べ替え・下のボタンで大きさ</span></div>
    <div class="row2">
      <label class="ctl"><span class="ic" data-scrub>間隔</span><input type="number" data-k="${gk}.gap" data-type="num" value="${gap}" step="1" min="0" inputmode="numeric"><span class="u">px</span></label>
      <label class="ctl"><span class="ic">切り抜き</span><select data-k="${gk}.ratio">${G_RATIOS.map(([v,l])=>`<option value="${v}"${ratio===v?" selected":""}>${l}</option>`).join("")}</select><span class="u"></span></label>
    </div>
    ${list.length?`<div class="gal" data-list="${k}" data-axis="grid" style="--gap:${Math.min(gap,12)/2}px">${list.map((x,j)=>`<div class="it" data-j="${j}" style="grid-column:span ${span(x.size)}">
      <img src="${esc(imgSrc(x.src))}" alt=""${ratio!=="original"?` style="aspect-ratio:${ratio.replace(":"," / ")};object-fit:cover"`:""}>
      <button class="x" data-del="${k}" data-j="${j}" aria-label="削除">✕</button>
      <div class="sz">${G_SIZES.map(([v,l])=>`<button data-size-set="${k}.${j}.size" data-v="${v}" class="${(x.size||"full")===v?"on":""}">${l}</button>`).join("")}</div>
    </div>`).join("")}</div>`:""}
    <div class="drop" data-upload="${k}" data-dir="${dir}" data-multi style="margin-top:10px">＋ 画像を追加（クリック・ドラッグ＆ドロップ／複数OK）<br><small>JPEG・PNG・TIFF・HEIC・WebP・GIF など</small></div></div>`;
};
/* 繰り返し行。fields: [[key|null(=文字列そのもの), placeholder, "textarea"?]] */
const rows=(k,l,fields,tpl,o={})=>{
  const list=val(k)||[];
  return `<div class="group"><div class="gt"><span>${l}</span>${o.hint?`<span class="hint">${o.hint}</span>`:""}</div>
    <div class="rows" data-list="${k}" data-axis="y">${list.map((it,j)=>`<div class="rowi" data-j="${j}">
      <div class="handle" aria-label="並べ替え">⋮⋮</div>
      <div class="body${o.two?" two":""}">${fields.map(([f,ph,kind])=>{
        const path=f?`${k}.${j}.${f}`:`${k}.${j}`, v=f?it[f]:it;
        if(kind==="lines")return `<textarea class="in" data-k="${path}" data-type="lines" placeholder="${esc(ph)}" rows="${Math.max(2,(v||[]).length)}">${esc((v||[]).join("\n"))}</textarea>`;
        return `<input class="in" data-k="${path}" value="${esc(v==null?"":v)}" placeholder="${esc(ph)}">`;
      }).join("")}</div>
      <button class="del" data-del="${k}" data-j="${j}" aria-label="削除">✕</button>
    </div>`).join("")}</div>
    <button class="btn small ghost add" data-add="${k}" data-tpl='${esc(JSON.stringify(tpl))}'>＋ 追加</button></div>`;
};

/* ===== 各画面 ===== */
function viewWorks(){
  const ws=W.works.works;
  return `<h1 class="h">作品</h1><p class="sub">上から順にホームに並びます。左の ⋮⋮ をドラッグで並べ替え。タップで編集。</p>
  <div class="cards" data-list="works.works" data-axis="y">${ws.map((w,i)=>`<div class="card" data-j="${i}" data-open="${i}">
    <div class="handle" aria-label="並べ替え">⋮⋮</div>
    ${w.thumb?`<img src="${esc(imgSrc(w.thumb))}" alt="" loading="lazy">`:`<div class="noimg"></div>`}
    <div style="min-width:0"><div class="t">${esc(w.title||"（無題）")}</div><div class="m">${esc([w.year,w.category].filter(Boolean).join(" · "))}</div></div>
    <div class="aw">${w.award?"🏆":""}</div></div>`).join("")}</div>
  <button class="btn add" id="addWork" style="margin-top:14px">＋ 作品を追加</button>`;
}
function viewWork(i){
  const k=`works.works.${i}`, w=W.works.works[i], vid=ytId(w.video||"");
  const dup=W.works.works.some((x,j)=>j!==i&&x.slug===w.slug);
  return `<a class="back" href="#works">← 作品一覧</a>
  <h1 class="h">${esc(w.title||"（無題）")}</h1><p class="sub">入力するとそのままプレビューに映ります。</p>
  ${txt(k+".title","タイトル")}
  ${txt(k+".slug","URL名",{hint:dup?"⚠ 他の作品と重複しています":"半角英数字とハイフン（work.html?id=○○）",ph:"kaimami"})}
  <div class="row2">${txt(k+".category","ジャンル",{ph:"Projection Mapping"})}${txt(k+".year","制作年",{ph:"2025",inputmode:"numeric"})}</div>
  ${txt(k+".award","受賞歴",{hint:"入れると🏆が付き、作品ページで飛びまわる"})}
  ${area(k+".about_ja","About（日本語）",{rows:6})}
  ${area(k+".about_en","About（英語）",{rows:6})}
  ${single(k+".thumb","サムネ画像","works",{hint:"ホーム・動画の表紙"})}
  <div class="field">${hintL("動画（YouTube URL）","About の下に表示")}<input class="in" data-k="${k}.video" value="${esc(val(k+".video"))}" placeholder="https://youtu.be/…" inputmode="url">
    ${vid?`<div class="yt"><img src="https://i.ytimg.com/vi/${encodeURIComponent(vid)}/hqdefault.jpg" alt=""><span>ID: ${esc(vid)}</span></div>`:""}</div>
  ${gallery(k+".images",k+".gallery","works")}
  ${rows(k+".credits","クレジット",[["role","役職（例：Direction）"],["names","名前（1行に1人）","lines"]],{role:"",names:[]},{hint:"⋮⋮ で並べ替え"})}
  <div class="group"><button class="btn danger small" id="delWork">この作品を削除</button></div>`;
}
function viewProfile(){
  const k="profile";
  return `<h1 class="h">プロフィール</h1><p class="sub">About だけ日本語・英語の両方。他は英語。</p>
  ${txt(k+".label","ホーム右上のリンク文言",{ph:"My Profile"})}
  <div class="row2">${txt(k+".name","氏名")}${txt(k+".role","肩書き")}</div>
  ${single(k+".photo","写真","profile",{portrait:true})}
  ${area(k+".about_ja","About（日本語）")}
  ${area(k+".about_en","About（英語）")}
  ${rows(k+".career","Career",[["date","2023.4"],["text","内容"]],{date:"",text:""},{two:true})}
  ${rows(k+".awards","Awards & Screenings",[["date","2025.11"],["text","内容"]],{date:"",text:""},{two:true})}
  ${rows(k+".skills","Skills",[[null,"例：DaVinci Resolve / Blender"]],"")}
  <div class="group"><div class="gt">Contact</div>
  ${txt(k+".mail","メール",{type:"email"})}${txt(k+".instagram","Instagram URL",{inputmode:"url"})}${txt(k+".youtube","YouTube URL",{inputmode:"url"})}</div>`;
}
function viewSite(){
  const k="site";
  return `<h1 class="h">サイト設定</h1><p class="sub">ホーム全体の設定。</p>
  ${txt(k+".title","サイト名")}
  ${txt(k+".message","ホーム最下部のメッセージ")}
  ${tog(k+".message_sparkle","メッセージのキラキラ演出")}
  ${txt(k+".trophy_speed","トロフィーの速さ（1=標準・大きいほど速い）",{type:"number",inputmode:"decimal"})}`;
}
/* 文字組み：イラレ/インデザインと同じ単位・操作（アイコンを左右ドラッグ／↑↓キー、Shiftで10倍）*/
const TI={
  size:'<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1 3h8v1.6H5.8V13H4.2V4.6H1zM9 7h6v1.3h-2.3V13h-1.4V8.3H9z"/></svg>',
  leading:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 3h12M2 13h12"/><path d="M5 11l3-7 3 7M6.2 8.5h3.6"/></svg>',
  tracking:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 3l2.5 7L7 3M9 10l2.5-7L14 10M2 13.5h12M4 12l-2 1.5L4 15M12 12l2 1.5-2 1.5"/></svg>',
  kerning:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1.5 3l2.5 7 2.5-7M7.5 10L10 3l2.5 7M7 13.5h4"/></svg>',
};
function viewTypo(){
  return `<h1 class="h">文字組み</h1>
  <p class="note">イラレ・インデザインと同じ単位です。サイズ＝px、行送り＝％（160＝1.6倍）、トラッキング＝1/1000em。<br>
  数値の左のアイコンを<b>左右にドラッグ</b>すると増減、入力欄で <b>↑↓キー</b>（Shift で10倍）。</p>
  ${Object.keys(TYPO_AREAS).map(key=>{
    const a=TYPO_AREAS[key], t=typoValue(W.site,key), k=`site.typography.${key}`, on=openTypo===key;
    return `<div class="typo${on?" on":""}" data-typo="${key}">
      <div class="th" data-typo-open="${key}"><span>${a.label}</span><span class="v">${t.size}px / ${t.leading}% / ${t.tracking}${t.palt?" / palt":""}</span></div>
      ${on?`<div class="tb">
        ${ctl(k+".size","size","サイズ",t.size,"px",0.5,6)}
        ${ctl(k+".leading","leading","行送り",t.leading,"%",5,50)}
        ${ctl(k+".tracking","tracking","トラッキング",t.tracking,"",10,-500)}
        <label class="ctl"><span class="ic">${TI.kerning}カーニング</span><select data-k="${k}.kerning">
          <option value="metrics"${t.kerning!=="none"?" selected":""}>メトリクス</option><option value="none"${t.kerning==="none"?" selected":""}>0</option></select><span class="u"></span></label>
        <label class="ctl"><span class="ic">ウェイト</span><select data-k="${k}.weight" data-type="num">
          ${[[300,"Light"],[400,"Regular"],[500,"Medium"],[700,"Bold"]].map(([v,l])=>`<option value="${v}"${+t.weight===v?" selected":""}>${l}</option>`).join("")}</select><span class="u"></span></label>
        <label class="toggle" style="align-self:center"><input type="checkbox" data-k="${k}.palt" data-type="bool"${t.palt?" checked":""}> プロポーショナル</label>
        <button class="btn small ghost reset" data-typo-reset="${key}">初期値に戻す</button>
      </div>`:""}</div>`;
  }).join("")}`;
}
const ctl=(k,ic,l,v,u,step,min)=>`<label class="ctl" title="${l}"><span class="ic" data-scrub>${TI[ic]}${l}</span>
  <input type="number" data-k="${k}" data-type="num" value="${v}" step="${step}" min="${min}" inputmode="decimal"><span class="u">${u}</span></label>`;

/* ===== 入力の反映 ===== */
function bindEditor(ed){
  ed.oninput=e=>{
    const el=e.target, k=el.dataset&&el.dataset.k;if(!k)return;
    let v=el.value;
    if(el.dataset.type==="bool")v=el.checked;
    else if(el.dataset.type==="num"){if(v==="")return;v=+v;if(isNaN(v))return;}
    else if(el.dataset.type==="lines")v=v.split("\n").map(s=>s.trim()).filter(Boolean);
    if(k.startsWith("site.typography.")){                           /* 初めて触るエリアは既定値から作る */
      const key=k.split(".")[2];
      if(!W.site.typography[key])W.site.typography[key]=clone(TYPO_AREAS[key].d);
    }
    setPath(W,k,v);
    if(/\.gallery\.ratio$/.test(k)){changed();rerender();return;}   /* 管理画面の一覧も切り抜きを反映 */
    if(/\.title$/.test(k)&&route().name==="work")$(".editor h1.h").textContent=v||"（無題）";
    if(k.startsWith("site.typography.")){const th=el.closest(".typo").querySelector(".th .v"),t=typoValue(W.site,k.split(".")[2]);
      th.textContent=`${t.size}px / ${t.leading}% / ${t.tracking}${t.palt?" / palt":""}`;}
    changed();
  };
  ed.onclick=async e=>{
    const t=e.target.closest("button,[data-open],[data-typo-open],.drop");if(!t)return;
    if(t.dataset.open!=null&&!e.target.closest(".handle")){location.hash="#work/"+t.dataset.open;return;}
    if(t.id==="addWork"){
      W.works.works.push({title:"",slug:"work-"+Date.now().toString(36),category:"",year:String(new Date().getFullYear()),award:"",about_ja:"",about_en:"",thumb:"",images:[],video:"",credits:[]});
      changed();location.hash="#work/"+(W.works.works.length-1);return;
    }
    if(t.id==="delWork"){
      const i=route().i,w=W.works.works[i];
      if(await ask("作品を削除",`「${esc(w.title||"（無題）")}」を削除します。公開するまでサイトからは消えません。`,[["no","やめる"],["yes","削除する",true]])!=="yes")return;
      W.works.works.splice(i,1);changed();location.hash="#works";return;
    }
    if(t.dataset.add){const list=getPath(W,t.dataset.add)||[];list.push(JSON.parse(t.dataset.tpl));setPath(W,t.dataset.add,list);changed();rerender(t.dataset.add);return;}
    if(t.dataset.sizeSet){setPath(W,t.dataset.sizeSet,t.dataset.v);changed();rerender();return;}
    if(t.dataset.del){getPath(W,t.dataset.del).splice(+t.dataset.j,1);changed();rerender(t.dataset.del);return;}
    if(t.dataset.clear){setPath(W,t.dataset.clear,"");changed();renderEditor();return;}
    if(t.dataset.upload!=null){pickFiles(t);return;}
    if(t.dataset.typoOpen){openTypo=openTypo===t.dataset.typoOpen?null:t.dataset.typoOpen;renderEditor();return;}
    if(t.dataset.typoReset){delete W.site.typography[t.dataset.typoReset];changed();renderEditor();return;}
  };
  /* ドラッグ＆ドロップで画像追加 */
  $$(".drop",ed).forEach(d=>{
    d.ondragover=e=>{e.preventDefault();d.classList.add("over");};
    d.ondragleave=()=>d.classList.remove("over");
    d.ondrop=e=>{e.preventDefault();d.classList.remove("over");upload([...e.dataTransfer.files],d);};
  });
  /* 並べ替え */
  $$("[data-list]",ed).forEach(c=>sortable(c,c.dataset.axis,(from,to)=>{
    const list=getPath(W,c.dataset.list);list.splice(to,0,list.splice(from,1)[0]);changed();rerender(c.dataset.list);
  }));
  /* 文字組みの数値：アイコンを左右ドラッグ／↑↓キー（Shift で10倍）*/
  $$(".ctl input",ed).forEach(inp=>{
    const step=+inp.step||1,min=+inp.min;
    const set=v=>{v=Math.max(min,Math.round(v/step)*step);inp.value=+v.toFixed(2);inp.dispatchEvent(new Event("input",{bubbles:true}));};
    inp.onkeydown=e=>{if(e.key!=="ArrowUp"&&e.key!=="ArrowDown")return;e.preventDefault();
      set(+inp.value+(e.key==="ArrowUp"?1:-1)*step*(e.shiftKey?10:1));};
    const ic=inp.parentElement.querySelector("[data-scrub]");
    ic.onpointerdown=e=>{
      e.preventDefault();ic.setPointerCapture(e.pointerId);
      const x0=e.clientX,v0=+inp.value;
      ic.onpointermove=ev=>set(v0+Math.round((ev.clientX-x0)/4)*step*(ev.shiftKey?10:1));
      ic.onpointerup=ic.onpointercancel=()=>{ic.onpointermove=null;};
    };
  });
}
/* 行を足し引きしたら、その画面を描き直す（入力中の欄以外）*/
function rerender(){const y=innerWidth>900?$("#editor").scrollTop:scrollY;renderEditor();if(innerWidth>900)$("#editor").scrollTop=y;else scrollTo(0,y);}

/* 並べ替え（マウス・指どちらも）。axis: "y"=縦一列 / "grid"=格子 */
function sortable(box,axis,onMove){
  /* ポインターキャプチャは使わない（入れ替えで要素を動かすとキャプチャが外れ、指を離しても確定しないため）。
     動き・離すは window で受ける */
  box.onpointerdown=e=>{
    if(e.button>0)return;
    const handle=axis==="grid"?e.target.closest(".it"):e.target.closest(".handle");
    if(!handle||e.target.closest("button")||!box.contains(handle))return;
    const item=handle.closest("[data-j]");if(!item||item.parentElement!==box)return;
    e.preventDefault();
    const from=[...box.children].indexOf(item);let moved=false,lastY=e.clientY,raf=0;
    item.classList.add("dragging");document.body.style.userSelect="none";
    const scroller=innerWidth>900?$("#editor"):null;
    /* 画面の上下端に近づいたら自動でスクロール（長い一覧でも端まで運べる）*/
    const edgeScroll=()=>{
      const top=scroller?scroller.getBoundingClientRect().top:0, bottom=scroller?scroller.getBoundingClientRect().bottom:innerHeight;
      const d=lastY<top+60?-12:lastY>bottom-90?12:0;
      if(d){scroller?scroller.scrollBy(0,d):scrollBy(0,d);place(lastX,lastY);}
      raf=requestAnimationFrame(edgeScroll);
    };
    let lastX=e.clientX;
    const place=(x,y)=>{
      const over=document.elementFromPoint(x,y);
      const o=over&&over.closest("[data-j]");
      if(!o||o===item||o.parentElement!==box)return;
      const r=o.getBoundingClientRect();
      const after=axis==="grid"&&y>r.top&&y<r.bottom?x>r.left+r.width/2:y>r.top+r.height/2;
      const ref=after?o.nextSibling:o;
      if(ref!==item&&item.nextSibling!==ref){box.insertBefore(item,ref);moved=true;}
    };
    const move=ev=>{lastX=ev.clientX;lastY=ev.clientY;place(lastX,lastY);};
    const end=()=>{
      removeEventListener("pointermove",move);removeEventListener("pointerup",end);removeEventListener("pointercancel",end);
      cancelAnimationFrame(raf);item.classList.remove("dragging");document.body.style.userSelect="";
      const to=[...box.children].indexOf(item);
      if(moved&&to!==from)onMove(from,to);
      /* ドラッグ直後のクリック（作品を開く）を1回だけ無視 */
      if(moved)addEventListener("click",ev=>{ev.stopPropagation();ev.preventDefault();},{capture:true,once:true});
    };
    addEventListener("pointermove",move);addEventListener("pointerup",end);addEventListener("pointercancel",end);
    raf=requestAnimationFrame(edgeScroll);
  };
}

/* ===== 画像 ===== */
/* 対応形式：JPEG / PNG / GIF / WebP / AVIF / BMP / SVG / TIFF / HEIC・HEIF（iPhone）。
   ブラウザが読めない TIFF・HEIC は、admin/vendor/ の変換ライブラリを必要なときだけ読み込む */
const IMG_ACCEPT="image/*,.tif,.tiff,.heic,.heif,.avif,.webp,.bmp,.svg";
const IMG_EXT=/\.(jpe?g|png|gif|webp|avif|bmp|svg|tiff?|heic|heif)$/i;
function pickFiles(t){
  const inp=document.createElement("input");inp.type="file";inp.accept=IMG_ACCEPT;inp.multiple=t.dataset.multi!=null;
  inp.onchange=()=>upload([...inp.files],t);inp.click();
}
const VENDOR=new URL("vendor/",document.currentScript.src).href;   /* admin.js と同じ場所の vendor/ */
const _libs={};
function loadLib(src){
  return _libs[src]=_libs[src]||new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=()=>{delete _libs[src];rej(new Error("変換ライブラリを読み込めませんでした"));};document.head.appendChild(s);});
}
async function sniff(file){
  const b=new Uint8Array(await file.slice(0,12).arrayBuffer());
  if((b[0]===0x49&&b[1]===0x49&&b[2]===0x2a)||(b[0]===0x4d&&b[1]===0x4d&&b[3]===0x2a))return "tiff";
  if(String.fromCharCode(...b.slice(4,12)).match(/^ftyp(heic|heix|hevc|heim|heis|mif1|msf1)/))return "heic";
  return "";
}
/* ブラウザ標準で読む（Safari は TIFF・HEIC もここで読める）*/
function nativeDecode(blob){
  return new Promise((res,rej)=>{const u=URL.createObjectURL(blob),i=new Image();
    i.onload=()=>res({src:i,w:i.naturalWidth||1600,h:i.naturalHeight||900,done:()=>URL.revokeObjectURL(u)});
    i.onerror=()=>{URL.revokeObjectURL(u);rej(new Error("decode"));};i.src=u;});
}
async function decodeTiff(file){
  await loadLib(VENDOR+"pako_inflate-1.0.11.min.js");             /* 圧縮TIFF用。UTIF より先に */
  await loadLib(VENDOR+"utif-3.1.0.js");
  const buf=await file.arrayBuffer(), ifds=UTIF.decode(buf);
  const page=ifds.reduce((a,b)=>(b.width*b.height>a.width*a.height?b:a),ifds[0]);   /* サムネ用の小さいページではなく一番大きい画像 */
  UTIF.decodeImage(buf,page,ifds);
  const w=page.width,h=page.height,rgba=UTIF.toRGBA8(page);
  /* 大きすぎる画像は canvas に載らない端末があるので、先に間引いてから載せる */
  const k=Math.min(1,Math.sqrt(16e6/(w*h))), cw=Math.max(1,Math.round(w*k)), ch=Math.max(1,Math.round(h*k));
  const c=document.createElement("canvas");c.width=cw;c.height=ch;
  const out=c.getContext("2d").createImageData(cw,ch);
  if(k===1)out.data.set(rgba);
  else for(let y=0;y<ch;y++){const sy=Math.floor(y/k)*w;for(let x=0;x<cw;x++){const si=(sy+Math.floor(x/k))*4,di=(y*cw+x)*4;
    out.data[di]=rgba[si];out.data[di+1]=rgba[si+1];out.data[di+2]=rgba[si+2];out.data[di+3]=rgba[si+3];}}
  c.getContext("2d").putImageData(out,0,0);
  return {src:c,w:cw,h:ch,done:()=>{}};
}
async function decodeHeic(file){
  await loadLib(VENDOR+"heic2any-0.0.4.min.js");
  const r=await heic2any({blob:file,toType:"image/jpeg",quality:.92});
  return nativeDecode(Array.isArray(r)?r[0]:r);
}
async function decodeAny(file){
  const kind=await sniff(file)||(/\.tiff?$/i.test(file.name)?"tiff":/\.hei[cf]$/i.test(file.name)?"heic":"");
  try{return await nativeDecode(file);}
  catch(e){
    if(kind==="tiff")return decodeTiff(file);
    if(kind==="heic")return decodeHeic(file);
    throw new Error(`「${file.name}」はこのブラウザで読めない形式です`);
  }
}
/* 長辺 max px の JPEG に（透過は黒で埋める＝サイトの黒地になじむ）*/
async function shrink(file,max=2000){
  const d=await decodeAny(file);
  try{
    const k=Math.min(1,max/Math.max(d.w,d.h));
    const c=document.createElement("canvas");c.width=Math.round(d.w*k);c.height=Math.round(d.h*k);
    const x=c.getContext("2d");x.fillStyle="#000";x.fillRect(0,0,c.width,c.height);
    x.imageSmoothingQuality="high";x.drawImage(d.src,0,0,c.width,c.height);
    const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",.85));
    if(!blob)throw new Error(`「${file.name}」を変換できませんでした`);
    return blob;
  }finally{d.done();}
}
const toB64=b=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(",")[1]);f.readAsDataURL(b);});
async function upload(files,t){
  files=files.filter(f=>f.type.startsWith("image/")||IMG_EXT.test(f.name));
  if(!files.length){toast("画像ファイルを選んでください（JPEG・PNG・TIFF・HEIC など）",true);return;}
  const k=t.dataset.upload, dir=t.dataset.dir, multi=t.dataset.multi!=null;
  const w=route().name==="work"?W.works.works[route().i]:null;
  const base=((w&&w.slug)||dir).replace(/[^a-z0-9-]/gi,"").toLowerCase()||"img";
  setBusy(`画像をアップロード中…（${files.length}枚）`);
  try{
    const out=[],commitFiles=[];
    for(const [n,f] of (multi?files:files.slice(0,1)).entries()){
      setBusy(`画像を変換中…（${n+1}/${multi?files.length:1}）`);
      const blob=await shrink(f);
      const path=`media/${dir}/${base}-${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}.jpg`;
      commitFiles.push({path,content:await toB64(blob),base64:true});
      BLOBS["/"+path]=URL.createObjectURL(blob);out.push("/"+path);
    }
    setBusy(`画像をアップロード中…（${commitFiles.length}枚）`);
    await commit(GH.live,commitFiles,`Upload ${commitFiles.length} image(s) from admin`);
    if(multi)setPath(W,k,[...(getPath(W,k)||[]),...out.map(src=>({src,size:"full"}))]);else setPath(W,k,out[0]);
    setBusy("");changed();rerender();toast("画像を追加しました");
  }catch(e){setBusy("");toast(e.status?"アップロードできませんでした："+errText(e):e.message,true);}
}

/* ===== 下書き保存・公開 ===== */
async function saveDraft(){
  const files=NAMES.filter(n=>!same(W[n],DRAFT[n])).map(n=>jsonFile(n,W[n]));
  if(!files.length)return;
  setBusy("確認用に反映中…");
  try{
    await commit(GH.draft,files,"Update staging from admin");
    DRAFT=clone(W);saveLocal();setBusy("");toast("確認用に反映しました。「確認用を見る」で確認できます（本公開サイトにはまだ出ません）");
  }catch(e){setBusy("");toast(errText(e),true);}
}
const F_LABEL={title:"タイトル",slug:"URL名",category:"ジャンル",year:"制作年",award:"受賞歴",about_ja:"About（日）",about_en:"About（英）",thumb:"サムネ",images:"画像",gallery:"画像の間隔・切り抜き",video:"動画",credits:"クレジット",
  label:"右上の文言",name:"氏名",role:"肩書き",photo:"写真",career:"Career",awards:"Awards",skills:"Skills",mail:"メール",instagram:"Instagram",youtube:"YouTube",
  message:"メッセージ",message_sparkle:"キラキラ演出",trophy_speed:"トロフィーの速さ"};
function diffList(a,b){
  const out=[], aw=a.works.works, bw=b.works.works;
  const am=new Map(aw.map(w=>[w.slug,w])), bm=new Map(bw.map(w=>[w.slug,w]));
  for(const w of bw){
    const o=am.get(w.slug);
    if(!o)out.push(["add","作品を追加："+(w.title||w.slug)]);
    else if(!same(o,w)){
      const ks=Object.keys({...o,...w}).filter(k=>!same(o[k],w[k])).map(k=>F_LABEL[k]||k);
      out.push(["","作品「"+(w.title||w.slug)+"」："+ks.join("・")]);
    }
  }
  for(const w of aw)if(!bm.has(w.slug))out.push(["rm","作品を削除："+(w.title||w.slug)]);
  const ao=aw.map(w=>w.slug).filter(s=>bm.has(s)), bo=bw.map(w=>w.slug).filter(s=>am.has(s));
  if(!same(ao,bo))out.push(["","作品の並び順"]);
  const pk=Object.keys({...a.profile,...b.profile}).filter(k=>!same(a.profile[k],b.profile[k]));
  if(pk.length)out.push(["","プロフィール："+pk.map(k=>F_LABEL[k]||k).join("・")]);
  const sk=Object.keys({...a.site,...b.site}).filter(k=>k!=="typography"&&!same(a.site[k],b.site[k]));
  if(sk.length)out.push(["","サイト設定："+sk.map(k=>F_LABEL[k]||k).join("・")]);
  const tk=Object.keys(TYPO_AREAS).filter(k=>!same(typoValue(a.site,k),typoValue(b.site,k)));
  if(tk.length)out.push(["","文字組み："+tk.map(k=>TYPO_AREAS[k].label).join("・")]);
  return out;
}
async function publish(){
  const d=diffList(LIVE,W);
  if(!d.length){toast("本公開と同じです");return;}
  const go=await ask("本公開しますか？",
    `<p class="note" style="margin-bottom:12px">以下の変更が sanoryota.com に反映されます（1〜2分）。${!same(W,DRAFT)?"<br>確認用にまだ反映していない編集も含まれます。":""}</p><ul class="diff">${d.map(([c,t])=>`<li class="${c}">${esc(t)}</li>`).join("")}</ul>`,
    [["no","やめる"],["stage","先に確認用で見る"],["yes","本公開する",true]]);
  if(go==="stage"){if(!same(W,DRAFT))await saveDraft();window.open("../stage/","_blank");return;}
  if(go!=="yes")return;
  setBusy("本公開中…");
  try{
    const files=NAMES.filter(n=>!same(W[n],LIVE[n])).map(n=>jsonFile(n,W[n]));
    if(!same(W,DRAFT))await commit(GH.draft,NAMES.filter(n=>!same(W[n],DRAFT[n])).map(n=>jsonFile(n,W[n])),"Update staging from admin");
    await commit(GH.live,files,"Publish from admin");
    LIVE=clone(W);DRAFT=clone(W);saveLocal();setBusy("");
    toast("本公開しました。1〜2分で sanoryota.com に反映されます");
  }catch(e){setBusy("");toast(errText(e),true);}
}

/* ===== モーダル・通知 ===== */
function ask(title,html,buttons){
  return new Promise(res=>{
    const m=document.createElement("div");m.className="modal";
    m.innerHTML=`<div class="box" role="dialog" aria-modal="true"><h2>${esc(title)}</h2><div>${html}</div>
      <div class="acts">${buttons.map(([v,l,p])=>`<button class="btn${p?" primary":""}" data-v="${v}">${l}</button>`).join("")}</div></div>`;
    m.onclick=e=>{const b=e.target.closest("[data-v]");if(b||e.target===m){m.remove();res(b?b.dataset.v:null);}};
    document.body.appendChild(m);
    const p=m.querySelector(".btn.primary");if(p)p.focus();
  });
}
function toast(t,err){
  const el=document.createElement("div");el.className="toast"+(err?" err":"");el.textContent=t;
  document.body.appendChild(el);setTimeout(()=>el.remove(),err?6000:3000);
}
