# sano ryota works archive — 仕様書

静的サイト（ビルド不要）。内容は `content/*.json` に入っていて、**自作の管理画面 https://sanoryota.com/admin** で編集します。
公開: GitHub Pages `sanoryootaa/portfolio-site` → 独自ドメイン **https://sanoryota.com**（`sanoryootaa.github.io/portfolio-site` も有効）

> **公開前（今）**：`/` は旧サイト（スプシ読み込み）のまま。新しいホームは隠しURL **`/home.html`**（検索除外）。作品・プロフィール・管理画面は新しいもの。

---

## 1. 編集のしかた（管理画面 `/admin`）

**流れ：編集 → プレビューで確認 → 下書き保存 → 公開**
1. **編集**：入力したそばから右側（スマホは下の「プレビュー」）に実際のサイトが映る。PC表示／スマホ表示を切り替え可。保存前でも映る。
2. **下書き保存**：GitHub の `draft` ブランチに保存。公開サイトには出ない。別の端末から続きができる。
3. **公開…**：変更点の一覧を確認してから `main` に反映（1〜2分でサイトに出る）。
- 上部の表示：🟡 未保存の変更あり ／ ⚪ 下書きあり（未公開）／ 🟢 公開中と同じ。
- 保存していない編集はその端末に自動で残る（閉じても続きから）。別端末で下書きが更新されていたら、どちらを使うか聞かれる。
- **画像**：ドラッグ＆ドロップ／選択でアップロード。ブラウザで長辺2000pxのJPEGに縮小してから `media/` に保存（公開するまでは参照されない）。
- **並べ替え**：作品・クレジット・経歴・画像は ⋮⋮（画像はそのもの）をドラッグ。指でもOK。
- **文字組み**：エリアごと（サイト名／ホームのラベル／作品名・氏名／ジャンル・受賞・肩書き／見出し／About日・英／クレジット／プロフィールの一覧）に、サイズ(px)・行送り(%)・トラッキング(1/1000em)・カーニング(メトリクス/0)・ウェイト・プロポーショナル(palt)。アイコンを左右ドラッグで増減、入力欄で ↑↓（Shift で10倍）。
- **ログイン**：初回だけ GitHub の Fine-grained トークン（このリポジトリだけ・Contents: Read and write）を貼る。トークンはその端末のブラウザに保存。期限切れ・ログアウト時は貼り直し。スマホも同じ。

### 表記ルール
- **日英バイリンガルは About 本文だけ**（`about_ja` → `about_en` の順に縦に積む）。他は英語のみ。
- 色は作品・プロフィールとも **#ffffff（白）のみ**。作品ごとの色・グレーは使わない。
- 英語の大文字：**タイトル・ジャンル・役職・見出しなど、2語以上の名前は各単語の頭文字を大文字**（例: `Projection Mapping`, `Color Grading & Edit`, `Works Archives`）。`of` `&` などの小さい語は小文字。About本文・経歴などの**文章は先頭だけ大文字**。略語（`3DCG` など）はそのまま。
- 文字組みは管理画面の「文字組み」で調整（未設定のエリアは一般的な組み＝15px・行送り160%など）。

---

## 2. ページ構成

| ページ | URL | 内容 |
|---|---|---|
| ホーム | `/`（公開前は `/home.html`）| 作品サムネの散らばり配置＋年/ジャンルのラベル＋受賞作のトロフィー。最下部にメッセージ |
| 管理 | `/admin` | 自作の管理画面（検索除外）|
| 作品 | `/work.html?id=<URL名>` | 黒背景・白文字のみ。タイトル → ジャンル/制作年 → 受賞歴 → About → 画像 → 動画 → クレジット |
| プロフィール | `/profile.html` | 黒背景・白文字のみ。氏名・肩書き・写真 → About → Career → Awards → Skills → Contact |

