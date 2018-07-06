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

const IMGURL = 'https://images.joyent.com/images';
const imgfs = require('zfs');
const ZCAGEIMAGES = '/zcage/images';
const ZCAGEDS = '/zcage';
var request = require('request');
var fs = require('fs');
var path = require('path');
const zone = require('./zonelib');
var util = require('util');
var process = require('process');
const {
    spawnSync
} = require('child_process');

function showProgress(received, total) {
    var percentage = (received * 100) / total;
    process.stdout.write(percentage + "% |  " + received + "  bytes out of " + total + " bytes.\r");
}

function fetchmeta(opts, cb, out) {
    var received_bytes = 0;
    var total_bytes = 0;

    var req = request(opts, cb);

    if (out) {
        req.on('response', function(data) {
            // Change the total bytes value to get progress later.
            total_bytes = parseInt(data.headers['content-length']);
        });

        req.on('data', function(chunk) {
            received_bytes += chunk.length;
            showProgress(received_bytes, total_bytes);
        });
        req.on('end', function() {
            console.log("");
        });
    }
}

function filter_images(err, resp, data) {
    if (err) {
        console.log("error retrieving data");
        return null;
    }
    let vms = {};
    vms = JSON.parse(data);
    if (vms.error)
        console.log(vms.error);

    var filtered = vms.filter(function(e) {
        return e.type == 'lx-dataset';
    });

    console.log("UUID\t\t\t\t\t\tNAME\t\t\t\tVERSION\t\tOS\t\t\tPUBLISHED");
    filtered.forEach(function(e) {
        console.log(e.uuid, '\t\t',
            e.name.trim(), '\t\t\t', e.version.trim(),
            '\t', e.os.trim(), '\t\t', e.published_at.trim());

    });
}

function GetUUIDdata(err, resp, data) {
    var vms = {};
    var objs = [];
    if (err) {
        console.log("error retrieving data");
        return null;
    }
    fs.readdir(ZCAGEIMAGES, function(err, items) {
        vms = JSON.parse(data);
        if (vms.error)
            console.log(vms.error);
        for (var i = 0; i < items.length; i++) {
            if (path.extname(items[i]) == '.gz') {
                objs.push(vms.filter(function(e) {
                    return e.uuid == items[i].split('.')[0].toString();
                })[0]);

            }
        }
        console.log("UUID\t\t\t\t\t\tNAME\t\t\t\tVERSION\t\tOS\t\t\tPUBLISHED");
        objs.forEach(function(e) {
            console.log(e.uuid, '\t\t',
                e.name.trim(), '\t\t\t', e.version.trim(),
                '\t', e.os.trim(), '\t\t', e.published_at.trim());
        });
    });
}

function list_images() {
    let opts = {
        url: IMGURL
    };
    fetchmeta(opts, filter_images);
}

function list_avail() {
    let opts = {
        url: IMGURL
    };
    fetchmeta(opts, GetUUIDdata);
}


function getzss(uuid) {
    var fileUrl = IMGURL + '/' + uuid + "/file";
    let opts = {
        url: fileUrl,
        encoding: null
    };

    if (fs.existsSync(ZCAGEIMAGES + '/' + uuid + '.zss.gz')) {
        console.log("vm image already available locally");
    } else {

        var canWrite = true

        try {
            fs.writeFileSync(ZCAGEIMAGES + '/.test')
            fs.unlinkSync(ZCAGEIMAGES + '/.test')
        } catch (e) {
            canWrite = false
        }
        if (canWrite) {
            console.log(`Downloading image ${uuid} from Joyent`);
            fetchmeta(opts, writefile, true)
        } else {
            console.log(`Not able to store vm image  ${uuid} user executing zcage must be able to write to ${ZCAGEIMAGES} or have a Primary Administrator Role (pfexec zcage pull ...)`);
        }
    }
}

function writefile(err, resp, body) {
    if (err) throw err;
    var output = ZCAGEIMAGES + '/' + resp.req.path.split('/')[2] + '.zss.gz';
    fs.writeFile(output, body, function(err) {
        console.log("VM image downloaded succesfully");
    });
}



function Isactivated() {
    if (fs.existsSync(ZCAGEDS)) {
        return 0;
    } else {
        console.log("zcage needs to be activated, run as root : zcage activate");
        return null;
    }
}

function ActivateZcage() {

    if (!zone.isAbletoexec()) {
        console.log("You must be root or use an account with Primary Administrator Role to Activate zcage (pfexec zcage activate)");
        return null;
    }

    var pool = GetPool();
    var zcageds = [pool + '/zcage', pool + '/zcage/vms', pool + '/zcage/images'];
    zcageds.forEach(function(e) {
        var opts = {
            name: e,
            options: {
                property: "mountpoint",
                value: e.replace(pool, '')
            }
        };
        imgfs.zfs.create(opts, function(err, output) {});
    });
   console.log("zcage Activated");
}

function GetPool() {
    var zpool = spawnSync('zpool', ['list', '-Ho', 'name']);
    if (zpool.error)
        throw VError(pool.error, "Failed Activating Zcage");
    var pool = zpool.stdout.toString();
    pool = pool.split('\n')[0];
    return pool;
}

module.exports.list_images = list_images;
module.exports.list_avail = list_avail;
module.exports.getzss = getzss;
module.exports.Isactivated = Isactivated;
module.exports.ActivateZcage = ActivateZcage;
