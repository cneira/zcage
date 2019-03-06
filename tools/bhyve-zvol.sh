#!/bin/sh
# Convert img to zvol so bhyve could use it as disk
# $1 filename , filename extension should be: .gz, .img or.xz, or raw  
# $2 size for zvol
# $3 zvol name  

if [ $# -lt 3 ]
	then
	echo "you need specify filename, size and zvol name"
	exit 1;
fi 

img=$1
filename=$(basename $1)
fileext=${filename##*.} 
tmp=$(uuidgen)
zvol=/dev/zvol/dsk/$3

function convert {
	img=$1
	fileext=$2
	tmp=$3
	fname=$4	
	case ${fname} in 
	*raw*)
		if [ ${fileext} == 'xz' ]
		 then 
			 xz -dkc ${img} > /zcage/images/${tmp}.raw
			 dd if=/zcage/images/${tmp}.raw of=${zvol} bs=1M
			 rm /zcage/images/${tmp}.raw
		else 
		if [ ${fileext} == 'gz' ]
		then
			name=$(gtar xvfz /zcage/images/${img} -C /zcage/images/)
			dd if=/zcage/images/${name} of=${zvol} bs=1M
			rm /zcage/images/${name}
		fi 
		fi 
		;;
	*qcow2*)
		if [ ${fileext} == 'xz' ]
		 then 
			 xz -dkc ${img} > /zcage/images/${tmp}.qcow2
			 qemu-img convert -f qcow2 -O raw /zcage/images/${tmp}.qcow2  /zcage/images/${tmp}.raw
			 dd if=/zcage/images/${tmp}.raw of=${zvol} bs=1M
			 rm /zcage/images/${tmp}.qcow2
		else 
			if [ ${fileext} == 'gz' ]
		then
			name=$(gtar xvfz /zcage/images/${img} -C /zcage/images/)
			dd if=/zcage/images/${name} of=${zvol} bs=1M
			rm /zcage/images/${name}
		fi 
	fi 
;;
		
esac
}


case ${fileext} in
	qcow2|img)   
		qemu-img convert -f qcow2 -O raw ${img}  /zcage/images/${tmp}.raw
		dd if=/zcage/images/${tmp}.raw of=${zvol} bs=1M
		rm /zcage/images/${tmp}.raw
		;;
	 raw)  	
	       	dd if=${img} of=${zvol} bs=1M 
		;;
	 gz|xz)  convert ${img} ${fileext} ${tmp} ${filename} 
		;;
 
	*)
		echo "Cannot convert: Not a valid image format."
		exit 1;
esac

echo ${zvol}
