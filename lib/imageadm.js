const curl = new(require('curl-request'))();
var fs = require('fs');
const IMGURL = 'https://images.joyent.com/images';
const  imgfs = require('zfs');
const  ZFSVMS = '/tmp';


function fetchmeta(url, uuid, cb) {
    curl.setHeaders([
            'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36'
        ])
        .get(url)
        .then(({
            statusCode,
            body,
            headers
        }) => {
            if (cb)
                cb(null, body, uuid);
            else
                return body;
        })
        .catch((e) => {
            console.log(e);
            if (cb)
                cb(e, null, uuid);
        });
}

function filter_images(err, data) {
    if (err) {
        console.log("error retrieving data");
        return null;
    }
    let vms = {};
    vms = JSON.parse(JSON.stringify(data));
    var filtered = vms.filter(function(e) {
        return e.type == 'lx-dataset';
    });

    console.log("UUID\t\t\t\t\t\t\tNAME\t\t\t\t\t\tVERSION\t\tOS\t\t\tPUBLISHED");
    filtered.forEach(function(e) {
        console.log(e.uuid, '\t\t\t', e.name, '\t\t\t\t\t', e.version, '\t\t\t', e.os, '\t\t\t', e.published_at);
    });
}

function list_images() {
    fetchmeta(IMGURL, null, filter_images);
}

function getzss(uuid) {
    fetchmeta(IMGURL + '/' + uuid + '/file', uuid, fetch_zss);
    console.log(`Downloading image ${uuid}`);
}

function fetch_zss(err, data, uuid) {
    if (err) {
        console.log("error downloading zss");
        return null;
    }
        console.log(`saving in ${ZFSVMS} zss `);
    fs.writeFile(`${ZFSVMS}/${uuid}.zss.gz`, data, function(err) {
        console.log(`Image download completed for ${uuid} zss `);
    });
}

function datasetexists(ds) {
	  var opts = {
    name: 'rpool/zones',
    property: 'quota'
};
   imgfs.zfs.get(opts, function (err, options) {
    console.log(options)
});
}


module.exports.list_images = list_images;
module.exports.getzss = getzss;
