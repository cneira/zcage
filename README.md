# Zcage

Zcage is a zone manager for illumos based distributions inspired by FreeBSD's iocage and SmartOS's vmadm.
It's intended to be easy to use with a simple command line syntax.
To use zcage you need an user account with Primary administrator role.  

****Zcage only has been tested in OmniOSce.****
   

## Installation

  Currently there is a bug in npm 5.X so npm 4.X must be used to install https://github.com/npm/npm/issues/16766

  *  npm install npm@4 -g

  *  npm install zcage -g


## Options when creating a zone

### ram (brand: ALL , not required, defaults to 1GB)  

* Assigns maximum amount of memory allowed for the container to use.

### net (brand: ALL , required)   

* Configures network for zone format is vnic|ip/mask|gateway

### alias (brand: ALL, not required, defaults to UUID v4) 

* Sets the zone name for later reference instead of UUID v4.

### quota (brand: ALL, not required) 

* Sets disk quota for zone.

### limitpriv (brand: ALL, not required)

* Adds privileges to a zone, priveleges must be comman separated values. 

### fs-allowed (brand: ALL, not required)

* Allows file system mounts other than the default
  
### with-image (brand: LX, required)

* Uses the image specified when creating a zone.

### disk (brand: BHYVE, required)

* Sets the disk that bhyve will use to start the vm.

### autoboot (brand: ALL, not required, defaults to false)

* Sets if a zone should be started at boot.

### brand (brand: ALL, not required, defaults to sparse)

*  Sets the zone brand for zone creation.

### cdrom (brand: BHYVE, not required)

* Specifies iso to use when booting a bhyve vm)

### hostbridge (brand: BHYVE, not required, defaults to intel)

* Specifies which hostbridge should bhyve present to the guest.

### cpu (brand: BHYVE, not required, defaults to 1)

* Specified the number of cpus the vm will use.

## Quickstart

* zcage needs to be activated before any zone could be created, it will create all the needed datasets for zone management.

```bash
# zcage activate
```
## EXAMPLES
First we need to setup a virtual nic for zones using dladm.
Currently each container need to have a different vnic otherwise it won't start.

```bash
# dladm create-vnic -l igb0 omni0
```
* Create a container using virtual network interface _vnic0_ using ip: 192.168.1.225/network mask and 192.168.1.1 as gateway and memory capped to use 2GB of RAM.

```bash
# zcage create --alias=test07 --net "vnic0|192.168.1.225/24|192.168.1.1" --ram 2gb
```
* Update the capped memory of the previously defined zone and also set/update a disk quota
```
# zcage update -z test07 --ram 4gb --quota 16G
```

* List remotely available linux images from Joyent

```bash
# zcage images --list  avail
UID                                            NAME                            VERSION         OS                      PUBLISHED
f7c19252-c998-11e4-be95-3315493f3741             lx-centos-6                     20150313        linux           2015-03-13T15:52:35Z
818cc79e-ceb3-11e4-99ee-7bc8c674e754             lx-ubuntu-14.04                 20150320        linux           2015-03-20T03:45:09Z
116deb8c-cf03-11e4-9b2d-7b1066800a6a             lx-debian-7                     20150320        linux           2015-03-20T13:14:41Z
eb4128ec-cf12-11e4-960d-8780cec6463f             lx-centos-6                     20150320        linux           2015-03-20T15:08:0
```
* List locally available linux images to create lx branded zones.

```bash
# zcage images --list local
UUID                                            NAME                            VERSION         OS                      PUBLISHED
96bb1fac-c87d-11e5-b5bf-ff4703459205             alpine-3                        20160201        linux           2016-02-01T00:49:02Z
```
# LX branded zones

* First you need install the lx brand package in OmniOSce:

```bash
# pkg install pkg:/system/zones/brand/lx
```
* Pull a linux image to create a lx branded zone

```bash
# zcage pull --image  96bb1fac-c87d-11e5-b5bf-ff4703459205
```
* To create a lx branded zone, you need to specify the image to use and brand as lx

```bash
# zcage create --net "vnic0|192.168.1.225/24|192.168.1.1" --ram 2gb  --with-image 96bb1fac-c87d-11e5-b5bf-ff4703459205 --alias lxvm --brand lx
```
Now you can reference the container by it's alias test07. If you don't provide an alias a UUID will be generated.

