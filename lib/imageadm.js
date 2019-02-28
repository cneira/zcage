/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. 
 *
 * Copyright (c) 2018, Carlos Neira cneirabustos@gmail.com 
 */


const IMGURL = 'https://images.joyent.com/images';
const PROXMOX_URL = 'http://download.proxmox.com/images/system';
const imgfs = require('zfs');
var request = require('request');
var fs = require('fs');
var path = require('path');
const zone = require('./zonelib');
var process = require('process');
var cheerio = require('cheerio');
var http = require('http');
var validator = require('validator');
const {
	spawnSync
} = require('child_process');

const ZCAGE = {
	BASEDIR: '/zcage',
	IMAGES: '/zcage/images',
	DS: '/zcage',
	VMS: '/zcage/vms',
	LXBRAND: '/usr/lib/brand/lx',
	BHYVEBRAND: '/usr/lib/brand/bhyve'
};

function showProgress(received, total) {
	var percentage = (received * 100) / total;
	process.stdout.write(percentage + "% |  " + received + "  bytes out of " +
		total + " bytes.\r");
}

function fetchmeta(opts, cb, out) {
	var received_bytes = 0;
	var total_bytes = 0;

	var req = request(opts, cb);

	if (out) {
		req.on('response', function (data) {
			total_bytes = parseInt(data.headers['content-length']);
		});

		req.on('data', function (chunk) {
			received_bytes += chunk.length;
			showProgress(received_bytes, total_bytes);
		});
		req.on('end', function () {
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

	var filtered = vms.filter(function (e) {
		return e.type == 'lx-dataset';
	});

	console.log("UUID\t\t\t\t\t\tNAME\t\t\t\tVERSION\t\tOS\t\t\tPUBLISHED");
	filtered.forEach(function (e) {
		console.log(e.uuid, '\t\t',
			e.name.trim(), '\t\t\t', e.version.trim(),
			'\t', e.os.trim(), '\t\t', e.published_at.trim());

	});
}

function GetUUIDdata(err, resp, data) {
	var vms = {};
	var objs = [];
	var others = [];
	var docker = [];
	if (err) {
		console.log("error retrieving data");
		return null;
	}
	fs.readdir(ZCAGE.IMAGES, function (err, items) {
		vms = JSON.parse(data);
		if (vms.error)
			console.log(vms.error);
		for (var i = 0; i < items.length; i++) {
			if (items[i].split('.').slice(1).join('.') == 'zss.gz') {
				objs.push(vms.filter(function (e) {
					return e.uuid == items[i].split('.')[0].toString();
				})[0]);

			} else
			if (items[i].split('.').slice(3).join('.') == 'tar.gz') {
				if (items[i] !== undefined)
					others.push(items[i]);
			} else if (items[i].split('.').slice(1).join('.') == 'gz') {
				if (items[i] !== undefined)
					docker.push(items[i]);
			}
		}
		if (objs.length > 0) {
			console.log("\nLocally available Joyent images");
			console.log("------------------------------------");
			console.log("UUID\t\t\t\t\t\tNAME\t\t\t\tVERSION\t\tOS\t\t\tPUBLISHED");
			objs.forEach(function (e) {
				console.log(e.uuid, '\t\t',
					e.name.trim(), '\t\t\t', e.version.trim(),
					'\t', e.os.trim(), '\t\t', e.published_at.trim());
			});
		}
		if (others.length > 0) {
			console.log("\nLocally available Proxmox images");
			console.log("------------------------------------");
			others.forEach(function (e) {
				console.log(e.toString());
			});
		}
		if (docker.length > 0) {
			console.log("\nLocally available Docker images");
			console.log("------------------------------------");
			docker.forEach(function (e) {
				console.log(e.toString());
			});
		}

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
	let PATH;
	let fileUrl;
	var source;
	if (!validator.isUUID(uuid)) {
		fileUrl = PROXMOX_URL + '/' + uuid;
		PATH = ZCAGE.IMAGES + '/' + uuid;
		source = 'proxmox';
	} else {
		fileUrl = IMGURL + '/' + uuid + "/file";
		PATH = ZCAGE.IMAGES + '/' + uuid + '.zss.gz';
	}
	let opts = {
		url: fileUrl,
		encoding: null
	};

	function writefile(err, resp, body) {
		if (err) throw err;
		if (!source)
			var output = ZCAGE.IMAGES + '/' + resp.req.path.split('/')[2] + '.zss.gz';
		else
			var output = ZCAGE.IMAGES + '/' + resp.req.path.split('/')[3];
		fs.writeFile(output, body, function (err) {
			console.log("VM image downloaded succesfully");
		});
	}



	if (fs.existsSync(PATH)) {
		console.log("Image is already available locally");
	} else {

		var canWrite = true;

		try {
			fs.writeFileSync(ZCAGE.IMAGES + '/.test');
			fs.unlinkSync(ZCAGE.IMAGES + '/.test');
		} catch (e) {
			canWrite = false;
		}
		if (canWrite) {
			console.log(`Downloading image ${uuid}`);
			fetchmeta(opts, writefile, true);
		} else {
			console.log(
				`Not able to store image  ${uuid} \nUser executing zcage must be able to write to ${ZCAGE.IMAGES} or have a Primary Administrator Role\nMaybe type:\npfexec zcage pull --image ${uuid})`
			);
		}
	}
}


function Isactivated() {
	if (fs.existsSync(ZCAGE.DS) && fs.existsSync(ZCAGE.VMS) && fs.existsSync(ZCAGE
			.LXBRAND) && fs.existsSync(ZCAGE.BHYVEBRAND)) {
		return 0;
	} else {
		console.log('Did you run zcage activate?\n' +
			'You need to install the following packages:\n' +
			'pkg install pkg:/system/zones/brand/lx\n' +
			'pkg install system/bhyve\n' +
			'pkg install system/zones/brand/bhyve\n' +
			'pkg install brand/pkgsrc\n' +
			'pkg install brand/sparse');

		return null;
	}
}

function ActivateZcage() {

	if (!zone.isAbletoexec()) {
		console.log(
			"You must be root or use an account with Primary Administrator Role to Activate zcage (pfexec zcage activate)"
		);
		return null;
	}

	var pool = GetPool();
	var zcageds = [pool + ZCAGE.BASEDIR, pool + ZCAGE.VMS, pool + ZCAGE.IMAGES];
	zcageds.forEach(function (e) {
		var opts = {
			name: e,
			options: {
				property: "mountpoint",
				value: e.replace(pool, '')
			}
		};
		imgfs.zfs.create(opts, function (err, output) {});
	});
}

function GetPool() {
	var zpool = spawnSync('zpool', ['list', '-Ho', 'name']);
	if (zpool.error)
		throw new Error("Failed to activate zones");
	var pool = zpool.stdout.toString();
	pool = pool.split('\n')[0];
	return pool;
}

function docker_list(library) {
	var r = spawnSync('list-tags.sh', [library]);
	if (r.error) {
		console.log(r.error);
		return -1;
	}

	console.log(r.stdout.toString());
	return 0;
}

function docker_pull(library, tag) {
	var r = spawnSync('pfexec', ['pull-by-tag.sh', library, tag]);
	if (r.error) {
		console.log("Not able to pull image " + library + " " + tag);
		return -1;
	}
	return r.stdout.toString();;
}

function list_proxmox() {
	http.get(PROXMOX_URL + '/', (res) => {
		const {
			statusCode
		} = res;
		const contentType = res.headers['content-type'];

		let error;
		if (statusCode !== 200) {
			error = new Error('Request Failed.\n' +
				`Status Code: ${statusCode}`);
		}
		res.setEncoding('utf8');
		let rawData = '';
		res.on('data', (chunk) => {
			rawData += chunk;
		});
		res.on('end', () => {
			try {
				var $ = cheerio.load(rawData);
				console.log("Proxmox Available images");
				console.log("-------------------------");
				$('a').each(function (i, element) {
					var a = $(this).prev();
					if (i > 2) {
						if (a.text().split('.').slice(3).join('.') == 'tar.gz' ||
							a.text().split('.').slice(3).join('.') == 'tar.xz')
							console.log(a.text());

					}
				});
			} catch (e) {
				console.error(e.message);
			}
		});
	}).on('error', (e) => {
		console.error(`Got error: ${e.message}`);
	});
}


module.exports.list_images = list_images;
module.exports.list_avail = list_avail;
module.exports.getzss = getzss;
module.exports.Isactivated = Isactivated;
module.exports.ActivateZcage = ActivateZcage;
module.exports.GetPool = GetPool;
module.exports.docker_list = docker_list;
module.exports.docker_pull = docker_pull;
module.exports.ZCAGE = ZCAGE;
module.exports.list_proxmox = list_proxmox;
