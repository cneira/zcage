/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. 
 *
 * Copyright (c) 2018, Carlos Neira cneirabustos@gmail.com 
 */

var restify = require('restify');
var zadm = require('./zonelib.js');
var zimg = require('./imageadm.js');

/* Most of the endpoint follow docker's engine api 
   some modifications on output have been done on purpouse.
   https://docs.docker.com/engine/api/v1.30/
*/

var server = restify.createServer();
server.pre(restify.plugins.pre.userAgentConnection());
server.use(restify.plugins.queryParser({
    mapParams: true
}));

server.use(restify.plugins.bodyParser({
    mapParams: true
}));

server.use(restify.plugins.acceptParser(server.acceptable));

/* Container endpoints 
 * https://docs.docker.com/engine/api/v1.30/#tag/Container
 */

/* https://docs.docker.com/engine/api/v1.30/#operation/ContainerList 
 *  This endpoint will always list all containers.
 *  No query params.
 */
server.get('/containers/json', function (req, res, next) {
    zadm.get_containers(function (z) {
	res.send(z);
	return next();
    });});

/* https://docs.docker.com/engine/api/v1.30/#operation/ContainerInspect
 *  Return low-level information about a container.
 *  Path parameters :  
 *  - id : String (required) id of container.
 */
server.get('/containers/:id/json', function (req, res, next) {
    zadm.getzonedata(req.params.id, function (z) {
	if (z.message)
	    res.send(404, z);
	else
	    res.send(z);
	return next();
    });
});

/* https://docs.docker.com/engine/api/v1.30/#operation/ContainerStart
 *  Path parameters :  
 *  - id : String (required) id of container.
 */
server.post('/containers/:id/start', function (req, res, next) {
    zadm.start(req.params.id, null, function (code, resp) {
	res.send(code, resp);
	return next();
    });
});

/* https://docs.docker.com/engine/api/v1.30/#operation/ContainerStop
 *  Path parameters :  
 *  - id : String (required) id of container.
 */
server.post('/containers/:id/stop', function (req, res, next) {
    zadm.halt(req.params.id, function (code, resp) {
	res.send(code, resp);
	return next();
    });
});

/* https://docs.docker.com/engine/api/v1.30/#operation/ContainerRestart
 *  Path parameters :  
 *  - id : String (required) id of container.
 */
server.post('/containers/:id/restart', function (req, res, next) {
    zadm.reboot(req.params.id, function (code, resp) {
	res.send(code, resp);
	return next();
    });
});

/* https://docs.docker.com/engine/api/v1.30/#operation/ContainerDelete
 *  Path parameters :  
 *  - id : String (required) id of container.
 */
server.del('/containers/:id', function (req, res, next) {
    zadm.destroy(req.params.id, true, function (code, resp) {
	res.send(code, resp);
	return next();
    });
});

/* https://docs.docker.com/engine/api/v1.30/#operation/ContainerStats
 *  Path parameters :  
 *  - id : String (required) id of container.
 */
server.get('/containers/:id/stats', function (req, res, next) {
    zadm.getstats(req.params.id, function (code, resp) {
	res.send(code, resp);
	return next();
    });
});

/* https://docs.docker.com/engine/api/v1.30/#operation/ContainerTop
 *  Path parameters :  
 *  - id : String (required) id of container.
 *  Query parameters :
 *  - ps_args: The arguments to pass to ps. For example, aux
 */
server.get('/containers/:id/top', function (req, res, next) {
    zadm.container_top(req.params.id, req.query.ps_args, function (code, resp) {
	res.send(code, resp);
	return next();
    });
});

/* https://docs.docker.com/engine/api/v1.30/#operation/ContainerExport
 *  Path parameters :  
 *  - id : String (required) id of container.
 */
server.get('/containers/:id/export', function (req, res, next) {
    zadm.container_export(req.params.id, function (code, resp) {
	res.send(code, resp);
	return next();
    });
});