* Update the zone to allow it to use more ram if needed and restrict maximum lwps to 3000

```bash
# zcage rctl -z test07 --ram 6gb --max-lwps 3000
```
* Destroy the container (cannot be undone)

```bash
# zcage destroy -z test07
```
* List zones

```bash
# zcage list
UUID                                     TYPE           STATE            ALIAS
2ff83af6-01a3-622a-e831-f65966465624     OS             stopped          nodejs
ecc9627e-6515-cd96-9fd0-b06973e4423f     OS             stopped          test07
2585e1a7-ef50-eb1d-e85b-cbf5631ced5e     OS             stopped          test08
c53b4cb4-f970-6d07-e64b-916c7fa23fc6     OS             stopped          test09
```
* General information about zone

```bash
# zcage info -z test07
{
    "memory": {
        "zone.max-physical-memory": "2147483648",
        "zone.max-locked-memory": "2147483648",
        "zone.max-swap": "2147483648"
    },
    "base-data": {
        "name": "omniosbuilds",
        "zonepath": "/zcage/vms/omniosbuilds",
        "autoboot": "false",
        "brand": "sparse",
        "ip-type": "exclusive",
        "fs-allowed": "ufs",
        "limitpriv": "default,dtrace_user,dtrace_proc",
        "debugid": "27"
    },
    "network": {
        "allowed-address": "192.168.1.205/24",
        "physical": "net4",
        "defrouter": "192.168.1.1"
    },
    "data": {
        "resolvers": "8.8.8.8,8.8.8.4"
    }
}

```
# Bhyve branded zones

First you need install bhyve and bhyve brand packages in OmniOSce:

```bash
# pfexec pkg install system/bhyve
```
And also the bhyve brand
```bash
# pfexec pkg install system/zones/brand/bhyve  
```

To create a bhyve branded zone, first we need to create a disk for it to use:

```bash
# zfs create -V 30G rpool/vm0
```
Then create the zone using the newly created disk and an iso to boot from.

```bash
# zcage create --net "net6|192.168.1.207/24|192.168.1.1" --ram 2gb  --alias bhyve0 --brand bhyve --cdrom=/home/neirac/isos/debian\-9.5.0\-amd64\-netinst.iso  --disk=rpool/vm0
```
Then you could connect to the newly created bhyve vm using vnc, to obtain the
port just use the info command.

```bash
#zcage info -z bhyve0
{
    "memory": {
        "zone.max-physical-memory": "2147483648",
        "zone.max-locked-memory": "2147483648",
        "zone.max-swap": "4294967296",
        "zone.cpu-shares": "4096",
        "zone.max-lwps": "3000"
    },
    "base-data": {
        "name": "bhyve0",
        "zonepath": "/zcage/vms/bhyve0",
        "autoboot": "false",
        "brand": "bhyve",
        "ip-type": "exclusive",
        "debugid": "178"
    },
    "network": {
        "allowed-address": "192.168.1.206/24",
        "physical": "net6",
        "defrouter": "192.168.1.1"
    },
    "bhyve_data": {
        "resolvers": "8.8.8.8,8.8.8.4",
        "quota": "32G",
        "hostbridge": "intel",
        "vnc": "unix=/tmp/cf8848db-c3cf-494f-b43c-927a44e41dbe.vnc",
        "vnc-port": "5920",
        "bootrom": "BHYVE_DEBUG",
        "vcpus": "1",
        "ram": "2gb",
        "bootdisk": "rpool/vm0"
    }
}
```

##  Demo

[![asciicast](https://asciinema.org/a/189466.png)](https://asciinema.org/a/189466)

## Bhyve Demo

[![asciicast](https://asciinema.org/a/189466.png)](https://asciinema.org/a/QLnjO8J2NVVPQrs3jh0EKEGta)


## FEATURES

* Resource control
* Exclusive IP networking by default
* Supports for brands sparse, ipkg, lipkg, bhyve and lx.


## TODO

* Improve info command to obtain more information from zones.
* Check if a vnc port is already used by a bhyve branded zone.
* Add boot order flag for bhyve zones.
* Import docker images for lx zones.
* Check if ip is already in use by a zone.
* Add tests
