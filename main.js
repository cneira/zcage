/* zcage tries to perform the same tasks as iocage but for illumos
 * http://iocage.readthedocs.io/en/latest/basic-use.html#activate-iocage
 * command syntax will be like iocage
 */

var fs = require('fs'),
    xml2js = require('xml2js');

const {
    spawnSync
} = require('child_process');


function mapToObj(inputMap) {
    let obj = {};

    inputMap.forEach(function(value, key) {
        obj[key] = value
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
    var keys = ["zoneid", "zonename", "state", "zone-path", "uuid", "brand", "ip-type"];
    var m = new Map();
    values.pop();
    for (var i = 0, len = values.length; i < len; i++) {
        m.set(keys[i], values[i]);
    }
    return mapToObj(m);
}

function list() {
    var zones = ZonesString();
    var zone_data;
    var zoneobjs = [];

    for (var i = 0, len = zones.length; i < len; i++) {
        zoneobjs.push(Zonedata(zones[i]));
    }
    return zoneobjs;
}

function getdata(zonename) {
    var zones = list();
    var zone = zones.filter(function(e) {
        return e.zonename == zonename;
    });
    if (zone == undefined)
        return null;
    return zone[0];
}

function addmeta(zoneobj) {
    if (zoneobj.state == "running") {
        var zname = zoneobj.zonename;
        zoneobj.hostname = ExecZonecmd(zname, "hostname");
        if (zoneobj.brand == "lx") {
            zoneobj.usedmem_percentage = ExecZonecmd(zname,
                "free | grep Mem | awk '{print $3/$2 * 100.0}'");
            zoneobj.freemem_percentage = ExecZonecmd(zname,
                "free | grep Mem | awk '{print $4/$2 * 100.0}'");
        }
    }
}

function destroy(zonename) {
    var z = getdata(zonename);
    var zdestroy;

    if (z == null) {
        console.log("Error: zone does not exists");
        return null;
    }
    if (z.state == "running") {
        var zhalt = spawnSync('pfexec', ['zoneadm', '-z', zonename, 'halt']);
        console.log("halting zone ", zhalt.stderr.toString());
    }

    zdestroy = spawnSync('pfexec', ['zoneadm', '-z', zonename, 'uninstall', '-F']);
    console.log("uninstalling ", zdestroy.stderr.toString());

    zdestroy = spawnSync('pfexec', ['zonecfg', '-z', zonename, 'delete', '-F']);
    console.log("deleting ", zdestroy.stderr.toString());

    return zdestroy.stdout.toString();

}

function getinfo(zonename) {
    var zonecfg = spawnSync('zonecfg', ['-z', zonename, 'info']);
    console.log("info ", zonecfg.stdout.toString());
    return zonecfg.stdout.toString();
}

function exec(zonename, cmd) {
    var zlogin = spawnSync('pfexec', ['zlogin', zonename, cmd]);
    console.log("executing ", zlogin.stdout.toString());
    return zlogin.stdout.toString();
}

function start(zonename) {
    var start = spawnSync('pfexec', ['zoneadm', '-z', zonename, 'boot']);
    console.log("info ", start.stdout.toString());
    return start.stdout.toString();
}

function halt(zonename) {
    var stop = spawnSync('pfexec', ['zoneadm', '-z', zonename, 'halt']);
    console.log("info ", stop.stdout.toString());
    return stop.stdout.toString();
}

function reboot(zonename) {
    var reboot = spawnSync('pfexec', ['zoneadm', '-z', zonename, 'reboot']);
    console.log("info ", reboot.stdout.toString());
    return reboot.stdout.toString();
}

function setproperty(zonename, property) {
    var zonedata = GetZoneData(zonename);
    var key = Object(property.keys());
    var val = Object(property.values());
    zonedata[key] = val;
    return zonedata;
}

function getproperty(zonename, property) {
    var zonedata = GetZoneData(zonename);
    var key = property.keys();
    return zonedata[key]
}

function install(zonename) {
    var iz = spawnSync('pfexec', ['zoneadm', '-z', zonename, 'install']);
    console.log("installing ", iz.stdout.toString());
    console.log("installing ", iz.stderr.toString());
    return iz.stdout.toString();
}

function uninstall(zonename) {
    var stop = spawnSync('pfexec', ['zoneadm', '-z', zonename, 'uninstall']);
    console.log("uninstalling ", stop.stdout.toString());
    return stop.stdout.toString();
}

function addattr(zoneobj, attr) {
    var cmd, attr;
    if ("brand" in zoneobj) {
        cmd = 'add attr; set name=' + attr.name + ';' +
            'set type=' + attr.type + ';'
        'set value=' + attr.value + ';' + 'end';
        attr = spawnSync('zonecfg', ['-z', zoneobj.name, cmd]);
    } else {
        console.log("Error zoneobj does not have brand property");
        return null;
    }
}

function create(zone_spec) {
    var script = spec2script(zone_spec);
    if (script != null) {
        var zonecfg = spawnSync('pfexec', ['zonecfg', '-z', zone_spec.name, script]);
        console.log("creating ", zonecfg.stderr.toString());
        install(zone_spec.name);
	var postsetup = genpostscript(zone_spec);

	if (postsetup != null) 
	    exec(zone_spec.name,postsetup); 

        return zonecfg.stdout.toString();
    }
    return null;
}

function create_zone_spec(resources) {
    var spec = {
        name: "",
        zonepath: "",
        brand: "",
        'ip-type': "exclusive",
        'dns-domain': "",
        resolvers: ["8.8.8.8", "8.8.8.4"],
    };
    if (resources != null && ("net", "brand" in resources)) {
        Object.keys(resources).forEach(function(key) {
            spec[key] = resources[key];
        });
    }
    console.log("props", JSON.stringify(spec, null, 4));
    return spec;
}

function spec2script(spec) {
    var script = "";
    var zone = getdata(spec.name);
    if (zone != null) {
        console.log("Error : zone name already exists");
        return null;
    }
    if ("brand", "net" in spec) {
        script = "create;"
        Object.keys(spec).forEach(function(key) {
            switch (key) {
                case "net":
                    spec.net.forEach(function(e) {
                        script +=
                            " add net ;";
                        if (spec.brand == "lx")
                            Object.keys(e).forEach(function(key) {
                                script += " set " + key + "=" + e[key] + ";";
                            });
                        else
                            script += " set physical=" + e["physical"] + ";";
                        script += " end;"
                    });
                    break;

                case "resolvers":
                case "dns-domain":
                    break;
                default:
                    script += " set " + key + "=" + spec[key] + ";";
                    break;
            }
        });
        script += "verify; commit;";
    } else {
        console.log("error not a valid spec");
        return null;
    }
    console.log("script", script);
    return script
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
	var postshellcmd = "" ;
	switch(zone_spec.brand) 
	{
		case "sparse": 
	         	 zone_spec.net.forEach(function(e) {
                            Object.keys(e).forEach(function(key) {
				    if(key == "ips") {
					    var ips = e[key].toString().split(",");
    					for (var i = 0, len = ips.length; i < len; i++) {
	                                	postshellcmd += 
							"ipadm create-addr -T static -a local=" 
							+ ips[i] 
							+ " " 
							+ e["physical"] +"/v4;";
					}
				    }
  				  if(key == "gateway") {
					postshellcmd+=  "; echo " + e[key] + " >> /etc/defaultrouter ;" ;
				 }
                            });
                   });
			var resolvers = zone_spec.resolvers.toString().split(",");
 			for (var i = 0, len = resolvers.length; i < len; i++) {
				postshellcmd += ";echo nameserver " + resolvers[i] + " >> /etc/resolv.conf"; 
			}
 			postshellcmd +=  "; cp /etc/nsswitch.{dns,conf} ; svcadm restart routing-setup ;";
                    break;
	  default: 
			postshellcmd = null;
	}

	console.log("shell ", postshellcmd);

	return postshellcmd;
}

var o = {
    brand: "sparse",
    name: "test04",
    autoboot: "false",
    zonepath: "/zones/test01",
    net: [{
        physical: "vnic0",
        gateway: "192.168.1.1",
        ips: ["192.168.1.108"],
    }],
};

destroy("test04");
var z = create_zone_spec(o);
create(z);
