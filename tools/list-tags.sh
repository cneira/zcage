# This script will list images by library, for example
# list-tags.sh alpine
#
#!/bin/sh
# JQ is needed for now, https://github.com/stedolan/jq/releases/download/jq-1.4/jq-solaris11-64
JQ=jq-solaris11-64

if [ $# -eq 0 ]; then
  echo "you need to specify where to search for tags.\nfor example :" \
    "\nlist-tags.sh alpine "
  exit 1
fi

export TOKEN="$(
  curl \
    --silent \
    --header 'GET' \
    "https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/${1}:pull" |
    $JQ -r '.token'
)"

curl --silent -H "Authorization: Bearer ${TOKEN}" https://registry-1.docker.io/v2/library/${1}/tags/list | $JQ '.'
