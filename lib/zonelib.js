/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. 
 *
 * Copyright (c) 2018, Carlos Neira cneirabustos@gmail.com 
 */

const ip = require('ipaddr.js');
const chalk = require('chalk');
const bytes = require('bytes');
const uuidv4 = require('uuid/v4');
var fs = require('fs'),
    xml2js = require('xml2js');
const util = require('util');
const VError = require('verror');
const dockerNames = require('docker-names');
var columnify = require('columnify');
const {
    spawnSync,
    spawn,
    fork
} = require('child_process');
const zfs = require('./imageadm');
var Ajv = require('ajv');
var validator = require('validator');
const path = require('path');

var debug = {
    enabled: false
};
const ubuntu_distros = ['xenial', 'disco', 'bionic'];

function mapToObj(inputMap) {
    let obj = {};

    inputMap.forEach(function (value, key) {
	obj[key] = value;
    });
    return obj;
}

function ZonesString() {
    var zoneadm = spawnSync('zoneadm', ['list', '-cp']);
    var zones = zoneadm.stdout.toString().split('\n');
    zones.pop();
    return zones;
}

function Zonedata(zonestring) {
    var values = zonestring.toString().split(':');
    var keys = ["zoneid", "zonename", "state", "zone-path", "uuid", "brand",
		"ip-type"
	       ];
    var m = new Map();
    values.pop();
    for (var i = 0, len = values.length; i < len; i++) {
	m.set(keys[i], values[i]);
    }
    return mapToObj(m);
}

function list() {
    var zones = ZonesString();
    var zoneobjs = [];

    for (var i = 0, len = zones.length; i < len; i++) {
	zoneobjs.push(Zonedata(zones[i]));
    }
    return zoneobjs;

}

function listzones(listOptions, out) {
    var zones = ZonesString();
    var zoneobjs = [];
    var type;

    for (var i = 0, len = zones.length; i < len; i++) {

	z = Zonedata(zones[i]);

	if (listOptions && ("state" in listOptions)) {
	    if (z.state != "configured" && z.state == "installed")
		z.state = "stopped";

	    if (listOptions && listOptions.state == z.state && z.zonename != "global")
		zoneobjs.push(z);
	} else {
	    if ("configured" != z.state) {
		switch (z.state) {
		case "installed":
		    z.state = "stopped";
		    break;
		}
		if (z.zonename != "global")
		    zoneobjs.push(z);
	    }
	}
    }
    if (!out) {
	var data = [];
	console.log(
	    "UUID\t\t\t\t     TYPE    STATE   RAM    \t    ALIAS\t\t CREATED"
	);
	for (i = 0, len = zoneobjs.length; i < len; i++) {
	    if (zoneobjs[i].zonename != "global") {
		getzonedata(zoneobjs[i].zonename, function (zdata, z) {
		    if (zdata.name == 'incomplete')
			return;
		    let ram;
		    let ipaddr = "unknown";
		    ram = zdata.ram;
		    let created;
		    if (zdata.metadata)
			created = zdata.metadata;
		    else
			created = {
			    CreatedAt: ""
			};
		    switch (zdata.brand) {
		    case "lx":
			type = "LX";
			break;
		    case "bhyve":
			type = "BHYVE";
			break;
		    case "kvm":
			type = "KVM";
			break;
		    default:
			type = "OS";
			break;
		    }
		    data = [{
			UUID: z.uuid,
			TYPE: type,
			STATE: z.state,
			RAM: ram,
			NAME: z.zonename,
			CREATED: created.CreatedAt
		    }];
		    var columns = columnify(data, {
			showHeaders: false,
			Align: 'right',
			config: {
			    TYPE: {
				minWidth: 6
			    },
			    STATE: {
				minWidth: 8
			    },
			    RAM: {
				minWidth: 10
			    },
			    NAME: {
				minWidth: 21
			    },
			}

		    });
		    console.log(columns);

		}, zoneobjs[i]);
	    }
	}
    }
    return zoneobjs;
}

function getdata(zonename, uuid) {
    var zones = list();
    var zone = zones.filter(zone => (zone.zonename == zonename || zone.uuid ==
				     uuid));
    if (zone == undefined || zone.length == 0)
	return null;
    return zone[0];
}

function destroy(zonename, dzvol, callback) {
    if (!isAbletoexec()) {
	console.log(
	    "You must be root or use an account with Primary Administrator Role to Activate zcage (pfexec zcage activate)"
	);
	return null;
    }
    var zoption = '-z';
    var z = '';
    if (validator.isUUID(zonename)) {
	z = getdata(zonename, zonename);
	zoption = '-u';
    } else {
	z = getdata(zonename);
    }

    var zdestroy;

    if (z == null) {
	console.log(chalk `Destroying zone: ${zonename}  [{red.bold ERR}] `);
	console.log(`${zonename} does not exists`);
	if (callback) {
	    callback(404, {
		message: "No such container: " + zonename
	    });
	}
	return null;
    }
    if (z.state == "running") {
	var zhalt = spawnSync('pfexec', ['zoneadm', zoption, zonename, 'halt']);
	if (zhalt.err != null) {
	    console.log(chalk `Halting zone: ${zonename}  [{red.bold ERR}] `);
	    console.log(zhalt.stderr.toString());

	    if (callback) {
		callback(500, {
		    message: "Something went wrong."
		});
	    }
	    return zhalt.status;
	}
    }

    zdestroy = spawnSync('pfexec', ['zoneadm', zoption, zonename, 'uninstall',
				    '-F'
				   ]);
    if (zdestroy.err != null) {
	console.log(chalk `Uninstalling zone: ${zonename}  [{red.bold ERR}] `);
	console.log(zdestroy.stderr.toString());

	if (callback) {
	    callback(500, {
		message: "Something went wrong."
	    });
	}
	return zdestroy.status;
    }


    if (dzvol == true && (z.brand == 'bhyve' || z.brand == 'kvm')) {
	getzonedata(z.zonename, function (zdata) {
	    var obj = zdata.vm_data;
	    var zvol = obj.bootdisk;
	    if (zvol) {
		let zvol_destroy = spawnSync('pfexec', ['zfs', 'destroy', zvol]);
		if (zvol_destroy.err != null) {
		    console.log(zvol_destroy.stderr.toString());

		    if (callback) {
			callback(500, {
			    message: "Something went wrong."
			});
		    }
		    return zvol_destroy.status;
		}
	    }
	});
    }
    zdestroy = spawnSync('pfexec', ['zonecfg', '-z', z.zonename, 'delete',
				    '-F'
				   ]);
    if (zdestroy.err != null) {
	console.log(chalk `Deleting zone: ${zonename}  [{red.bold ERR}] `);
	console.log(zdestroy.stderr.toString());
	if (callback) {
	    callback(500, {
		message: "Something went wrong."
	    });
	}
	return zdestroy.status;
    }
    console.log(chalk `${zonename} destroyed [{green.bold OK}] `);
    if (callback) {
	callback(204, {
	    message: "Container Id: " + zonename + " destroyed"
	});
    }

    return zdestroy.status;
}

function getinfo(zonename) {
    var zonecfg = spawnSync('zonecfg', ['-z', zonename, 'info']);
    if (zonecfg.err != null)
	console.log("info ", zonecfg.stderr.toString());
    return zonecfg.stdout.toString();
}

function exec(zonename, cmd, out) {
    var zlogin = spawnSync('pfexec', ['zlogin', zonename, cmd]);

    if (zlogin.err != null)
	console.log("error executing ", cmd, zlogin.stderr.toString());

    if (out != undefined)
	out[cmd] = zlogin.stdout.toString();

    return zlogin.status;
}

function start(zonename, opts, callback) {

    if (!isAbletoexec()) {
	console.log(
	    "You must be root or use an account with Primary Administrator Role to Activate execute this action"
	);
	return null;
    }

    var zoption = '-z';
    var zone;
    zonename += '';
    if (validator.isUUID(zonename)) {
	zone = getdata(zonename, zonename);
	zoption = '-u';
    } else {
	zone = getdata(zonename);
    }
    if (zone == null) {
	console.log(chalk `{red.bold Error : alias does not exists}`);
	if (callback) {
	    callback(404, {
		message: "No such container: " + zonename
	    });
	}
	return null;
    }
    if (zone.state == "running") {
	if (callback) {
	    callback(304, {
		message: "Container already started."
	    });
	}
	console.log(chalk `{blue.bold vm uuid ${zone.uuid} is already running}`);
	return null;
    }
    if (vnicused(zone.zonename)) {
	console.log(chalk `zone: ${zonename} start [{red.bold ERR}] `);
	console.log("vnic is being used by other container");
	if (callback) {
	    callback(500, {
		message: "vnic is being used by other container"
	    });
	}
	return null;
    }
    if ((zone.brand == 'bhyve' || zone.brand == 'kvm') && (opts != undefined &&
							   opts != null)) {
	var script = "add fs; set dir=" + "\"" +
	    opts + "\"" +
	    ";set special=" + "\"" +
	    opts + "\"" +
	    "; set type=lofs;add options ro;" +
	    "add options nodevices;end;";
	var r = spawnSync('pfexec', ['zonecfg', zoption, zonename,
				     'add attr; set type=string;set name=cdrom;set value=' + opts + ";end;" +
				     script
				    ]);
	if (debug.enabled)
	    console.log(r.stderr.toString(), r.stdout.toString());
    }
    var start = spawnSync('pfexec', ['zoneadm', zoption, zonename, 'boot']);

    if (start.error != null) {
	console.log(chalk `${zonename} start [{red.bold ERR}] `);
	if (callback) {
	    callback(204, {
		message: "Container Id:" + zone.uuid + "started"
	    });
	}

    } else {
	console.log(chalk `${zonename} started [{green.bold OK}] `);
	if (callback) {
	    callback(204, {
		message: "Container Id:" + zone.uuid + "started"
	    });
	}

    }

    if (zone.brand == 'bhyve' || zone.brand == 'kvm') {
	isvnc_enabled(zone, zone.brand);
    }

    getzonedata(zonename, function (zdata) {
	if(zdata.Cmd) {
	    var logs = zdata.Cmd.replace(','," ") + ' 2> '  +
		      '/stderr.log' + ' 1> '  +  '/stdout.log';
	    var Cmd = ['zlogin', zdata.name, logs] ;
	    var execmd = spawnSync('pfexec', Cmd );
	    if(debug.enabled) {
	    console.log("executing command - stdout: "
			+ execmd.stdout.toString() +
			" stderr: " + execmd.stderr.toString());
	    }
	}
    });
    if (debug.enabled)
	console.log("starting zone", start.stderr.toString(), start.stdout.toString());
    return start.status;
}

