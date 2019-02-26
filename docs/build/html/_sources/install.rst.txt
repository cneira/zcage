.. index:: Install zcage
.. _Install zcage:

Install zcage
==============

zcage is a zone manager that takes advantage of the best features
and technologies from Illumos. It is intended to be  
easy to use with a simple command line syntax. Visit the
`zcage github <https://github.com/cneira/zcage>`_ for more information.

.. tip:: zcage currently only works in Omniosce <https://omniosce.org/> 

Using github
++++++++++++
To install from github, run this commands:

:samp:` git clone https://github.com/cneira/zcage.git && cd zcage && pfexec npm install -g` 

Using npm 
+++++++++++++++++++++

To install using npm 
.. tip:: Currently there is a bug in npm 5.X so npm 4.X must be used to install https://github.com/npm/npm/issues/16766

:samp:` npm install npm@4 -g`
:samp: `npm install zcage -g`

Required packages
+++++++++++++++++++++
To start creating zones the following packages are needed :
:command: `pkg install pkg:/system/zones/brand/lx`
:command: `pkg install system/bhyve`
:command: `pkg install system/zones/brand/bhyve`
:command: `pkg install brand/sparse`

.. tip:: If you are running Omnios Bloody you could create pkgsrc zones, for that you need the following package

:command: `pkg install brand/pkgsrc` 


