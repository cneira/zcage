var fs = require('fs');
var path = require('path');
if (!fs.existsSync) {
    fs.existsSync = path.existsSync;
}


function compact(array) {
    return array.filter(function (i) {
        if (typeof i.length !== 'undefined')
            return i.length > 0;
        return !!i;
    });
}

function findCmd(name) {
    "use strict";

    var paths = process.env['PATH'].split(':');
    var pathLen = paths.length;
    for (var i = 0; i < pathLen; i++) {
        var sp = path.resolve(paths[i]);
        var fname = path.normalize(path.join(sp, name));
        if (fs.existsSync(fname)) {
            return fname;
        }
    }

    return null;
}


function parseNumber(str) {
    var m = str.match(/^([0-9.]+)([KMGT]?)$/);
    if (!m) {
        return -1;
    }

    var n = parseFloat(m[1]);
    if (m[2] === 'K') {
        n *= 1024;
    } else if (m[2] === 'M') {
        n *= 1024 * 1024;
    } else if (m[2] === 'G') {
        n *= 1024 * 1024 * 1024;
    } else if (m[2] === 'T') {
        n *= 1024 * 1024 * 1024 * 1024;
    } else if (m[2] === 'P') {
        n *= 1024 * 1024 * 1024 * 1024 * 1024;
    }

    return Math.floor(n);
}

function Property(info) {
    "use strict";

    var obj = Object.create({});
    if (typeof info === 'string') {
        info = info.split(/\t+/, 4);
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

exports.compact = compact;
exports.parseNumber = parseNumber;
exports.Property = Property;
exports.findCmd = findCmd;
