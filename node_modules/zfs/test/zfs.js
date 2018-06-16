/*globals describe: false, it: false */

var assert = require('assert');
var should = require('should');
var zfs = require('zfs');

describe('zfs', function () {
    describe('list', function () {
        it('returns a list of ZFS filesystems', function (done) {
            var expected = [ {
                name: 'zones',
                used: 1016833507328,
                avail: 944892805120,
                refer: 328704,
                mountpoint: '/zones'
            }, {
                name: 'zones/37a67136-6cdf-4f65-add2-85e4fce60d63',
                used: 696254464,
                avail: 10039486054,
                refer: 696254464,
                mountpoint: '/zones/37a67136-6cdf-4f65-add2-85e4fce60d63'
            }, {
                name: 'zones/37a67136-6cdf-4f65-add2-85e4fce60d63-disk0',
                used: 1503238553,
                avail: 944892805120,
                refer: 1116691496,
                mountpoint: '-'
            }, {
                name: 'zones/37a67136-6cdf-4f65-add2-85e4fce60d63/cores',
                used: 31744,
                avail: 2415919104,
                refer: 31744,
                mountpoint: '/zones/37a67136-6cdf-4f65-add2-85e4fce60d63/cores'
            }, {
                name: 'zones/39a4f744-85cf-416c-ad37-1b933f9e7b13',
                used: 155648,
                avail: 10737418240,
                refer: 124928,
                mountpoint: '/zones/39a4f744-85cf-416c-ad37-1b933f9e7b13'
            } ];
            zfs.list(function (err, list) {
                should.not.exist(err);
                list.should.eql(expected);
                done();
            });
        });
        it('returns a list of ZFS snapshots', function (done) {
            var expected = [ {
                name: 'zones/var@daily-20120516T043000Z',
                used: 137216,
                refer: 2820669,
                mountpoint: '-'
            }, {
                name: 'zones/var@hourly-20120516T160000Z',
                used: 39424,
                refer: 2831155,
                mountpoint: '-'
            }, {
                name: 'zones/var@hourly-20120516T170000Z',
                used: 39424,
                refer: 2831155,
                mountpoint: '-'
            } ];
            zfs.list({ type: 'snapshot' }, function (err, list) {
                should.not.exist(err);
                list.should.eql(expected);
                done();
            });
        });
    });
    describe('get', function (done) {
        it('returns a list of all properties', function (done) {
            var expected = [ {
                name: 'zones',
                property: 'compression',
                value: 'on',
                source: 'local'
            }, {
                name: 'zones/f78f9208-9c26-47f7-9e03-881a96d17c04',
                property: 'compression',
                value: 'on',
                source: 'inherited from zones'
            }, {
                name: 'zones/f78f9208-9c26-47f7-9e03-881a96d17c04/data',
                property: 'compression',
                value: 'on',
                source: 'inherited from zones'
            }, {
                name: 'zones/f78f9208-9c26-47f7-9e03-881a96d17c04/data@daily-20120430',
                property: 'compression',
                value: '-',
                source: '-'
            } ];
            zfs.get({ property: 'compression' }, function (err, list) {
                should.not.exist(err);
                list.should.eql(expected);
                done();
            });
        });
        it('returns a list of local properties', function (done) {
            var expected = [ {
                name: 'zones',
                property: 'compression',
                value: 'on',
                source: 'local'
            } ];
            zfs.get({ source: 'local' }, function (err, list) {
                should.not.exist(err);
                list.should.eql(expected);
                done();
            });
        });
    });
});