- 旧URL `/#work-N`・`/#profile` は新ページへ自動転送。
- フォント：英字=Helvetica、日本語=游ゴシック（全ページ共通 `assets/site.css`）。
- 見出しは `(About)` `(Credit)` のように丸括弧で囲む。
- ✕（ホームへ戻る）は小さめの白。開いた瞬間は右上にいて、約1秒後からゆっくり回りながら画面内を漂う（どこにいてもクリックで閉じる）。フィルムのちらつきのように不規則に明滅。
- 作品ページの受賞歴は、元の位置から文字列が龍のように連なって飛び立ち、画面内を飛びまわる（読み上げ用に元の文字は非表示で残す）。
- 「動きを減らす」設定の端末では ✕・龍・ちらつきは止まる。

---

## 3. データ（`content/`）

### works.json — 作品（上から順にホームに並ぶ。13件目以降は配置パターンが下に繰り返す）
| キー | 内容 |
|---|---|
| `title` | タイトル（バイリンガル不要） |
| `slug` | URL名（半角英数字とハイフン） |
| `category` | ジャンル |
| `year` | 制作年 |
| `award` | 受賞歴。入力した作品だけホームでトロフィーが漂う |
| `about_ja` / `about_en` | About 本文（日→英の順に縦積み） |
| `thumb` | サムネ画像（ホーム・動画のポスター） |
| `images` | 作品ページに並ぶ画像（複数） |
| `video` | YouTube URL |
| `credits` | `[{role, names[]}]`。左に役職・右に名前（名前が多いと右側で段組み。スマホは役職の下に2列）|

### profile.json — プロフィール
`label`（ホーム右上の文言）, `name`, `role`, `photo`, `about_ja` / `about_en`,
`career` / `awards`: `[{date, text}]`（date 空なら行頭から）, `skills`: 文字列のリスト, `mail`, `instagram`, `youtube`

### site.json — サイト設定
- `typography.<エリア>`: `{size, weight, leading, tracking, kerning, palt}`（エリアと既定値は `assets/site.js` の `TYPO_AREAS`）
| キー | 内容 |
|---|---|
| `title` | サイトタイトル |
| `message` / `message_sparkle` | ホーム最下部のメッセージ / キラキラ演出 on/off |
| `trophy_speed` | トロフィーの速さ（1=標準） |

### 固定ファイル
- `media/site/favicon.png`（タブのアイコン・ホーム右上の点滅アイコン）、`media/site/ogp.jpg`（リンク共有時のプレビュー）。差し替えは同名で上書き。

---

## 4. アクセス解析（Google Analytics 4）

- `assets/site.js` 冒頭の `GA_ID` 1か所で全ページに読み込み。`anonymize_ip:true`＋`allow_google_signals:false`。Cookie同意バナーは無し。
- 送信はすべて `gaEv()` 経由（gtag未読込でも落ちない）。ページごとの `page_view` は自動。

| イベント | プロパティ | 発火 |
|---|---|---|
| `work_open` | work_title / work_category / work_date | 作品ページを開いた |
| `engaged_browsing` | — | 1訪問（タブ）で2作品目を開いたとき1回 |
| `about_open` | — | プロフィールページを開いた |
| `video_play` | work_title | 作品ページの再生ボタン |
| `contact_click` | label（mail） | プロフィールのメール |
| `sns_click` | platform（instagram / youtube） | プロフィールのSNS |
| `scroll_bottom` | — | ホーム最下部のメッセージが見えた（1回） |

作品別閲覧数：GA4 → レポート → エンゲージメント → イベント → `work_open`（`work_title` をカスタムディメンション登録して分解）。

## 5. 独自ドメイン / GitHub Pages

- リポジトリ直下に `CNAME`（`sanoryota.com`）。DNS: apex は A レコード（`185.199.108.153` / `.109` / `.110` / `.111`）、`www` は CNAME → `sanoryootaa.github.io`。HTTPS は自動。
