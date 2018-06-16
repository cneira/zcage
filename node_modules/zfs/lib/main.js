var zfs = require('./zfs'),
    zpool = require('./zpool');

//ZFS EXPORTS
exports.get = zfs.get;
exports.set = zfs.set;
exports.list = zfs.list;
exports.destroy = zfs.destroy;
exports.create = zfs.create;
exports.snapshot = zfs.snapshot;
exports.clone = zfs.clone;
exports.mount = zfs.mount;
exports.unmount = zfs.unmount;
exports.send = zfs.send;
exports.receive = zfs.receive;

exports.zfs = {
    set: zfs.set,
    get: zfs.get,
    destroy: zfs.destroy,
    create: zfs.create,
    list: zfs.list,
    snapshot: zfs.snapshot,
    clone: zfs.clone,
    mount: zfs.mount,
    unmount: zfs.unmount,
    send : zfs.send,
    receive : zfs.receive
};

//ZPooL EXPORTS
exports.zpool = {
    set: zpool.set,
    destroy: zpool.destroy,
    create: zpool.create,
    add: zpool.add,
    list: zpool.list,
    get: zpool.get
    //TODO:status
};
