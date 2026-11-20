#!/bin/zsh
# Compila Not Stop y la publica en GitHub Pages (rama gh-pages).
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.local/node-dl/node-v22.23.5-darwin-arm64/bin:$PATH"
npm test
npm run build
touch dist/.nojekyll
TMP=$(mktemp -d)
cp -R dist/. "$TMP"
cd "$TMP"
git init -q -b gh-pages
git config user.name "$(git -C "$OLDPWD" config user.name)"
git config user.email "$(git -C "$OLDPWD" config user.email)"
git add -A
git commit -q -m "Publicación $(date '+%Y-%m-%d %H:%M')"
git push -q -f "$(git -C "$OLDPWD" remote get-url origin)" gh-pages
cd - > /dev/null
rm -rf "$TMP"
echo "Publicado: https://regdz1997.github.io/not-stop/"
