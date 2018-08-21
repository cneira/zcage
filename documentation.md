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
A zone definition is supplied by command line using the create option, the following attributes for zone creation are available.


| Parameter       | Short hand | Description                                                                     |
| --------------- | :--------: | :------------------------------------------------------------------------------:|
| alias           | -a         |  Names container so it could be referenced by alias instead of UUID.            |    
| net             |  N/A       |  Configures network for container format is nic\|ip/mask\|gateway.              |
| ram             |  N/A       |  Assigns maximum RAM memory allowed for the zone.                               |       
| with-image      |  N/A       |  Use image uuid previously pulled using zcage pull when creating a zone.        |
| autoboot        |  N/A       |  Zone be started automatically when host is booted.                             |
| max-lwps        |  N/A       |  Assigns maximum of lightweight threads that the zone is allowed to create.     | 
| cpu-shares      |  N/A       |  Sets the number of cpu shares allowed for the zone.                            |
       

#### References
https://www.aelius.com/njh/subnet_sheet.html
