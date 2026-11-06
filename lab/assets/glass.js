/* ===== lab：すりガラス =====
   作品のサムネ・制作年・カテゴリを、すりガラスの裏の3D空間に置く。中央の開口部からだけくっきり見える。
   - 単位は px。ガラスの表面（z=0）が画面と 1px=1px で重なるようにカメラを置く
   - 要素ごとにガラスからの距離 d（作品の slug から決まるシード値。リロードしても同じ）
   - ぼけ：各ピクセルで「カメラ→その点」の視線がガラスの開口部（表と裏の両方）を通るか判定。
     通ればくっきり、ガラスを通れば d に比例した半径でぼかし、遠いほどガラスの色に霞ませる
   - 影：光の向きに沿ってガラス面まで戻り、開口部を通る光だけが当たる（半影は d に比例）
   - 開口部の大きさは CSS 変数 --aperture-w / --aperture-h（index.html）*/
import * as THREE from "../vendor/three-0.170.0.module.min.js";

const CFG={
  fov:32,               /* カメラの画角（小さいほど奥行きが穏やか）*/
  thick:18,             /* ガラスの厚み(px) */
  bevel:2.5,            /* 開口部のフチの面取り(px) */
  minDepth:10,maxDepth:560,   /* ガラスから要素までの距離の範囲(px) */
  wallGap:160,          /* いちばん奥の要素から壁まで(px) */
  blurK:0.085,          /* ぼけ半径(px) = blurK × 距離 */
  haze:0.7,             /* ガラス越しに遠いものほど白く霞む強さ */
  shadow:0.8,           /* 要素に落ちるガラスの影の明るさ（1=影なし）*/
  wallShadow:0.9,       /* 奥の壁に落ちる影の明るさ */
  light:[-0.42,0.58,1], /* 光の向き（左上手前から）*/
  glassColor:0xeef0f0, glassOpacity:0.34,
  parallax:22,          /* マウスでカメラが動く量(px) */
  scrollEase:10,        /* スクロールの追従（大きいほど速い）*/
};
const COARSE=matchMedia("(pointer:coarse)").matches;

/* ===== WebGL2 が無ければ通常のホームへ ===== */
const canvas=document.getElementById("glass");
const gl2=canvas.getContext("webgl2",{antialias:true,alpha:false});
if(!gl2){location.replace("home.html");throw new Error("no webgl2");}

