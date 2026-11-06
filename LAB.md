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