function rctl(zname, rctlOptions, callback) {
    if (!isAbletoexec()) {
	console.log(
	    "You must be root or use an account with Primary Administrator Role to Activate execute this action"
	);
	return null;
    }
    var rctlobj = {};
    var z;
    if (validator.isUUID(zname)) {
	z = getdata(zname, zname);
    } else {
	z = getdata(zname);
    }
    if (z == null) {
	console.log(chalk `{red.bold Error : Alias does not exists}`);
	return null;
    }
    delete rctlOptions.zonename;
    rctlobj.rctl = addrctl(rctlOptions, z.zonename);
    update_rctl(z.zonename, rctlobj.rctl, function(err, zname, script, callback) {
	Asynczonecfgexec(err, zname, script, callback);
    }, callback); 
}

function Asynczonecfgexec(err, zname, script, callback) {

    if (err) {
	console.log("error on creating script", err);
	if(callback)
	    callback(400, {message: "Something wrong happened"});
	return; 
    }
    var zonecfg = spawnSync('pfexec', ['zonecfg', '-z', zname, script]);
    if (zonecfg.err) {
	console.log("error on zonecfg executing script", zonecfg.stderr.toString());
	if(callback)
	    callback(400, {message: "Something wrong happened"});
	return;
    }
    console.log(zonecfg.stderr.toString());
    console.log(zonecfg.stdout.toString());

    if(callback) {
	callback(200, { Warnings: [] });
    }
    return zonecfg.status;
}

function halt(zonename, callback) {

    if (!isAbletoexec()) {
	console.log(
	    "You must be root or use an account with Primary Administrator Role to Activate execute this action"
	);
	return null;
    }
    var zoption = '-z';
    var z = '';
    zonename += '';
    if (validator.isUUID(zonename)) {
	z = getdata(zonename, zonename);
	zoption = '-u';
    } else {
	z = getdata(zonename);
    }
    if (z == null) {
	if (callback) {
	    callback(404, {
		message: "No such container: " + z.uuid
	    });
	}

	console.log("Error zone does not exists");
	return null;
    }
    if (z != null && (z.brand == 'bhyve' || z.brand == 'kvm')) {
	spawnSync('pfexec', ['zonecfg', zoption, zonename,
			     'remove attr name=cdrom; remove fs;'
			    ]);
    }

    var stop = spawnSync('pfexec', ['zoneadm', zoption, zonename, 'halt']);
    if (stop.error != null) {
	console.log("info ", stop.stdout.toString());
    } else {
	if (callback) {
	    callback(204, {
		message: "Container Id:" + z.uuid + "stopped"
	    });
	    return null;
	}
	console.log(chalk `${zonename} stopped [{green.bold OK}] `);
    }
    return stop.stdout.toString();
}

function reboot(zonename, callback) {

    if (!isAbletoexec()) {
	console.log(
	    "You must be root or use an account with Primary Administrator Role to Activate execute this action"
	);
	return null;
    }

    var zoption = '-z';
    var z;
    var reboot;
    if (validator.isUUID(zonename)) {
	z = getdata(zonename, zonename);
    } else {
	z = getdata(zonename);
    }
    if (z == null) {
	console.log("Error zone does not exists");
	if (callback) {
	    callback(404, {
		message: "No such container: " + z.uuid
	    });
	}
	return;
    }

    if (z.state == "running") {
	if (z.brand == 'bhyve' || z.brand == 'kvm') {
	    var path = z['zone-path'] + '/root/tmp';
	    var vncpid = spawnSync('pgrep', ['-f', path]);
	    var pid = vncpid.stdout.toString();
	    if (vncpid.error != null) {
		console.log(`Error restarting vnc`);
	    }
	    vncpid = spawnSync('pfexec', ['kill', '-9', pid]);
	    if (vncpid.error != null) {
		console.log(`Error killing vnc pid : {pid}`);
	    }
	}
	reboot = spawnSync('pfexec', ['zoneadm', zoption, zonename, 'reboot']);
	if (reboot.error != null) {
	    console.log("info ", reboot.stdout.toString());
	    if (callback) {
		callback(500, {
		    message: "Something went wrong"
		});
	    }
	} else {
	    console.log(chalk `zone: ${zonename} rebooted [{green.bold OK}] `);
	    if (callback) {
		callback(204, {
		    message: "Container Id:" + z.uuid + " Restarted"
		});
		return reboot.status;
	    }
	}
	return reboot.status;
    } else {
	console.log("Error vm is not running");
	if (callback) {
	    callback(204, {
		message: "Container Id:" + z.uuid + "Already running"
	    });
	    return reboot.status;
	}
    }
}

function install(zonename, brand, uuid, zone_spec) {
    var iz;
    if (brand == 'lx') {
	var img;
	if (zone_spec.docker) {
	    var tags = zone_spec.docker.split("/");
	    if(tags.length != 2) {
		console.log("docker tag setup incorrectly: " + zone_spec.docker);
		return -1;
	    }
	    debug.enabled && console.log("docker tags installing ", tags);
	    img = zfs.docker_pull(tags[0], tags[1]);
	    if(debug.enabled){
		console.log("docker image pulled: " + img);
	    }
	    iz = spawnSync('pfexec', ['zoneadm', '-z', zonename, 'install', '-t',
				      img
				     ], {
					 shell: true
				     });

	} else {
	    let option = '-s';
	    if (validator.isUUID(uuid)) {
		img = '/zcage/images/' + uuid + '.zss.gz';
	    } else {
		img = '/zcage/images/' + uuid;
		option = '-t';
	    }
	    iz = spawnSync('pfexec', ['zoneadm', '-z', zonename, 'install', option,
				      img
				     ], {
					 shell: true
				     });
	}
	if (iz.error != null) {
	    console.log("Error installing ", iz.stderr.toString());
	    console.log("Error installing ", iz.stdout.toString());
	    return iz.status;
	}

    } else {

	if (debug.enabled)
	    console.log("installing ", zonename);

	iz = spawnSync('pfexec', ['zoneadm', '-z', zonename, 'install']);
	if (iz.error != null) {
	    console.log("Error installing ", iz.stderr.toString(),
			iz.stdout.toString());
	    return iz.status;
	}
    }

    if (debug.enabled)
	console.log("zoneadm: install returned ", iz.stderr.toString(), iz.stdout.toString());

    if ((brand == 'bhyve' || brand == 'kvm') && zone_spec['with-image']) {
	img = zfs.ZCAGE.IMAGES + '/' + uuid;

	if (zone_spec['with-image'].toUpperCase().indexOf("CLOUD") > -1) {
	    zone_spec['uses-cloud-init'] = true;
	    /* Ubuntu does not use eth0 */

	    zone_spec.cloud_nic = 'eth0';
	    ubuntu_distros.forEach(function (d) {
		if (zone_spec['with-image'].includes(d)) {
		    zone_spec.cloud_nic = 'enp0s6';
		}
	    })
	}

	if (debug.enabled) {
	    console.log("vm setting image", JSON.stringify(zone_spec, null, 4));
	    console.log("vm image used for zvol creation: " + img);
	    console.log("vm zvol size = " + zone_spec.rctl.quota);
	    console.log(" is cloud init = " + zone_spec['uses-cloud-init']);
	}
	iz = spawnSync('pfexec', ['bhyve-zvol.sh', img, zone_spec.rctl.quota,
				  zone_spec.vm_metadata['disk']
				 ]);
	if (debug.enabled)
	    console.log("bhyve-zvol stdout:" + iz.stdout.toString() +
			"stderr: " + iz.stderr.toString());
	if (iz.error != null) {
	    console.log("Converting to raw ", iz.stderr.toString(),
			iz.stdout.toString());
	    return iz.status;
	}

	if (zone_spec['uses-cloud-init'] == true) {
	    if (!zone_spec.udata) {
		console.log("This seems to be a cloud-init image," +
			    " but --udata was not provided\nNo setup being done");
	    } else {

		iz = spawnSync('pfexec', ['cloud-init.sh', JSON.stringify(zone_spec, null,
									  4)]);

		if (debug.enabled)
		    console.log("cloud-init stdout:" + iz.stdout.toString() +
				"stderr: " + iz.stderr.toString());

		if (iz.error != null) {
		    console.log("Setting up cloud-init data ", iz.stderr.toString(),
				iz.stdout.toString());
		    return iz.status;
		}
	    }
	}
    }
    return iz.status;
}

