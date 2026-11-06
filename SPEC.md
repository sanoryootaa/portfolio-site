# sano ryota works archive — 仕様書

静的サイト（ビルド不要）。内容は `content/*.json` に入っていて、**管理画面 Pages CMS** で編集します。
公開: GitHub Pages `sanoryootaa/portfolio-site` → 独自ドメイン **https://sanoryota.com**（`sanoryootaa.github.io/portfolio-site` も有効）

---

## 1. 編集のしかた（管理画面）

1. **https://sanoryota.com/admin** を開く（スマホは「ホーム画面に追加」推奨）
2. 「作品」「プロフィール」「サイト設定」「画像」から直接 Pages CMS の編集画面へ（初回だけ GitHub ログイン）
3. 編集して保存 → 1〜2分でサイトに反映
- 作品・クレジット・経歴は折りたたみ表示（「2025　かいまみ」のように一覧で見える）。クリックで開く・ドラッグで並べ替え。
- 編集先ブランチは `admin/index.html` の `BRANCH`（公開後は `main`）。
- 画像は管理画面からアップロード（`media/` に保存される）。Driveの共有設定は不要。
- 保存ごとに履歴（git）が残るので元に戻せる。

### 表記ルール
- **日英バイリンガルは About 本文だけ**（`about_ja` → `about_en` の順に縦に積む）。他は英語のみ。
- 色は作品・プロフィールとも **#ffffff（白）のみ**。作品ごとの色・グレーは使わない。
- 英語は**頭文字だけ大文字、他は小文字**（固有名詞・略語は除く。例: `Projection mapping`, `Color grading & edit`, `3DCG`）。
- 文字詰め・行間・ウェイトの設定は無し（一般的な組みで固定。調整はCSS側で行う）。

---

## 2. ページ構成

| ページ | URL | 内容 |
|---|---|---|
| ホーム | `/` | 作品サムネの散らばり配置＋年/ジャンルのラベル＋受賞作のトロフィー。最下部にメッセージ |
| 管理 | `/admin` | Pages CMS の各編集画面への入口（検索除外）|
| 作品 | `/work.html?id=<URL名>` | 黒背景・白文字のみ。タイトル → ジャンル/制作年 → 受賞歴 → About → 画像 → 動画 → クレジット |
| プロフィール | `/profile.html` | 黒背景・白文字のみ。氏名・肩書き・写真 → About → Career → Awards → Skills → Contact |

- 旧URL `/#work-N`・`/#profile` は新ページへ自動転送。
- フォント：英字=Helvetica、日本語=游ゴシック（全ページ共通 `assets/site.css`）。
- 見出しは `(About)` `(Credit)` のように丸括弧で囲む。
- ✕（右上・ホームへ戻る）は小さめの白で、フィルムのちらつきのように不規則に明滅する。

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
| `credits` | `[{role, names[]}]`。役職の後ろに ` /` を付けて縦に積む |

### profile.json — プロフィール
`label`（ホーム右上の文言）, `name`, `role`, `photo`, `about_ja` / `about_en`,
`career` / `awards`: `[{date, text}]`（date 空なら行頭から）, `skills`: 文字列のリスト, `mail`, `instagram`, `youtube`

### site.json — サイト設定
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
