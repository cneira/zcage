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
  
### with-image (brand: LX|KVM|BHYVE, required)

* Uses the image specified when creating a zone.

### udata (brand: KVM|BHYVE, Optional)

* Uses user-data from file when creating a VM using a cloud-init image.
  Format is : 
```json
{ "userid": "joe", "pubkey": "ssh-rsa ...."}
```
### docker (brand: LX, required )

* Uses the image specified from dockerhub registry v2 

### autoboot (brand: ALL, not required, defaults to false)

* Sets if a zone should be started at boot.

### brand (brand: ALL, not required, defaults to sparse)

*  Sets the zone brand for zone creation.

### cdrom (brand: BHYVE|KVM, not required)

* Specifies iso to use when booting a bhyve or kvm vm)

### cpu (brand: BHYVE|KVM, not required, defaults to 1)

* Specified the number of cpus the vm will use.


 ## Links

   [Quickstart](https://github.com/cneira/zcage/blob/master/docs/quickstart.md)  
   [Install](https://github.com/cneira/zcage/blob/master/docs/install.md)  
   [Basic usage](https://github.com/cneira/zcage/blob/master/docs/basic-use.md)  
   [Networking](https://github.com/cneira/zcage/blob/master/docs/networking.md)  
   [Brand types](https://github.com/cneira/zcage/blob/master/docs/brand-types.md)  
   [Options available](https://github.com/cneira/zcage/blob/master/docs/Options.md)    