function uninstall(zonename) {

    var uz = spawnSync('pfexec', ['zoneadm', '-z', zonename, 'uninstall']);
    if (uz.error != null)
	console.log("Error uninstalling ", uz.stderr.toString());

    return uz.status;
}


function create(zonename, zone_spec) {

    var script = spec2script(zone_spec);

    if (debug.enabled) {
	console.log("zone_spec:", JSON.stringify(zone_spec, null, 4));
	console.log("spec2script:", script);
    }

    var status = -1;
    if (script != null) {
	var zonecfg = spawnSync('pfexec', ['zonecfg', '-z', zonename, script]);
	if (debug.enabled)
	    console.log("configuring zone", zonecfg.stdout.toString(),
			zonecfg.stderr.toString());
	if (zonecfg.err != null) {
	    console.log("Error creating", zonecfg.stderr.toString());
	    return null;
	}
	if (zone_spec.brand == 'lx' || zone_spec.brand == 'bhyve' || zone_spec.brand ==
	    'kvm') {
	    status = install(zonename, zone_spec.brand, zone_spec['with-image'],
			     zone_spec);
	    if (status != 0) {
		console.log("Error: Installing zone", zonename);
		return null;
	    }
	} else {
	    status = install(zonename, zone_spec.brand);
	    if (status != 0) {
		console.log("Error: Installing zone", zonename);
		return null;
	    }

	}

	if (zone_spec.brand != 'lx' && zone_spec.brand != 'bhyve' && zone_spec.brand !=
	    'kvm') {
	    status = setupzone(zonename, zone_spec);
	    if (status != 0) {
		console.log("Zone postsetup failed= ", status);
		return status;
	    }
	}

	if ("quota" in zone_spec.rctl) {
	    var cmd = "quota=" + zone_spec.quota + " ";
	    var ds = zfs.GetPool() + zone_spec.zonepath;

	    if (debug.enabled)
		console.log("Setting quota=%s on dataset %s", zone_spec.rctl.quota, ds);

	    var quota = spawnSync('pfexec', ['zfs', 'set', 'quota=' +
					     zone_spec.rctl.quota, ds
					    ]);
	    if (debug.enabled)
		console.log("setting zfs quota", quota.stderr.toString());
	}

    }

    return status;
}

function setupzone(zonename, zone_spec) {

    var status = 0;
    switch (zone_spec.brand) {

    case "sparse":
    case "pkgsrc":
	status = start(zonename);
	if (status != 0) {
	    console.log("Error: Starting zone", zonename);
	}
	var setup = genpostscript(zone_spec);
	status = exec(zonename,
		      "svcs svc:/milestone/multi-user | grep online");
	while (status != 0) {
	    status = exec(zonename,
			  "svcs svc:/milestone/multi-user | grep online");
	}
	exec(zonename, setup);
	break;
    default:
	break;
    }
    return status;
}

function create_zone_spec(resources) {

    var spec = {
	zonepath: "",
	brand: "",
	'ip-type': "exclusive",
	'dns-domain': "",
	resolvers: ["8.8.8.8", "8.8.8.4"],
	autoboot: false
    };

    if (resources != null && ("net", "brand" in resources)) {
	Object.keys(resources).forEach(function (key) {
	    spec[key] = resources[key];
	});
    }

    if (spec.brand === "bhyve" || spec.brand === "kvm") {
	var vm_metadata = {
	    acpi: 'on',
	    netif: 'virtio-net-viona',
	    type: 'generic',
	    vcpus: "1",
	    ram: "2G"
	};
	if (spec.brand === "bhyve") {
	    vm_metadata.bootrom = "BHYVE_RELEASE_CSM";
	    vm_metadata.hostbridge = "intel";
	    vm_metadata.vnc = "unix=/tmp/" + uuidv4() + ".vnc";
	}
	if (spec.brand === "kvm") {
	    vm_metadata.vnc = "on";
	    if (debug.enabled) {
		console.log("zone spec ram: " + spec.ram + "vm_metadata :" + vm_metadata.ram);
	    }

	    if (resources.vm_metadata.ram.includes('gb')) {
		resources.vm_metadata.ram = resources.vm_metadata.ram.replace('gb', 'G');
	    } else {
		resources.vm_metadata.ram = resources.vm_metadata.ram.replace('mb', 'M');
	    }

	    if (debug.enabled) {
		console.log("kvm changing gb|mb to G|M current ram: " + spec.ram +
			    "vm_metadata :" + vm_metadata.ram);
	    }
	}
	spec.vm_metadata = vm_metadata;
	Object.keys(resources.vm_metadata).forEach(function (key) {
	    if (resources.vm_metadata[key] != undefined) {
		spec.vm_metadata[key] = resources.vm_metadata[key];
	    }
	});
    }
    if (debug.enabled) {
	console.log("spec", JSON.stringify(spec, null, 4));
	console.log("VM", JSON.stringify(spec.vm_metadata, null, 4));
    }

    return spec;
}

function spec2script(spec) {
    var script = "";
    script = "create;";
    if (spec.brand == 'lx') {
	script +=
	    "add attr;set name=kernel-version;set type=string;set value=3.16.0;end;";
    }
    Object.keys(spec).forEach(function (key) {
	switch (key) {
	case "net":
	    spec.net.forEach(function (e) {
		script +=
		    " add net ;";
		if (e.address == 'dhcp') {
		    script += "set physical=" + e.physical + ";";
		    if (spec.brand == 'lx') {
			script += "add property (name=ip,value=\"dhcp\");";
			script += "add property (name=primary,value=\"true\");";
			script += "add property (name=ips,value=\"dhcp\");";
			script += "add property (name=primary,value=\"true\");";
		    }
		    script += " end;";
		} else {
		    script += "set physical=" + e.physical + ";";
		    var prefix = ip.IPv4.parse(e.netmask.toString())
			.prefixLengthFromSubnetMask();
		    var addr = e.address + "/" + prefix +
			";";
		    script += "set allowed-address=" + addr +
			";";
		    script += "set defrouter=" + e.gateway +
			";";
		    script += " end;";
		}
	    });
	    break;

	case "resolvers":
	    script +=
		"add attr;set name=resolvers;set type=string;set value=";
	    for (var i = 0, len = spec.resolvers.length; i < len; i++) {
		if (i + 1 >= len)
		    script += spec.resolvers[i] + ";";
		else
		    script += spec.resolvers[i] + ",";
	    }
	    script += "end;";
	    break;
	case "dns-domain":
	    break;

	case "rctl":
	    if ("dedicated-cpu" in spec.rctl) {
		script += "add dedicated-cpu;set ncpus=" +
		    spec.rctl["dedicated-cpu"] + ";";
		if ("importance" in spec.rctl) {
		    script += "set importance=" + spec.rctl.importance +
			";";
		}
		script += "end; ";
	    }

	    Object.keys(spec.rctl).forEach(function (key) {
		if (key == 'quota') {
		    script +=
			"add attr; set name=quota;set type=string;" +
			" set value=" + spec.rctl.quota +
			";end;";
		} else
		    if (key == "max-physical-memory" ||
			key == "max-locked-memory" ||
			key == "max-swap" ||
			key == "max-lwps" ||
			key == "max-shm-ids" ||
			key == "max-msg-ids" ||
			key == "max-shm-memory") {
			script += "add rctl;";
			script += "set name=zone." + key + ";" +
			    "add value (priv=privileged,limit=" +
			    spec.rctl[key] + ",action=deny);";

			script += "end; ";
		    } else if (key == "cpu-shares") {
			script += "set cpu-shares=" + spec.rctl["cpu-shares"] +";"  
		    }
	    });
	    break;

	case "vm_metadata":

	    Object.keys(spec.vm_metadata).forEach(function (key) {
		switch (key) {
		case 'vnc':
		    script +=
			"add attr; set type=string;set name=" +
			key + "; set value=" +
			"\"" + spec.vm_metadata[key] +
			"\"" +
			" ;end;";
		    script +=
			"add attr; set type=string;" +
			"set name=vnc-port;" +
			"set value=" +
			(Math.floor(Math.random() *
				    (5999 - 5900) + 5900)).toString() +
			";end;;";
		    break;
		case 'ram':
		case 'bootrom':
		case 'console':
		case 'hostbridge':
		case 'cdrom':
		case 'vcpus':
		case 'bootorder':
		case 'bootdisk':
		    script +=
			"add attr; set type=string;set name=" +
			key + "; set value=" +
			"\"" + spec.vm_metadata[key] +
			"\"" +
			" ;end;";
		    break;

		case 'disk':
		    script += "add device; set match=" +
			"/dev/zvol/rdsk/" +
			spec.vm_metadata.bootdisk +
			" ; end;";
		    break;

		case 'fs':
		    script += "add fs; set dir=" + "\"" +
			spec.vm_metadata[key] + "\"" +
			";set special=" + "\"" +
			spec.vm_metadata[key] + "\"" +
			"; set type=lofs;add options ro;" +
			"add options nodevices;end;";
		    break;

		case 'device':
		    script += "add device; set match=" +
			spec.vm_metadata[key] +
			";end;";
		    break;

		}
	    });
	    break;

	default:
	    if (key != 'with-image' && key != 'alias' && key != 'debug' && key !=
		'docker' && key != 'udata' && key != 'cpu' && key != 'image' && key != "Cmd")
		script += " set " + key + "=" + spec[key] + ";";
	    break;

	}

    });
    script += ";verify; commit;";


    if (debug.enabled)
	console.log(arguments.callee.name, script.split(';'));

    return script;
}

