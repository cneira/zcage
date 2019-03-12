#!/bin/sh
# This will create a cloud-init config based on the customer_metadata key from
# zcage's zone definition
# customer_data: is the cloud-config file
#	    https://cloudinit.readthedocs.io/en/latest/topics/examples.html
# Params:
# $1 =  customer_data
# $2 =  zone data set to store data.
# JQ is needed for now, https://github.com/stedolan/jq/releases/download/jq-1.4/jq-solaris11-64
JQ=jq-solaris11-64

if [ $# -lt 1 ]; then
	echo "Error: a cloud-init config data needs to be specified"
	exit 2
fi

# file will store the cloud-init config data specified by user
# We need a user-data and a meta-data file.
# meta-data contains host identification information

json=$1
# user-data and meta-data will used zone configuration
zonepath=$(echo ${json} | $JQ .zonepath)
datapath=$(sed -e 's/^"//' -e 's/"$//' <<< ${zonepath})
meta=${datapath}/root/meta-data
user=${datapath}/root/user-data
echo $zonepath
netmask=$(echo ${json} | $JQ .net | $JQ '.[]' | $JQ .netmask)
echo $netmask
address=$(echo ${json} | $JQ .net | $JQ '.[]' | $JQ .address)
echo $address
gateway=$(echo ${json} | $JQ .net | $JQ '.[]' | $JQ .gateway)
echo $gateway
instanceid=$(echo ${json} | $JQ .alias | sed -e 's/^"//' -e 's/"$//')
echo $instanceid
localhostname=${instanceid}
echo $localhostname
resolvers=$(echo ${json} | $JQ -c .resolvers )

nameservers=$(for i in $(echo ${json} | $JQ .resolvers | $JQ '.[]' | sed -e 's/^"//' -e 's/"$//');do 
	  	   printf "echo nameserver %s >> /etc/resolv.conf ;" ${i}; done)

echo "runcmd :" "${nameservers}"

udata=$(echo ${json} | $JQ -r .udata)
echo "udata is :" ${udata}
uid=$(cat ${udata} | $JQ -r .userid)

pubkey=$(cat ${udata} | $JQ -r .pubkey)

nic=$(echo ${json} | $JQ -r .cloud_nic)
echo  ${uid}
echo ${pubkey}

cat <<EOF > ${meta}
instance-id: ${instanceid};
local-hostname: ${instanceid}
network-interfaces: |
  auto ${nic}
  iface ${nic} inet static
  address $(sed -e 's/^"//' -e 's/"$//' <<< ${address})
  netmask $(sed -e 's/^"//' -e 's/"$//' <<< ${netmask})
  gateway $(sed -e 's/^"//' -e 's/"$//' <<< ${gateway})
EOF

cat <<EOF > ${user}
#cloud-config
 users:
   - default
   - name:  ${uid} 
#     ssh_import_id: ${uid}
     sudo: ALL=(ALL) NOPASSWD:ALL
     shell: /bin/bash   
     lock_passwd: false
     ssh_authorized_keys:
       - ${pubkey}  
 runcmd:
     - rm /etc/resolv.conf ;  ${nameservers}  
EOF


# Create disc to be used by vm

mkisofs -o ${datapath}/root/config.iso -V cidata -J -rock  ${user} ${meta}
