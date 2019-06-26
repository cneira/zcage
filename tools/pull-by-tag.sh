#!/bin/sh
# Download docker image
# $1 distro , for example : ubuntu, alpine, etc..
# $2 image tag , for example : latest
# pull-by-tag.sh  ubuntu latest
# JQ is needed for now, https://github.com/stedolan/jq/releases/download/jq-1.4/jq-solaris11-64
JQ=jq-solaris11-64

if [ $# -lt 2 ]; then
  echo "you need to specify library, tag and destination.\nfor example :" \
    "\npull-by-tag.sh library/alpine latest"
    "\npull-by-tag.sh gitea/gitea latest"
  exit 1
fi
NAME=$(echo ${1} | cut -d/ -f2)
IMAGE="/zcage/images/docker-$NAME-${2}-$(uuidgen).gz"
IMAGEDIR="/tmp/docker-$NAME-${2}-$(uuidgen)"
blobsums="/tmp/blobsums-$(uuidgen).txt"
blobs="/tmp/blobs-$(uuidgen).txt"
TMPDIR=/tmp/$(uuidgen)
mkdir $TMPDIR
mkdir $IMAGEDIR

export TOKEN="$(
  curl \
    --silent \
    --header 'GET' \
    "https://auth.docker.io/token?service=registry.docker.io&scope=repository:${1}:pull&service=registry.docker.io" |
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
    >"/tmp/${BLOBSUM}.gz"  
  gtar xfvz "/tmp/${BLOBSUM}.gz"  -C ${IMAGEDIR} > /dev/null 
  rm "/tmp/${BLOBSUM}.gz"
done <$blobsums


gtar cfvz  ${IMAGE} -C ${IMAGEDIR} .  > /dev/null

# Clean up
rm $blobsums
rm -rf ${IMAGEDIR}
rm -rf ${TMPDIR}

echo $IMAGE