/*
 * This is needed to setup networking in sparse zones
 *  # zoneadm -z omni boot
 *  # zlogin omni
 *  # ipadm create-if omni0
 *  # ipadm create-addr -T static -a local=x.x.x.x/y omni0/v4
 *  # echo x.x.x.x > /etc/defaultrouter
 *  # echo nameserver 80.80.80.80 > /etc/resolv.conf
 *  # cp /etc/nsswitch.{dns,conf}
 *  # svcadm restart routing-setup
 */

function genpostscript(zone_spec) {
    var postshellcmd = "";
    switch (zone_spec.brand) {
    case "sparse":
    case "pkgsrc":
    case "lipkg":
    case "ipkg":
    case "bhyve":
    case "kvm":
	postshellcmd = "sleep 1; ";

	var resolvers = zone_spec.resolvers.toString().split(",");
	for (var i = 0, len = resolvers.length; i < len; i++) {
	    postshellcmd += " echo nameserver " + resolvers[i] +
		" >> /etc/resolv.conf &&";
	}
	postshellcmd += "echo " + zone_spec.alias + " > /etc/nodename";

	// Setup dhcp on interface if requested
	zone_spec.net.forEach(function (net) {
	    if (net.address == "dhcp") {
		postshellcmd += "ipadm create-if " + net.physical + ";";
		postshellcmd += "ipadm create-addr -T dhcp " + net.physical + "/v4 " +
		    ";";
	    }
	});
	postshellcmd += "sleep 1; ";
	postshellcmd +=
	    " cp /etc/nsswitch.{dns,conf} && svcadm restart routing-setup ";
	break;
    default:
	postshellcmd = null;
    }
    if (debug.enabled)
	console.log("postshellcmd :" + postshellcmd);
    return postshellcmd;
}
/*
 *  Parses --ipaddr="vnic0|192.168.1.1/24|gateway,.."
 *  to a network json tag
 */
function ipaddrcmd2netobject(ipaddr) {

    if (debug.enabled)
	console.log(ipaddr);

    var networks = ipaddr;
    var net = [];
    for (var i = 0, l = networks.length; i < l; i++) {
	var o = {};
	addrnic = networks[i].split("|");
	if (addrnic.length < 2) {
	    console.log(
		'not enough parameters in --net=vnic|vm-ip|vm-gateway-ip'
	    );
	    return null;
	}
	o.physical = addrnic[0];
	var address = addrnic[1].split("/");
	o.address = address[0];
	try {
	    if (o.address != "dhcp") {
		if (ip.parse(o.address).kind() == "ipv4") {
		    o.netmask = ip.IPv4.subnetMaskFromPrefixLength(address[1]).toString();
		} else {
		    o.netmask = ip.IPv6.subnetMaskFromPrefixLength(address[1]).toString();
		}
	    }
	} catch (ex) {
	    console.log("zone definition is invalid", ex.message);
	    return null;
	}
	if (o.address != "dhcp")
	    o.gateway = addrnic[2];
	net.push(o);
    }
    if (debug.enabled)
	console.log("network is ", net);

    return net;
}


function build(createOptions) {

    if (createOptions.debug == true)
	debug.enabled = true;

    if (debug.enabled)
	console.log("CreateOptions ", JSON.stringify(createOptions, null, 4));

    if (!isAbletoexec()) {
	console.log(
	    "You must have Primary Administrator Privileges to create zones");
	return null;
    }
    var zname;
    if ("net" in createOptions) {

	if (!vnic_exists(createOptions)) {
	    return null;
	}

	createOptions.net =
	    ipaddrcmd2netobject(createOptions.net);

	if (createOptions.net === null) {
	    return null;
	}
	if ("alias" in createOptions) {
	    zname = createOptions.alias;
	    delete createOptions.alias;
	} else {
	    zname = dockerNames.getRandomName(true);
	}
	createOptions.zonepath = `/zcage/vms/${zname}`;
	createOptions.alias = zname;

	if ("ram" in createOptions) {
	    createOptions.rctl = addrctl(createOptions);
	    if (createOptions.rctl == null) {
		return null;
	    }
	}
	if (createOptions['with-image'] && createOptions.disk) {
	    console.log("--with-image and --disk are mutually exclusive");
	    return null;
	}

	if (createOptions.brand === "bhyve" || createOptions.brand === "kvm") {
	    if (createOptions['with-image'])
		createOptions.disk = zfs.GetPool() + '/' + zname;
	    createOptions.vm_metadata = {
		ram: createOptions.ram,
		vcpus: createOptions.cpu,
		disk: createOptions.disk,
		bootdisk: createOptions.disk,
		cdrom: createOptions.cdrom,
		hostbridge: createOptions.hostbridge,
		fs: createOptions.cdrom,
	    };
	    if (debug.enabled) {
		console.log("vm data",
			    JSON.stringify(createOptions.vm_metadata, null, 4));
	    }

	    delete createOptions.cpu;
	    delete createOptions.cdrom;
	    delete createOptions.disk;
	    delete createOptions.bootdisk;
	}

	delete createOptions.ram;
	delete createOptions.quota;

	var zone = getdata(zname);

	if (zone != null) {
	    console.log("Error : alias already exists");
	    return null;
	}

	if (!createOptions.docker &&
	    createOptions['with-image'] &&
	    (!fs.existsSync(zfs.ZCAGE.IMAGES + '/' + createOptions['with-image'] +
			    '.zss.gz') &&
	     !fs.existsSync(zfs.ZCAGE.IMAGES + '/' + createOptions['with-image']))) {

	    console.log(
		"There is no image , first execute: pfexec zcage pull --image <uuid> or zcage fetch <url>."
	    );
	    return null;
	}

	if (createOptions.brand != 'lx' && createOptions.docker) {
	    console.log("--docker option is only available for lx branded zones");
	    return null;
	}
	if (createOptions.brand == 'lx' && !("with-image" in createOptions) && !
	    createOptions.docker) {
	    console.log("--with-image option is required for a lx container");
	    return null;
	}
	if (createOptions.brand != 'lx' &&
	    createOptions.brand != 'bhyve' &&
	    createOptions.brand != 'kvm' &&
	    ("with-image" in createOptions)) {
	    console.log(
		"--with-image option is only valid for a lx, bhyve or kvm brand "
	    );
	    return null;
	}

	if (createOptions.udata && (createOptions.brand != 'bhyve' &&
				    createOptions.brand != 'kvm' || !fs.existsSync(createOptions.udata))) {
	    console.log("--udata is only valid for a bhyve or kvm brand");
	    console.log("--udata needs to be a json file with the following format\n" +
			' { "userid ": " joe ", " pubkey ": " ssh-rsa key"}');
	    return null;
	}

	if (debug.enabled)
	    console.log("createOptions:  " + JSON.stringify(createOptions, null, 4));

	var z = create_zone_spec(createOptions);

	if (validate_zonespec(z) === null)
	    return null;

	if (create(zname, z) === 0) {
	    addmeta(zname, false);
	    console.log(chalk `${zname} created [{green.bold OK}] `);
	} else {
	    console.log("Failed creating zone: ", zname);
	    return -1;
	}
	if ((createOptions.brand == 'bhyve' || createOptions.brand == 'kvm') &&
	    z['uses-cloud-init'] == true) {
	    if (debug.enabled)
		console.log("Using cloud-init config" + z.zonepath + '/root/config.iso');
	    start(zname, z.zonepath + '/root/config.iso');
	} else if (createOptions.brand == 'lx') {
	    start(zname);
	}

    } else {
	console.log(`missing --net=vnic|zone-ipaddr|zone-ip-gateway`);
	return null;
    }
}

function addrctl(createOptions, zname) {
    let rctl = {};
    let obj = {};
    let z = {};
    z.brand = createOptions.brand;
    if (debug.enabled) {
	console.log("addrctl for " + zname + " " + JSON.stringify(createOptions, null,
								  4));
    }
    if (zname) {
	if (validator.isUUID(zname)) {
	    z = getdata(zname, zname);
	} else {
	    z = getdata(zname);
	}
	if (z == null) {
	    console.log("Container does not exists");
	}
    }

    if (z.brand != 'bhyve' && z.brand != 'kvm') {
	if ("ram" in createOptions) {
	    rctl.ram = createOptions.ram;
	    if (/^[0-9]+(gb|mb)$/.test(rctl.ram.toLowerCase())) {
		obj['max-physical-memory'] = bytes.parse(rctl.ram).toString();
		obj['max-locked-memory'] = bytes.parse(rctl.ram).toString();
		obj['max-swap'] = (bytes.parse(rctl.ram).toString() * 2).toString();
		obj['cpu-shares'] = ((bytes.parse(rctl.ram).toString() /
				      1024 / 1024) * 2).toString();
		obj['max-lwps'] = '3000';
	    } else {
		console.log("Error Memory should be specified as mb or gb");
		return null;
	    }
	}

	if ("dedicated-cpu" in createOptions) {
	    obj['dedicated-cpu'] = createOptions['dedicated-cpu'];
	    obj.importance = createOptions['dedicated-cpu-importance'];
	} else if ("cpu-shares" in createOptions) {
	    if (/^[0-9]+$/.test(createOptions['cpu-shares'])) {
		obj['cpu-shares'] = createOptions['cpu-shares'];
	    } else {
		console.log("cpu-shares must be numeric");
		return null;
	    }
	}
	if ("max-lwps" in createOptions) {
	    obj['max-lwps'] = createOptions['max-lwps'];
	}
    }
    if ("quota" in createOptions) {
	obj.quota = createOptions.quota;
    }

    if ("autoboot" in createOptions) {
	obj.autoboot = createOptions.autoboot;
    }
    if (createOptions.ram && (z.brand == 'bhyve' || z.brand == 'kvm')) {
	if (createOptions.ram.includes('gb'))
	    obj['vm_ram'] = createOptions.ram.replace('gb', 'G');
	else
	    obj['vm_ram'] = createOptions.ram.replace('mb', 'M');
    }
    if (debug.enabled)
	console.log("rctl object", JSON.stringify(obj, null, 4));

    return obj;
}

