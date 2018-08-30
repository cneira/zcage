# Zcage

Zcage is a container manager for Illumos based distributions inspired by FreeBSD's iocage and SmartOS's vmadm.
It's intended to be easy to use with a simple command line syntax.
To use zcage you need an user account with Primary administrator role


## Installation

  Currently there is a bug in npm 5.X so npm 4.X must be used to install https://github.com/npm/npm/issues/16766

  *  npm install npm@4 -g

  *  npm install zcage -g

## Quickstart

* zcage needs to be activated before any container could be created, it will create all the needed datasets for zone management.

```bash
# zcage activate
```
## EXAMPLES
First we need to setup a nic for containers to use, in this case we will create a vnic.
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
* List locally available linux images to create containers

```bash
# zcage images --list local
UUID                                            NAME                            VERSION         OS                      PUBLISHED
96bb1fac-c87d-11e5-b5bf-ff4703459205             alpine-3                        20160201        linux           2016-02-01T00:49:02Z
```
* Pull a linux image to create containers

```bash
# zcage pull --image  96bb1fac-c87d-11e5-b5bf-ff4703459205
```
* To create a lxbrand container, you need to specify the image to use and brand as lx

```bash
# zcage create --net "vnic0|192.168.1.225/24|192.168.1.1" --ram 2gb  --with-image 96bb1fac-c87d-11e5-b5bf-ff4703459205 --alias lxvm --brand lx
```
Now you can reference the container by it's alias test07. If you don't provide an alias a UUID will be generated for the container.

* Update the container to allow it to use more ram if needed and restrict maximum lwps to 3000

```bash
# zcage rctl -z test07 --ram 6gb --max-lwps 3000
```
* Destroy the container (cannot be undone)

```bash
# zcage destroy -z test07
```
* List containers

```bash
#zcage list
UUID                                     TYPE           STATE            ALIAS
2ff83af6-01a3-622a-e831-f65966465624     OS             stopped          nodejs
ecc9627e-6515-cd96-9fd0-b06973e4423f     OS             stopped          test07
2585e1a7-ef50-eb1d-e85b-cbf5631ced5e     OS             stopped          test08
c53b4cb4-f970-6d07-e64b-916c7fa23fc6     OS             stopped          test09
```

##  Demo

[![asciicast](https://asciinema.org/a/189466.png)](https://asciinema.org/a/189466)

## Bhyve Demo

[![asciicast](https://asciinema.org/a/189466.png)](https://asciinema.org/a/QLnjO8J2NVVPQrs3jh0EKEGta)


## FEATURES

* Ease of use
* Resource control
* Exclusive IP networking by default
* Supports for brands sparse, bhyve and lx.


## TODO

* Check if host memory allows it to create more zones.
* Create zones using a json file.
* Improve info command to obtain more information from zones.
