# sano ryota works archive — 仕様書

このサイトは **1ファイル（`index.html`）** で動く静的サイトで、内容は Google スプレッドシートから読み込みます。
公開: GitHub Pages `sanoryootaa/portfolio-site` → 独自ドメイン **https://sanoryota.com**（`sanoryootaa.github.io/portfolio-site` も有効）

---

## 1. スプレッドシートの基本ルール

- **A列にキーワード、B列に値**（C列以降は説明用メモでOK／無視されます）。
- 1キー＝1行。値の改行はセル内改行でOK（クレジットや経歴など）。
- **複数タブ対応**：読み込むタブは `index.html` の `SHEET_TABS=["", "profile", "works"]`。
  - `""` … 一番左のシート
  - `profile` … プロフィール・デザイン設定など
  - `works` … 作品（`workN_*`）
  - 後ろのタブが前のタブを上書き。どのタブにどのキーを置いても可。
- キーは**日本語の別名**でも書けます（下表「別名」）。
- 値が空のキーは既定値が使われます。
- 画像URLは Google Drive 共有リンク／`lh3.googleusercontent.com` どちらでも可（自動で表示用に変換）。
  - ※Drive画像は「リンクを知っている全員が閲覧可」にすること。

---

## 2. サイト全体

| キー | 別名 | 内容 |
|---|---|---|
| `site_title` | | タブ名・トップ左の見出し |
| `site_image` | `サイト画像` / `OGP画像` | favicon・リンク共有プレビュー画像（動的反映。SNSの確実な反映はhead直書きが必要） |
| `message` | `メッセージ` | 最下部・左下のメッセージ |
| `message_sparkle` | `キラキラ` | メッセージの演出 on/off。`off`/`0`/`false`/`no`/`オフ`/`なし` でOFF（OFF時はクリック無しで丸出し表示） |

---

## 3. プロフィール

| キー | 内容 |
|---|---|
| `profile_label` | 右上リンクの文言（例: profile here） |
| `profile_name` | 氏名 |
| `profile_role` | 肩書き |
| `profile_about` | ABOUT ME 本文 |
| `profile_career` | CAREER（1行1項目／日付と内容は**全角または半角2つ以上のスペース**で区切る） |
| `profile_awards` | AWARDS（1行1項目、同上） |
| `profile_skills` | SKILLS（1行1項目。日付なし行は行頭から表示） |
| `profile_mail` | メール |
| `profile_instagram` | InstagramのURL |
| `profile_youtube` | YouTubeのURL |
| `profile_photo` | プロフィール写真URL |

---

## 4. 作品（`works` タブ推奨、N=1〜12）

| キー | 内容 |
|---|---|
| `workN_title` | タイトル |
| `workN_category` | カテゴリ |
| `workN_year` | 制作年 |
| `workN_thumb` | サムネ画像URL |
| `workN_video` | 動画（YouTube URL かID） |
| `workN_desc` | 説明文 |
| `workN_credit` | クレジット（役職は末尾に `/`、改行で1行ずつ） |
| `workN_award` | 受賞歴。**入力された作品だけ**サムネにトロフィー🏆がふわふわ漂い、作品ページのカテゴリ下に受賞名を表示 |
| `workN_color` | **fixedモード時**の作品ごとの色（下記カラーモード参照） |

---

## 5. 色

| キー | 別名 | 内容 |
|---|---|---|
| `bg_color` | `背景色` | 背景色 |
| `text_color` | `文字色` | 文字色 |
| `accent_color` | `基調色` | プロフィール/✕印/作品見出しの基調色 |
| `work_colors` | `作品色` | 作品アクセントの**候補色**（カンマ区切り。色数は自由）。空なら既定6色 |
| `color_mode` | `カラーモード` | `random`（既定）／`fixed`（`固定`） |

### カラーモード
- **random**：`work_colors` の候補から、各作品にランダム割り当て。**被りは最小**（各色の使用回数の差が1以下になるよう均等配分してシャッフル）。候補数を増減すれば自動で対応。
- **fixed**：各作品の色を `workN_color` で個別固定。未指定の作品は既定色にフォールバック。

---

## 6. デザイン（字詰め・行間・ウェイト）— イラレ感覚の数値

- **字詰め（letter-spacing）**：トラッキング 1/1000em（例 `50`→0.05em、`-25`→-0.025em）。`em`付きでも可。
- **行間（line-height）**：行送り％（例 `150`→1.5倍）。`1.5` のような倍率も可。
- **ウェイト（font-weight）**：数値（`400`＝標準, `700`＝太字）。