function update_rctl(zname, newrctl, callback, callback2) {

    var parser = new xml2js.Parser();
    var z;
    var zonename;
    if (validator.isUUID(zname)) {
	z = getdata(zname, zname);
    } else {
	z = getdata(zname);
    }
    if (z == null) {
	console.log("Container does not exists");
    }

    zonename = z.zonename;
    attr = {};
    attr = {
	name: "UpdatedAt",
	value: (new Date()).toISOString()
    };

    addattr(zonename, attr, true);

    if (z.brand == 'bhyve' || z.brand == 'kvm') {
	let script;
	if ('quota' in newrctl) {
	    var cmd = "quota=" + newrctl.quota + " ";
	    var ds = zfs.GetPool() + z['zone-path'];
	    var quota = spawnSync('pfexec', ['zfs', 'set',
					     'quota=' + newrctl.quota, ds
					    ]);
	    script += ";remove attr name=quota; add attr; set name=quota;" +
		"set type=string;set value=" + newrctl.quota + ";end;"
	    if (debug.enabled)
		console.log("update rclt", quota.stderr.toString());
	}

	script +=
	    ";remove attr name=ram; add attr; set name=ram;set type=string;" +
	    "set value=" + newrctl['vm_ram'] + ";end;";
	let r = spawnSync('pfexec', ['zonecfg', '-z', zonename, script]);
	if (r.error != null) {
	    console.log("Updating Ram for zone: " + zonename +
			" failed. stdout: " +
			r.stdout.toString() + " errmsg:" + r.stderr.toString());
	}
	return;
    }

    fs.readFile('/etc/zones/' + zonename + '.xml', function (err, data) {
	parser.parseString(data, function (err, result) {
	    if (err) {
		console.log("Error reading xml", err);
		return null;
	    }
	    var oldrctl = {};
	    var tmp = {};

	    if ('max-physical-memory' in newrctl)
		tmp["zone.max-physical-memory"] = newrctl[
		    'max-physical-memory'];

	    if ('max-locked-memory' in newrctl)
		tmp["zone.max-locked-memory"] = newrctl[
		    'max-locked-memory'];

	    if ('max-swap' in newrctl)
		tmp["zone.max-swap"] = newrctl['max-swap'];

	    if ('max-lwps' in newrctl)
		tmp["zone.max-lwps"] = newrctl['max-lwps'];

	    if ('max-shm-ids' in newrctl)
		tmp["zone.max-shm-ids"] = newrctl['max-shm-ids'];

	    if ('max-msg-ids' in newrctl)
		tmp["zone.max-msg-ids"] = newrctl['max-msg-ids'];

	    if ('max-shm-memory' in newrctl)
		tmp["zone.max-shm-memory"] = newrctl[
		    'max-shm-memory'];

	    if ('dedicated-cpu' in newrctl) {
		tmp["dedicated-cpu"] = newrctl['dedicated-cpu'];
	    } else {
		if ('cpu-shares' in newrctl)
		    tmp["zone.cpu-shares"] = newrctl['cpu-shares'];
	    }
	    if ('importance' in newrctl)
		tmp.importance = newrctl.importance;

	    if ('autoboot' in newrctl)
		tmp.autoboot = newrctl.autoboot;

	    if (result.zone.rctl)
		Object.keys(result.zone.rctl).forEach(function (key) {
		    let obj = result.zone.rctl[key];
		    var value = obj['rctl-value'][0];
		    oldrctl[obj.$.name] = value.$.limit;
		});

	    if (result.zone.pset)
		Object.keys(result.zone.pset).forEach(function (
		    key) {
		    let obj = result.zone.pset[key].$;
		    let max = obj.ncpu_max;
		    let min = obj.ncpu_min;
		    oldrctl['dedicated-cpu'] =
			`${min}-${max}`;
		});


	    if ('quota' in newrctl) {
		var cmd = "quota=" + newrctl.quota + " ";
		var ds = zfs.GetPool() + z['zone-path'];
		var quota = spawnSync('pfexec', ['zfs', 'set',
						 'quota=' + newrctl.quota, ds
						]);
		if (debug.enabled)
		    console.log("update rclt", quota.stderr.toString());
	    }
	    if (z.brand == 'bhyve' || z.brand == 'kvm') {
		script +=
		    ";remove attr name=ram; add attr; set name=ram;set type=string;" +
		    "set value=" + tmp['zone.max-physical-memory'] + ";end;";
		let r = spawnSync('pfexec', ['zonecfg', '-z', zonename, script]);
		if (r.error != null) {
		    console.log("Updating Ram for zone: " + zonename +
				" failed. stdout: " +
				r.stdout.toString() + " errmsg:" + r.stderr.toString());
		}
		return;
	    }

	    var script = " ";
	    var rctl;

	    var zinitpid = spawnSync('pgrep', ['-z', zonename,
					       'init'
					      ]);
	    if (zinitpid.error != null) {
		console.log(
		    `Error getting updating zone resources `
		);
		pid = null;
	    }

	    pid = zinitpid.stdout.toString();
	    Object.keys(tmp).forEach(function (key) {
		var rctl;
		if (!(key in oldrctl)) {
		    if (key == "importance") {} else
			if (key == "autoboot") {
			    script += "set autoboot=" + tmp[
				key] + ";end;";
			} else
			    if (key == "dedicated-cpu") {
				if(oldrctl["zone.cpu-shares"] ) {
				    script += " remove rctl name=zone.cpu-shares;"
				} else if( oldrctl["cpu-shares"]){
				    script += " remove cpu-shares;"
				}
				script +=
				    "add dedicated-cpu ; ";
				script += "set ncpus=" + tmp[
				    key] + ";";
				if (tmp.importance != undefined) {
				    script += "set importance=" +
					tmp.importance + ";";
				    delete tmp.importance;
				}
				script += ";end;";
			    } else if (key == "zone.cpu-shares" || key == "cpu-shares") {
				if(key == "zone.cpu-shares")
				    script += " remove rctl name=zone.cpu-shares;";
				else 
				    script += " remove cpu-shares;";

				script +="set cpu-shares=" + tmp[key] +";end;" 
				script += 
				    "remove dedicated-cpu; ";
			    } else {
				script += "add rctl ; ";
				script += " set name=" + key +
				    ";";
				script +=
				    "add value (priv=privileged,limit=" +
				    tmp[key] + ",action=deny);";
				script += "end;";
			    }
		    if (debug.enabled)
			console.log("script ", script);
		    if (pid) {
			rctl = spawnSync('pfexec', [
			    'prctl', '-n',
			    `zone.${key}`, '-s',
			    '-v', tmp[key], pid
			], {
			    shell: true
			});
			if (rctl.err)
			    console.log(
				"Error updating resources ",
				rctl.stderr.toString());
		    }

		}
	    });

	    Object.keys(oldrctl).forEach(function (key) {
		var rctl;
		if (key == "autoboot") {
		    script += "set autoboot=" + tmp[key] +
			";end;";
		} else
		    if (key == "zone.max-physical-memory" ||
			key == "zone.max-locked-memory" ||
			key == "zone.max-swap" ||
			key == "zone.max-lwps" ||
			key == "zone.max-shm-ids" ||
			key == "zone.max-msg-ids" ||
			key == "zone.max-shm-memory" ||
			key == "dedicated-cpu") {
			if (tmp[key] != undefined) {
			    if (key == "dedicated-cpu") {
				if(oldrctl['zone.cpu-shares']) {
				    script += " remove rctl name=zone.cpu-shares;"
				    script += " remove cpu-shares;"
				}
				script += 
				    "remove dedicated-cpu ; ";
				script +=
				    "add dedicated-cpu ; ";
				script += "set ncpus=" +
				    tmp[key] + ";";
				if (tmp.importance !=
				    undefined) {
				    script +=
					"set importance=" +
					tmp.importance +
					";";
				    delete tmp.importance;
				}
				script += ";end;";
				if (pid) {
				    rctl = spawnSync(
					'pfexec', [
					    'prctl',
					    '-n',
					    `${key}`,
					    '-r', '-v',
					    tmp[key],
					    pid
					], {
					    shell: true
					});
				    if (rctl.err)
					console.log(
					    "Error updating resources ",
					    rctl.stderr.toString()
					);
				}

			    } else {
				script += "select rctl ";
				script += " name=" + key +
				    ";" +
				    "remove value (priv=privileged,limit=" +
				    oldrctl[key] +
				    ",action=deny);";
				script +=
				    "add value (priv=privileged,limit=" +
				    tmp[key] +
				    ",action=deny);";
				script += "end;";

				if (pid) {
				    rctl = spawnSync(
					'pfexec', [
					    'prctl',
					    '-n',
					    `zone.${key}`,
					    '-r', '-v',
					    tmp[key],
					    pid
					], {
					    shell: true
					});
				    if (rctl.err)
					console.log(
					    "Error updating resources ",
					    rctl.stderr.toString()
					);
				}
			    }
			}
		    } else if (key == "zone.cpu-shares" || key == "cpu-shares") {

			if (tmp[key] != undefined) {

			    if(key=="zone.cpu-shares")
				script += " remove rctl name=zone.cpu-shares;";
			    else 
				script += " remove cpu-shares;";

			    script += " set cpu-shares=" + tmp[key] +";" ;
			    script += "remove dedicated-cpu; ";
			    if (z.brand == 'bhyve' || z.brand == 'kvm') {
				script +=
				    ";remove attr name=ram; add attr; set name=ram;set type=string;" +
				    "set value=" + tmp['zone.max-physical-memory'] + ";end;";
			    }
			    debug.enable && console.log(script);
			    if (pid) {
				rctl = spawnSync('pfexec',
						 [
						     'prctl', '-n',
						     `zone.${key}`,
						     '-r', '-v', tmp[
							 key], pid
						 ], {
						     shell: true
						 });
				if (rctl.err)
				    console.log(
					"Error updating resources ",
					rctl.stderr.toString()
				    );
			    }

			}
		    }
	    });
	    if (debug.enabled)
		console.log("script end ", script);
	    callback(err, zonename, script, callback2);
	});
    });
    console.log(chalk `${zname} updated [{green.bold OK}] `);
}


