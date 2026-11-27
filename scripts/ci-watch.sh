#!/usr/bin/env bash
# Attend la CI de main pour un commit (HEAD par défaut) et affiche les tests en échec.
set -uo pipefail

sha=$(git rev-parse "${1:-HEAD}") || exit 1
id=
for _ in $(seq 60); do
  id=$(gh run list --branch main --workflow ci.yml --commit "$sha" --limit 1 --json databaseId --jq '.[0].databaseId // empty')
  [[ -n $id ]] && break
  sleep 2
done
if [[ -z $id ]]; then
  echo "Aucune CI de main pour ${sha:0:7} (commit poussé sur main ?)." >&2
  exit 1
fi

gh run watch "$id" --exit-status --interval 20 >/dev/null
conclusion=$(gh run view "$id" --json conclusion --jq .conclusion)
url=$(gh run view "$id" --json url --jq .url)
case $conclusion in
  success)
    echo "CI verte : ${sha:0:7}"
    exit 0
    ;;
  cancelled)
    echo "CI de ${sha:0:7} remplacée par une plus récente : relancer sur origin/main." >&2
    exit 1
    ;;
esac
gh run view "$id" --log-failed | sed -E 's/^[^\t]*\t[^\t]*\t[0-9TZ:.-]+ //' | grep -E '✘|Error|[0-9]+ failed' | head -40
echo "CI ROUGE (${sha:0:7}) : la corriger maintenant, avant toute autre tâche. $url" >&2
exit 1
