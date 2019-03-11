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

		if ("state" in listOptions) {
			if (z.state != "configured" && z.state == "installed")
				z.state = "stopped";

			if (listOptions.state == z.state && z.zonename != "global")
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
		console.log("UUID\t\t\t\t\t TYPE\tSTATE\t ALIAS");
		for (i = 0, len = zoneobjs.length; i < len; i++) {
			if (zoneobjs[i].zonename != "global") {
				switch (zoneobjs[i].brand) {
				case "lx":
					type = "LX";
					break;
				case "bhyve":
					type = "BHYVE";
					break;
				default:
					type = "OS";
					break;

				}

				if (zoneobjs[i].state == "running") {
					console.log(chalk `${zoneobjs[i].uuid}\t ${type}\t{green.bold ${zoneobjs[i].state}}\t${zoneobjs[i].zonename}`);

				} else {
					console.log(chalk `${zoneobjs[i].uuid}\t ${type}\t{red.bold ${zoneobjs[i].state}}\t${zoneobjs[i].zonename}`);
				}
			}
		}
	}
	return zoneobjs;
}

function getdata(zonename, uuid) {
	var zones = list();
	var zone = zones.filter(zone => (zone.zonename == zonename || zone.uuid ==
		uuid));
	if (zone == undefined)
		return null;
	return zone[0];
}

function destroy(zonename) {

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
		return null;
	}
	if (z.state == "running") {
		var zhalt = spawnSync('pfexec', ['zoneadm', zoption, zonename, 'halt']);
		if (zhalt.err != null) {
			console.log(chalk `Halting zone: ${zonename}  [{red.bold ERR}] `);
			console.log(zhalt.stderr.toString());
			return zhalt.status;
		}
	}

	zdestroy = spawnSync('pfexec', ['zoneadm', zoption, zonename, 'uninstall',
		'-F'
	]);
	if (zdestroy.err != null) {
		console.log(chalk `Uninstalling zone: ${zonename}  [{red.bold ERR}] `);
		console.log(zdestroy.stderr.toString());
		return zdestroy.status;
	}

	zdestroy = spawnSync('pfexec', ['zonecfg', zoption, zonename, 'delete',
		'-F'
	]);
	if (zdestroy.err != null) {
		console.log(chalk `Deleting zone: ${zonename}  [{red.bold ERR}] `);
		console.log(zdestroy.stderr.toString());
		return zdestroy.status;
	}

	console.log(chalk `zone: ${zonename} destroyed [{green.bold OK}] `);
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

function start(zonename, opts) {

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
		return null;
	}
	if (zone.state == "running") {
		console.log(chalk `{blue.bold vm uuid ${zone.uuid} is already running}`);
		return null;
	}
	if (vnicused(zone.zonename)) {
		console.log(chalk `zone: ${zonename} start [{red.bold ERR}] `);
		console.log("vnic is being used by other container");
		return null;
	}
	if (zone.brand == 'bhyve' && (opts != undefined && opts != null)) {
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
	} else {
		console.log(chalk `${zonename} started [{green.bold OK}] `);
	}

	if (zone.brand == 'bhyve')
		isvnc_enabled(zone);

	if (debug.enabled)
		console.log("starting zone", start.stderr.toString(), start.stdout.toString());

	return start.status;
}

function rctl(zname, rctlOptions) {
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
	rctlobj.rctl = addrctl(rctlOptions);
	update_rctl(z.zonename, rctlobj.rctl, Asynczonecfgexec);
}

function Asynczonecfgexec(err, zname, script) {

	if (err) {
		console.log("error on creating script", err);
		callback(err);
	}

	var zonecfg = spawnSync('pfexec', ['zonecfg', '-z', zname, script]);
	if (zonecfg.err) {
		console.log("error on zonecfg executing script", zonecfg.stderr.toString());
	}
	console.log(zonecfg.stderr.toString());
	console.log(zonecfg.stdout.toString());
	return zonecfg.status;
}

function halt(zonename) {

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
		console.log("Error zone does not exists");
	}
	if (z != null && z.brand == 'bhyve') {
		spawnSync('pfexec', ['zonecfg', zoption, zonename,
			'remove attr name=cdrom; remove fs;'
		]);
	}

	var stop = spawnSync('pfexec', ['zoneadm', zoption, zonename, 'halt']);
	if (stop.error != null)
		console.log("info ", stop.stdout.toString());
	else
		console.log(chalk `${zonename} stopped [{green.bold OK}] `);

	return stop.stdout.toString();
}

function reboot(zonename) {

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
	}

	if (z.state == "running") {
		if (z.brand == 'bhyve') {
			var path = z.zonepath + 'root/tmp';
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
		if (reboot.error != null)
			console.log("info ", reboot.stdout.toString());
		else
			console.log(chalk `zone: ${zonename} rebooted [{green.bold OK}] `);

	} else {
		console.log("Error vm is not running");
	}
	return reboot.status;
}

