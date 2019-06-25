# Basic Usage

This section is about basic zcage usage and is meant as a "how-to"
reference for new users.
zcage first needs to be activated before is able to create new zones
and interact with them.
  
  
## Activate zcage
-----------------

Before zcage is able to create new zones, it needs to `activate`.  
This allows zcage to create all the zfs datasets needed for storing zones 
and images. Also zcage checks if required packages are already installed.
Once zcage is ready  users are able to immediately
begin creating zones and downloading images for lx branded zones.

```bash
# pfexec zcage activate --pool <pool that zcage will use to store data>
```

## Fetching images 
------------------
Fetching images is only needed when creating lx branded zones. 
  
`zcage images --list joyent` lists linux images from [Joyent](https://www.joyent.com/).
  
`zcage images --list proxmox` lists [Proxmox images](https://www.proxmox.com/en/).
  
`zcage images --list docker ubuntu` lists docker images for ubuntu.
  
Then users can choose which image to download, using 
`zcage pull --image <uuid> --provider <provider name>` as seen in this example:

```
# zcage images --list proxmox
Proxmox Available images
-------------------------
alpine-3.7-default_20180913_amd64.aplinfo
alpine-3.7-default_20180913_amd64.tar.xz
alpine-3.8-default_20180913_amd64.aplinfo
alpine-3.8-default_20180913_amd64.tar.xz
alpine-3.9-default_20190224_amd64.aplinfo
alpine-3.9-default_20190224_amd64.tar.xz
archlinux-base_20161207-1_amd64.tar.gz
archlinux-base_20170704-1_amd64.tar.gz
archlinux-base_20171214-1_amd64.tar.gz
archlinux-base_20180906-1_amd64.tar.gz
archlinux-base_20190124-1_amd64.aplinfo
archlinux-base_20190124-1_amd64.tar.gz
centos-6-default_20161207_amd64.aplinfo
centos-6-default_20161207_amd64.tar.xz
centos-7-default_20170504_amd64.tar.xz
centos-7-default_20171212_amd64.aplinfo
centos-7-default_20171212_amd64.tar.xz
debian-6.0-standard_6.0-7_amd64.tar.gz
debian-7.0-standard_7.11-1_amd64.tar.gz
debian-8.0-standard_8.11-1_amd64.aplinfo
debian-8.0-standard_8.11-1_amd64.tar.gz
```
   
```
# zcage images --list joyent
UUID                                      NAME                VERSION     OS      PUBLISHED
f7c19252-c998-11e4-be95-3315493f3741      lx-centos-6         20150313    linux   2015-03-13T15:52:35Z
818cc79e-ceb3-11e4-99ee-7bc8c674e754      lx-ubuntu-14.04     20150320    linux   2015-03-20T03:45:09Z
116deb8c-cf03-11e4-9b2d-7b1066800a6a      lx-debian-7         20150320    linux   2015-03-20T13:14:41Z
eb4128ec-cf12-11e4-960d-8780cec6463f      lx-centos-6         20150320    linux   2015-03-20T15:08:09Z
430da066-e3a7-11e4-9657-332a2dbdf565      lx-ubuntu-14.04     20150415    linux   2015-04-15T19:40:25Z

```
  
```
# zcage images --list docker alpine
{
  "name": "library/alpine",
  "tags": [
    "2.6",
    "2.7",
    "3.1",
    "3.2",
    "3.3",
    "3.4",
    "3.5",
    "3.6",
    "3.7",
    "3.8",
    "3.9",
    "edge",
    "latest"
  ]
}

```
  
```
# zcage images --list local

Locally available Joyent images
------------------------------------
UUID                                     NAME         VERSION     OS      PUBLISHED
63d6e664-3f1f-11e8-aef6-a3120cf8dd9d     debian-9     20180404    linux   2018-04-04T15:28:29Z
77bc3f50-8f4c-11e6-90b6-f7b69b9dcf20     alpine-3     20161011    linux   2016-10-11T00:48:47Z

Locally available Proxmox images
------------------------------------
ubuntu-18.10-standard_18.10-1_amd64.tar.gz

Locally available Docker images
------------------------------------
alpine-latest-0b199873-8a80-e519-c710-c3f01a67bebf.gz
alpine-latest-5d51211d-460e-e603-9e27-e77b2b724c12.gz
alpine-latest-9d1c5dea-f91a-ce75-96bb-e18336b37870.gz

```
   
To fetch an image from Joyent, we just use the uuid and the provider name.
  
```
# zcage pull --image 63d6e664-3f1f-11e8-aef6-a3120cf8dd9d  --provider joyent
``` 
   
To fetch an image from Proxmox, just use proxmox as the provider.
```
# zcage pull --image  alpine-3.7-default_20180913_amd64.tar  --provider proxmox
```
  
## Basic Zone Creation
   

Create a Zone 
-------------

There are five types of brands: **sparse**, **bhyve**, **kvm**, **lx**, **lipkg** and
**pkgsrc**. More details about these zone brands can be found in the 
[Brands types](https://github.com/cneira/zcage/blob/master/docs/brand-types.md) sections of this documentation. 

Depending on the user's requirements, the command `create` could create either zone brand.  
By default, `zcage create` creates a **sparse** zone, but invoking the
**-type** option changes the creation of the zone brand. 

First we need to setup a virtual network interface using [DLADM(1)](https://illumos.org/man/1M/dladm).  

Currently each zone needs to have a different vnic otherwise it won't start.
   
```
# pfexec dladm create-vnic -l igb0 omni0
```
  
Here is an example of creating a sparse zone using virtual network interface 
omni0 using ip: 192.168.1.225/network mask, 192.168.1.1 as gateway and memory 
capped to use 2GB of RAM:  

```
# zcage create --alias=test07 --net "omni0|192.168.1.225/24|192.168.1.1" --ram 2gb
```
   

After a zone is created and running we could update it's previously defined capped memory 
also set or update a disk quota of the zfs dataset for that zone.
   

```
# zcage update -z test07 --ram 4gb --quota 16G`
```
  

More information about zone properties are available  
in [Available Options](https://github.com/cneira/zcage/blob/master/docs/Options.md).   
  

## Listing Zones
-------------

To list all zones, use: `zcage list`
To see all downloaded linux images, use: `zcage images --list local`


Start, Stop, or Restart a Zone
------------------------------

Zones can be started, stopped, or restarted at any time. By default, new
zones are  *down* (stopped) state. To see the status of all zones,
use `zcage list` and read the **STATE** column.
  
   
Use each zone's UUID or alias to start, stop, or restart it.

Start
------

Use `zcage start -z <alias or UUID>` to start a zone.

Start a zone with the alias **apache01**:
   
```
# zcage start -z apache01
```

If no alias provided by the user, `zcage` automatically assigns an alias to a new zone.  
This UUID is always usable when doing `zcage` operations like starting a zone:
   

```
# zcage start -z 26e8e027-f00c-11e4-8f7f-3c970e80eb61
```


Stop
-----

`zcage stop` uses the same syntax as `zcage start`.

```
# zcage stop -z www01
# zcage stop -z 26e8e027-f00c-11e4-8f7f-3c970e80eb61
```

Reboot
--------
  
`zcage reboot` also uses the same syntax as **start** and **stop**:

```
# zcage reboot -z apache01

# zcage reboot -z 26e8e027-f00c-11e4-8f7f-3c970e80eb61
```

Get Zone information 
----------------------
  
   
To view all information for a zone use the **info** subcommand:
   
```
# zcage info -z apache01
```

Destroy a Zone
--------------

Destroy a specific zone using the **destroy** subcommand:
   
```
# zcage destroy -z apache01
```
  
<aside class="warning">
 This irreversibly destroys the zone. 
</aside>
  
## Links

   [Quickstart](https://github.com/cneira/zcage/blob/master/docs/quickstart.md)  
   [Install](https://github.com/cneira/zcage/blob/master/docs/install.md)  
   [Basic usage](https://github.com/cneira/zcage/blob/master/docs/basic-use.md)  
   [Networking](https://github.com/cneira/zcage/blob/master/docs/networking.md)  
   [Brand types](https://github.com/cneira/zcage/blob/master/docs/brand-types.md)  
   [Options available](https://github.com/cneira/zcage/blob/master/docs/Options.md)    