function getzonedata(zname, callback, zobj) {

    var parser = new xml2js.Parser();
    var z;
    var zonename;
    if (validator.isUUID(zname)) {
	z = getdata(zname, zname);
    } else {
	z = getdata(zname);
    }
    if (z == null) {
	console.log("zone " + zname + "does not exists");
	if (callback) {
	    callback({
		message: "No such container: " + z.uuid
	    });
	}
	return null;
    }
    if (z.state == 'incomplete') {
	if (debug.enabled)
	    console.log("incomplete container");
	if (callback) {
	    callback({
		name: 'incomplete'
	    }, zobj);
	}
	return null;
    }
    zonename = z.zonename;
    fs.readFile('/etc/zones/' + zonename + '.xml', function (err, data) {
	parser.parseString(data, function (err, result) {
	    let zone = {};
	    let o = {};
	    Object.keys(result.zone.$).forEach(function (key) {
		o[key] = result.zone.$[key];
	    });
	    zone.id = z.uuid;
	    zone.state = z.state;
	    zone.name = o.name;
	    zone.brand = o.brand;
	    zone.autoboot = o.autoboot;
	    zone.ram = 'uncapped';
	    o = {};
	    if (result.zone.rctl &&
		(z.brand != 'bhyve' && z.brand != 'kvm')) {
		Object.keys(result.zone.rctl).forEach(function (key) {
		    let obj = result.zone.rctl[key];
		    var rctl = obj['rctl-value'][0];
		    o[obj.$.name] = rctl.$.limit;
		    if (obj.$.name == 'zone.max-physical-memory')
			zone.ram = rctl.$.limit / 1024 /
			1024 + 'M';
		});
	    }
	    attrs = {};
	    if (result.zone.attr) {
		Object.keys(result.zone.attr).forEach(function (
		    key) {
		    let obj = result.zone.attr[key];
		    attrs[obj.$.name] = obj.$.value;
		});
	    }

	    if (attrs.quota) {
		zone.quota = attrs.quota;
		delete attrs.quota;
	    }

	    onet = {};
	    onet.network = [];
	    if (result.zone.network) {
		Object.keys(result.zone.network).forEach(function (
		    key) {
		    let obj = result.zone.network[key];
		    if (obj['net-attr']) {
			Object.keys(obj['net-attr']).forEach(function (key) {
			    let net = obj['net-attr'][key].$;
			    let ip, gw;
			    if (net.name == 'ips')
				onet['network']['allowed-address'] = net.value;
			    else
				if (net.name == "gateway")
				    onet['network']['defrouter'] = net.value;

			});
			onet.network['physical'] = obj.$.physical;
		    } else if (!obj.$['allowed-address']) {
			onet['network'].push({
			    nic: obj.$.physical,
			    ipaddress: 'dhcp'
			});
		    } else {
			onet['network'].push({
			    ipaddress: obj.$['allowed-address'],
			    gateway: obj.$['defrouter'],
			    nic: obj.$.physical
			});

		    }
		});
	    }

	    if (attrs.CreatedAt && attrs.UpdatedAt) {
		zone.CreatedAt= attrs.CreatedAt;
		zone.UpdatedAt= attrs.UpdatedAt;
		delete attrs.CreatedAt;
		delete attrs.UpdatedAt;
	    }
	    if (attrs.Cmd) {
		zone.Cmd = attrs.Cmd;
	    }
	    if (result.zone.network) {
		zone.network = onet['network'];
	    }

	    if (zone.network && attrs.resolvers) {
		zone.network['resolvers'] = attrs.resolvers.split(',');
		delete attrs.resolvers;
	    }

	    switch (z.brand) {
	    case 'bhyve':
	    case 'kvm':
		zone.vm_data = attrs;
		zone.ram = zone.vm_data.ram;
		if (zone.ram.toUpperCase().includes('G'))
		    zone.ram = bytes.parse(zone.ram).toString() * 1024 + 'M';
		else
		    zone.ram = bytes.parse(zone.ram).toString() + 'M';
		delete zone.vm_data.ram;
		break;
	    }
	    if (callback) {
		callback(zone, zobj);
	    } else {
		console.log(JSON.stringify(zone, null, 4));
		return zone;
	    }
	});
    });
}

/*
 * Returns an array of currently used nics by running containers
 */

function vnicused(zonename, array) {
    let obj = {
	state: "running"
    };
    let z = [];
    let nic_wanted = [];
    var parser = new xml2js.Parser();
    var running = listzones(obj, true);
    var result = null;
    var data;

    for (var i = 0, l = running.length; i < l; i++) {
	data = fs.readFileSync('/etc/zones/' + running[i].zonename + '.xml');
	parser.parseString(data, function (innerError, innerJson) {
	    error = innerError;
	    result = innerJson;
	});
	Object.keys(result.zone.network).forEach(function (key) {
	    let obj = result.zone.network[key];
	    z.push(obj.$.physical);
	});
    }
    if (array)
	return z;

    data = fs.readFileSync('/etc/zones/' + zonename + '.xml');
    parser.parseString(data, function (innerError, innerJson) {
	error = innerError;
	result = innerJson;
    });
    if(result.zone.network)
	Object.keys(result.zone.network).forEach(function (key) {
	    let obj = result.zone.network[key];
	    nic_wanted.push(obj.$.physical);
	});

    for (i = 0; i < nic_wanted.length; i++) {
	if (z.indexOf(nic_wanted[i]) !== -1) {
	    return true;
	}
    }
    return false;
}