function install(zonename, brand, uuid, zone_spec) {
	var iz;
	if (brand == 'lx') {
		var img;
		if (zone_spec.docker) {
			var tags = zone_spec.docker.split("/");
			debug.enabled && console.log("docker tags installing ", tags);
			img = zfs.docker_pull(tags[0], tags[1]);
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

	if (brand == 'bhyve' && zone_spec['with-image']) {
		img = zfs.ZCAGE.IMAGES + '/' + uuid;
		if (debug.enabled) {
			console.log("bhyve setting image", JSON.stringify(zone_spec, null, 4));
			console.log("bhyve image used for zvol creation: " + img);
			console.log("bhyve zvol size = " + zone_spec.rctl.quota);
			if (zone_spec['with-image'].toUpperCase().indexOf("cloud") == -1) {
				zone_spec['uses-cloud-init'] = true;
			}
			console.log(" is cloud init = " + zone_spec['uses-cloud-init']);
		}
		iz = spawnSync('pfexec', ['bhyve-zvol.sh', img, zone_spec.rctl.quota,
			zone_spec.bhyve_metadata['disk']
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
		if (zone_spec.brand == 'lx' || zone_spec.brand == 'bhyve') {
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
		if (zone_spec.brand != 'lx' && zone_spec.brand != 'bhyve') {
			status = setupzone(zonename, zone_spec);
			if (status != 0) {
				console.log("Zone postsetup failed= ", status);
				return status;
			}
		}

		if ("quota" in zone_spec.rctl) {
			var cmd = "quota=" + zone_spec.quota + " ";
			var ds = zfs.GetPool() + zone_spec.zonepath;

			i(debug.enabled)
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

	if (spec.brand === "bhyve") {
		var bhyve_metadata = {
			acpi: 'on',
			hostbridge: 'intel',
			netif: 'virtio-net-viona',
			type: 'generic',
			vnc: "unix=/tmp/" + uuidv4() + ".vnc",
			bootrom: "BHYVE_RELEASE_CSM",
			vcpus: "1"
		};
		spec.bhyve_metadata = bhyve_metadata;
		Object.keys(resources.bhyve_metadata).forEach(function (key) {

			if (resources.bhyve_metadata[key] != undefined) {
				spec.bhyve_metadata[key] = resources.bhyve_metadata[key];
			}
		});
	}
	if (debug.enabled) {
		console.log("spec", JSON.stringify(spec, null, 4));
		console.log("bhyve", JSON.stringify(spec.bhyve_metadata, null, 4));
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
				var prefix = ip.IPv4.parse(e.netmask.toString())
					.prefixLengthFromSubnetMask();
				var addr = e.address + "/" + prefix +
					";";
				script += "set allowed-address=" + addr +
					";";
				script += "set physical=" + e.physical +
					";";
				script += "set defrouter=" + e.gateway +
					";";
				script += " end;";
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
					script += "add rctl;";
					script += "set name=zone.cpu-shares;" +
						"add value (priv=privileged, limit=" +
						spec.rctl["cpu-shares"] +
						",action=none);end;";
				}
			});
			break;

		case "bhyve_metadata":

			Object.keys(spec.bhyve_metadata).forEach(function (key) {
				switch (key) {
				case 'vnc':
					script +=
						"add attr; set type=string;set name=" +
						key + "; set value=" +
						"\"" + spec.bhyve_metadata[key] +
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
				case 'bootdisk':
					script +=
						"add attr; set type=string;set name=" +
						key + "; set value=" +
						"\"" + spec.bhyve_metadata[key] +
						"\"" +
						" ;end;";
					break;

				case 'disk':
					script += "add device; set match=" +
						"/dev/zvol/rdsk/" +
						spec.bhyve_metadata.bootdisk +
						" ; end;";
					break;

				case 'fs':
					script += "add fs; set dir=" + "\"" +
						spec.bhyve_metadata[key] + "\"" +
						";set special=" + "\"" +
						spec.bhyve_metadata[key] + "\"" +
						"; set type=lofs;add options ro;" +
						"add options nodevices;end;";
					break;

				case 'device':
					script += "add device; set match=" +
						spec.bhyve_metadata[key] +
						";end;";
					break;

				}
			});
			break;

		default:
			if (key != 'with-image' && key != 'alias' && key != 'debug' && key !=
				'docker' && key != 'udata')
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
		postshellcmd = "sleep 1; ";

		var resolvers = zone_spec.resolvers.toString().split(",");
		for (var i = 0, len = resolvers.length; i < len; i++) {
			postshellcmd += " echo nameserver " + resolvers[i] +
				" >> /etc/resolv.conf &&";
		}
		postshellcmd +=
			" cp /etc/nsswitch.{dns,conf} && svcadm restart routing-setup ";

		postshellcmd += "echo " + zone_spec.alias + " > /etc/nodename";
		break;

	default:
		postshellcmd = null;
	}
	return postshellcmd;
}
/*
 *  Parses --ipaddr="vnic0|192.168.1.1/24|gateway,.."
 *  to a network json tag
 */
function ipaddrcmd2netobject(ipaddr) {
	var networks = ipaddr.split(",");
	var net = [];
	for (var i = 0, l = networks.length; i < l; i++) {
		var o = {};
		addrnic = networks[i].split("|");
		if (addrnic.length < 3) {
			console.log(
				'not enough parameters in --net=vnic|vm-ip|vm-gateway-ip'
			);
			return null;
		}
		o.physical = addrnic[0];
		var address = addrnic[1].split("/");
		o.address = address[0];
		try {
			if (ip.parse(o.address).kind() == "ipv4") {
				o.netmask = ip.IPv4.subnetMaskFromPrefixLength(address[1]).toString();
			} else {
				o.netmask = ip.IPv6.subnetMaskFromPrefixLength(address[1]).toString();
			}
		} catch (ex) {
			console.log("zone definition is invalid", ex.message);
			return null;
		}
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
			zname = uuidv4();
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

		if (createOptions.brand === "bhyve") {
			if (createOptions['with-image'])
				createOptions.disk = zfs.GetPool() + '/' + zname;
			createOptions.bhyve_metadata = {
				ram: createOptions.ram,
				vcpus: createOptions.cpu,
				disk: createOptions.disk,
				bootdisk: createOptions.disk,
				cdrom: createOptions.cdrom,
				hostbridge: createOptions.hostbridge,
				fs: createOptions.cdrom,
			};
			if (debug.enabled) {
				console.log("bhyve data",
					JSON.stringify(createOptions.bhyve_metadata, null, 4));
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
		if (createOptions.brand != 'lx' && createOptions.brand != 'bhyve' && (
				"with-image" in createOptions)) {
			console.log(
				"--with-image option is only valid for a lx or bhyve brand "
			);
			return null;
		}

		if (createOptions.udata && (createOptions.brand != 'bhyve' ||
				!fs.existsSync(createOptions.udata))) {
			console.log("--udata is only valid for a bhyve brand");
			console.log("--udata needs to be a json file with the following format\n" +
				' { "userid ": " joe ", " pubkey ": " ssh-rsa key"}');
			return null;
		}


		var z = create_zone_spec(createOptions);

		if (validate_zonespec(z) === null)
			return null;

		if (create(zname, z) === 0) {
			console.log(chalk `${zname} created [{green.bold OK}] `);
		} else {
			console.log("Failed creating zone: ", zname);
			return -1;
		}
		if (createOptions.brand == 'bhyve' && z['uses-cloud-init'] == true) {
			if (debug.enable)
				console.log("Using cloud-init config" + z.zonepath + '/root/config.iso');
			start(zname, z.zonepath + '/root/config.iso');
		} else if (createOptions.brand != 'bhyve') {
			start(zname);
		}

	} else {
		console.log(`missing --net=vnic|zone-ipaddr|zone-ip-gateway`);
		return null;
	}
}

function addrctl(createOptions) {
	let rctl = {};
	let obj = {};
	if (debug.enabled)
		console.log(JSON.stringify(createOptions, null, 4));
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
	}
	if ("max-lwps" in createOptions) {
		obj['max-lwps'] = createOptions['max-lwps'];
	}
	if ("cpu-shares" in createOptions) {
		if (/^[0-9]+$/.test(createOptions['cpu-shares'])) {
			obj['cpu-shares'] = createOptions['cpu-shares'];
		} else {
			console.log("cpu-shares must be numeric");
			return null;
		}
	}
	if ("autoboot" in createOptions) {
		obj.autoboot = createOptions.autoboot;
	}

	if ("quota" in createOptions) {
		obj.quota = createOptions.quota;
	}

	if (debug.enabled)
		console.log("rctl object", JSON.stringify(obj, null, 4));

	return obj;
}

function update_rctl(zname, newrctl, callback) {

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

			if ('cpu-shares' in newrctl)
				tmp["zone.cpu-shares"] = newrctl['cpu-shares'];

			if ('dedicated-cpu' in newrctl)
				tmp["dedicated-cpu"] = newrctl['dedicated-cpu'];

			if ('importance' in newrctl)
				tmp.importance = newrctl.importance;

			if ('autoboot' in newrctl)
				tmp.autoboot = newrctl.autoboot;


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
							key] + ";end";
					} else
					if (key == "dedicated-cpu") {
						script +=
							"add dedicated-cpu ; ";
						script += "set ncpus=" + tmp[
							key] + ";";
						if (tmp.importance != undefined) {
							script += "set importance=" +
								tmp.importance + ";";
							delete tmp.importance;
						}
						script += ";end";
					} else if (key == "zone.cpu-shares") {
						script += "add rctl; ";
						script +=
							"set name=zone.cpu-shares;";
						script +=
							"add value (priv=privileged,limit=" +
							tmp[key] + ",action=none);";
						script += "end;";
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
							script += "end;commit;";

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
				} else if (key == "zone.cpu-shares") {

					if (tmp[key] != undefined) {
						script += "set cpu-shares = " + tmp[key] + ";";

						if (z.brand == 'bhyve') {
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
			callback(err, zonename, script);
		});
	});
	console.log(chalk `${zname} updated [{green.bold OK}] `);
}


function getzonedata(zname, callback) {

	var parser = new xml2js.Parser();
	var z;
	var zonename;
	if (validator.isUUID(zname)) {
		z = getdata(zname, zname);
	} else {
		z = getdata(zname);
	}
	if (z == null) {
		console.log("container does not exists");
		return null;
	}
	if (z.state == 'incomplete') {
		console.log("incomplete container");
		return null;
	}
	zonename = z.zonename;
	fs.readFile('/etc/zones/' + zonename + '.xml', function (err, data) {
		parser.parseString(data, function (err, result) {
			let zone = {};
			let o = {};
			Object.keys(result.zone.rctl).forEach(function (key) {
				let obj = result.zone.rctl[key];
				var rctl = obj['rctl-value'][0];
				o[obj.$.name] = rctl.$.limit;
				zone.memory = o;
			});
			o = {};
			Object.keys(result.zone.$).forEach(function (key) {
				o[key] = result.zone.$[key];
				zone["base-data"] = o;
			});
			o = {};
			Object.keys(result.zone.network).forEach(function (
				key) {
				let obj = result.zone.network[key];
				zone.network = obj.$;
			});
			o = {};
			attrs = {};
			Object.keys(result.zone.attr).forEach(function (
				key) {
				let obj = result.zone.attr[key];
				attrs[obj.$.name] = obj.$.value;
			});
			switch (z.brand) {
			case 'bhyve':
				zone.bhyve_data = attrs;
				break;
			case 'lx':
				zone.lx_data = attrs;
				break;
			default:
				zone.data = attrs;
				break;

			}

			if (callback) {
				callback(zone);
			} else {
				console.log(JSON.stringify(zone, null, 4));
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
				"enum": ["sparse", "ipkg", "lipkg", "lx", "bhyve", "pkgsrc"]
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
	var ajv = new Ajv({
		allErrors: true
	});

	//    if (!validateips(z.net)) {
	//        return null;
	//    }
	//
	var validate = ajv.compile(schema);
	var valid = validate(z);
	if (!valid) {
		console.log("error is ", validate.errors);
		return null;
	}
	return 0;
}

function validateips(net) {
	var nics = vnicused(null, true);
	for (var i = 0; i < net.length; i++) {
		if (net[i].netmask == '0.0.0.0' || net[i].address == '0.0.0.0' || net[i]
			.gateway == '0.0.0.0') {
			console.log("Error: network parameters are not correct or missing",
				net);
			return false;
		} else if (nics.indexOf(net[i].physical) != -1) {
			console.log(
				`Error: vnic [${net[i].physical}] is already used by a running vm`
			);
			return false;
		}
	}
	return true;
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

function isvnc_enabled(zone) {
	getzonedata(zone.zonename, function (zdata) {
		if (debug.enabled)
			console.log("zone data", zone);
		var obj = zdata.bhyve_data;
		var unixds = zone['zone-path'] + '/root' +
			obj.vnc.split("unix=")[1] +
			" " + obj['vnc-port'];
		if (debug.enabled)
			console.log("setting vnc at ", unixds);
		var child = spawn("pfexec /usr/lib/brand/bhyve/socat " + unixds, {
			shell: true,
			detached: true,
			stdio: 'ignore'
		});
		child.unref();
	});

}

function vnic_exists(zone) {
	var cmd = "pfexec dladm show-vnic | awk '{ if (NR != 1) {print $1}}'";
	var nics = [];
	r = spawnSync(cmd, {
		shell: true
	});
	var net = zone.net.split('|')[0];
	if (!r.error) {
		nics = r.stdout.toString().split('\n');
		if (nics.indexOf(net) !== -1) {
			return true;
		}
	}
	console.log("Error: nic", net, "does not exists");
	return false;
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
