.. Zcage documentation master file, created by
   sphinx-quickstart on Tue Feb 26 11:04:29 2019.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

=================================
Zcage - An Illumos Zone manager
=================================
Zcage is a zone manager for Illumos written in nodejs, is inspired by FreeBSD's 
iocage and SmartOS's vmadm, combining some of the best features of Illumos, like
crossbow and zones to create secure containers.
It's intended to be easy to use with a simple command syntax. 


**FEATURES:**

- Easy to use
- Rapid thin provisioning within seconds
- Virtual networking stacks (Crossbow <https://wiki.smartos.org/display/DOC/Networking+and+Network+Virtualization>)
- Resource control
- Exclusive IP networking by default
- Supports for brands sparse, ipkg, lipkg, bhyve and lx.
- Import docker images to create lx branded zones

Documentation:
--------------
.. toctree::
   :maxdepth: 2
   :caption: Contents:

   install
   basic-use
   networking
   brand-types


Indices and tables
==================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`