/* ===== シード値（作品 slug＋要素の種類 → いつも同じ乱数）===== */
function hash(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function rng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/* ===== three ===== */
THREE.ColorManagement.enabled=false;
const renderer=new THREE.WebGLRenderer({canvas,context:gl2,antialias:true});
renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
renderer.setClearColor(0xffffff,1);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(CFG.fov,1,1,10000);
scene.add(new THREE.AmbientLight(0xffffff,1.05));
const sun=new THREE.DirectionalLight(0xffffff,1.1);sun.position.set(...CFG.light).multiplyScalar(1000);scene.add(sun);

let Q={dpr:Math.min(devicePixelRatio||1,COARSE?1.5:2),taps:COARSE?8:16};
const S={vw:0,vh:0,camZ:1,ap:{w:0,h:0},scroll:0,scrollNow:0,ptr:new THREE.Vector2(9,9),cam:new THREE.Vector2(),camT:new THREE.Vector2(),
  hover:-1,focus:-1,docH:0};
const U={  /* 全要素で共有する uniform */
  uHole:{value:new THREE.Vector2()},uThick:{value:CFG.thick},uK:{value:CFG.blurK},uShadow:{value:CFG.shadow},
  uHaze:{value:CFG.haze},uMaxD:{value:CFG.maxDepth},uLight:{value:new THREE.Vector3(...CFG.light).normalize()},
  uGlass:{value:new THREE.Color(CFG.glassColor)},
};

const VERT=`varying vec2 vUv;varying vec3 vW;
void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const COMMON=`
uniform vec2 uHole;uniform float uThick,uK,uShadow,uHaze,uMaxD;uniform vec3 uLight,uGlass;
varying vec2 vUv;varying vec3 vW;
float sdBox(vec2 p,vec2 b){vec2 d=abs(p)-b;return length(max(d,0.))+min(max(d.x,d.y),0.);}
/* カメラ→点の視線が開口部（ガラスの表と裏）を通るか。1=通る（くっきり）*/
float through(vec3 P){
  vec3 C=cameraPosition;
  vec2 gf=P.xy+(C.xy-P.xy)*((0.-P.z)/(C.z-P.z));
  vec2 gb=P.xy+(C.xy-P.xy)*((-uThick-P.z)/(C.z-P.z));
  return 1.-smoothstep(-.8,.8,max(sdBox(gf,uHole),sdBox(gb,uHole)));
}
/* 光：点から光の方へ戻ってガラス面で開口部を通るか。半影は距離に比例 */
float lit(vec3 P,float d){
  vec2 g=P.xy+uLight.xy*(-P.z/uLight.z);float w=2.+d*.14;
  return mix(uShadow,1.,1.-smoothstep(-w,w,sdBox(g,uHole)));
}`;
const ITEM_FRAG=COMMON+`
uniform sampler2D map;uniform float uHasTex,uDepth,uTexPerPx,uHover,uFocus;uniform vec2 uApp,uExpand;uniform vec3 uBase;
vec4 tap(vec2 uv,float lod){
  if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.)return vec4(0.);
  vec4 c=uHasTex>.5?textureLod(map,uv,lod):vec4(uBase,1.);return vec4(c.rgb*c.a,c.a);
}
void main(){
  vec2 tuv=(vUv-.5)*uExpand+.5;
  float inb=step(0.,tuv.x)*step(0.,tuv.y)*step(tuv.x,1.)*step(tuv.y,1.);
  vec4 c0=uHasTex>.5?texture(map,tuv):vec4(uBase,1.);
  vec4 sharp=vec4(c0.rgb*c0.a,c0.a)*inb;
  float inside=through(vW);
  /* ぼけ：半径 r(px) を黄金角の渦で TAPS 点サンプル。ミップを使ってちらつきを抑える */
  vec4 acc=vec4(0.);
  if(inside<.999){
    float r=uK*uDepth;vec2 ruv=r/uApp;
    /* サンプル間隔に合わせてミップを上げる。少ないサンプル数（スマホ）ほど一段上げてブロック感を消す */
    float lod=log2(max(1.,r*uTexPerPx*2.6/sqrt(float(TAPS))))+(TAPS<12?.8:.3);
    /* ピクセルごとに渦の向きをずらす（Interleaved Gradient Noise）→ 角ばった模様ではなく、すりガラスの粒になる */
    float jit=6.2831853*fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
    float ws=0.;
    for(int i=0;i<TAPS;i++){float fi=float(i)+.5,rr=sqrt(fi/float(TAPS)),a=fi*2.39996323+jit;
      float w=1.-.55*rr;acc+=tap(tuv+vec2(cos(a),sin(a))*rr*ruv,lod)*w;ws+=w;}
    acc/=ws;
  }
  vec4 col=mix(acc,sharp,inside);
  /* フォーカス（キーボード）：サムネの外側に黒い枠 */
  vec2 e=3./uApp;
  float ring=uFocus*step(-e.x,tuv.x)*step(-e.y,tuv.y)*step(tuv.x,1.+e.x)*step(tuv.y,1.+e.y)*(1.-inb);
  if(col.a<.003&&ring<.5)discard;
  vec3 rgb=col.a>0.?col.rgb/col.a:vec3(0.);
  rgb=mix(rgb,vec3(0.),uHover);                                  /* ホバーは今のサイトと同じく黒 */
  rgb*=lit(vW,uDepth);
  float dn=clamp(uDepth/uMaxD,0.,1.);
  rgb=mix(rgb,uGlass,uHaze*(.18+.82*dn)*(1.-inside));            /* ガラス越しは遠いほど白く */
  float a=col.a*(1.-(1.-inside)*.3*dn);
  if(ring>.5){rgb=vec3(0.);a=1.;}
  gl_FragColor=vec4(rgb,a);
}`;
const WALL_FRAG=COMMON+`
uniform float uDepth,uWallShadow;uniform vec3 uBase;
void main(){
  float inside=through(vW);
  vec3 rgb=uBase*mix(uWallShadow,1.,(lit(vW,uDepth)-uShadow)/(1.-uShadow));
  rgb=mix(rgb,uGlass,uHaze*(1.-inside));
  gl_FragColor=vec4(rgb,1.);
}`;

/* ===== ガラス（開口部つきの板。厚み・面取り・フチのハイライト）===== */
let glass=null,rim=null,wall=null;
const grain=(()=>{                        /* すりガラスの細かい粒 */
  const c=document.createElement("canvas");c.width=c.height=128;const x=c.getContext("2d"),d=x.createImageData(128,128);
  const r=rng(7);for(let i=0;i<d.data.length;i+=4){const v=232+r()*23;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255;}
  x.putImageData(d,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1/128,1/128);return t;
})();
function buildGlass(){
  [glass,rim,wall].forEach(o=>{if(o){scene.remove(o);o.traverse(m=>{m.geometry&&m.geometry.dispose();});}});
  const W=S.vw*3,H=S.vh*3,hw=S.ap.w/2+CFG.bevel,hh=S.ap.h/2+CFG.bevel;
  const shape=new THREE.Shape();shape.moveTo(-W,-H);shape.lineTo(W,-H);shape.lineTo(W,H);shape.lineTo(-W,H);shape.lineTo(-W,-H);
  const hole=new THREE.Path();hole.moveTo(-hw,-hh);hole.lineTo(-hw,hh);hole.lineTo(hw,hh);hole.lineTo(hw,-hh);hole.lineTo(-hw,-hh);
  shape.holes.push(hole);
  const depth=Math.max(1,CFG.thick-2*CFG.bevel);
  const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:CFG.bevel,bevelSize:CFG.bevel,bevelSegments:3,curveSegments:1});
  const mat=new THREE.MeshStandardMaterial({color:CFG.glassColor,map:grain,roughness:.38,metalness:0,transparent:true,opacity:CFG.glassOpacity,depthWrite:false});
  glass=new THREE.Mesh(geo,mat);glass.position.z=-(depth+CFG.bevel);glass.renderOrder=1000;scene.add(glass);
  /* フチ：光の来る上・左は白く光り、下・右は細い影 */
  rim=new THREE.Group();
  const ap=S.ap,edge=(x,y,w,h,col,op)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op,depthWrite:false}));
    m.position.set(x,y,.6);m.renderOrder=1001;rim.add(m);};
  edge(0,ap.h/2+.75,ap.w+2,1.5,0xffffff,.95);edge(-ap.w/2-.75,0,1.5,ap.h+2,0xffffff,.8);
  edge(0,-ap.h/2-.5,ap.w+2,1,0x000000,.16);edge(ap.w/2+.5,0,1,ap.h+2,0x000000,.12);
  scene.add(rim);
  /* 奥の壁：開口部から差す光が落ちる */
  const wd=CFG.maxDepth+CFG.wallGap,ws=(S.camZ+wd)/S.camZ;
  wall=new THREE.Mesh(new THREE.PlaneGeometry(S.vw*ws*2.2,S.vh*ws*2.2),
    new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:WALL_FRAG,uniforms:{...U,uDepth:{value:wd},uWallShadow:{value:CFG.wallShadow},uBase:{value:new THREE.Color(0xffffff)}}}));
  wall.position.z=-wd;wall.renderOrder=-1;scene.add(wall);
}

/* ===== 要素（サムネ・制作年・カテゴリ）===== */
let EL=[],WORKS=[],LINKS=[];
const PLACE=new THREE.DataTexture(new Uint8Array([12,12,12,255]),1,1);PLACE.needsUpdate=true;
function itemMaterial(){
  return new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:ITEM_FRAG,transparent:true,depthWrite:false,defines:{TAPS:Q.taps},
    uniforms:{...U,map:{value:PLACE},uHasTex:{value:0},uBase:{value:new THREE.Color(0x0c0c0c)},uDepth:{value:0},uTexPerPx:{value:1},
      uHover:{value:0},uFocus:{value:0},uApp:{value:new THREE.Vector2(1,1)},uExpand:{value:new THREE.Vector2(1,1)}}});
}
function textTexture(text,typo){
  const scale=3,size=+typo.size||15,c=document.createElement("canvas"),x=c.getContext("2d");
  const fam=getComputedStyle(document.documentElement).getPropertyValue("--sans")||"Helvetica, sans-serif";
  const font=`${+typo.weight||400} ${size*scale}px ${fam}`;
  x.font=font;if("letterSpacing" in x)x.letterSpacing=((+typo.tracking||0)/1000*size*scale)+"px";
  const w=Math.ceil(x.measureText(text).width)+4*scale,h=Math.ceil(size*1.25*scale);
  c.width=w;c.height=h;x.font=font;if("letterSpacing" in x)x.letterSpacing=((+typo.tracking||0)/1000*size*scale)+"px";
  x.fillStyle="#0a0a0a";x.textBaseline="middle";x.fillText(text,2*scale,h/2);
  const t=new THREE.CanvasTexture(c);t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=4;
  return {tex:t,w:w/scale,h:h/scale};
}
function build(site,works){
  WORKS=works;
  EL.forEach(e=>{scene.remove(e.mesh);e.mesh.geometry.dispose();e.mat.dispose();e.tex&&e.tex!==PLACE&&e.tex.dispose();});EL=[];
  const typo=typoValue(site,"home_label"),loader=new THREE.TextureLoader();
  works.forEach((w,i)=>{
    const r=rng(hash(w.slug||String(i)));
    const depth=()=>CFG.minDepth+(CFG.maxDepth-CFG.minDepth)*r();
    /* 年・カテゴリの辺と位置（今のホームと同じ決め方を、シード値で）*/
    const pk=()=>["top","bottom","left","right"][Math.floor(r()*4)];
    const e1=pk();let e2;do{e2=pk();}while(e2===e1);
    const p1=16+r()*58,p2=16+r()*58,jx=r()*12-6,jy=r()*2.1-.7,ml=r();
    const thumb={kind:"thumb",work:i,d:depth(),w:0,h:0,jx,jy,ml};
    EL.push(thumb);
    [["year",w.year,e1,p1],["cat",w.category,e2,p2]].forEach(([kind,text,edge,p])=>{
      if(!text)return;const t=textTexture(text,typo);
      EL.push({kind,work:i,d:depth(),tw:t.w,th:t.h,edge,p,tex:t.tex,thumb});
    });
    const tm=itemMaterial();thumb.mat=tm;
    const src=asset(w.thumb);
    if(src)loader.load(src,tex=>{tex.generateMipmaps=true;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.anisotropy=renderer.capabilities.getMaxAnisotropy();
      tm.uniforms.map.value=tex;tm.uniforms.uHasTex.value=1;thumb.tex=tex;thumb.texW=tex.image.width;kick();});
  });
  EL.forEach(e=>{
    if(!e.mat){e.mat=itemMaterial();e.mat.uniforms.map.value=e.tex;e.mat.uniforms.uHasTex.value=1;e.texW=e.tex.image.width;}
    e.mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),e.mat);e.mesh.renderOrder=-e.d;e.mesh.userData.el=e;scene.add(e.mesh);
  });
  buildLinks(works);
  layout();
}

/* ===== 配置（今のホームの散らばり。スマホは縦に積む）===== */
const LAYOUT=[{x:12,top:3},{x:60,top:7},{x:34,top:15},{x:6,top:23},{x:64,top:25},{x:28,top:34},
  {x:56,top:42},{x:10,top:48},{x:40,top:56},{x:66,top:62},{x:18,top:71},{x:46,top:80}];
function layout(){
  S.vw=innerWidth;S.vh=innerHeight;
  const cs=getComputedStyle(document.getElementById("aperture"));
  S.ap.w=parseFloat(cs.width);S.ap.h=parseFloat(cs.height);
  U.uHole.value.set(S.ap.w/2,S.ap.h/2);
  S.camZ=(S.vh/2)/Math.tan(THREE.MathUtils.degToRad(CFG.fov/2));
  camera.aspect=S.vw/S.vh;camera.near=10;camera.far=S.camZ+CFG.maxDepth+CFG.wallGap+2000;camera.updateProjectionMatrix();
  renderer.setPixelRatio(Q.dpr);renderer.setSize(S.vw,S.vh,false);
  const mobile=S.vw<=760;
  const SW=Math.min(S.vw,1500),off=(S.vw-SW)/2,pages=Math.max(1,Math.ceil(WORKS.length/LAYOUT.length));
  const stageH=SW*4600/1600*pages;
  const WW=19,XS=((100-Math.max(...LAYOUT.map(L=>L.x+WW)))-Math.min(...LAYOUT.map(L=>L.x)))/2;
  let maxY=0;
  EL.filter(e=>e.kind==="thumb").forEach(t=>{
    const i=t.work;
    if(mobile){t.w=S.vw*.54;t.h=t.w*9/16;t.x=S.vw*(.02+t.ml*.42);t.y=132+i*(t.h+108);}
    else{const L=LAYOUT[i%LAYOUT.length],k=Math.floor(i/LAYOUT.length);
      t.w=SW*WW/100;t.h=t.w*9/16;t.x=off+SW*(L.x+XS+t.jx)/100;t.y=(Math.max(3,L.top+t.jy)+100*k)/100*(stageH/pages);}
    maxY=Math.max(maxY,t.y+t.h);
  });
  EL.filter(e=>e.kind!=="thumb").forEach(e=>{
    const t=e.thumb,g=8;e.w=e.tw;e.h=e.th;
    if(e.edge==="top"){e.x=t.x+t.w*e.p/100;e.y=t.y-g-e.h;}
    else if(e.edge==="bottom"){e.x=t.x+t.w*e.p/100;e.y=t.y+t.h+g;}
    else if(e.edge==="left"){e.x=t.x-g-e.w;e.y=t.y+t.h*e.p/100;}
    else{e.x=t.x+t.w+g;e.y=t.y+t.h*e.p/100;}
  });
  /* スクロールの長さ：最後の作品が画面の中央（開口部）に来るまで */
  S.docH=maxY+S.vh*.5+120;
  document.getElementById("spacer").style.height=S.docH+"px";
  buildGlass();
  kick();
}

/* 要素を今のスクロール位置に置く。
   見かけの大きさ・位置（px）を決め、距離 d の分だけ奥に置いて拡大（カメラから見て同じ大きさになる）。
   縦の動きは奥ほど遅い（視差）。サムネのサイズも奥ほど少し小さく */
function place(){
  const s=S.scrollNow;
  for(const e of EL){
    const sc=(S.camZ+e.d)/S.camZ,ss=Math.sqrt(sc);
    const aw=e.w/Math.pow(sc,.35),ah=e.h/Math.pow(sc,.35);            /* 見かけのサイズ */
    const cx=e.x+e.w/2-S.vw/2, cy=-(e.y+e.h/2-s-S.vh/2)/ss;            /* 見かけの中心（画面中央が原点）*/
    const m=CFG.blurK*e.d*1.6+3;                                       /* ぼけがはみ出す分の余白(px) */
    e.mesh.position.set(cx*sc,cy*sc,-e.d);
    e.mesh.scale.set((aw+2*m)*sc,(ah+2*m)*sc,1);
    const u=e.mat.uniforms;
    u.uDepth.value=e.d;u.uApp.value.set(aw,ah);u.uExpand.value.set((aw+2*m)/aw,(ah+2*m)/ah);
    u.uTexPerPx.value=(e.texW||aw)/aw;                                 /* 画面1pxあたりのテクセル数（ミップの段を決める）*/
  }
}

/* ===== 操作：クリック・ホバー・キーボード ===== */
const ray=new THREE.Raycaster();
function pick(){
  if(S.ptr.x>2)return -1;
  ray.setFromCamera(S.ptr,camera);
  const hits=ray.intersectObjects(EL.map(e=>e.mesh),false);
  for(const h of hits){
    const e=h.object.userData.el,ex=e.mat.uniforms.uExpand.value;
    const tu=(h.uv.x-.5)*ex.x+.5,tv=(h.uv.y-.5)*ex.y+.5;
    if(tu>=0&&tu<=1&&tv>=0&&tv<=1)return e.work;
  }
  return -1;
}
function buildLinks(works){
  const nav=document.getElementById("links");
  nav.innerHTML=works.map((w,i)=>`<a href="${esc(workURL(w))}" data-i="${i}">${esc(w.title||"")}${w.year?`, ${esc(w.year)}`:""}${w.category?`, ${esc(w.category)}`:""}</a>`).join("");
  LINKS=[...nav.querySelectorAll("a")];
  LINKS.forEach(a=>{
    a.addEventListener("focus",()=>{
      S.focus=+a.dataset.i;const t=EL.find(e=>e.kind==="thumb"&&e.work===S.focus);
      scrollTo({top:Math.max(0,t.y+t.h/2-S.vh/2),behavior:REDUCED?"auto":"smooth"});kick();
    });
    a.addEventListener("blur",()=>{S.focus=-1;kick();});
  });
}
canvas.addEventListener("pointermove",e=>{
  S.ptr.set(e.clientX/S.vw*2-1,-(e.clientY/S.vh)*2+1);
  if(!COARSE&&!REDUCED)S.camT.set(S.ptr.x*CFG.parallax,S.ptr.y*CFG.parallax);
  kick();
});
canvas.addEventListener("pointerleave",()=>{S.ptr.set(9,9);S.camT.set(0,0);kick();});
canvas.addEventListener("click",e=>{
  S.ptr.set(e.clientX/S.vw*2-1,-(e.clientY/S.vh)*2+1);
  const i=pick();if(i>=0)LINKS[i].click();
});

/* ===== 描画ループ（動きがある間だけ回す）===== */
let raf=0,last=0,slow=0,frames=0;
function kick(){if(!raf)raf=requestAnimationFrame(frame);}
addEventListener("scroll",()=>{S.scroll=scrollY;kick();},{passive:true});
addEventListener("resize",()=>{layout();});
function frame(t){
  raf=0;const dt=Math.min(.05,last?(t-last)/1000:.016);last=t;
  let moving=false;
  const k=REDUCED?1:1-Math.exp(-dt*CFG.scrollEase);
  S.scrollNow+=(S.scroll-S.scrollNow)*k;if(Math.abs(S.scroll-S.scrollNow)>.3)moving=true;else S.scrollNow=S.scroll;
  S.cam.lerp(S.camT,REDUCED?1:1-Math.exp(-dt*4));if(S.cam.distanceTo(S.camT)>.05)moving=true;
  camera.position.set(S.cam.x,S.cam.y,S.camZ);camera.lookAt(S.cam.x*.25,S.cam.y*.25,0);
  place();
  S.hover=COARSE?-1:pick();
  canvas.style.cursor=S.hover>=0?"pointer":"";
  for(const e of EL){
    const u=e.mat.uniforms,th=e.kind==="thumb"&&e.work===S.hover?1:0,tf=e.kind==="thumb"&&e.work===S.focus?1:0;
    u.uHover.value+=(th-u.uHover.value)*(REDUCED?1:Math.min(1,dt*14));if(Math.abs(th-u.uHover.value)>.01)moving=true;else u.uHover.value=th;
    u.uFocus.value=tf;
  }
  renderer.render(scene,camera);
  /* 端末に合わせて画質を下げる：動いている間の平均が重ければ解像度→サンプル数の順に落とす */
  if(moving){frames++;slow+=dt>1/40?1:0;
    if(frames>=45){if(slow>25){if(Q.dpr>1){Q.dpr=Math.max(1,Q.dpr*.8);renderer.setPixelRatio(Q.dpr);renderer.setSize(S.vw,S.vh,false);}
      else if(Q.taps>8){Q.taps=8;EL.forEach(e=>{e.mat.defines.TAPS=8;e.mat.needsUpdate=true;});}}frames=0;slow=0;}
    kick();
  }
}

/* ===== 起動 ===== */
onContent(["site","works","profile"],([site,data,profile],first)=>{
  if(!first)return;
  document.getElementById("hTitle").textContent=site.title||"";
  document.getElementById("hProfile").textContent=profile.label||"Profile";
  setTitle("Lab — Glass",site.title);
  const fb=document.getElementById("botmsg");
  if(site.message){fb.hidden=false;fb.querySelector("span").textContent=site.message;}
  document.fonts.ready.then(()=>build(site,data.works||[]));
});

/* ?debug：検証用（作品 i のサムネ中心が今どこに見えているか）*/
if(new URLSearchParams(location.search).has("debug"))window.__glass={
  screenOf(i){const e=EL.find(x=>x.kind==="thumb"&&x.work===i);if(!e)return null;
    const v=e.mesh.position.clone().project(camera);return {x:(v.x+1)/2*S.vw,y:(1-v.y)/2*S.vh,d:e.d};},
  state:()=>({scroll:S.scroll,scrollNow:S.scrollNow,hover:S.hover,focus:S.focus,dpr:Q.dpr,taps:Q.taps}),
};
