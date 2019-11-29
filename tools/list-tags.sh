# This script will list images by library, for example
# list-tags.sh alpine
# list-tags.sh gitea/gitea latest
#
#!/bin/sh
# JQ is needed for now, https://github.com/stedolan/jq/releases/download/jq-1.4/jq-solaris11-64
#JQ=jq-solaris11-64
JQ=jq
if [ $# -eq 0 ]; then
  echo "you need to specify where to search for tags.\nfor example :" \
    "\nlist-tags.sh library/alpine latest"
    "\nlist-tags.sh gitea/gitea latest"
  exit 1
fi

export TOKEN="$(
  curl \
    --silent \
    --header 'GET' \
    "https://auth.docker.io/token?service=registry.docker.io&scope=repository:${1}:pull&service=registry.docker.io" |
    $JQ -r '.token'
)"

curl --silent -H "Authorization: Bearer ${TOKEN}" https://registry-1.docker.io/v2/${1}/tags/list | $JQ '.'
