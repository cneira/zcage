.. index:: Basic Usage
.. _Basic Usage:

Basic Usage
===========

This section is about basic zcage usage and is meant as a "how-to"
reference for new users.

.. tip:: Remember, command line help is always available by typing
   :command:`zcage help`. 

zcage first needs to be activated before is able to create new zones
and interact with them.

.. index:: Activate zcage 
.. _Activate zcage:

Activate zcage
---------------

Before zcage is able to create new zones, it needs to :command:`activate`.
this allows zcage to create all the zfs datasets needed for storing zones 
and images. Also zcage checks if required packages are already installed.

Once zcage is ready  users are able to immediately
begin creating zones and downloading images for lx branded zones.

.. index:: Fetching images 

Fetching images is only needed when creating lx branded zones. 
:command:`zcage images --list remote` lists linux images from Joyent's repos.
Then users can choose which image to download, using 
:command:`zcage pull --image <uuid>` as seen in this example:

.. code-block:: none

# zcage images --list  avail
UID                                        NAME               VERSION         OS                      PUBLISHED
f7c19252-c998-11e4-be95-3315493f3741       lx-centos-6        20150313        linux           2015-03-13T15:52:35Z
818cc79e-ceb3-11e4-99ee-7bc8c674e754       lx-ubuntu-14.04    20150320        linux           2015-03-20T03:45:09Z
116deb8c-cf03-11e4-9b2d-7b1066800a6a       lx-debian-7        20150320        linux           2015-03-20T13:14:41Z
eb4128ec-cf12-11e4-960d-8780cec6463f       lx-centos-6        20150320        linux           2015-03-20T15:08:0

# zcage pull --image 96bb1fac-c87d-11e5-b5bf-ff4703459205 
# zcage images --list local
UUID                                       NAME               VERSION         OS                      PUBLISHED
96bb1fac-c87d-11e5-b5bf-ff4703459205       alpine-3           20160201        linux           2016-02-01T00:49:02Z


.. index:: Basic Zone Creation
.. _Create a Zone:

Create a Zone 
-------------

There are five types of brands: **sparse**, **bhyve**, **lx**, **lipkg** and
**pkgsrc**. More details about these zone brands can be found in the 
:ref :`Zone brands` sections of this documentation. 

Depending on the user's requirements, the :command:`create` subcommand
could create either zone brand. By default,
:command:`zcage create` creates a **sparse** zone, but invoking the
**-type** option changes the creation of the zone brand. 

First we need to setup a virtual network interface using DLADM(1) <https://illumos.org/man/1M/dladm>.
Currently each zone needs to have a different vnic otherwise it won't start.

:command: `pfexec dladm create-vnic -l igb0 omni0`

Here is an example of creating a sparse zone using virtual network interface 
omni0 using ip: 192.168.1.225/network mask, 192.168.1.1 as gateway and memory 
capped to use 2GB of RAM.:

:samp:`# zcage create --alias=test07 --net "omni0|192.168.1.225/24|192.168.1.1" --ram 2gb`

After a zone is created and running we could update it's previously defined capped memory 
also set or update a disk quota of the zfs dataset for that zone.

:samp: `# zcage update -z test07 --ram 4gb --quota 16G`

More information about zone properties are available  
in `zcage github <https://github.com/cneira/zcage>`

.. index:: Listing Zones
.. _Listing Zones:

Listing Zones
-------------

To list all zones, use :command:`zcage list`

To see all downloaded linux images, use :command:`zcage images --list local`

. index:: Zone start stop restart
.. _Start Stop Restart Zone:

Start, Stop, or Restart a Zone
------------------------------

Zones can be started, stopped, or restarted at any time. By default, new
zones are  *down* (stopped) state. To see the status of all zones,
use :command:`zcage list` and read the **STATE** column.

Use each zone's UUID or alias to start, stop, or restart it.



.. index:: Zone Start
.. _StartZone:

Start
+++++

Use :command:`zcage start -z <alias or UUID>` to start a zone.

**Examples:**

Start a zone with the alias **apache01**:

:samp:`zcage start -z apache01`.

If no alias provided by the user, :command:`zcage`
automatically assigns a complex UUID to a new zone. This UUID is always
usable when doing :command:`zcage` operations like starting a zone:

:samp:`# zcage start -z 26e8e027-f00c-11e4-8f7f-3c970e80eb61`

. index:: Zone Stop
.. _StopZone:

Stop
++++

:command:`zcage stop` uses the same syntax as :command:`zcage start`.

**Examples:**

:samp:`# zcage stop -z www01`

:samp:`# zcage stop -z 26e8e027-f00c-11e4-8f7f-3c970e80eb61`


.. index:: Zone Reboot
.. _RebootZone:

Reboot
+++++++

:command:`zcage reboot` also uses the same syntax as **start** and
**stop**:

:samp:`# zcage reboot -z apache01`

:samp:`# zcage reboot -z 26e8e027-f00c-11e4-8f7f-3c970e80eb61`


.. index:: Get information 
.. _Get Zone information:

Get Zone information 
+++++++++++++++++++++

To view all information for a zone use the **info** subcommand:

:samp:`# zcage info -z apache01`

.. index:: Destroy a Zone
.. _Destroy a Zone:

Destroy a Zone
--------------

Destroy a specific zone using the **destroy** subcommand:

:samp:`# zcage destroy -z apache01`

.. warning:: This irreversibly destroys the zone. 

