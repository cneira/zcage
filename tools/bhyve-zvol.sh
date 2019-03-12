#!/bin/sh
# This script will be called when a zone is installed and --with-image option
# is used.
# $1 filename value from --with-image: valid file extensions: .gz, .img
# or.xz, or raw
# $2 size for zvol : quota value from zone definition.
# $3 zvol name: disk value from zone definition by default will be pool/zname

if [ $# -lt 3 ]; then
  echo "you need specify image name, zvol size and zvol name"
  exit 1
fi

# full path for physical device.
zvol=/dev/zvol/rdsk/$3
# where the zvol will be created.
zpool=$3
# $1 filename value from --with-image: filename extension should be: .gz, .img
img=$1
# file name without path.
filename=$(basename $1)
# file extension to decide how to procede.
fileext=${filename##*.}
# tmp file that will be used for decompression
tmp=$(uuidgen)
# $2 size for zvol : quota value from zone definition.
volsize=$2

# Will catch last command return value
# and exit if not 0

catch_error() {
  rc=$1
  reason=$2
  if [ ${rc} -ne 0 ]; then
    printf "Error:errcode: %d reason: %s" ${rc} ${reason}
    exit -1
  fi
}

# convert
# Description:
# 	When image is compressed, we decompress and write to zvol
# Params:
# $1  : image name
# $2  : file extension of image
# $3  : tmp file name to use for decompression and writing
# $4  : file name without path

convert() {
  img=$1
  fileext=$2
  tmp=$3
  fname=$4

  case ${fname} in
    *raw*)
      if [ ${fileext} == 'xz' ]; then
        err=$(xz -dkc ${img} >/zcage/images/${tmp}.raw)
        catch_error $? ${err}
        err=$(qemu-img convert -f raw -O host_device /zcage/images/${tmp}.raw ${zvol})
        catch_error $? ${err}
        rm /zcage/images/${tmp}.raw
      else
        if [ ${fileext} == 'gz' ]; then
          name=$(gtar xvfz /zcage/images/${img} -C /zcage/images/)
          catch_error $? ${name}
          err=$(qemu-img convert -f qcow2 -O host_device /zcage/images/${name} ${zvol})
          catch_error $? ${err}
          rm /zcage/images/${name}
        fi
      fi
      ;;
    *qcow2*)
      if [ ${fileext} == 'xz' ]; then
        err=$(xz -dkc ${img} >/zcage/images/${tmp}.qcow2 2>&1)
        catch_error $? ${err}
        err=$(qemu-img convert -f qcow2 -O host_device /zcage/images/${tmp}.qcow2 ${zvol})
        catch_error $? ${err}
        rm /zcage/images/${tmp}.qcow2
      else
        if [ ${fileext} == 'gz' ]; then
          name=$(gtar xvfz /zcage/images/${img} -C /zcage/images/)
          catch_error $? ${name}
          err=$(qemu-img convert -f qcow2 -O host_device /zcage/images/${name} ${zvol})
          catch_error $? ${err}
          rm /zcage/images/${name}
        fi
      fi
      ;;

  esac
}


# Process image and create zvol

ok=$(zfs create -V ${volsize} ${zpool})
catch_error $? ${ok}

case ${fileext} in
  qcow2)
    err=$(qemu-img convert -f qcow2 -O host_device ${img} ${zvol})
    catch_error $?  ${err}
    ;;
  raw)
    err=$(qemu-img convert -f raw -O host_device ${img} ${zvol})
    catch_error $?  ${err}
    ;;
  gz | xz)
    convert ${img} ${fileext} ${tmp} ${filename}
    ;;
   img)
    err=$(qemu-img convert -f qcow2 -O host_device ${img} ${zvol})
    catch_error $?  ${err}
    ;;

  *)
    echo "Cannot convert: Not a valid image format."
    exit 1
    ;;
esac

exit 0
