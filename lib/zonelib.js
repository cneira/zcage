/*
 * CDDL HEADER START
 *
 * The contents of this file are subject to the terms of the
 * Common Development and Distribution License (the "License").
 * You may not use this file except in compliance with the License.
 *
 * You can obtain a copy of the license at usr/src/OPENSOLARIS.LICENSE
 * or http://www.opensolaris.org/os/licensing.
 * See the License for the specific language governing permissions
 * and limitations under the License.
 *
 * When distributing Covered Code, include this CDDL HEADER in each
 * file and include the License file at usr/src/OPENSOLARIS.LICENSE.
 * If applicable, add the following below this CDDL HEADER, with the
 * fields enclosed by brackets "[]" replaced with your own identifying
 * information: Portions Copyright [yyyy] [name of copyright owner]
 *
 * CDDL HEADER END
 */

/*
 * Copyright (c) 2018, Carlos Neira cneirabustos@gmail.com .All rights reserved.
 */

/* zcage tries to perform the same tasks as iocage but for illumos
 * http://iocage.readthedocs.io/en/latest/basic-use.html#activate-iocage
 * command syntax will be like iocage
 * TODO:
 * - Improve Error to reflect the actual error from the zoneadm and zonecfg tools
 * - Improve function naming to reflect actual purpose.
 * - Add Unit tests and coverage
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
    spawnSync
} = require('child_process');

var Ajv = require('ajv');
var validator = require('validator');

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

function listzones(listOptions) {
    var zones = ZonesString();
    var zone_data;
    var zoneobjs = [];
    var type;

    for (var i = 0, len = zones.length; i < len; i++) {

        z = Zonedata(zones[i]);

        if ("state" in listOptions) {
            if (z.state != "configured" && z.state == "installed")
                z.state = "stopped";

            if (listOptions.state == z.state)
                zoneobjs.push(z);
        } else {
            if ("configured" != z.state) {
                switch (z.state) {
                    case "installed":
                        z.state = "stopped";
                        break;
                }
                zoneobjs.push(z);
            }
        }
    }
    // TODO: get zone info 
    console.log("UUID\t\t\t\t\t TYPE\t\tSTATE\t\t ALIAS");
    for (var i = 0, len = zoneobjs.length; i < len; i++) {
        if (zoneobjs[i].zonename != "global") {
            if (zoneobjs[i].state == "running") {
                if (zoneobjs[i].brand != "lx")
                    type = "OS"
                else
                    type = "LX"
                console.log(chalk `${zoneobjs[i].uuid}\t ${type}\t\t{green.bold ${zoneobjs[i].state}}\t\t${zoneobjs[i].zonename}`);

            } else {
                if (zoneobjs[i].brand != "lx")
                    type = "OS"
                else
                    type = "LX"
                console.log(chalk `${zoneobjs[i].uuid}\t ${type}\t\t{red.bold ${zoneobjs[i].state}}\t\t${zoneobjs[i].zonename}`);
            }
        }
    }
}

function getdata(zonename, uuid) {
    var zones = list();
    var zone = zones.filter(zone => (zone.zonename == zonename || zone.uuid == uuid));
    if (zone == undefined)
        return null;
    return zone[0];
}

function addmeta(zoneobj) {
    if (zoneobj.state == "running") {
        var zname = zoneobj.zonename;
        zoneobj.hostname = exec(zname, "hostname");
        if (zoneobj.brand == "lx") {
            zoneobj.usedmem_percentage = exec(zname,
                "free | grep Mem | awk '{print $3/$2 * 100.0}'");
            zoneobj.freemem_percentage = exec(zname,
                "free | grep Mem | awk '{print $4/$2 * 100.0}'");
        } else {
            out = {};
            exec(zname, "uptime", out);
            zoneobj["uptime"] = out["uptime"].split("  ")[2];
        }
    }
}

function destroy(zonename) {

    var zoption = '-z';
    if (validator.isUUID(zonename)) {
        var z = getdata(zonename, zonename);
        var zoption = '-u';
    } else {
        var z = getdata(zonename);
    }
    var zdestroy;

    if (z == null) {
        console.log("Error: zone does not exists");
        return null;
    }
    if (z.state == "running") {
        var zhalt = spawnSync('pfexec', ['zoneadm', zoption, zonename, 'halt']);
        if (zhalt.err != null) {
            console.log("Error halting zone ", zhalt.stderr.toString());
            return zhalt.status;
        }
    }

    zdestroy = spawnSync('pfexec', ['zoneadm', zoption, zonename, 'uninstall', '-F']);
    if (zdestroy.err != null) {
        console.log("Error uninstalling : ", zdestroy.stderr.toString());
        return zdestroy.status;
    }

    zdestroy = spawnSync('pfexec', ['zonecfg', zoption, zonename, 'delete', '-F']);
    if (zdestroy.err != null) {
        console.log("Error deleting: ", zdestroy.stderr.toString());
        return zdestroy.status;
    }

    console.log(chalk `VM ${zonename} destroyed [{green.bold OK}] `);
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

function start(zonename) {
    var zoption = '-z';
    var zone;
    zonename += '';
    if (validator.isUUID(zonename)) {
        zone = getdata(zonename, zonename);
        var zoption = '-u';
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

    var start = spawnSync('pfexec', ['zoneadm', zoption, zonename, 'boot']);

    if (start.error != null) {
        console.log(chalk `{red.bold error starting region}`);
    } else {
        console.log(chalk `VM ${zonename} started [{green.bold OK}] `);
    }

    return start.status;
}

function rctl(zname, rctlOptions) {
    var pid;
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
    delete rctlOptions["zonename"];
    rctlobj["rctl"] = addrctl(rctlOptions);
    update_rctl(z.zonename, rctlobj["rctl"], Asynczonecfgexec);
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
    var zoption = '-z';
    if (validator.isUUID(zonename)) {
        var z = getdata(zonename, zonename);
        var zoption = '-u';
    } else {
        var z = getdata(zonename);
    }
    if (z == null) {
        console.log("Error zone does not exists");
    }

    var stop = spawnSync('pfexec', ['zoneadm', zoption, zonename, 'halt']);
    if (stop.error != null)
        console.log("info ", stop.stdout.toString());
    else
        console.log(chalk `VM ${zonename} stopped [{green.bold OK}] `);

    return stop.stdout.toString();
}

function reboot(zonename) {
    var zoption = '-z';
    if (validator.isUUID(zonename)) {
        var z = getdata(zonename, zonename);
        var zoption = '-u';
    } else {
        var z = getdata(zonename);
    }
    if (z == null) {
        console.log("Error zone does not exists");
    }
    if (z.state == "running") {
        var reboot = spawnSync('pfexec', ['zoneadm', zoption, zonename, 'reboot']);
        if (reboot.error != null)
            console.log("info ", reboot.stdout.toString());
        else
            console.log(chalk `VM ${zonename} rebooted [{green.bold OK}] `);

    } else {
        console.log("Error vm is not running");
    }
    return reboot.status;
}

function install(zonename, brand, uuid) {
    if (brand == 'lx') {
        var img = '/zcage/images/' + uuid + '.zss.gz';
        var iz = spawnSync('pfexec', ['zoneadm', '-z', zonename, 'install', '-s', img], {
            shell: true
        });

        if (iz.error != null) {
            console.log("Error installing ", iz.stderr.toString());
            console.log("Error installing ", iz.stdout.toString());
            return iz.status;
        }

    } else {
        var iz = spawnSync('pfexec', ['zoneadm', '-z', zonename, 'install']);
        if (iz.error != null) {
            console.log("Error installing ", iz.stderr.toString());
            return iz.status;
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

function addattr(zonename, zoneobj, attr) {
    var cmd, attr;
    if ("brand" in zoneobj) {
        cmd = 'add attr; set name=' + attr.name + ';' +
            'set type=' + attr.type + ';'
        'set value=' + attr.value + ';' + 'end';
        attr = spawnSync('zonecfg', ['-z', zonename, cmd]);
        if (attr.error != null)
            console.log("Error adding attribute:", attr.stderr.toString());
        return attr.status;
    } else {
        console.log("Error zoneobj does not have brand property");
        return null;
    }
}
//TODO: check if vnic is already taken, if that so zone creation will fail.

function create(zonename, zone_spec) {

    var script = spec2script(zonename, zone_spec);
    var status = -1;
    if (script != null) {
        var zonecfg = spawnSync('pfexec', ['zonecfg', '-z', zonename, script]);
        if (zonecfg.err != null) {
            console.log("Error creating", zonecfg.stderr.toString());
            return null;
        }
        if (zone_spec.brand == 'lx') {
            status = install(zonename, zone_spec.brand, zone_spec['with-image']);
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

        if (zone_spec.brand != 'lx') {
            status = setupzone(zonename, zone_spec);
            if (status != 0) {
                console.log("Zone postsetup failed= ", status);
                return status;
            }
        }
    }
    return status;
}

function setupzone(zonename, zone_spec) {
    var status = -1;
    switch (zone_spec.brand) {
        case "sparse":
            status = start(zonename);
            if (status != 0) {
                console.log("Error: Starting zone", zonename);
            }

            var setup = genpostscript(zone_spec);
            var status = exec(zonename, "svcs svc:/milestone/multi-user | grep online");
            while (status != 0) {
                status = exec(zonename, "svcs svc:/milestone/multi-user | grep online");
            }

            status = exec(zonename, setup);
            if (status != 0)
                console.log("Error exec setting up zone", setup);
            status = halt(zonename);
            if (status != 0)
                console.log("Error halting setting up zone", setup);
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
        Object.keys(resources).forEach(function(key) {
            spec[key] = resources[key];
        });
    }
    return spec;
}

function spec2script(zname, spec) {
    var script = "";
    script = "create;"
    if (spec.brand == 'lx') {
        script += "add attr; set name=kernel-version;set type=string;set value=2.6.32;end;";
    }
    Object.keys(spec).forEach(function(key) {
        switch (key) {
            case "net":
                spec.net.forEach(function(e) {
                    script +=
                        " add net ;";

                    if (spec.brand == "lx") {
                        script += "add property (name=gateway,value=\"" + e["gateway"] + "\");";
                        script += "add property (name=netmask,value=\"" + e["netmask"] + "\");";
                        script += "add property (name=ips,value=\"" + e["address"] + "\");";
                        script += "add property (name=primary,value=\"true\");";
                        script += " set physical=" + e["physical"] + ";";

                        Object.keys(e).forEach(function(key) {
                            // script += " set " + key + "=" + e[key] + ";";
                        });
                    } else {
                        var prefix = ip.IPv4.parse(e["netmask"].toString()).prefixLengthFromSubnetMask();
                        var addr = e["address"] + "/" + prefix + ";";
                        script += "set allowed-address=" + addr + ";";
                        script += "set physical=" + e["physical"] + ";";
                        script += "set defrouter=" + e["gateway"] + ";";
                    }
                    script += " end;"
                });
                break;

            case "resolvers":
                script += "add attr;set name=resolvers;set type=string;set value=";
                for (var i = 0, len = spec.resolvers.length; i < len; i++) {
                    if (i + 1 >= len)
                        script += spec.resolvers[i] + ";";
                    else
                        script += spec.resolvers[i] + ",";
                }
                script += "end;";
            case "dns-domain":
                break;

            case "rctl":
                if ("dedicated-cpu" in spec.rctl) {
                    script += "add dedicated-cpu;set ncpus=" +
                        spec.rctl["dedicated-cpu"] + ";"
                    if ("importance" in spec.rctl) {
                        "set importance=" + spec.rctl["importance"] + ";";
                    }
                }

                Object.keys(spec.rctl).forEach(function(key) {
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
                            spec.rctl[key] + ",action=deny);"

                        script += "end; ";
                    } else if (key == "cpu-shares") {
                        script += "set name=zone.cpu-shares;" +
                            "add value (priv=privileged, limit=" +
                            spec.rctl["cpu-shares"] + ",action=none);"
                    }
                });
                break;

            default:
                if (key != 'with-image')
                    script += " set " + key + "=" + spec[key] + ";";
                break;
        }
    });
    script += "verify; commit;";
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
    var postshellcmd = "";
    console.log("Doing Post creation tasks for Native Container");
    switch (zone_spec.brand) {
        case "sparse":
            postshellcmd = "sleep 1; "
            //            zone_spec.net.forEach(function(e) {
            //                Object.keys(e).forEach(function(key) {
            //                    if (key == "physical") {
            //                        postshellcmd += "ipadm create-if " + e["physical"] + " && ";
            //                    }
            //                    if (key == "address") {
            //                        postshellcmd +=
            //                            "ipadm create-addr -T static -a local=" +
            //                            e["address"] +
            //                            " " +
            //                            e["physical"] + "/v4 && ";
            //
            //                    }
            //                    if (key == "gateway") {
            //                        postshellcmd += " echo " + e[key] + " >> /etc/defaultrouter &&";
            //                    }
            //                });
            //            });
            //
            var resolvers = zone_spec.resolvers.toString().split(",");
            for (var i = 0, len = resolvers.length; i < len; i++) {
                postshellcmd += " echo nameserver " + resolvers[i] + " >> /etc/resolv.conf &&";
            }
            postshellcmd += " cp /etc/nsswitch.{dns,conf} && svcadm restart routing-setup ";
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
            console.log('not enough parameters in --net=vnic|vm-ipaddress|vm-gateway-ipaddress');
            return null;
        }
        o["physical"] = addrnic[0];
        var address = addrnic[1].split("/");
        o["address"] = address[0];
        try {
            if (ip.parse(o["address"]).kind() == "ipv4") {
                o["netmask"] = ip.IPv4.subnetMaskFromPrefixLength(address[1]).toString();
            } else {
                o["netmask"] = ip.IPv6.subnetMaskFromPrefixLength(address[1]).toString();
            }
        } catch (ex) {
            console.log("VM spec invalid", ex.message);
            return null;
        }
        o["gateway"] = addrnic[2];
        net.push(o);
    }
    //console.log("network is ", net);
    return net;
}
// minimal zonespec
// https://docs.oracle.com/cd/E19044-01/sol.containers/817-1592/z.config.ov-13/index.html
// http://cuddletech.com/?p=314
// https://www.claudiokuenzler.com/blog/437/increase-capped-memory-solaris-smartos-zone-smartmachine#.WywNGfnwZp_
//var o = {
//    brand: "sparse",
//    autoboot: "false",
//    zonepath: "/zones/test01",
//    net: [{
//        physical: "vnic0",
//        gateway: "192.168.1.1",
//        ips: ["192.168.1.108"],
//    }],
//   rctl: {
//            zone.max-physical-memory: "2gb",
//	      zone.max-locked-memory: "2gb",
//	      zone.max-swap: "2gb",
//	      zone.max-shm-ids: "",
//            zone.max-msg-ids: "",
//            zone.max-lwps: "",
//            zone.cpu-shares: "",
//            zone.max-shm-memory:"",
//            dedicated-cpu:"1-2",
//	      importance:"1"
//         }
//};

function build(createOptions) {

    if (!!createOptions['dedicated-cpu'] && !!createOptions['cpu-shares']) {
        console.log('cpu-shares option is not compatible with dedicated-cpu option');
        return null;
    }
    var zname;
    if ("net" in createOptions) {
        createOptions["net"] =
            ipaddrcmd2netobject(createOptions["net"]);

        if (createOptions["net"] == null) {
            return null;
        }
        if ("alias" in createOptions) {
            zname = createOptions["alias"];
            delete createOptions["alias"];
        } else {
            zname = uuidv4();
        }
        createOptions["zonepath"] = `/zcage/vms/${zname}`;
        var count = createOptions["count"];

        if (("ram" in createOptions) ||
            ("max-lwps" in createOptions) ||
            ("dedicated-cpu" in createOptions) ||
            ("dedicated-cpu-importance" in createOptions) ||
            ("cpu-shares" in createOptions)) {
            createOptions["rctl"] = addrctl(createOptions);
            if (createOptions["rctl"] == null) {
                return null;
            }
        }

        delete createOptions["ram"];
        delete createOptions["max-lwps"];
        delete createOptions["dedicated-cpu-importance"];
        delete createOptions["cpu-shares"];
        delete createOptions["dedicated-cpu"];
        delete createOptions["count"];

        var zone = getdata(zname);
        if (zone != null) {
            console.log("Error : alias already exists");
            return null;
        }
        if (createOptions.brand == 'lx' && !("with-image" in createOptions)) {
            console.log("--with-image option is required for a lx container");
            return null;
        }

        var z = create_zone_spec(createOptions);
        if (validate_zonespec(z) == null)
            return null;

        if (create(zname, z) == 0) {
            console.log(chalk `VM ${zname} created [{green.bold OK}] `);
        } else {
            console.log("Failed creating VM : ", zname);
        }
    } else {
        console.log(`missing --net=nic|ipaddr|gateway`);
        return null;
    }
}

function addrctl(createOptions) {
    let rctl = {};
    let obj = {};
    if ("cpu-shares" in createOptions) {
        rctl['cpu-shares'] = createOptions['cpu-shares'];
        obj['cpu-shares'] = rctl['cpu-shares'];
    }
    if ("ram" in createOptions) {
        rctl.ram = createOptions.ram;

        if (/^[0-9]+(gb|b|mb|tb|kb)$/.test(rctl.ram.toLowerCase())) {
            obj['max-physical-memory'] = bytes.parse(rctl.ram).toString();
            obj['max-locked-memory'] = bytes.parse(rctl.ram).toString();
            obj['max-swap'] = bytes.parse(rctl.ram).toString();
        } else {
            console.log("Error Ram should be specified in b,mb,kb,gb or tb");
            return null;
        }
    }
    if ("dedicated-cpu" in createOptions) {
        obj['dedicated-cpu'] = createOptions['dedicated-cpu'];
        obj['importance'] = createOptions['dedicated-cpu-importance'];
    }
    if ("max-lwps" in createOptions) {
        obj['max-lwps'] = createOptions['max-lwps'];
    }
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

    fs.readFile('/etc/zones/' + zonename + '.xml', function(err, data) {
        parser.parseString(data, function(err, result) {
            if (err) {
                console.log("Error reading xml", err);
                return null;
            }
            var oldrctl = {};
            var tmp = {};
            //TODO: make it generic
            if ('max-physical-memory' in newrctl)
                tmp["zone.max-physical-memory"] = newrctl['max-physical-memory'];

            if ('max-locked-memory' in newrctl)
                tmp["zone.max-locked-memory"] = newrctl['max-locked-memory'];

            if ('max-swap' in newrctl)
                tmp["zone.max-swap"] = newrctl['max-swap'];

            if ('max-lwps' in newrctl)
                tmp["zone.max-lwps"] = newrctl['max-lwps'];

            if ('max-shm-ids' in newrctl)
                tmp["zone.max-shm-ids"] = newrctl['max-shm-ids'];

            if ('max-msg-ids' in newrctl)
                tmp["zone.max-msg-ids"] = newrctl['max-msg-ids'];

            if ('max-shm-memory' in newrctl)
                tmp["zone.max-shm-memory"] = newrctl['max-shm-memory'];

            if ('cpu-shares' in newrctl)
                tmp["zone.cpu-shares"] = newrctl['cpu-shares'];

            if ('dedicated-cpu' in newrctl)
                tmp["dedicated-cpu"] = newrctl['dedicated-cpu'];

            if ('importance' in newrctl)
                tmp["importance"] = newrctl['importance'];


            Object.keys(result.zone.rctl).forEach(function(key) {
                //console.log(util.inspect(result.zone.rctl[key], false, null));
                let obj = result.zone.rctl[key];
                var value = obj['rctl-value'][0];
                oldrctl[obj['$'].name] = value['$'].limit;
            });
            if (result.zone.pset)
                Object.keys(result.zone.pset).forEach(function(key) {
                    let obj = result.zone.pset[key]['$'];
                    let max = obj['ncpu_max'];
                    let min = obj['ncpu_min'];
                    oldrctl['dedicated-cpu'] = `${min}-${max}`;
                });


            var script = " ";
            var err;

            var zinitpid = spawnSync('pgrep', ['-z', zonename, 'init']);
            if (zinitpid.error != null) {
                console.log(`Error getting updating zone resources `);
                pid = null;
            }

            pid = zinitpid.stdout.toString();

            // add new rctl 
            Object.keys(tmp).forEach(function(key) {
                if (!(key in oldrctl)) {
                    if (key == "importance") {} else
                    if (key == "dedicated-cpu") {
                        script += "add dedicated-cpu ; ";
                        script += "set ncpus=" + tmp[key] + ";";
                        if (tmp["importance"] != undefined) {
                            script += "set importance=" + tmp["importance"] + ";";
                            delete tmp["importance"];
                        }
                        script += ";end";
                    } else {
                        script += "add rctl ; ";
                        script += " set name=" + key + ";"
                        script += "add value (priv=privileged,limit=" + tmp[key] + ",action=deny);";
                        script += "end;";
                    }
                    if (pid) {
                        var rctl = spawnSync('pfexec', ['prctl', '-n', `zone.${key}`, '-s', '-v', tmp[key], pid], {
                            shell: true
                        });
                        if (rctl.err)
                            console.log("Error updating resources ", rctl.stderr.toString());
                    }

                } else if (key == "zone.cpu-shares" && oldrctl[key] != undefined) {
                    script += "add rctl; ";
                    script += "set name=zone.cpu-shares;";
                    script += "add value (priv=privileged,limit=" + tmp[key] + ",action=none);";
                    script += "end;";
                    if (pid) {
                        var rctl = spawnSync('pfexec', ['prctl', '-n', `zone.${key}`, '-s', '-v', tmp[key], pid], {
                            shell: true
                        });
                        if (rctl.err)
                            console.log("Error updating resources ", rctl.stderr.toString());
                    }
                }
            });

            //update current rctl
            Object.keys(oldrctl).forEach(function(key) {
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
                            script += "remove dedicated-cpu ; ";
                            script += "add dedicated-cpu ; ";
                            script += "set ncpus=" + tmp[key] + ";";
                            if (tmp["importance"] != undefined) {
                                script += "set importance=" + tmp["importance"] + ";";
                                delete tmp["importance"];
                            }
                            script += ";end;";
                            if (pid) {
                                var rctl = spawnSync('pfexec', ['prctl', '-n', `${key}`, '-r', '-v', tmp[key], pid], {
                                    shell: true
                                });
                                if (rctl.err)
                                    console.log("Error updating resources ", rctl.stderr.toString());
                            }

                        } else {
                            script += "select rctl ";
                            script += " name=" + key + ";" +
                                "remove value (priv=privileged,limit=" +
                                oldrctl[key] + ",action=deny);"

                            script += "add value (priv=privileged,limit=" +
                                tmp[key] + ",action=deny);"
                            script += "end;";

                            if (pid) {
                                var rctl = spawnSync('pfexec', ['prctl', '-n', `zone.${key}`, '-r', '-v', tmp[key], pid], {
                                    shell: true
                                });
                                if (rctl.err)
                                    console.log("Error updating resources ", rctl.stderr.toString());
                            }
                        }
                    }
                } else if (key == "zone.cpu-shares") {
                    if (tmp[key] != undefined) {
                        script += "select name=zone.cpu-shares;" +
                            "remove value (priv=privileged, limit=" +
                            oldrctl["cpu-shares"] + ",action=none);"
                        script += "add value (priv=privileged,limit=" +
                            tmp[key] + ",action=none);"
                        if (pid) {
                            var rctl = spawnSync('pfexec', ['prctl', '-n', `zone.${key}`, '-r', '-v', tmp[key], pid], {
                                shell: true
                            });
                            if (rctl.err)
                                console.log("Error updating resources ", rctl.stderr.toString());
                        }

                    }
                }
            });
            callback(err, zonename, script);
        });
    });
    console.log(chalk `VM ${zname} updated [{green.bold OK}] `);
}

function getzonedata(zname) {
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

    fs.readFile('/etc/zones/' + zonename + '.xml', function(err, data) {
        parser.parseString(data, function(err, result) {

            let zone = {};
            let o = {};
            Object.keys(result.zone.rctl).forEach(function(key) {
                let obj = result.zone.rctl[key];
                var rctl = obj['rctl-value'][0];
                o[obj['$'].name] = rctl['$'].limit;
                zone["rctl"] = o;
            });

            o = {};
            Object.keys(result.zone.$).forEach(function(key) {
                o[key] = result.zone.$[key];
                zone["base-data"] = o;
            });

            o = {};
            Object.keys(result.zone.network).forEach(function(key) {
                let obj = result.zone.network[key];
                zone["network"] = obj['$'];
            });
            let z = {};

            z[zname] = zone;
            console.log(JSON.stringify(z, null, 4));
        });
    });
}

function validate_zonespec(z) {
    var schema = "  {\n            \"type\": \"object\",\n            \"properties\": {\n                \"zonepath\": {\n                    \"type\": \"string\"\n                },\n                \"brand\": {\n                    \"type\": \"string\",\n                    \"enum\": [\"sparse\", \"ipkg\", \"lipkg\", \"lx\"]\n                },\n                \"ip-type\": {\n                    \"type\": \"string\",\n                    \"enum\": [\"exclusive\"]\n                },\n                \"autoboot\": {\n                    \"type\": \"boolean\"\n                },\n                \"additionalProperties\": false,\n                \"net\": {\n                    \"type\": \"array\",\n                    \"items\": {\n                        \"type\": \"object\",\n                        \"properties\": {\n                            \"physical\": {\n                                \"type\": \"string\"\n                            },\n                            \"address\": {\n                                \"type\": \"string\",\n                                \"format\": \"ipv4\"\n                            },\n                            \"netmask\": {\n                                \"type\": \"string\",\n                                \"format\": \"ipv4\"\n                            },\n                            \"gateway\": {\n                                \"type\": \"string\",\n                                \"format\": \"ipv4\"\n                            }\n                        }\n                    }\n                },\n                \"rctl\": {\n                    \"type\": \"object\",\n                    \"properties\": {\n                        \"max-physical-memory\": {\n                            \"type\": \"string\",\n                            \"pattern\": \"^[0-9]+$\"\n                        },\n                        \"max-locked-memory\": {\n                            \"type\": \"string\",\n                            \"pattern\": \"^[0-9]+$\"\n                        },\n                        \"max-swap\": {\n                            \"type\": \"string\",\n                            \"pattern\": \"^[0-9]+$\"\n                        },\n                        \"cpu-shares\": {\n                            \"type\": \"string\",\n                            \"pattern\": \"^[0-9]+$\"\n                        },\n                        \"dedicated-cpu\": {\n                            \"type\": \"string\",\n                            \"pattern\": \"^[1-9]-[1-9]$\"\n                        },\n                        \"dedicated-cpu-importance\": {\n                            \"type\": \"string\",\n                            \"pattern\": \"^[1-9]$\"\n                        }\n                    }\n                }\n            }\n        }\n";
    var ajv = new Ajv({
        allErrors: true
    });
    var validate = ajv.compile(JSON.parse(schema));
    var valid = validate(z);
    if (!valid) {
        console.log("error is ", validate.errors);
        return null;
    }

    return 0;
}

module.exports.destroy = destroy;
module.exports.halt = halt;
module.exports.start = start;
module.exports.listzones = listzones;
module.exports.build = build;
module.exports.rctl = rctl;
module.exports.getzonedata = getzonedata;
