# CLAUDE.md — 開発引き継ぎメモ

このリポジトリで作業する際の要点。データ項目・ページ構成・GAイベントの一覧は **`SPEC.md`**。

## プロジェクト概要
- **佐野涼太のポートフォリオ**。ビルド不要の静的サイト（HTML/CSS/JSのみ・依存なし）。
- 内容は **`content/*.json`**、画像は **`media/`**。ユーザーは **自作の管理画面 `/admin`**（GitHub API で直接読み書き）で編集する。
- 公開: **GitHub Pages** `sanoryootaa/portfolio-site`（`main` から配信）→ 独自ドメイン **https://sanoryota.com**。
- ローカル: `/Users/sanoryota/05_ポートフォリオ/サイト/Site Html 002`（＝リポジトリのルート）。

## ファイル構成
- `index.html` … **公開前は旧サイト（スプシ読み込み・main の元のまま）**。公開時に `home.html` で置き換える
- `home.html` … 新しいホーム（散らばり配置・ラベル・トロフィー・最下部メッセージ）。公開前の隠しURL
- `work.html?id=<slug>` … 作品ページ / `profile.html` … プロフィールページ（どちらも黒地・`<html class="dark">`）
- `assets/site.css` … 共通（フォント・黒地ページ・✕・龍・バイリンガル段組み）
- `assets/site.js` … 共通（`HOME`・`PREVIEW`・GA4・`onContent()`・文字組み `TYPO_AREAS/applyTypography`・`esc/asset/ytId`・✕/龍の動き）
- `admin/` … 管理画面（`index.html` / `admin.css` / `admin.js`）。外部スクリプトは読まない（トークンを扱うため）
- `content/{works,profile,site}.json` … 本公開データ（main）。確認用は **`renewal` ブランチ**の同じパス（`draft` ブランチは旧・未使用）
- `stage/index.html` … 確認用ページの入口（ホームを `?stage=1` で開く）
- `media/works|profile|site/` … 画像 / `CNAME` / `SPEC.md` / `tools/drive-urls.html`（旧スプシ運用の補助。不要）

## 管理画面の仕組み（admin/admin.js）
- 認証：Fine-grained PAT（このリポジトリのみ・Contents RW）を localStorage `admin:token` に保存。
- 3段階：編集中 `W`（localStorage `admin:work` に自動保存）→ 確認用 `DRAFT`（renewal ブランチ・`/stage/` で見られる）→ 本公開 `LIVE`（main）。
- 確認用ページ（`?stage=1`、site.js の `STAGE`）：GitHub API で renewal の最新コミット SHA を取り、`raw.githubusercontent.com/<sha>/content/*.json` を読む（同じURLだと raw が5分キャッシュするため SHA 指定）。ログイン済み端末は admin のトークンで問い合わせ（未ログインは60回/時）。GA なし・noindex・左下に目印。
- **lab ブランチ＝実験場**（sanoryota.com/lab/）。`lab` に push すると `.github/workflows/lab-publish.yml`（lab ブランチにだけある）が main の `lab/` にコピーして Pages を再ビルド。main の `lab/` は手で触らない。本番から lab へはリンクしない。詳細は lab ブランチの `LAB.md`。
- **renewal ブランチはもうコード置き場ではない**（管理画面が content を書き込む）。コードは main だけに push し、`main:renewal` を push しないこと。
- 書き込みは Git Data API で複数ファイル1コミット（`commit()`、422 は取り直して再試行）。draft ブランチが無ければ main から作る。
- プレビュー：編集のたびに localStorage `preview:<name>` に書き、iframe の `?preview=1` ページが `storage` イベントで描き直す（`onContent()`）。プレビュー・管理画面では GA を送らない。
- 画像：canvas で長辺2000px JPEG に縮小 → main の `media/` に即コミット。反映前は blob URL で表示（`BLOBS`）。
  - ブラウザが読めない TIFF / HEIC は `admin/vendor/`（utif 3.1.0 + pako_inflate 1.0.11 / heic2any 0.0.4、自前配信）を必要時だけ読み込んで変換（`decodeAny()`）。
- 並べ替え `sortable()`：ポインターキャプチャは使わない（DOM 入れ替えでキャプチャが外れて確定しなくなるため）。window で move/up を受け、端で自動スクロール。
- 項目を足すとき：JSON ＋ 描画（各ページ）＋ 管理画面の `view*()` ＋ `F_LABEL`（公開時の差分表示）＋ SPEC.md。
- 文字組みのエリアを足すとき：`TYPO_AREAS` に1行（label/page/sel/既定値）。管理画面にも自動で出る。

## 公開（ローンチ）の手順
1. `git mv -f home.html index.html`（旧サイトを置き換え）
2. `assets/site.js` の `HOME` を `"./"` に
3. `index.html`・`work.html`・`profile.html` の `<meta name="robots" content="noindex">`（公開前用）を削除
4. 構文チェック → main に push

## 動作の要点
- **データ追加/変更**＝ JSON のキー ＋ 描画箇所 ＋ 管理画面（`admin/admin.js`）＋ `SPEC.md` をセットで更新。
- **表記ルール**: 日英バイリンガルは About 本文だけ（日→英で縦積み）。他は英語のみ。2語以上の名前（タイトル・ジャンル・役職・見出し・サイト名）は各単語の頭文字を大文字（of/& は小文字）、文章は sentence case。
- **色**: 作品・プロフィールページは黒地に #ffffff のみ（作品色・グレー・アクセント色は撤去済み）。ホームは白地に黒文字。
- **タイポは一般的な組みで固定**（トラッキング・行間・ウェイトのキーやpalt等は全部撤去済み。調整はCSSで）。フォントは `--sans`（Helvetica → 游ゴシック）。
- **画像パス**は JSON では `/media/...`。表示時に `asset()` で相対化（github.io/portfolio-site 配下でも切れないように）。
- **ホーム配置**: `layout` 12枠。13件目以降は同パターンを下に繰り返し、`#stage` の aspect-ratio を伸ばす。
- **旧URL互換**: `/#work-N` → `work.html?id=`、`/#profile` → `profile.html`（新ホーム。公開後に効く）。
- **GA4**: `assets/site.js` の `GA_ID` 1か所。送信は必ず `gaEv()`。イベント一覧は SPEC.md §4。

## 作業の約束ごと
- **既存挙動を壊さない**（描画・アニメ・GA送信）。
- **コミット前にJS構文チェック**:
  ```bash
  node -e "const fs=require('fs');new Function(fs.readFileSync('assets/site.js','utf8'));new Function(fs.readFileSync('admin/admin.js','utf8'));for(const f of ['home.html','work.html','profile.html']){[...fs.readFileSync(f,'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(m=>new Function(m[1]));}console.log('JS OK')"
  ```
- 表示確認は `python3 -m http.server` で（`fetch` を使うので file:// では動かない）。
- コミット→push まで一気に（main 直）。反映は1〜2分＋キャッシュ注意。
- 管理画面から main / draft にコミットが入るので、作業前に必ず `git pull --rebase`。
- **CSS/JS（assets/・admin/）を変えたら `tools/bump.sh`** を実行して各ページの `?v=` を更新（GitHub Pages は max-age=600 なので、しないと最大10分古いファイルが使われる）。管理画面のプレビューは `&t=` でページ本体も毎回取り直す。
- レイアウトは PC と スマホ（`max-width:760px`）で別指定。