/* https://docs.docker.com/engine/api/v1.30/#operation/ContainerLogs
 *  Path parameters :  
 *  - id : String (required) id of container.
 *  Query parameters:
 * - stdout : boolean default false, returns logs from stdout
 * - stderr : boolean default false, returns logs from stderr
 */
server.get('/containers/:id/logs', function (req, res, next) {
    zadm.container_logs(req.params.id,req.query.stdout, req.query.stderr,
			function (code, resp) {
			    res.send(code, resp);
			    return next();
			});
});

/* https://docs.docker.com/engine/api/v1.30/#operation/ContainerUpdate
 *  Path parameters :  
 *  - id : String (required) id of container.
 */
server.post('/containers/:id/update', function (req, res, next) {
    zadm.container_update(req.params.id,req.body, function (code, resp) {
	res.send(code, resp);
	return next();
    });
});

/* https://docs.docker.com/engine/api/v1.30/#operation/ContainerWait
 *  Path parameters :  
 *  - id : String (required) id of container.
 *  Query parameters:
 *  - condition: String default stopped, Wait until a container state reaches the given condition. 
 */
server.post('/containers/:id/wait', function (req, res, next) {
    zadm.container_wait(req.params.id,req.query.condition, function (code, resp) {
	res.send(code, resp);
	return next();
    });
});


/* https://docs.docker.com/engine/api/v1.30/#operation/ContainerCreate
 *  Query parameters :  
 *  - name : String  assign name to container.
 *  Request body :
 *  Minimum tags required are : 
 *  - net
 *  - image(for lx, bhyve and kvm brands)
 * {
 *    "brand": "lx",
 *    "net": [
 *        {
 *            "physical": "vnic2",
 *            "address": "192.168.1.110",
 *            "netmask": "255.255.255.0",
 *            "gateway": "192.168.1.1"
 *        }
 *    ],
 *    "ram": "4gb", 
 *    "image": "898c46f3b1a1f39827ed135f020c32e2038c87ae0690a8fe73d94e5df9e6a2d6"
 *   }
 */
server.post('/containers/create', function (req, res, next) {
    if (req.query.name) {
	/* TODO Validate name */
	req.body.alias = req.query.name;
    }
    zadm.create_container(req.body, function (code, resp) {
	res.send(code, resp);
	return next();
    });
});

/* Image endpoints 
 * https://docs.docker.com/engine/api/v1.30/#tag/Image
 */

/* https://docs.docker.com/engine/api/v1.30/#operation/ImageList
 *  Will return all images available in server. 
 */
server.get('/images/json', function (req, res, next) {
    zimg.container_images(function (code, resp) {
	res.send(code, resp);
	return next();
    })});

/* https://docs.docker.com/engine/api/v1.30/#operation/ImageInspect 
 * Returns low level information for image.
 *  Path parameters :  
 *  - id : String (required) id of container.
 */
server.get('/images/:id/json', function (req, res, next) {
    zimg.image_id2fname(req.params.id, function (code, resp) {
	res.send(code, resp);
	return next();
    });
});

/* https://docs.docker.com/engine/api/v1.30/#operation/ImageCreate
 *  Query parameters :  
 *  - from_image :  (String)  image Id to use to create new image.
 *  - from_source:  (String)  url were to fetch an image.
 *  - repo : (String)  if from_image and from_source are not used, fetch 
 *           image from docker repo using tag. if used, name the image using
 *           repo and tag names. 
 *  - tag :  used with repo query param.
 */
server.post('/images/create', function (req, res, next) {
    zimg.create_image(req.params, function (code, resp) {
	res.send(code, resp);
	return next();
    });
});

/* 
 * Returns Networks available for containers.
 */
server.get('/vnics/json', function (req, res, next) {
    zadm.vnic_list(function (code, resp) {
	res.send(code, resp);
	return next();
    });});

/*
 *  Remove stopped containers
 */

server.post('/containers/prune', function (req, res, next) {
    zadm.container_prune(function (code, resp) {
	res.send(code, resp);
	return next();
    });});


function start_daemon(port) {
    server.listen(port, function () {
	console.log('Listening for requests at %s',server.url);
    });
}

module.exports.start_daemon = start_daemon;
