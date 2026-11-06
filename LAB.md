# lab — 実験場

- 閲覧: **https://sanoryota.com/lab/**（本番からはリンクしない・全ページ noindex・GA なし）
- 公開: `lab` ブランチに push → `.github/workflows/lab-publish.yml` が main の `lab/` にコピー → GitHub Pages が反映（1〜2分）。
  Pages の設定は変えていない（main / ルート配信のまま）。コピーされない：`content/` `media/` `admin/` `stage/` `tools/` `CNAME` `*.md`
- 作品データ・画像は本番と同じ `/content/` `/media/` を読む（`assets/site.js` の `ROOT`）。
- 分岐元：main（2026-11-06 時点の最新コード）。本番のコードを lab に取り込むときは `git merge main`。

## 実験一覧
| URL | 内容 |
|---|---|
| `/lab/` | すりガラス：作品のサムネ・制作年・カテゴリをガラスの裏の3D空間に置き、中央の開口部から見る（`assets/glass.js`）|

## すりガラス（/lab/）
- 実装：Three.js r170（`vendor/` に同梱）＋自前シェーダー。`assets/glass.js`、ページは `index.html`。
- **開口部の大きさ**：`index.html` の CSS 変数 `--aperture-w` / `--aperture-h`（スマホは media query 内）。
- **見え方の調整**：`assets/glass.js` 冒頭の `CFG`
  - `minDepth`/`maxDepth`（ガラスからの距離の範囲 px）・`blurK`（ぼけ半径 = blurK × 距離）・`haze`（遠いほど白く）
  - `thick`/`bevel`（ガラスの厚み・フチの面取り）・`shadow`/`wallShadow`（影の濃さ）・`light`（光の向き）
  - `parallax`（マウスでカメラが動く量）・`scrollEase`（スクロールの追従）・`glassColor`/`glassOpacity`
- **距離**：作品の slug から作るシード値（`hash`→`rng`）。リロード・端末が変わっても同じ。作品を並べ替えても各作品の距離は変わらない。
- **仕組み**
  - ガラス面（z=0）が画面と 1px=1px になるようカメラを置く。要素は見かけの大きさ・位置を決めてから距離 d だけ奥に置き拡大。縦の動きは奥ほど遅い（視差）。
  - ピクセルごとに「カメラ→点」の視線がガラスの表と裏の両方で開口部を通るか判定（`through()`）。通ればくっきり、通らなければ d に比例した半径で、黄金角の渦＋ピクセルごとの回転ジッター＋ミップでぼかし、遠いほどガラス色に霞ませる。
  - 光（`lit()`）：点から光の方向へ戻りガラス面で開口部を通るかで、ガラスの影と開口部から差す光を要素と奥の壁に落とす（半影は距離に比例）。
  - ガラス板は ExtrudeGeometry（開口部の穴・厚み・面取り）＋MeshStandardMaterial（粒のテクスチャ）。フチの上・左に白いハイライト、下・右に細い影。
- **操作**：サムネ・制作年・カテゴリはレイキャストでクリック／ホバー（今のサイトと同じく黒くなる）。キーボードは画面外の `<nav id="links">` のリンクで Tab/Enter。フォーカスすると作品が開口部の中央まで動き、黒い枠が付く。
- **品質**：スマホ（pointer:coarse）は解像度 1.5x・サンプル 8、PC は 2x・16。動いている間に重ければ解像度→サンプル数の順に自動で落とす。描画は動きがある間だけ。
- **prefers-reduced-motion**：スクロール追従・カメラの視差・ホバーのアニメ・アイコンの点滅を止める（すりガラスの見た目はそのまま）。
- WebGL2 が無い端末は `home.html`（通常のホーム）へ。
- 検証用：`?debug` で `window.__glass.screenOf(i)` / `state()`。
