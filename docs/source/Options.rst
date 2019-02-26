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

### docker (brand: LX, required )

* Uses the image specified from dockerhub registry v2 

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


