# CLAUDE.md — 開発引き継ぎメモ

このリポジトリで作業する際の要点。データ項目・ページ構成・GAイベントの一覧は **`SPEC.md`**。

## プロジェクト概要
- **佐野涼太のポートフォリオ**。ビルド不要の静的サイト（HTML/CSS/JSのみ・依存なし）。
- 内容は **`content/*.json`**、画像は **`media/`**。ユーザーは **Pages CMS**（`.pages.yml`）の管理画面で編集する。
- 公開: **GitHub Pages** `sanoryootaa/portfolio-site`（`main` から配信）→ 独自ドメイン **https://sanoryota.com**。
- ローカル: `/Users/sanoryota/05_ポートフォリオ/サイト/Site Html 002`（＝リポジトリのルート）。

## ファイル構成
- `index.html` … ホーム（散らばり配置・ラベル・トロフィー・最下部メッセージ）
- `work.html?id=<slug>` … 作品ページ / `profile.html` … プロフィールページ（どちらも黒地・`<html class="dark">`）
- `assets/site.css` … 共通（フォント・黒地ページ・✕・バイリンガル段組み）
- `assets/site.js` … 共通（GA4読み込み・`loadContent()`・`esc/asset/ytId`・✕の戻る動作）
- `content/{works,profile,site}.json` … データ / `.pages.yml` … 管理画面の定義
- `admin/index.html` … 管理画面の入口（`sanoryota.com/admin`）。**`BRANCH` 定数は main へマージしたら "main" に変える**
- `media/works|profile|site/` … 画像 / `CNAME` / `SPEC.md` / `tools/drive-urls.html`（旧スプシ運用の補助ツール。今は不要）

## 動作の要点
- **データ追加/変更**＝ JSON のキー ＋ `.pages.yml` の field ＋ 描画箇所 ＋ `SPEC.md` をセットで更新。
- **表記ルール**: 日英バイリンガルは About 本文だけ（日→英で縦積み）。他は英語のみ・sentence case（固有名詞・略語を除く）。
- **色**: 作品・プロフィールページは黒地に #ffffff のみ（作品色・グレー・アクセント色は撤去済み）。ホームは白地に黒文字。
- **タイポは一般的な組みで固定**（トラッキング・行間・ウェイトのキーやpalt等は全部撤去済み。調整はCSSで）。フォントは `--sans`（Helvetica → 游ゴシック）。
- **画像パス**は JSON では `/media/...`。表示時に `asset()` で相対化（github.io/portfolio-site 配下でも切れないように）。
- **ホーム配置**: `layout` 12枠。13件目以降は同パターンを下に繰り返し、`#stage` の aspect-ratio を伸ばす。
- **旧URL互換**: `/#work-N` → `work.html?id=`、`/#profile` → `profile.html`（index.html）。
- **GA4**: `assets/site.js` の `GA_ID` 1か所。送信は必ず `gaEv()`。イベント一覧は SPEC.md §4。

## 作業の約束ごと
- **既存挙動を壊さない**（描画・アニメ・GA送信）。
- **コミット前にJS構文チェック**:
  ```bash
  node -e "const fs=require('fs');new Function(fs.readFileSync('assets/site.js','utf8'));for(const f of ['index.html','work.html','profile.html']){[...fs.readFileSync(f,'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(m=>new Function(m[1]));}console.log('JS OK')"
  ```
- 表示確認は `python3 -m http.server` で（`fetch` を使うので file:// では動かない）。
- コミット→push まで一気に（ユーザーは即反映を見たい）。反映は1〜2分＋キャッシュ注意。
- レイアウトは PC と スマホ（`max-width:760px`）で別指定。
