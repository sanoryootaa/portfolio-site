#!/bin/sh
# CSS/JS を変えたら実行：各ページの ?v= を今の日時に更新して、ブラウザの古いキャッシュを使わせない
cd "$(dirname "$0")/.." || exit 1
V=$(date +%Y%m%d%H%M)
sed -i '' -E "s#\?v=[0-9]+#?v=$V#g" home.html work.html profile.html admin/index.html stage/index.html
echo "v=$V"
