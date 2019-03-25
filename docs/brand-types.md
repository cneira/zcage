
# Brand Types

zcage supports the following zone brands:

* sparse (default)
* ipkg
* lipkg
* lx
* bhyve
* kvm

All brand types have specific benefits and drawbacks, serving a variety
of unique needs. This section describes and has creation examples for
each of these brand types.

  
Sparse (default)
----------------

Sparse zones are created by default if ***--type*** is not specified. 
   

```
# zcage create --alias=test07 --net "omni0|192.168.1.225/24|192.168.1.1" --ram 2gb
```
   

In a sparse zone critical file systems like /usr, /lib, /etc, /platform etc are inherited from
the global zone to the non-global zone as a read-only loopback file system.
This allows to use little disk space and be created faster.
  
  
Ipkg (ipkg) 
--------------

Ipkg zones are creating by specifying ***--type ipkg*** on creation 

``` 
# zcage create --alias=test07 --net "omni0|192.168.1.225/24|192.168.1.1" --type ipkg --ram 2gb
```
An ipkg zone gets its own writable copy of all file systems. Thus installation takes longer time than the sparse root zone.
   
   
Lipkg (lipkg) 
--------------

Lipkg zones are creating by specifying ***--type lipkg*** on creation 
   

``` 
# zcage create --alias=test07 --net "omni0|192.168.1.225/24|192.168.1.1" --type lipkg --ram 2gb
```
   
Linked images link the packages in a zone to the global zone. If you update the global zone's packages,
the linked-image zones get updated alongside it. This means going forward, an upgrade with linked image zones does not
require detaching and reattaching the zone. 
You can update zones on a running system (at the cost of losing some log state during the time of the upgrade and the time of a reboot), or you can simply halt the zones, do the upgrade, and reboot with all linked-image zones automatically updated(https://omniosce.org/info/linked_images.html).
  
  
Linux Branded Zone (lx) 
------------------------

Linux branded zones are creating by specifying ***--type lx*** on creation, this type of brand needs an 
extra parameter to be specified on creation ***--image*** or ***--docker***.
  
When using the **--image** flag the user needs to specify an already download linux image, 
this image could be downloaded using ***zcage pull --image***. 

```
# zcage images --list remote
```
```
# zcage pull --image  96bb1fac-c87d-11e5-b5bf-ff4703459205
```
```
# zcage create --alias=test07 --net "omni0|192.168.1.225/24|192.168.1.1" --type lx --ram 2gb --with-image 96bb1fac-c87d-11e5-b5bf-ff4703459205
```
  
When using the ***--docker*** flag the user needs to specify the container image name from docker hub (https://hub.docker.com/search?q=&type=image) that will be used when creating the zone.
   
```
# zcage create --net "vnic0|192.168.1.225/24|192.168.1.1" --ram 2gb  --docker alpine/latest --alias lxvm --brand lx
```

Bhyve (bhyve) and KVM (kvm) 
----------------------------

Bhyve and kvm zones are creating by specifying ***--type bhyve*** or ***--type kvm*** on creation, this type of brand needs an extra
parameters to be specified on creation ***--disk <zfs dataset>***.
To create a bhyve or kvm branded zone, first we need to create a disk for it to use:
   
```
# zfs create -V 30G rpool/vm0
``` 
```
# zcage create --brand bhyve --net "net6|192.168.1.207/24|192.168.1.1" --ram 2gb  --alias bhyve0  --disk=rpool/vm0
# zcage create --brand kvm --net "net6|192.168.1.207/24|192.168.1.1" --ram 2gb  --alias kvm0  --disk=rpool/vm0
```
   
This will create a bhyve zone that will use the dataset specified on the ***--disk*** parameter as a disk.  
You could specify the iso which to use at boot using the --with-iso option
   
```
# zcage start -z bhyve0 --with-iso /home/neirac/isos/FreeBSD-11.2-RELEASE-amd64-bootonly.iso
# zcage start -z kvm0 --with-iso /home/neirac/isos/FreeBSD-11.2-RELEASE-amd64-bootonly.iso
```
   

Then you could connect to the newly created bhyve zone using vnc, to obtain the port just use the info command.
   

```
# zcage info -z bhyve0`
```

Or just use the serial terminal, for KVM branded zones a vnc connection is recommended. 
    
```
# zlogin -C bhyve0
```
Cloud init
-----------
To import cloud init images into bhyve or kvm branded zones, the --with-image parameter can be used, cloud init images need
the --udata parameter that contains the user name and authorized ssh keys to be used to login into the host.

* udata 
--udata parameter should a json file with the following format:

```json
{ "userid": "youruser", "pubkey": "ssh-rsa your key" }
```
The image should be previously fetched by ***zcage --pull***
```
# zcage images --list cloud-init centos/7 

centos cloud-init Available images
-------------------------
CentOS-7-x86_64-GenericCloud-1503.qcow2.xz
CentOS-7-x86_64-GenericCloud-1503.raw.xz
CentOS-7-x86_64-GenericCloud-1508.qcow2.xz
CentOS-7-x86_64-GenericCloud-1509.qcow2.xz
CentOS-7-x86_64-GenericCloud-1510.qcow2.xz
CentOS-7-x86_64-GenericCloud-1511.qcow2.xz
CentOS-7-x86_64-GenericCloud-1511.qcow2c.xz
CentOS-7-x86_64-OracleCloud.raw.tar.gz

# zcage pull  --image CentOS-7-x86_64-GenericCloud-1503.qcow2.xz --provider cloud-init centos/7
Downloading image CentOS-7-x86_64-GenericCloud-1503.qcow2.xz
1.2344791010857434% |  3538944  bytes out of 286675084 bytes..

# zcage create --debug --net="vnic1|192.168.1.209/24|192.168.1.1" --brand bhyve|kvm --alias cloud-init --with-image=CentOS-7-x86_64-GenericCloud.qcow2.xz --udata=/home/cneira/udata

```
* Third party images :

To use images from other sources the ***zcage --fetch <url>*** command could be used, then that image could be
used by a lx or bhyve by specifying the image name. The image fetched will be stored in /zcage/images.

```
# zcage fetch https://download.openvz.org/template/precreated/centos-6-x86-devel.tar.gz

 
``` 
   
bhyve was originally integrated into FreeBSD by NetApp in around 2011 where it became part of the base system with FreeBSD 10.0-RELEASE.   
It continued to evolve and was ported to illumos by Pluribus Networks in around 2013 and they contributed  
 the resulting code to the illumos community in late 2017. From there, Joyent worked on integrating bhyve   
into their illumos fork, bringing it up-to-date with bhyve from FreeBSD-11.1 and making many improvements along the way.  

The intention that they have stated is for them to continue to work closely with the FreeBSD maintainers so that improvements make it back where appropriate.(https://omniosce.org/info/bhyve.html)
 
# Links

   [Quickstart](https://github.com/cneira/zcage/blob/master/docs/quickstart.md)  
   [Install](https://github.com/cneira/zcage/blob/master/docs/install.md)  
   [Basic usage](https://github.com/cneira/zcage/blob/master/docs/basic-use.md)  
   [Networking](https://github.com/cneira/zcage/blob/master/docs/networking.md)  
   [Brand types](https://github.com/cneira/zcage/blob/master/docs/brand-types.md)  
   [Options available](https://github.com/cneira/zcage/blob/master/docs/Options.md)    

