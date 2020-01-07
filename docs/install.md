
# Install zcage

zcage is a zone manager that takes advantage of the best features
and technologies from Illumos. It is intended to be  
easy to use with a simple command line syntax.   
  
  
**zcage currently only works in Omniosce https://omniosce.org/** 

## Using github
  
To install from github (for stability use a released version)  

```
# git clone https://github.com/cneira/zcage.git && cd zcage && pfexec npm install -g 
```
## Required packages
 
To start creating zones the following packages are needed :
   
* cdrtools 
* brand/bhyve
* brand/kvm
* brand/lx
* brand/pkgsrc
* brand/sparse
* brand/lipkg
* system/kvm (provides qemu-img)

```bash
# pkg install cdrtools brand/bhyve brand/kvm brand/lx brand/pkgsrc brand/sparse brand/lipkg system/kvm jq
```


***If you are running Omnios Bloody you could create pkgsrc zones, for that you 
need the following package***
   
```
# pkg install brand/pkgsrc 
```
  
 ## Links

   [Quickstart](https://github.com/cneira/zcage/blob/master/docs/quickstart.md)  
   [Install](https://github.com/cneira/zcage/blob/master/docs/install.md)  
   [Basic usage](https://github.com/cneira/zcage/blob/master/docs/basic-use.md)  
   [Networking](https://github.com/cneira/zcage/blob/master/docs/networking.md)  
   [Brand types](https://github.com/cneira/zcage/blob/master/docs/brand-types.md)  
   [Options available](https://github.com/cneira/zcage/blob/master/docs/Options.md)    