| 区分 | 字詰めキー（別名） | 行間キー（別名） | ウェイトキー（別名） |
|---|---|---|---|
| 全体 | `letter_spacing`（字詰め） | `line_height`（行間） | — |
| 作品タイトル | `title_letter_spacing`（タイトル字詰め） | `title_line_height`（タイトル行間） | `title_weight`（タイトルウェイト） |
| クレジット | `credit_letter_spacing`（クレジット字詰め） | `credit_line_height`（クレジット行間） | `credit_weight`（クレジットウェイト） |
| プロフィール | `profile_letter_spacing`（プロフィール字詰め） | `profile_line_height`（プロフィール行間） | `profile_weight`（プロフィールウェイト） |
| 作品説明文 | `desc_letter_spacing`（説明字詰め） | `desc_line_height`（説明行間） | `desc_weight`（説明ウェイト） |
| 年/カテゴリ ラベル | `label_letter_spacing`（ラベル字詰め） | — | `label_weight`（ラベルウェイト） |

| その他 | 別名 | 内容 |
|---|---|---|
| `label_gap` | `ラベル距離` | 年/カテゴリのサムネ端からの距離（px） |
| `trophy_speed` | `トロフィー速度` | トロフィーの速さ（大きいほど速い。1=標準） |

---

## 7. 挙動メモ（コード上の仕様）

- **ホーム配置**：作品は `layout` 配列の散らばりを基準に、毎回わずかにランダムでずれる（順番は固定、上端はヘッダーに被らないようクランプ）。帯は左右中央に自動整列。
- **年/カテゴリの位置**：毎回ランダム（上下左右の辺＋辺上位置）。年とカテゴリは別の辺、画面端では外側の辺を避ける。
- **スマホ**：作品はランダムな横位置で縦に積む（サイドのラベル分の余白を確保）。詳細/プロフィールはボトムシート風スライドで開閉。
- **詳細/プロフィール**：開いている状態は URLハッシュ（`#work-N` / `#profile`）に記録され、再読み込みで復元。
- **✕ボタン**：カードの右上角に追従し、画面幅でサイズ可変。
- 値が読めない時は既定（サンプル）が表示される。スプレッドシートは公開（リンク閲覧可）必須。

---

## 8. アクセス解析（Google Analytics 4）

- `<head>` に gtag.js を導入。**測定IDの差し替えは `<head>` の GA4 ブロック2か所**（`var GA_ID="..."` と `gtag/js?id=...` の src）。
- プライバシー: `anonymize_ip:true`＋`allow_google_signals:false`。Cookie同意バナーは無し。
- 送信はすべて `gaEv()` 経由＝`typeof gtag==='function'` のときだけ実行（未読込でも落ちない）。
- スクロール深度・エンゲージメント時間は GA4 の**拡張計測機能（標準）**を優先。独自イベントは名前が別で二重計測にならない。

| イベント | プロパティ | 発火タイミング（紐づく既存ハンドラ） |
|---|---|---|
| `page_view` | 自動 | gtag `config`（来訪者数・PV・参照元・国・デバイス） |
| `work_open` | work_title / work_category / work_date | `openDetail()`（作品ポップアップを開く）＝作品別閲覧数 |
| `engaged_browsing` | — | `openDetail()`（1訪問で work_open 2回目に1回だけ） |
| `about_open` | — | `openProfile()` |
| `video_play` | work_title | `playVideo()`（再生ボタン＝autoplayを再生開始とみなす。IFrame APIは未使用） |
| `contact_click` | label（mail） | プロフィール contact の mail リンク |
| `sns_click` | platform（instagram / youtube） | プロフィールの各SNSリンク |
| `scroll_bottom` | — | 最下部メッセージ枠を IntersectionObserver で検知（1回のみ） |

**作品別閲覧数の見方**: GA4 → レポート → エンゲージメント → イベント → `work_open`。`work_title` 別に見るには、管理 → カスタム定義でイベントパラメータ `work_title` をカスタムディメンション登録 → 「探索」で分解。

## 9. 独自ドメイン / GitHub Pages

- リポジトリ直下に `CNAME`（中身 `sanoryota.com`）。GitHub Pages の Custom domain が自動設定される。
- DNS: apex は A レコード（`185.199.108.153` / `.109` / `.110` / `.111`）、`www` は CNAME → `sanoryootaa.github.io`。
- HTTPS（Let's Encrypt）は DNS 反映後に自動発行 → Settings > Pages で **Enforce HTTPS** を有効化。

---

最終更新は git 履歴を参照。
