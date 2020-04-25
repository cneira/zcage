/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. 
 *
 * Copyright (c) 2018, Carlos Neira cneirabustos@gmail.com 
 */


const IMGURL = 'https://images.joyent.com/images';
const PROXMOX_URL = 'http://download.proxmox.com/images/system';
const UBUNTU_CLOUDINIT_URL = 'https://cloud-images.ubuntu.com';
const CENTOS_CLOUDINIT_URL = 'https://cloud.centos.org/centos';
const ARCH = 'amd64';
const FEDORA_CLOUDINIT_URL = 'http://fedora.c3sl.ufpr.br/linux/releases';
const imgfs = require('zfs');
var request = require('request');
var fs = require('fs');
var path = require('path');
const zone = require('./zone');
var process = require('process');
var cheerio = require('cheerio');
var validator = require('validator');
var columnify = require('columnify');
const uuidv4 = require('uuid/v4');
const {
    spawnSync
} = require('child_process');

const ZCAGE = {
    BASEDIR: '/zcage',
    IMAGES: '/zcage/images',
    DS: '/zcage',
    VMS: '/zcage/vms',
    LXBRAND: '/usr/lib/brand/lx',
    BHYVEBRAND: '/usr/lib/brand/bhyve',
    KVMBRAND: '/usr/lib/brand/kvm',
    CONFIG: '/etc/zcage.conf',
    REFRESH_INDEX: 30,
    INDEX: '/zcage/images/index.json',
    NETWORKS: '/zcage/networks.json'
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
        req.on('response', function(data) {
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
    console.log("filtering images");
    if (err) {
        console.log("error retrieving data");
        return null;
    }
    let vms = {};
    vms = JSON.parse(data);
    if (vms.error)
        console.log(vms.error);

    var ds = [];
    vms.forEach(function(e) {
        ds.push({
            UUID: e.uuid,
            NAME: e.name,
            VERSION: e.version,
            OS: e.os,
            PUBLISHED: e.published_at
        });
    });
    console.log("show cols" + cols);
    var cols = columnify(ds);
    console.log(cols);
}

function GetUUIDdata(err, resp, data) {
    var vms = {};
    var objs = [];
    var others = [];
    var docker = [];
    var misc = [];
    if (err) {
        console.log("error retrieving data");
        return null;
    }
    fs.readdir(ZCAGE.IMAGES, function(err, items) {
        vms = JSON.parse(data);
        if (vms.error)
            console.log(vms.error);
        if (err) {
            console.log(err.message);
            return null;
        }
        for (var i = 0; i < items.length; i++) {
            if (items[i].split('.').slice(1).join('.') == 'zss.gz') {
                objs.push(vms.filter(function(e) {
                    return e.uuid == items[i].split('.')[0].toString();
                })[0]);

            } else
            if (items[i].split('.').slice(3).join('.') == 'tar.gz') {
                if (items[i] !== undefined)
                    others.push(items[i]);
            } else if (items[i].split('.').slice(1).join('.') == 'gz') {
                if (items[i] !== undefined)
                    docker.push(items[i]);
            } else
            if (items[i] !== undefined)
                misc.push(items[i]);

        }
        if (objs.length > 0) {
            console.log("\nLocally available Joyent images");
            console.log("------------------------------------");
            console.log("UUID\t\t\t\t\t\tNAME\t\t\t\tVERSION\t\tOS\t\t\tPUBLISHED");
            objs.forEach(function(e) {
                console.log(e.uuid, '\t\t',
                    e.name.trim(), '\t\t\t', e.version.trim(),
                    '\t', e.os.trim(), '\t\t', e.published_at.trim());
            });
        }
        if (others.length > 0) {
            console.log("\nLocally available Proxmox images");
            console.log("------------------------------------");
            others.forEach(function(e) {
                console.log(e.toString());
            });
        }
        if (docker.length > 0) {
            console.log("\nLocally available Docker images");
            console.log("------------------------------------");
            docker.forEach(function(e) {
                console.log(e.toString());
            });
        }
        if (misc.length > 0) {
            console.log("\nLocally available images from other sources");
            console.log("------------------------------------");
            misc.forEach(function(e) {
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

/* TODO refactor to get provider */
function getzss(uuid, source) {
    let PATH;
    let fileUrl;
    var source;
    switch (source) {
        case 'proxmox':
            fileUrl = PROXMOX_URL + '/' + uuid;
            PATH = ZCAGE.IMAGES + '/' + uuid;
            break;
        case 'joyent':
            fileUrl = IMGURL + '/' + uuid + "/file";
            PATH = ZCAGE.IMAGES + '/' + uuid + '.zss.gz';
            break;
        default:
            console.log("not a valid provider");
            return null;

    }
    let opts = {
        url: fileUrl,
        encoding: null
    };

    function writefile(err, resp, body) {
        if (err) throw err;
        fs.writeFile(PATH, body, function(err) {
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

function fetch(url, repo, tag, callback) {
    let PATH;
    var source;
    var output;
    if (!isURL(url)) {
        console.log("fetch: %s is not an url", url);
        if (callback) {
            callback(404, {
                message: "url does not exists or read access."
            });
        }
        return null;
    }

    let opts = {
        url: url,
        encoding: null
    };

    if (repo && tag) {
        output = ZCAGE.IMAGES + '/' + repo + '-' + tag + '-' + file;
    } else {
        output = ZCAGE.IMAGES + '/' + resp.req.path.split('/').pop();
    }

    function writefile(err, resp, body) {
        if (err) throw err;

        fs.writeFile(output, body, function(err) {
            console.log("VM image downloaded succesfully");
        });
    }

    if (fs.existsSync(output)) {
        console.log("Image is already available locally");
        if (callback) {
            callback(400, {
                message: "Image already available in local repo"
            });
            return;
        }
    } else {
        var canWrite = true;
        try {
            fs.writeFileSync(ZCAGE.IMAGES + '/.test');
            fs.unlinkSync(ZCAGE.IMAGES + '/.test');
        } catch (e) {
            canWrite = false;
        }
        if (canWrite) {
            console.log(`Downloading image ${file}`);
            if (callback) {
                callback(201, {
                    message: "Image is downloading now"
                });
            }
            fetchmeta(opts, writefile, true);
        } else {
            console.log(
                `Not able to store image  ${file} \nUser executing zcage must be able to write to ${ZCAGE.IMAGES} or have a Primary Administrator Role\nMaybe type:\npfexec zcage pull --image ${file})`
            );
        }
    }
}

function fetch_by_provider(provider, where, img) {
    var url;
    var distro;

    if (where && where.split('/').length == 2) {
        distro = where.split('/')[0];
        version = where.split('/')[1];
    }
    if (provider != 'cloud-init' && distro === undefined)
        return null;

    switch (provider) {
        case 'cloud-init':
            switch (distro) {
                case 'ubuntu':
                    url = UBUNTU_CLOUDINIT_URL + '/' + version + '/current/';
                    break;
                case 'centos':
                    url = CENTOS_CLOUDINIT_URL + '/' + version + '/images/';
                    break;

                case 'fedora':
                    url = FEDORA_CLOUDINIT_URL + '/' + version + '/Cloud/x86_64/images/';
                    break;
                default:
                    console.log("Distro not supported");
                    return null;
            }

            break;
    }
    fetch(url + img);
}

function Isactivated(out) {
    if (fs.existsSync(ZCAGE.CONFIG) &&
        fs.existsSync(ZCAGE.DS)) {
        return 1;
    } else {
        if (!out)
            console.log('Did you run zcage activate?\n' +
                'You need to install the following packages:\n' +
                'pkg install pkg:/system/zones/brand/lx\n' +
                'pkg install system/bhyve\n' +
                'pkg install system/zones/brand/bhyve\n' +
                'pkg install brand/pkgsrc\n' +
                'pkg install brand/kvm\n' +
                'pkg install brand/kvm-driver\n' +
                'pkg install brand/sparse');
        return null;
    }
}

function ActivateZcage(pool) {
    if (!zone.isAbletoexec()) {
        console.log(
            "You must be root or use an account with Primary Administrator Role to Activate zcage (pfexec zcage activate)"
        );
        return null;
    }
    if (pool == "zcage") {
        console.log("Pool name cannot be \"zcage\", choose another one");
        return null;
    }
    var zcageds = [pool + ZCAGE.BASEDIR, pool + ZCAGE.VMS, pool + ZCAGE.IMAGES];

    let basedir = pool + ZCAGE.BASEDIR;
    let vmdir = pool + ZCAGE.VMS;
    let imgdir = pool + ZCAGE.IMAGES;

    var obasedir = {
        name: basedir,
        options: {
            property: "mountpoint",
            value: basedir.replace(pool, '')
        }
    };

    var ovmdir = {
        name: vmdir,
        options: {
            property: "mountpoint",
            value: vmdir.replace(pool, '')
        }
    };
    var oimgdir = {
        name: imgdir,
        options: {
            property: "mountpoint",
            value: imgdir.replace(pool, '')
        }
    };

    imgfs.zpool.get({
        name: pool
    }, function(err, output) {
        if (err) {
            console.log("Error pool does not exists")
            return process.exit();
        } else {
            console.log("Activating zcage wait a few seconds...");
            imgfs.zfs.create(obasedir, function(err, output) {
                if (err)
                    console.log("Error creating zcage data: " + err);
                else
                    imgfs.zfs.create(ovmdir, function(err, output) {
                        if (err)
                            console.log("Error creating zcage data: " + err);
                        else
                            imgfs.zfs.create(oimgdir, function(err, output) {
                                if (err)
                                    console.log("Error creating zcage data: " + err);
                            });
                    });
            });
        }
    });

}

function GetPool() {
    let pool;
    if (fs.existsSync(ZCAGE.CONFIG)) {
        data = fs.readFileSync(ZCAGE.CONFIG, "utf-8");
        config = JSON.parse(data);
        pool = config.pool;
    } else {
        zpool = spawnSync('zpool', ['list', '-Ho', 'name']);
        if (zpool.error)
            throw new Error("Failed to activate zones");
        pool = zpool.stdout.toString();
        pool = pool.split('\n')[0];
    }
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

/* List docker images by library/tag */
function docker_pull(library, tag) {
    var r = spawnSync('pfexec', ['pull-by-tag.sh', library, tag]);
    var errorText = r.stderr.toString().trim();
    if (errorText) {
        console.log("Not able to pull image: " + errorText);
        return -1;
    }
    return r.stdout.toString();
}

function list_datasource(source, image) {
    var url;
    var title;
    var distro;
    var version;
    var title;
    var token;
    var slice;
    var http;
    var BEGIN_LIST;

    if (image && image.split('/').length == 2) {
        distro = image.split('/')[0];
        version = image.split('/')[1];
    }

    if (source != "proxmox" && distro === undefined)
        return null;
    switch (source) {

        case 'proxmox':
            url = PROXMOX_URL + '/';
            title = "Proxmox";
            token = 'a';
            slice = 3;
            BEGIN_LIST = 2;
            http = require('http');
            break;

        case 'cloud-init':
            title = distro + " cloud-init";
            switch (distro) {
                case 'ubuntu':
                    url = UBUNTU_CLOUDINIT_URL + '/' + version + '/current/';
                    token = 'img';
                    slice = 1;
                    BEGIN_LIST = 2;
                    http = require('https');
                    break;
                case 'centos':
                    url = CENTOS_CLOUDINIT_URL + '/' + version + '/images/';
                    http = require('https');
                    token = 'table:last-child tr td';
                    BEGIN_LIST = 2;
                    slice = 2;
                    break;

                case 'fedora':
                    url = FEDORA_CLOUDINIT_URL + '/' + version + '/Cloud/x86_64/images/';
                    http = require('http');
                    token = 'tbody tr td';
                    BEGIN_LIST = 2;
                    slice = 3;
                    break;
            }

            break;
    }

    http.get(url, (res) => {
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
                console.log(title + " Available images");
                console.log("-------------------------");
                $(token).each(function(i, element) {
                    var a = $(this).prev();
                    if (i > BEGIN_LIST) {
                        if (a.text().split('.').slice(slice).join('.') == 'tar.gz' ||
                            a.text().split('.').slice(slice).join('.') == 'raw.xz' ||
                            a.text().split('.').slice(slice).join('.') == 'qcow2.xz' ||
                            a.text().split('.').slice(slice).join('.') == 'xz' ||
                            a.text().split('.').slice(slice).join('.') == 'qcow2' ||
                            a.text().split('.').slice(slice).join('.') == 'img' ||
                            a.text().includes('raw') ||
                            a.text().includes('img') ||
                            a.text().includes('qcow2') ||
                            a.text().split('.').slice(slice).join('.') == 'tar.xz') {
                            if (a.text().includes(ARCH) || a.text().includes('x86_64'))
                                console.log(a.text());
                        }

                    }
                });
            } catch (e) {
                console.error(e.message);
            }
        });
    }).on('error', (e) => {
        console.error(`Got error: ${e.message}`);
    });
    return 1;
}

function sleep(millis) {
    return new Promise(resolve => setTimeout(resolve, millis));
}

function isURL(str) {
    var pattern = new RegExp('^((ft|htt)ps?:\\/\\/)?' + // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name and extension
        '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
        '(\\:\\d+)?' + // port
        '(\\/[-a-z\\d%@_.~+&:]*)*' + // path
        '(\\?[;&a-z\\d%@_.,~+&:=-]*)?' + // query string
        '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
    return pattern.test(str);
}

/*  container_images :
 *  This will display images in the current server.
 *  An image should contain the following metadata in it’s file name:
 *  provider-type-uuid. For example a lx brand image should be like this:
 *  joyent-lx-distro-<uuid>.zss
 *  A proxmox lx image :
 *  proxmox-lx-distro-uuid.tar.gz
 *  For KVM or BHYVE images the convention is :
 *  Centos-VM-<filename>.raw|img|qcow2
 *  For custom images:
 *  Custom-<lx|VM|native>.zss.gz
 *  Docker images:
 *  Docker-repo-tag.gz
 */

function container_images(callback) {
    var obj = [];
    var cmd = 'ls /zcage/images | wc -l ';

    var r = spawnSync(cmd, {
        shell: true
    });
    var errorText = r.stderr.toString().trim();
    if (errorText) {
        if (callback)
            callback(500, {
                message: errorText
            });
        else
            console.log(errorText)
        return;
    }
    let cnt = r.stdout.toString();
    if (fs.existsSync(ZCAGE.INDEX)) {
        fs.stat(ZCAGE.INDEX, function(err, stats) {
            if (err) {
                if (callback)
                    callback(500, {
                        message: err.message
                    });
                console.log(err.message)
                throw err;
            }
            let seconds = (new Date().getTime() - new Date(stats.mtime).getTime()) /
                1000;

            //	    console.log("index modified " + seconds + " seconds ago");
            if (seconds > ZCAGE.REFRESH_INDEX) {
                fs.readdir(ZCAGE.IMAGES, function(err, item) {

                    item.forEach(function(item, index, arr) {
                        fs.stat(ZCAGE.IMAGES + '/' + item, function(err, stats) {
                            if (err) {
                                if (callback)
                                    callback(500, {
                                        message: "Something wrong happened."
                                    });
                                console.log("Error Listing images" + err.message)
                                return;
                            }
                            var img = {}
                            var r = spawnSync('sha256sum ' + ZCAGE.IMAGES + '/' + item, {
                                shell: true
                            });
                            var errorText = r.stderr.toString().trim();
                            if (errorText) {
                                if (callback)
                                    callback(500, {
                                        message: errorText
                                    });
                                console.log("Error Listing images" + err.message)
                                return;
                            }
                            var id = r.stdout.toString().split(/\s+/);
                            img.Id = id[0];
                            img.Created = stats.ctime;
                            img.Size = stats.size;
                            img.VirtualSize = stats.size;
                            img.SharedSize = 0;
                            img.Labels = {};
                            img.Containers = 0;
                            img.filename = item;
                            if (item.split('.').slice(1).join('.') == 'raw.xz' ||
                                item.split('.').slice(1).join('.') == 'qcow2.xz' ||
                                item.split('.').slice(1).join('.') == 'xz' ||
                                item.split('.').slice(1).join('.') == 'qcow2' ||
                                item.split('.').slice(1).join('.') == 'img' ||
                                item.includes('raw') || item.includes('qcow') ||
                                item.includes('img')
                            ) {
                                if (item.toUpperCase().includes('CLOUD')) {
                                    img.RepoTags = ['cloud-init', item.split('-')[0], item.split('-')[1]];
                                } else {
                                    img.RepoTags = [item.split('-')[0], item.split('-')[1]];
                                }
                                img.Labels = ['KVM', 'BHYVE'];
                            } else if (item.toUpperCase().includes('JOYENT')) {
                                img.Labels = ['Linux', item.split('-')[1]];
                                img.RepoTags = ['Joyent', item.split('-')[1]];
                            } else if (!item.includes('native')) {
                                img.Labels = ['Linux', 'Docker'];
                                img.RepoTags = [item.split('-')[0], item.split('-')[1]];
                            }
                            if (item.split('.').slice(1).join('.') != 'json') {
                                obj.push(img);
                            }
                            if (!arr[index + 1]) {
                                fs.writeFile(ZCAGE.INDEX, JSON.stringify(obj,
                                        null, 4),
                                    function(err) {
                                        if (err) {
                                            if (callback)
                                                callback(500, {
                                                    message: "Something wrong happened"
                                                });
                                            console.log(err.message)
                                        } else {
                                            var tmpobj = [];
                                            obj.forEach(function(e, index, arr) {
                                                delete e.filename;
                                                tmpobj.push(e);
                                                if (!arr[index + 1]) {
                                                    if (callback) {
                                                        callback(200, tmpobj);
                                                    } else {
                                                        //	 console.log(tmpobj)
                                                    }
                                                }
                                            });
                                        }
                                    });
                            }
                        })
                    })
                })
            } else {
                fs.readFile(ZCAGE.INDEX, (err, data) => {
                    if (err) {
                        callback(500, {
                            message: err.message
                        })
                        throw err;
                    }
                    let images = JSON.parse(data);
                    images.forEach(function(e, index, arr) {
                        obj.push(e);
                        if (!arr[index + 1]) {
                            if (callback)
                                callback(200, obj);
                        }
                    });
                });
            }
        });
    } else {
        fs.readdir(ZCAGE.IMAGES, function(err, item) {
            item.forEach(function(item, index, arr) {
                fs.stat(ZCAGE.IMAGES + '/' + item, function(err, stats) {
                    if (err) {
                        callback(500, {
                            message: err.message
                        });
                        throw err;
                    }
                    var img = {}
                    var r = spawnSync('sha256sum ' + ZCAGE.IMAGES + '/' + item, {
                        shell: true
                    });
                    if (r.error) {
                        callback(500, {
                            message: r.stderr.toString()
                        });
                        return;
                    }
                    var id = r.stdout.toString().split(/\s+/);
                    img.Id = id[0];
                    img.Created = stats.ctime;
                    img.Size = stats.size;
                    img.VirtualSize = stats.size;
                    img.SharedSize = 0;
                    img.Labels = {};
                    img.Containers = 0;
                    img.filename = item;
                    if (item.split('.').slice(1).join('.') == 'raw.xz' ||
                        item.split('.').slice(1).join('.') == 'qcow2.xz' ||
                        item.split('.').slice(1).join('.') == 'xz' ||
                        item.split('.').slice(1).join('.') == 'qcow2' ||
                        item.split('.').slice(1).join('.') == 'img' ||
                        item.includes('raw') || item.includes('qcow') ||
                        item.includes('img')
                    ) {
                        if (item.toUpperCase().includes('CLOUD')) {
                            img.RepoTags = ['cloud-init', item.split('-')[0], item.split('-')[1]];
                        } else {
                            img.RepoTags = [item.split('-')[0], item.split('-')[1]];
                        }
                        img.Labels = ['KVM', 'BHYVE'];
                    } else if (item.toUpperCase().includes('JOYENT')) {
                        img.Labels = ['Linux', item.split('-')[1]];
                        img.RepoTags = ['Joyent', item.split('-')[1] + item.split('-')[2]];
                    } else if (!item.includes('native')) {
                        img.Labels = ['Linux', 'Docker'];
                        img.RepoTags = [item.split('-')[0], item.split('-')[1]];
                    }
                    if (item.split('.').slice(1).join('.') != 'json') {
                        obj.push(img);
                    }
                    if (!arr[index + 1]) {
                        fs.writeFile(ZCAGE.INDEX, JSON.stringify(obj,
                                null, 4),
                            function(err) {
                                if (err) {
                                    console.log(err.message);
                                    if (callback)
                                        callback(500, {
                                            message: err.message
                                        });
                                } else {
                                    var tmpobj = [];
                                    obj.forEach(function(e, index, arr) {
                                        delete e.filename;
                                        tmpobj.push(e);
                                        if (!arr[index + 1]) {
                                            if (callback)
                                                callback(200, tmpobj);
                                        }
                                    });
                                }
                            });
                    }
                })
            })
        })
    }
}

function image_id2fname(id, callback) {
    data = fs.readFileSync(ZCAGE.INDEX);
    let images = JSON.parse(data);
    var imgid = images.filter(function(e) {
        return e.Id == id;
    });
    if (imgid.length == 0) {
        if (callback)
            callback(404, {
                message: "No such image"
            });
        return null;
    } else {
        if (callback)
            callback(200, imgid[0]);
        return imgid[0];
    }
}
// https://docs.docker.com/engine/api/v1.30/#operation/ImageCreate
/*
 * create_image
 * Will create an image in that will be pulled from a remote source
 * or will take an existing compressed archive and register it as an
 * image.
 * @from_source : the remote  url from where to fetch an image, repo and tag
 * must be provided to create the image using the convention:
 * provider-type-filename
 * @repo : if repo is docker then repo will be used as the library
 * where to fetch the image with @tag, if not and if @from_source is
 * defined, then repo and tag will be used to name the tag.
 * @from_image: id of image to convert it to the repo + tag naming
 * convention,so it will be displayed with the right metadata when listed. 
 */

function create_image(query, callback) {
    var dockerimg = '';
    if (!query.from_source && !query.from_image && query.repo && query.tag) {
        dockerimg = docker_pull(query.repo, query.tag)
        if (dockerimg == -1) {
            if (callback)
                callback(500, {
                    message: "Something wrong happened"
                });
            return;
        } else if (callback) {
            callback(200, {
                message: "Container image created"
            });
            return;
        }
    } else if (query.from_source && query.repo && query.tag) {
        fetch(query.from_source, query.repo, query.tag, callback);
        return;
    } else if (query.from_image && query.repo && query.tag) {
        let img = image_id2fname(query.from_image);
        if (img == null) {
            if (callback)
                callback(404, {
                    message: "No such image"
                });
            return;
        }
        var ext = img.filename.split('.').slice(1).join('.');
        var name = query.repo + '-' + query.tag + '.' + ext;
        r = spawnSync('pfexec', ['cp',
            ZCAGE.IMAGES + '/' + img.filename,
            ZCAGE.IMAGES + '/' + name
        ]);
        var errorText = r.stderr.toString().trim();
        if (errorText) {
            if (callback)
                callback(500, {
                    message: errorText
                });
            return;
        }
        callback(200, {
            message: "Container image " + name + " created"
        });
        return;
    }
}

function can_create_vm() {
        try {
            fs.writeFileSync(ZCAGE.VMS + '/.test');
            fs.unlinkSync(ZCAGE.VMS + '/.test');
        } catch (e) {
            return false;
        }
	return true;
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
module.exports.list_datasource = list_datasource;
module.exports.fetch = fetch;
module.exports.fetch_by_provider = fetch_by_provider;
module.exports.container_images = container_images;
module.exports.image_id2fname = image_id2fname;
module.exports.create_image = create_image;
module.exports.can_create_vm = can_create_vm;
