# CLAUDE.md — 開発引き継ぎメモ

このリポジトリで作業する際の要点。詳細な「スプレッドシートのキー一覧」は **`SPEC.md`** を参照。

## プロジェクト概要
- **佐野涼太のポートフォリオ**。実体は **単一ファイル `index.html`**（CSS/JSすべて内包）。ビルド不要・依存なし。
- 内容は **Google スプレッドシートから取得**して描画（作品・プロフィール・デザイン設定・色など）。
- 公開: **GitHub Pages** `sanoryootaa/portfolio-site` → 独自ドメイン **https://sanoryota.com**。
- ローカルの作業ディレクトリ: `/Users/sanoryota/NID/Portfolio/Site Html 002`（＝リポジトリのルート）。

## ファイル構成
- `index.html` … 本体（ここをほぼ全部いじる）
- `SPEC.md` … スプレッドシートのキー仕様（ユーザー向け）。**キーを足したら必ず更新**。
- `tools/drive-urls.html` … Google DriveフォルダからImage直リンクを一括生成する補助ツール（APIキー埋め込み済み）
- `CNAME` … `sanoryota.com`（独自ドメイン）
- `CLAUDE.md` … これ

## 動作の要点（index.html 内）
- **スプレッドシート**: `SHEET_ID` 定数、`SHEET_TABS=["", "profile", "works"]`（複数タブをマージ、後勝ち）。CSVを `gviz/tq?tqx=out:csv&headers=0` で取得（`headers=0` 必須。無いと先頭行が結合される）。
- **キー解決**: `DEFAULTS`（既定値）＋ `KEY_ALIASES`（日本語別名→英語キー）。値取得は `g(key)`（DATAにあれば優先、無ければDEFAULTS）。**作品系の既定値は空**（未入力ならサンプルを出さない方針）。
- **デザイン数値はイラレ感覚**: トラッキング=1/1000em、行間=行送り％（150→1.5）、余白=px。変換は `toLS/toLH/toPX`。`applyDesign()` が CSS変数(`--...`)に反映。
- **固定タイポ**: `body` に `font-kerning:none`（カーニング0）/ `font-feature-settings:"palt"`（プロポーショナルメトリクスON）/ `text-spacing-trim:space-all`（役物なし）。字間はキー `tracking` のみで制御。
- **色**: `work_colors`（候補）＋ `color_mode`（random=重複最小のランダム配分 / fixed=`workN_color`個別）。`recolor()` が `colors[]` を決定。
- **描画フロー**: `renderAll() = applyDesign()+buildArchive()+buildHeaderProfile()`。**初回描画は `loadSheet().then` の中だけ**（読み込み中に既定テキストを見せないため）。`restoreState()` で `#work-N`/`#profile` を復元。
  - ⚠️ **ブート順の落とし穴**: `recolor()`/`g()` は `let DATA={}` 定義後に呼ぶこと。トップレベルで呼ぶと TDZ でサイトが真っ白になる（過去に踏んだ）。
- **作品ページ(PC)**: 2カラム。左=動画→メタ(タイトル/カテゴリ/制作年/受賞)→ABOUT、右=credit。スマホは1カラム縦積み＋ボトムシート風スライド開閉、`align-content:start`（内容が短くても間延びしない）。
- **トロフィー**: `workN_award` があるとサムネ周りをループ移動（`t-roam-i` を動的注入）。速度は `trophy_speed`。
- **GA4**: `<head>` に gtag.js（`GA_ID` 定数、差し替えは head の2箇所）。送信は必ず `gaEv()`（`typeof gtag==='function'` ガード）。イベント: work_open / about_open / contact_click / sns_click / scroll_bottom / engaged_browsing / video_play。詳細は SPEC.md §8。

## 作業の約束ごと
- **既存挙動を壊さない**。特に描画・開閉・アニメ・GA送信。イベントは既存ハンドラに最小追加。
- **必ずJS構文チェックしてからコミット**:
  ```bash
  node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const b=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(s=>s.trim());new Function('gtag','dataLayer','GA_ID',b[b.length-1]);console.log('JS OK')"
  ```
  必要なら DOMスタブで top-level 実行まで確認（真っ白化の再発防止）。
- **コミット→pushまで一気に**（ユーザーは即反映を見たい）。ブランチは `main` 直。反映は1〜2分＋キャッシュ注意（スマホは特に）。
- コミットのトレーラー: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。
- **キーを追加/変更したら `SPEC.md` を更新**。
- 画像URLは Drive共有リンク / `lh3.googleusercontent.com` どちらも可（`imgURL()` が変換）。対象ファイルは「リンクを知っている全員が閲覧可」必須。

## デプロイ / ドメイン
- push すれば GitHub Pages が自動反映。独自ドメインは `CNAME`＋DNS（apex A レコード4つ / `www` は CNAME→`sanoryootaa.github.io`）。HTTPSは自動発行。

## よくある依頼の勘所
- 「◯◯を変えられるようにして」= だいたい**スプレッドシートのキー追加**（DEFAULTS + KEY_ALIASES + applyDesign or 描画箇所 + SPEC.md）。
- 「サンプルが見える」= DEFAULTS が空か、初回描画が load 後か確認。
- レイアウト崩れは PC(グリッド) と スマホ(メディアクエリ `max-width:760px`) で別指定。スマホは `!important` 多用。
