var cp = require('child_process');
var util = require('./util');


var zfsBin = util.findCmd('zfs');
function zfs(args, callback) {
    "use strict";

    cp.execFile(zfsBin, args, {maxBuffer: 8000000}, function (err, stdout, stderr) {
        if (callback && typeof callback === 'function') {
            if (err) {
                err.message = util.compact(err.message.split('\n')).join('; ').trim();
                callback(err);
            } else {
                callback(null, stdout);
            }
        }
    });
}

function spawnzfs (args, callback) {
    "use strict";

    var child;
    try {
        child = cp.spawn(zfsBin, args);
    }
    catch (e) {
        return callback(e);
    }

    return callback(null, child);
}

function ZFS(info) {
    "use strict";

    var obj = Object.create({});
    if (typeof info === 'string') {
        info = info.split(/\s+/);
    }

    if (info.length !== 5) {
        return null;
    }

    obj.name = info[0];
    obj.used = util.parseNumber(info[1]);
    if (info[2] !== '-') { // Snapshots don't have 'avail' field.
        obj.avail = util.parseNumber(info[2]);
    }
    obj.refer = util.parseNumber(info[3]);
    obj.mountpoint = info[4];

    Object.freeze(obj);
    return obj;
}

function Property(info) {
    "use strict";

    var obj = Object.create({});
    if (typeof info === 'string') {
        info = info.split(/\t/, 4);
    }

    if (info.length !== 4) {
        return null;
    }

    obj.name = info[0];
    obj.property = info[1];
    obj.value = info[2];
    obj.source = info[3];

    Object.freeze(obj);
    return obj;
}

/*
*
* List the ZFS folders or datasets
*
* You have the optional opts parameter (if no opts defined, this function returns all the datasets)
*
* PARAMS:
* opts: {
*   type: string //Define a type of dataset to filter on (optional)
*   sort: string //property on which to sort the output list of datasets (optional)
*   name: string //a list of a specific dataset (optional)
*   recursive: boolean //recursively list datasets
*}
*
 */

function list(opts, cb) {
    "use strict";

    if (typeof opts === 'function') {
        cb = opts;
        opts = undefined;
    }

    var params = ['list', '-H'];

    if (opts && opts.type) {
        params.push('-t');
        params.push(opts.type);
    }

    if (opts && opts.sort) {
        params.push('-s');
        params.push(opts.sort);
    }

    if (opts && opts.recursive) {
        params.push('-r');
    }

    if (opts && opts.name) {
        params.push(opts.name);
    }

    zfs(params, function (err, stdout) {
        if (cb && typeof cb === 'function') {
            if (err) {
                cb(err);
                return;
            }
            var lines = util.compact(stdout.split('\n'));
            var list = lines.map(function (x) { return new ZFS(x); });
            cb(err, list);
        }
    });
}

/*
*
* Get the parameters of a specific dataset or all datasets
*
* PARAMS:
* opts: {
*   property: string //which property to show (must exist)
*   source: string //can be one of the following: local,default,inherited,temporary,none (optional)
*   name: string //the name of the dataset (optional)
*}
*
 */
function get(opts, cb) {
    "use strict";

    var params = [ 'get', '-pH' ];
    if (opts.source) {
        params.push('-s', opts.source);
    }

    params.push(opts.property);

    if (opts.name) {
      params.push(opts.name);
    }

    zfs(params, function (err, stdout) {
        if (cb && typeof cb === 'function') {
            if (err) return cb(err);
            var lines = util.compact(stdout.split('\n'));
            var list = lines.map(function (x) { return new util.Property(x); });
            cb(err, list);
        }
    });
}

/*
*
* Remove a dataset from the ZFS filesystem
*
* PARAMS:
* opts: {
*   recursive: Boolean //to make the destroy recursive (add the -r command to the zfs command) (optional)
*   name: string //The name of the dataset to destroy (must exist)
*}
*
 */

function destroy(opts, cb) {
    "use strict";

    var params = [ 'destroy' ];
    if (opts.recursive) {
        params.push('-r');
    }
    params.push(opts.name);

    zfs(params, cb);
}

