# Zcage - An Illumos Zone manager

Zcage is a zone manager for Illumos written in nodejs, is inspired by FreeBSD's 
iocage and SmartOS's vmadm, combining some of the best features of Illumos, like
crossbow and zones to create secure containers.  
It's intended to be easy to use with a simple command syntax. 
  
  
## FEATURES:

* Easy to use.
* Rapid thin provisioning within seconds.
* Virtual networking.
* Resource control.
* Exclusive IP networking by default.
* Supports for brands sparse, ipkg, lipkg, bhyve, kvm and lx.
* Import docker images to create lx branded zones.
* Import cloud init images to create kvm or bhyve branded zones (Only Centos and Ubuntu supported).

## Documentation:
--------------
   [install] (docs/install.md)  
   [basic use] (docs/basic-use.md)  
   [networking] (docs/networking.md)  
   [brand-types] (docs/brand-types.md)  
   [Options available] (docs/Options.md)  
