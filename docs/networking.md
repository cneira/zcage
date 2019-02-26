
# Networking

Zones created by :command: `zcage` are setup as an exclusive-IP zone, this  
means that each zone have its distinct IP layer configuration and state
(<https://illumos.org/man/5/zones>). 
Network virtualization is provided by Crossbow (https://wiki.smartos.org/display/DOC/Networking+and+Network+Virtualization).


## Creating Virtual Network Interfaces

zcage needs a virtual network interface (vnic) per each zone ,these
are created using the **DLADM(1)**  command, for example this will create the vnic
vnic0 using the physical nic e1000g0: 
   
```
# dladm create-vnic -l e1000g0 vnic0
```
Then later vnic0 could be use for **zcage create** when specifying network 
properties.


## Configuring Zone networking

###IPv4
   
```
# zcage create --alias=test07 --net "vnic0|192.168.1.225/24|192.168.1.1" --ram 2gb`
```
###IPv6
    
```
# zcage create --alias=test07 --net "vnic1|0:0:0:0:0:ffff:c0a8:1e1/24|0:0:0:0:0:ffff:c0a8:101" --ram 2gb`
```

These examples creates a zone with IP **192.168.1.225/24** and **0:0:0:0:0:ffff:c0a8:1e1/24** using vnics *vnic1* and *vnic0*.
   
