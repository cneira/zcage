#!/bin/sh
# Download docker image
# $1 distro , for example : ubuntu, alpine, etc..
# $2 image tag , for example : latest
# pull-by-tag.sh  ubuntu latest
# JQ is needed for now, https://github.com/stedolan/jq/releases/download/jq-1.4/jq-solaris11-64
JQ=jq-solaris11-64

if [ $# -lt 2 ]; then
  echo "you need to specify library, tag and destination.\nfor example :" \
    "\npull-by-tag.sh alpine latest"
  exit 1
fi

IMAGE="/zcage/images/$1-$2-$(uuidgen).gz"
blobsums="/tmp/blobsums-$(uuidgen).txt"

export TOKEN="$(
  curl \
    --silent \
    --header 'GET' \
    "https://auth.docker.io/token?service=registry.docker.io&scope=repository:${1}:pull" |
    $JQ -r '.token'
)"

curl \
  --silent \
  --request 'GET' \
  --header "Authorization: Bearer ${TOKEN}" \
  "https://registry-1.docker.io/v2/${1}/manifests/${2}" |
  $JQ -r '.fsLayers[].blobSum' >$blobsums


while read BLOBSUM; do
  pfexec curl \
    --silent \
    --location \
    --request 'GET' \
    --header "Authorization: Bearer ${TOKEN}" \
    "https://registry-1.docker.io/v2/${1}/blobs/${BLOBSUM}" \
    >$IMAGE
done <$blobsums

# Clean up
#rm $blobsums

echo $IMAGE