/*
*
* Create a new dataset inside the ZFS filesystem
*
* PARAMS:
* opts: {
*   name: string //the name for the new dataset (must exist)
*   size: string //the size of the volume (optional)
*   options: { property: String, value: String } //all extra options you want to set for the new dataset, like quota,... (optional)
*   OR:
*   options = [ { property: String, value: String }, { property: String, value: String } ]
*
*}
 */

function create(opts, cb) {
    "use strict";

    var params = [ 'create' ];

    if (opts.options) {
        if (opts.options.length) {
            //opts.options is an array
            for (var x =0; x < opts.options.length; x++) {
                params.push('-o', opts.options[x].property + "=" + opts.options[x].value);
            }
        } else {
            //opts.options is a single object
            params.push('-o', opts.options.property + "=" + opts.options.value);
        }
    }

    if (opts.size) {
      params.push('-V', util.parseNumber(opts.size));
    }
    params.push(opts.name);

    zfs(params, cb);
}

/*
* Set a specific option for a given dataset
*
* PARAMS:
* opts: {
*   name: string //the name of the dataset for which to set the option (must exist)
*   property: string //which property to set (must exist)
*   value: string //which value to set for the property (must exist)
* }
*
 */

function set(opts, cb) {
    "use strict";

    var params = [ 'set' ];

    params.push(opts.property + "=" + opts.value);

    params.push(opts.name);

    zfs(params, cb);
}

/*
*
* Creates a snapshot with the given name.
*
* PARAMS:
* opts: {
*   name: string // the name of the snapshot (must exist)
*   dataset: string //the mountpoint of the snapshot (must exist)
*   recursive: boolean //if true the -r option is added to the zfs command (optional)
* }
*
 */

function snapshot(opts, cb) {
    "use strict";

    var params = [ 'snapshot' ];
    if (opts.recursive) {
        params.push('-r');
    }
    params.push(opts.dataset + '@' + opts.name);

    zfs(params, cb);
}

/*
*
*  Creates a clone of the given snapshot.
*  The target dataset can be  located  anywhere  in  the  ZFS  hierarchy, and is created as the same type as the original.
*
*  PARAMS:
*  opts: {
*   snapshot: string //the location of the snapshot. Follwing structure must be used: pool/project/production@today (must exist)
*   dataset: string //the name of the mount point (must exist)
* }
*
 */

function clone(opts, cb) {
    "use strict";

    var params = [ 'clone' ];
    params.push(opts.snapshot, opts.dataset);

    zfs(params, cb);
}

/*
*
*  Mount the specified dataset/all datasets to the mountpoint
*
*  PARAMS:
*  opts: {
*    dataset: string // the name of the zfs dataset. if the dataset is null, then mount all datasets with '-a'
*    overlay: boolean // whether use overlay mode
*    options: [string, string, ...] // the temporal properties set for the mount duration, 
*                                      such as ro/rw for readonly and readwrite (optional)
*  }
 */
function mount(opts, cb) {
    "use strict";
    
    var params = [ 'mount' ];
    
    if (opts.overlay) {
        params.push('-O');
    }
    
    if (opts.options) {
        if (opts.options.length) {
            //opts.options is an array
            for (var x =0; x < opts.options.length; x++) {
                params.push('-o', opts.options[x]);
            }
        } else {
            //opts.options is a single object, callback err and return
            cb({error:'invalid argu: the options should be a string array'});
            return;
        }
    }
    
    if (opts.dataset) {
        params.push(opts.dataset);  
    } else {
        params.push('-a');
    }
    
    zfs(params, cb);
}

/*
*
*  Unmount the specified filesystem|mountpoint
*
*  PARAMS:
*  opts: {
*    name: string // the name of the zfs dataset or the path of the mountpoint. 
*                    if the dataset is null, then unmount all available filesystems with '-a'
*    force: boolean // whether forcely unmount even if the filesystem is still in use.
*  }
 */
function unmount(opts, cb) {
    "use strict";
    
    var params = [ 'unmount' ];
    
    if (opts.force) {
        params.push('-f');
    }
    
    if (opts.name) {
        params.push(opts.name);  
    } else {
        params.push('-a');
    }
    
    zfs(params, cb);
}

