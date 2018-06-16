var cp = require('child_process');
var util = require('./util');

function ZPool(info) {
    "use strict";

    var obj = Object.create({});
    if (typeof info === 'string') {
        info = info.split(/\s+/);
    }

    if (info.length !== 10) {
        return null;
    }

    obj.name = info[0];
    obj.size = info[1];
    obj.alloc = info[2];
    obj.free = info[3];
    obj.cap = info[4];
    obj.health = info[5];
    if (info[6] !== '-') {
        obj.altroot = info[6];
    }

    Object.freeze(obj);
    return obj;
}

var zpoolBin = util.findCmd('zpool');
function zpool(args, callback) {
    "use strict";

    cp.execFile(zpoolBin, args, {maxBuffer: 8000000}, function (err, stdout, stderr) {
        if (callback && typeof callback === 'function') {
            if (err) {
                err.message = util.compact(err.message.split('\n')).join('; ').trim();
                callback(err);
            } else {
                if (!stdout || stdout == '') stdout = 'Request succesfully fulfilled!';
                callback(null, stdout);
            }
        }
    });
}

/*
*
*  Creates a new storage pool containing the virtual devices specified
*  on the	command	line. The pool name must begin with a letter, and can
*  only contain alphanumeric characters as well as underscore ("_"),
*  dash ("-"), and period	(".").
*
*  zpool create -f datastore raidz /dev/vdb /dev/vdc /dev/vdd
*
*  PARAMS:
*  opts: {
*   options: { property: String, value: String } //all extra options you want to set for the new datastore, like quota,... (optional)
 *   OR:
 *   options = [ { property: String, value: String }, { property: String, value: String } ],
 *   mountpoint: String, //Optional, Sets the mount point for the root dataset. The	default	mount point is "/pool" or "altroot/pool" if altroot is specified.
 *   name: String, //must exist, the name of the datastore
 *   devices: String or Array //Must exist, a list or array containing the device paths and things like mirror and raidz. (see example above)
 *}
 *
 */

function create (opts, cb) {
    //

    "use strict";

    var params = [ 'create', '-f' ];

    /*
     immediately add some options to the create procedure
     done by adding argument -o option=value
     the opts.options parameter is an array of objects, or a single object

     opts.options = { property: String, value: String }

     OR:

     opts.options = [ { property: String, value: String }, { property: String, value: String } ]

     */

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

    if (opts.mountpoint) {
        params.push('-m', opts.mountpoint);
    }

    params.push(opts.name);

    if (opts.devices.length) {
        params = params.concat(opts.devices);
    } else {
        var devices = opts.devices.split(/\s+/);
        params = params.concat(devices);
    }

    zpool(params, cb);
}

/*
*
*  Adds the specified virtual devices to the given pool.
*
*  PARAMS:
*  opts: {
*   name: String, //Must exist, the name of the pool to which to add the device
*   devices: String or Array //Must exist, a list of devices to add to the given pool.
* }
 */

function add (opts, cb) {
    "use strict";

    var params = [ 'add', '-f' ];

    params.push(opts.name);

    //devices is an array or a string of devices
    if (opts.devices.length) {
        params = params.concat(opts.devices);
    } else {
        var devices = opts.devices.split(/\s+/);
        params = params.concat(devices);
    }

    zpool(params, cb);
}

/*
*
* Sets the given property on the specified pool. See the zpool manpage for possible options and values
*
* PARAMS:
* opts: {
*   property: String //Must exist, which property to set
*   value: String //Must exits, the value for the described property
*   name: String //Must exist, the name of the pool on which to set the property
*}
*
 */

function set(opts, cb) {
    "use strict";

    var params = [ 'set' ];

    params.push(opts.property + "=" + opts.value);

    params.push(opts.name);

    zpool(params, cb);
}

/*
*
* Destroys the given pool, freeing up any devices for other use.
* This command tries to unmount any active datasets before destroying the pool.
*
* PARAMS:
* opts: {
*   name: String //Must exist, the name of the pool to destroy
* }
*
 */


function destroy(opts, cb) {
    "use strict";

    var params = [ 'destroy', '-f' ];

    params.push(opts.name);

    zpool(params, cb);
}

/*
*
* Lists the given pools along with a health status and space usage. If
* no pools are specified, all pools in the system are listed.
*
* PARAMS:
* opts: {
*   name: String, //optional, the name of the pool for which to list the status
* }
*
 */

function list(opts, cb) {
    //list the statistics from a (specific) pool. -o option is NOT available
    "use strict";

    if (typeof opts === 'function') {
        cb = opts;
        opts = undefined;
    }

    var params = ['list', '-H'];

    if (opts && opts.name) {
        params.push(opts.name);
    }

    zpool(params, function (err, stdout) {
        if (cb && typeof cb === 'function') {
            if (err) {
                cb(err);
                return;
            }
            var lines = util.compact(stdout.split('\n'));
            var list = lines.map(function (x) { return new ZPool(x); });
            cb(err, list);
        }
    });
}

/*
*
* Retrieves the given list of properties	(or all	properties if "all" is
* used) for the specified storage pool(s). These	properties are displayed
* with the following fields:
*   name	        Name of storage pool
*   property	    Property name
*   value	        Property value
*   source	        Property source, either 'default' or 'local'.
*
*
* PARAMS:
* opts: {
*  name: String //Optional, define a pool name for which to show the options
*  property: String //Optional, comma-separated list of properties to show. If not defined this
 *  function returns all options.
 * }
 */

function get(opts, cb) {
    "use strict";

    var params = [ 'get', '-pH' ];

    if (opts.property) {
        params.push(opts.property);
    } else {
        params.push('all');
    }


    if (opts.name) {
        params.push(opts.name);
    }

    zpool(params, function (err, stdout) {
        if (cb && typeof cb === 'function') {
            if (err) return cb(err);
            var lines = util.compact(stdout.split('\n'));
            var list = lines.map(function (x) { return new util.Property(x); });
            cb(err, list);
        }
    });
}

exports.get = get;
exports.set = set;
exports.list = list;
exports.destroy = destroy;
exports.create = create;
exports.add = add;