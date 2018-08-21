# Zcage Software design document 


SRS Revisions

| Date       | Description          | Revision | Editor                 |
| ---------- | :------------------: | :------: | ---------------------: |
| 08/21/2018 | Created the document | 0        | cneirabustos@gmail.com |


## **Purpose**

The purpose of this document is to describe the implementation of the Zcage illumos's zones management Software.
Zcage is designed to automate the creation illumos's zones performing all needed tasks in behalf of the user using existing tools (zonecfg and zoneadm). The user needs to provided zcage with a minimal zone specification attributes, the rest will take "safe" default values.

## **Scope**

This document describes the implementation details of Zcage. The software consists of one major functionality, it converts a zone definition supplied by the user into a zonecfg script that's executed and will result in the creation and installation of the defined zone.


## **Zone creation Parameters**

A zone definition is supplied by command line using the create option, the following attributes for zone creation are available.


| Parameter               | Required? | Used by | Defaults | Description                                                                    |
| ----------------------- | :--------:| :---:   | :------: | :-----------------------------------------------------------------------------:|
| dedicated-cpu-importance|  N        |   N     |  N/A     | Updates or sets the dedicated cpu importance for container                     |
| dedicated-cpu           |  N        |   N     |  N/A     | Updates or sets the amount of dedicated cpus for container                     |
| with-image              |  N        |   LX    |  N/A     | Use image uuid previously pulled using zcage pull when creating a zone.        |
| cpu-shares              |  N        |   ALL   |  N/A     | Sets the number of cpu shares allowed for the zone.                            |
| limitpriv               |  N        |   ALL   |  N/A     | Set privileges in non GZ                                                       |
| max-lwps                |  N        |   ALL   |  N/A     | Assigns maximum of lightweight threads that the zone is allowed to create.     | 
| autoboot                |  N        |   ALL   |  false   | Zone be started automatically when host is booted.                             |
| alias                   |  N        |   ALL   |  N/A     | Names container so it could be referenced by alias instead of UUID.            |    
| brand                   |  N        |   ALL   |  sparse  | Sets the zone brand (lx, sparse,lipkg, ipkg and bhyve)                         |
| net                     |  Y        |   ALL   |  N/A     | Configures network for container format is nic\|ip/mask\|gateway.              |
| ram                     |  N        |   ALL   |  N/A     | Assigns maximum RAM memory allowed for the zone.                               |     
| disk                    |  N        |   BHYVE |  N/A     | Exposes a ZVOL as disk                                                         |
| bootdisk                |  N        |   BHYVE |  N/A     | Especifies disk to boot from                                                   |
| cdrom                   |  N        |   BHYVE |  N/A     | Expose iso to vm                                                               |
| hostbridge              |  N        |   BHYVE |  N/A     | Hostbridge model for vm                                                        |
| cpu                     |  N        |   BHYVE |  1       | vcpus or topology for BHYVE                                                    |    


## **Zone definition validation**

A zone definition will be converted to the following json object 

```json
zone_spec: {
    "zonepath": "/zcage/vms/bhyvetest",
    "brand": "bhyve",
    "ip-type": "exclusive",
    "dns-domain": "",
    "resolvers": [
        "8.8.8.8",
        "8.8.8.4"
    ],
    "autoboot": false,
    "net": [
        {
            "physical": "net5",
            "address": "192.168.1.206",
            "netmask": "255.255.255.0",
            "gateway": "192.168.1.1"
        }
    ],
    "rctl": {
        "max-physical-memory": "2147483648",
        "max-locked-memory": "2147483648",
        "max-swap": "2147483648"
    },
    "bhyve_metadata": {
        "acpi": "on",
        "hostbridge": "intel",
        "netif": "virtio-net-viona",
        "type": "generic",
        "vnc": "unix=/tmp/013df5c2-8848-408e-8fca-7849a727c86a.vnc,wait",
        "bootrom": "BHYVE_DEBUG",
        "console": "socket,/tmp/4c7f6c1c-1e8c-448c-85ce-2c43a68a2471.com1",
        "vcpus": "1",
        "ram": "2gb",
        "disk": "/dev/zvol/rdsk/rpool/debian9",
        "bootdisk": "rpool/debian9",
        "cdrom": "/home/neirac/isos/debian-9.5.0-amd64-netinst.iso",
        "fs": "/home/neirac/isos/debian-9.5.0-amd64-netinst.iso"
    }
}

```

which will be validated against the following schema:

```json
  {
        "type": "object",
        "properties": {
            "zonepath": {
                "type": "string"
            },
            "brand": {
                "type": "string",
                "enum": ["sparse", "ipkg", "lipkg", "lx", "bhyve"]
            },
            "ip-type": {
                "type": "string",
                "enum": ["exclusive"]
            },
            "autoboot": {
                "type": "boolean"
            },
            "additionalProperties": false,
            "net": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "physical": {
                            "type": "string"
                        },
                        "address": {
                            "type": "string",
                            "format": "ipv4"
                        },
                        "netmask": {
                            "type": "string",
                            "format": "ipv4"
                        },
                        "gateway": {
                            "type": "string",
                            "format": "ipv4"
                        }
                    }
                }
            },
            "rctl": {
                "type": "object",
                "properties": {
                    "max-physical-memory": {
                        "type": "string",
                        "pattern": "^[0-9]+$"
                    },
                    "max-locked-memory": {
                        "type": "string",
                        "pattern": "^[0-9]+$"
                    },
                    "max-swap": {
                        "type": "string",
                        "pattern": "^[0-9]+$"
                    },
                    "cpu-shares": {
                        "type": "string",
                        "pattern": "^[0-9]+$"
                    },
                    "dedicated-cpu": {
                        "type": "string",
                        "pattern": "^[1-9]-[1-9]$"
                    },
                    "dedicated-cpu-importance": {
                        "type": "string",
                        "pattern": "^[1-9]$"
                    }
                }
            }
        },
        "required": ["zonepath", "net", "brand"]
    };
```

#### References