function validate_zonespec(z) {
    var schema = {
	"type": "object",
	"properties": {
	    "zonepath": {
		"type": "string"
	    },
	    "brand": {
		"type": "string",
		"enum": ["sparse", "ipkg", "lipkg", "lx", "bhyve", "kvm", "pkgsrc"]
	    },
	    "ip-type": {
		"type": "string",
		"enum": ["exclusive"]
	    },
	    "autoboot": {
		"type": "boolean"
	    },
//	    "additionalProperties": false,
//	    "net": {
//		"type": "array",
//		"items": {
//		    "type": "object",
//		    "properties": {
//			"physical": {
//			    "type": "string"
//			},
//			"address": {
//			    "type": "string",
//			},
//			"netmask": {
//			    "type": "string",
//			},
//			"gateway": {
//			    "type": "string",
//			}
//		    }
//		}
//	    },
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
	//"required": ["zonepath", "net", "brand"]
	"required": ["zonepath",  "brand"]
    };
    var ajv = new Ajv({
	allErrors: true
    });

    var validate = ajv.compile(schema);
    var valid = validate(z);

    if (!valid) {
	console.log("zone" + validate.errors[0].dataPath + " " + validate.errors[0].message);
	if (debug.enabled)
	    console.log("error is ", validate.errors);
	return null;
    }
    return 0;
}

function isAbletoexec() {
    var uid = spawnSync('whoami');
    var user = uid.stdout.toString().replace(/\n$/, '');
    if (user == 'root') return true;
    var prim = spawnSync('grep', ['-i', user, '/etc/user_attr']);
    if (prim.stdout.indexOf('Primary Administrator') > -1)
	return true;
    return false;
}

function isvnc_enabled(zone, brand) {
    getzonedata(zone.zonename, function (zdata) {
	var unixds;
	if (debug.enabled)
	    console.log("zone data", zone);
	var obj = zdata.vm_data;
	if (brand == 'bhyve') {
	    unixds = zone['zone-path'] + '/root' +
		obj.vnc.split("unix=")[1] +
		" " + obj['vnc-port'];
	} else {
	    unixds = zone['zone-path'] + '/root/tmp/vm.vnc' +
		" " + obj['vnc-port'];
	}
	if (debug.enabled) {
	    console.log("/usr/lib/brand/" + brand + "/socat " + unixds);
	}

	var child = spawn("pfexec /usr/lib/brand/" + brand + "/socat " + unixds, {
	    shell: true,
	    detached: true,
	    stdio: 'ignore'
	});
	child.unref();
    });
}

function vnic_exists(zone) {
    var cmd = "pfexec dladm show-vnic | awk '{ if (NR != 1) {print $1}}'";
    var rc = false;
    var nics = [];
    r = spawnSync(cmd, {
	shell: true
    });

    zone.net.forEach(function (nic) {
	if (!r.error) {
	    nics = r.stdout.toString().split('\n');
	    if (nics.indexOf(nic.split('|')[0]) !== -1) {
		rc = true;
		return;
	    }
	}
    })

    if (debug.enabled)
	console.log("return rc = ", rc);
    if (rc == false)
	console.log("Error: nic", net, "does not exists");
    return rc;
}

/* Add a string attribute to zone 
 * attr = { name: 'attrname', value: 'val'}
 * Remove then set attribute.
 * op = true|false 
 */

function addattr(zname, attr, op) {
    var zoption = '-z';
    let script = "";
    if (op) {
	script += ";remove attr name=" + attr.name + ";";
    }
    script += 'add attr; set type=string;set name=' +
	attr.name + ';set value=' + attr.value + ";end;verify;commit";
    var r = spawnSync('pfexec',
		      ['zonecfg', zoption, zname, script]);

    if (debug.enabled) {
	console.log("Adding metadata: " + script);
    }
    if (r.err != null) {
	console.log(r.stderr.toString());
	return r.status;
    }
    return r.status;
}

function addmeta(zname, op) {
    attr = {
	name: "CreatedAt",
	value: (new Date()).toISOString()
    };
    addattr(zname, attr, op);
    attr = {};
    attr = {
	name: "UpdatedAt",
	value: (new Date()).toISOString()
    };
    addattr(zname, attr, op);
}
/*
 *  Rest API from https://docs.docker.com/engine/api/v1.30/
 */
function get_containers(cb) {
    let lzones = listzones(null, true);
    var jzones = [];
    lzones = lzones.filter(zone => (zone.state != 'incomplete'));
    var zobj = {
	zcnt: lzones.length,
	cb: cb
    };
    for (var i = 0, len = lzones.length; i < len; i++) {
	getzonedata(lzones[i].zonename, function (zdata, zobj) {
	    if (zdata.name != 'incomplete')
		jzones.push(zdata);
	    if (jzones.length >= zobj.zcnt) {
		zobj.cb(jzones);
	    }
	}, zobj);
    }
}

function create_container(zdef, callback) {
    var zone;
    if (zdef.alias) {
	zone = getdata(zdef.alias);
	if (zone != null) {
	    console.log("Error : alias already exists");
	    callback(409, {
		message: "Container name already exists"
	    });
	    return;
	}
    } else {
	zdef.alias = dockerNames.getRandomName(true);
    }
    zconverted = convert_zjson_to_coptions(zdef);
    var r = validate_brand_reqs(zconverted);

    if (r.statusCode != '201') {
	callback(400, r);
	return;
    }

    var z = create_zone_spec(zconverted);

    if (validate_zonespec(z) === null) {
	callback(400, {
	    message: "zone json spec is not valid"
	});
	return;
    }
    zconverted.name = zdef.alias;
    if (create(zdef.alias, z) === 0) {
	addmeta(zdef.alias, false);
        if(zdef.Cmd) {
	    addattr(zdef.alias,{name: "Cmd", value: "\"" + zdef.Cmd +"\""  },false); 
	}
	zone = getdata(zdef.alias);
	var warn = [];
	
	if (zdef.net && vnicused(zdef.alias)) {
	    warn.push("vnic is being used by other container");
	}
	callback(201, { Id: zone.uuid, Warnings: warn });
	if ((zdef.brand == 'bhyve' || zdef.brand == 'kvm') &&
	    z['uses-cloud-init'] == true) {
	    if (debug.enabled)
		console.log("Using cloud-init config" + z.zonepath + '/root/config.iso');
	    start(zdef.alias, z.zonepath + '/root/config.iso');
	} 
	return;
    } else {
	console.log("Failed creating zone: ", zdef.zname);
	callback(400, {
	    message: "Failed creating zone"
	});
	return;
    }
}

function convert_zjson_to_coptions(zdef) {
    var rctl = {};
    var obj = {};
    var newzdef = zdef;
    //set defaults 
    if (!newzdef.ram) {
	newzdef['ram'] = "1gb";
    }
    if ("quota" in newzdef) {
	newzdef.rctl.quota = zdef.quota;
	delete newzdef.quota;
    } else {
	obj['quota'] = "10G";
    }

    if(zdef.docker) {
	zdef.brand = 'lx';
	newzdef.brand = 'lx';
    }
    switch (zdef.brand) {
    case 'lx':
	if (zdef['image']) {
	    var img = zfs.image_id2fname(zdef.image);
	    newzdef['with-image'] = img.filename;
	    delete newzdef.image;
	}
	rctl.ram = zdef.ram;
	if (/^[0-9]+(gb|mb)$/.test(rctl.ram.toLowerCase())) {
	    obj['max-physical-memory'] = bytes.parse(rctl.ram).toString();
	    obj['max-locked-memory'] = bytes.parse(rctl.ram).toString();
	    obj['max-swap'] = (bytes.parse(rctl.ram).toString() * 2).toString();
	    obj['cpu-shares'] = ((bytes.parse(rctl.ram).toString() /
				  1024 / 1024) * 2).toString();
	    obj['max-lwps'] = '3000';
	} else {
	    console.log("Error Memory should be specified as mb or gb");
	    return null;
	}
	delete newzdef.ram;
	newzdef.rctl = obj;

	break;

    case 'bhyve':
    case 'kvm':
	if (zdef.ram.includes('gb'))
	    obj['vm_ram'] = zdef.ram.replace('gb', 'G');
	else
	    obj['vm_ram'] = zdef.ram.replace('mb', 'M');

	delete newzdef.ram;
	newzdef.rctl = obj;

	if (zdef['image']) {
	    var img = zfs.image_id2fname(zdef.image);
	    newzdef['with-image'] = img.filename;
	    delete newzdef.image;
	}
	let vcpus = "1"
	if (zdef.cpu) {
	    vcpus = zdef.cpu;
	    delete newzdef.cpu;
	}
	newzdef['vm_metadata'] = {
	    ram: obj['vm_ram'],
	    disk: 'rpool/' + zdef.alias,
	    bootdisk: 'rpool/' + zdef.alias,
	    vcpus: vcpus
	};
	break;
    default:
	rctl.ram = zdef.ram;
	if (/^[0-9]+(gb|mb)$/.test(rctl.ram.toLowerCase())) {
	    obj['max-physical-memory'] = bytes.parse(rctl.ram).toString();
	    obj['max-locked-memory'] = bytes.parse(rctl.ram).toString();
	    obj['max-swap'] = (bytes.parse(rctl.ram).toString() * 2).toString();
	    obj['cpu-shares'] = ((bytes.parse(rctl.ram).toString() /
				  1024 / 1024) * 2).toString();
	    obj['max-lwps'] = '3000';
	} else {
	    console.log("Error Memory should be specified as mb or gb");
	    return null;
	}
	delete newzdef.ram;
	newzdef.rctl = obj;
	break;
    }
    newzdef.zonepath = `/zcage/vms/${zdef.alias}`;
    if (debug.enabled) {
	console.log("After conversion: " + JSON.stringify(zdef, null, 4));
    }
    return newzdef;
}

function validate_brand_reqs(zdef) {
    var resp = {
	statusCode: 201,
	message: "OK"
    };
    switch (zdef.brand) {
    case 'lx':
	if (!zdef['with-image'] && !zdef.docker) {
	    resp = {
		statusCode: 400,
		message: "lx brand must specify image"
	    };
	} else if(zdef.docker && zdef.docker.split('/').length != 2){
	    resp= { statusCode: 400, message: "docker tag is incorrect should be repo/tag"};
	}else if (zdef.docker) {
	    var repo = zdef.docker.split('/');
	    var r = spawnSync('list-tags.sh', [repo[0]]);
	    if (r.error) {
		console.log(r.error);
		resp = {
		    statusCode: 400,
		    message: "lx brand must specify image"
		};
	    }
	    var jtags = JSON.parse(r.stdout.toString());
	    var tags = jtags.tags;
	    console.log(tags);
	    var found = false;
	    tags.forEach(function (e) {
		if(e == repo[1]) {
		    found = true;
		}
	    });
	    if(found == false)
		resp = {
		    statusCode: 404,
		    message: "No such docker tag"
		};
	    
	    console.log(r.stdout.toString());
	}
	break;
    }
    return resp;
}

function getstats(zname, callback) {
    var z;
    if (validator.isUUID(zname)) {
	z = getdata(zname, zname);
    } else {
	z = getdata(zname);
    }
    if (z == null) {
	console.log(chalk `{red.bold Error : Alias does not exists}`);
	if (callback) {
	    callback(404, {
		message: "No such container: " + zname
	    });
	}
	return null;
    }

    getzonedata(z.zonename, function (z, cb) {
	var kstats = spawnSync('pfexec', ['kstat', '-j']);
	if (kstats.error) {
	    if (cb) {
		cb(400, {
		    message: "Something went wrong."
		});
	    }
	    return;
	}

	kjs = JSON.parse(kstats.stdout.toString());
	var zjs = kjs.filter(e => (e.name == z.name));
	var net = [];
	var cpu = [];
	var cpuinfo = [];
	var mstats = [];
	var blkio = [];
	var zmisc = [];
	var zcaps = [];
	z.network.forEach(function (n) {
	    net.push(kjs.filter(e => (e.module == "link" && e.name == n.nic)));
	});
	mstats.push(zjs.filter(e => (e.module == "memory_cap")));
	cpu = zjs.filter(e => (e.module == "cpu_stat"));
	blkio.push(zjs.filter(e => (e.module == "zone_vfs")));
	zmisc = zjs.filter(e => (e.module == "zones" && e.class == "zone_misc"));
	cpuinfo = kjs.filter(e => (e.module == "unix" && e.class == "misc"));
	zcaps = kjs.filter(e => (e.module == "caps" && e.class == "zone_caps" && e.data
				 .zonename == z.name));
	var stats = {};

	stats["read"] = (new Date()).toISOString();
	zcaps.forEach(function (e) {
	    if (e.name.includes("nproc")) {
		stats["pids_stats"] = {
		    current: e.data.usage
		};
	    }
	});

	var networks = [];
	var obj = {};
	var ndata = {};
	ndata = {
	    networks: net
	};

	ndata.networks.forEach(function (e) {
	    console.log("ndata " + JSON.stringify(e, null, 4));
	    obj[e[0].name] = e[0].data;
	    console.log("e is " + JSON.stringify(obj, null, 4));
	    networks.push(obj);
	});

	stats["networks"] = networks;
	mstats.forEach(function (m) {
	    stats["memory_stats"] = m[0].data;
	});

	/*
	 * More work is needed on translate memory_stats
	 *  https://docs.docker.com/engine/api/v1.30/#operation/ContainerStats
	 */

	delete stats["memory_stats"].zonename;
	stats["cpu_stats"] = {};
	zmisc.forEach(function (m) {
	    stats["cpu_stats"]["cpu_usage"] = {
		percpu_usage: [1000, 100],
		usage_in_usermode: m.data.nsec_user,
		usage_in_kernelmode: m.data.nsec_sys,
		total_usage: 100215355
	    };
	    stats["cpu_stats"].system_cpu_usage = 10000;
	    stats["cpu_stats"].online_cpus = cpuinfo[0].data.ncpus;
	    stats["cpu_stats"]["throttling_data"] = {
		periods: 0,
		throttled_periods: 0,
		throttled_time: 0
	    }
	});

	stats["pre_cpu_stats"] = stats["cpu_stats"];

	blkio.forEach(function (m) {
	    stats["blkio"] = m[0].data;
	});
	delete stats["blkio"].zonename;
	if (cb) {
	    cb(201, stats);
	    return;
	}
    }, callback);
}

function container_top(zname, flags, callback) {
    var script = "ps -o uid=,pid=,ppid=,c=,stime=,tty=,time=,comm=";
    var z;
    if (validator.isUUID(zname)) {
	z = getdata(zname, zname);
    } else {
	z = getdata(zname);
    }
    if (z == null) {
	if (callback) {
	    callback(404, {
		message: "No such container: " + zname
	    });
	}
	return;
    }
    if (flags) {
	script += " " + flags;
    }
    if (debug.enabled) {
	console.log("script ps: " + script);
    }

    var r = spawnSync('pfexec',
		      ['zlogin', z.zonename, script]);

    if (r.err != null) {
	if (callback) {
	    callback(500, {
		message: "Something went wrong."
	    });

	}
	return r.status;
    }

    var procs = r.stdout.toString().split('\n');
    var psout = [];

    procs.forEach(function (e) {
	let ps = e.trim().split(/\s+/);
	psout.push(ps);
    });

    if (callback) {
	callback(200, {
	    Titles: [
		"UID",
		"PID",
		"PPID",
		"C",
		"STIME",
		"TTY",
		"TIME",
		"CMD"
	    ],
	    Processes: [psout]
	});
    }
    return;
}

function container_logs(zname, stdout, stderr, callback) {
    var script = "";
    var r;
    if (validator.isUUID(zname)) {
	z = getdata(zname, zname);
    } else {
	z = getdata(zname);
    }
    if (z == null) {
	if (callback) {
	    callback(404, {
		message: "No such container: " + zname
	    });
	}
	return;
    }
    if(stderr) {
	script = ' cat /stderr.log ';
    } else if (stdout) {
	script = ' cat /stdout.log ';
    }else {
	script = ' cat /stdout.log /stderr.log';
    }
    var r = spawnSync('pfexec',
		      ['zlogin', z.zonename, script]);

    if (r.err != null) {
	if (callback) {
	    callback(500, {
		message: "Something went wrong."
	    });
	}
	return r.status;
    }
    if (callback) {
	callback(200, r.stdout.toString());
    }
    return;
}

function container_export(zname, callback) {
    var script = "";
    var r;
    if (validator.isUUID(zname)) {
	z = getdata(zname, zname);
    } else {
	z = getdata(zname);
    }
    if (z == null) {
	if (callback) {
	    callback(404, {
		message: "No such container: " + zname
	    });
	}
	return;
    }
    var uuid = uuidv4();
    var ds = zfs.GetPool() + z['zone-path'] + '@' + uuid;
    r = spawnSync('pfexec',
		  ['zfs', 'snapshot', ds]);

    if (r.err != null) {
	if (callback) {
	    callback(500, {
		message: "Something went wrong."
	    });

	}
	return r.status;
    }

    var res = "";
    while (res != '1') {
	var r = spawnSync('pfexec',
			  ['zfs', 'list', '-t', 'snapshot']);
	if (r.err != null) {
	    if (callback) {
		callback(500, {
		    message: "Something went wrong."
		});
	    }
	    return r.status;
	}
	var snaps = r.stdout.toString().split('\n');
	snaps.forEach(function (e) {
	    if (e.includes(uuid)) {
		res = '1';
	    }
	});
    }
    script = 'pfexec zfs send ' + ds + ' | pfexec gzip >  /tmp/' +  z.brand + '-' + 'omniosce'+ '-'+ uuid +
	'.zss.gz';
    r = spawnSync(script, {
	shell: true
    });
    if (r.err != null) {
	if (callback) {
	    callback(500, {
		message: "Something went wrong."
	    });

	}
	return r.status;
    }
    script = 'pfexec mv  /tmp/' + z.brand +'-' + 'omniosce' +'-' + uuid + '.zss.gz /zcage/images/';
    r = spawnSync(script, {
	shell: true
    });
    if (r.err != null) {
	console.log(r.stderr.toString());
	if (callback) {
	    callback(500, {
		message: "Something went wrong."
	    });
	}
	return r.status;
    }

    if (callback) {
	callback(200, {
	    message: "Exported image:" + z.uuid + " to /images/" + z.brand + '-' + 'omniosce' + '-' + uuid + ".zss.gz"
	});
    }
    return;
}

function container_update(id, newdefs, callback) {
    rctl(id, newdefs, callback);
}

function container_wait(id, condition, callback) {
    var wstat = 'running';
    var previous =[] ;
    if(condition) {
	wstat = condition;
    }
    while(true) {
	if (validator.isUUID(id)) {
	    z = getdata(id, id);
	} else {
	    z = getdata(id);
	}
	if (z == null) {
	    if (callback) {
		callback(404, {
		    message: "No such container: " + zname
		});
	    }
	    break;
	}
	previous.push(z.state);
	if (z.state == wstat || (previous.length > 1 && z.state != previous[previous.length - 2 ])) {
	    if(callback)
		callback(200, {StatusCode: 0 });
	    break;
	}
    }
}

function vnic_list(callback) {
    var cmd = "pfexec dladm show-vnic | awk '{ if (NR != 1) {print }}'";
    var rc = false;
    r = spawnSync(cmd, {
	shell: true
    });
    var networks = [];
    var obj = r.stdout.toString().split("\n");
    obj.pop();
    obj.forEach(function (e, index, arr) {
        var net = e.split(/\s+/);
	networks.push( { Name: net[0],
			 type: "virtual nic",
			 Usedby: (net[6] != '--' )?net[6] : ''
		       });

	if (!arr[index + 1]) 
	    callback(200, { networks } );
	
    });
}
/* Destroy all stopped containers
 * TODO: filter by timestamp
 */
function container_prune(callback) {
    let zones = list();
    console.log(zones);
    var names = [];
    zones.forEach(function (e, index, arr) {
	if(e.state == 'installed') {
	    names.push(e.zonename);
	    destroy(e.zonename, false);
	}
	if(!arr[index+1]) {
	    callback(200,
		     { ContainersDeleted: names,
		       SpaceReclaimed: 0 });
	}
    });
}



module.exports.destroy = destroy;
module.exports.halt = halt;
module.exports.reboot = reboot;
module.exports.start = start;
module.exports.listzones = listzones;
module.exports.build = build;
module.exports.rctl = rctl;
module.exports.getzonedata = getzonedata;
module.exports.isAbletoexec = isAbletoexec;
module.exports.get_containers = get_containers;
module.exports.create_container = create_container;
module.exports.getstats = getstats;
module.exports.container_top = container_top;
module.exports.container_export = container_export;
module.exports.container_logs = container_logs;
module.exports.container_update = container_update;
module.exports.container_wait = container_wait;
module.exports.vnic_list = vnic_list;
module.exports.container_prune = container_prune;