/*
*
*  Initiates a send operation of a given snapshot
*
*  Callback contains a readable stream that is the sendStream
*  Signature : zfs.send(opts, function (err, sendStream) {});
*  Events :  sendStream.on('error', function (err) {});
*            sendStream.on('verbose', function (data) {});
*
*  PARAMS:
*  opts: {
*   snapshot: string //the location of the snapshot. Follwing structure must be used: pool/project/production@today (must exist)
*   replication: boolean //create a replication stream
*   deduplicate: boolean //create a deduplicated stream
*   properties: boolean //send dataset properties with the stream
*   noop: boolean //don't actually do anything
*   parseable : boolean //output in machine readable format
*   verbose : boolean //emit verbose events containing the contents of stderr
*   incremental : snapshot //do an incremental send. the snapshot referred to here is the from snapshot
*   intermediary : boolean //only applies when incremental is set. Include intermediary snapshots with the stream
* }
*
 */

function send(opts, cb) {
    "use strict";

    var params = [ 'send' ];
    if (opts.replication) {
        params.push('-R');
    }

    if (opts.deduplicate) {
        params.push('-D');
    }

    if (opts.properties) {
        params.push('-p');
    }

    if (opts.noop) {
        params.push('-n');
    }

    if (opts.parsable) {
        params.push('-P');
    }

    if (opts.verbose) {
        params.push('-v');
    }

    if (opts.incremental) {
        if (opts.intermediary) {
            params.push('-I');
        }
        else {
            params.push('-i');
        }

        params.push(opts.incremental);
    }

    params.push(opts.snapshot);

    spawnzfs(params, function (err, child) {
        if (err) {
            return cb(err);
        }

        var buffer = [];
        var sendStream = child.stdout;

        child.stderr.on('data', function (data) {
            data = data.toString();
            buffer.push(data);

            if (opts.verbose) {
                sendStream.emit('verbose', data);
            }

            //only keep last 5 lines
            if (buffer.length > 5) {
                buffer.shift();
            }
        });

        child.once('exit', function (code) {
            if (code !== 0) {
                var message = 'Send Error:' + util.compact(buffer.join('\n').split('\n')).join('; ').trim();
                var err = new Error(message);
                err.code = code;

                sendStream.emit('error', err);
            }
        });

        return cb(null, sendStream);
    });
}

/*
*
*  Initiates a receive of a snapshot
*
*  Callback is the writable stream
*
*  PARAMS:
*  opts: {
*   snapshot: string //the location of the snapshot. Follwing structure must be used: pool/project/production@today (must exist)
*   verbose: boolean //if true, the receiveStream will emit 'verbose' events containing the output of stderr
*   noop: boolean //if true, zfs will not actually receive anything
*   force: boolean //if true, dataset will be rolled back to most recent snapshot
*   unmounted : boolean //if true, dataset will not be mounted after receive
*   d : boolean //discard first element of received dataset's name
*   e : boolean //discard all elements except last of received dataset's name
* }
*
 */

function receive(opts, cb) {
    "use strict";

    var params = [ 'receive' ];
    if (opts.verbose) {
        params.push('-v');
    }

    if (opts.noop) {
        params.push('-n');
    }

    if (opts.force) {
        params.push('-F');
    }

    if (opts.unmounted) {
        params.push('-u');
    }

    if (opts.d) {
        params.push('-d');
    }

    if (opts.e) {
        params.push('-e');
    }

    params.push(opts.dataset);

    spawnzfs(params, function (err, child) {
        if (err) {
            return cb(err);
        }

        var buffer = [];
        var receiveStream = child.stdin;

        child.stderr.on('data', function (data) {
            data = data.toString();
            buffer.push(data);

            if (opts.verbose) {
                receiveStream.emit('verbose', data);
            }

            //only keep last 5 lines
            if (buffer.length > 5) {
                buffer.shift();
            }
        });

        child.once('exit', function (code) {
            if (code !== 0) {
                var message = 'Receive Error: ' + util.compact(buffer.join('\n').split('\n')).join('; ').trim();
                var err = new Error(message);
                err.code = code;

                receiveStream.emit('error', err);
            }
        });

        return cb(null, receiveStream);
    });
}

exports.get = get;
exports.set = set;
exports.list = list;
exports.destroy = destroy;
exports.create = create;
exports.snapshot = snapshot;
exports.clone = clone;
exports.mount = mount;
exports.unmount = unmount;
exports.send = send;
exports.receive = receive;
