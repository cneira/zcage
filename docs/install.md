
# Install zcage

zcage is a zone manager that takes advantage of the best features
and technologies from Illumos. It is intended to be  
easy to use with a simple command line syntax.   
  
  
**zcage currently only works in Omniosce https://omniosce.org/** 

## Using github
  
To install from github, run this commands:  

```
# git clone https://github.com/cneira/zcage.git && cd zcage && pfexec npm install -g 
```
## Using npm 
  
To install using npm 
**Currently there is a bug in npm 5.X so npm 4.X must be used to install https://github.com/npm/npm/issues/16766**
```
# npm install npm@4 -g
# npm install zcage -g
```

## Required packages
 
To start creating zones the following packages are needed :
   
```
# pkg install pkg:/system/zones/brand/lx
# pkg install system/bhyve
# pkg install system/zones/brand/bhyve
# pkg install brand/sparse
```
***If you are running Omnios Bloody you could create pkgsrc zones, for that you 
need the following package***
   
```
# pkg install brand/pkgsrc 
```
  
