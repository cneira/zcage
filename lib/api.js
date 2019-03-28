var restify = require('restify');
var zadm = require('./zonelib.js');

var server = restify.createServer();
server.pre(restify.plugins.pre.userAgentConnection());
server.use(restify.plugins.queryParser({
	mapParams: true
}));
server.use(restify.plugins.bodyParser({
	mapParams: true
}));
server.use(restify.plugins.acceptParser(server.acceptable));

server.get('/containers/json', function (req, res, next) {
	zadm.get_containers(function (z) {
		res.send(z);
		return next();
	});
});

server.get('/containers/:id/json', function (req, res, next) {
	zadm.getzonedata(req.params.id, function (z) {
		if (z.message)
			res.send(404, z);
		else
			res.send(z);
		return next();
	});
});

server.post('/containers/:id/start', function (req, res, next) {
	zadm.start(req.params.id, null, function (code, resp) {
		res.send(code, resp);
		return next();
	});
});

server.post('/containers/:id/stop', function (req, res, next) {
	zadm.halt(req.params.id, function (code, resp) {
		res.send(code, resp);
		return next();
	});
});

server.post('/containers/:id/restart', function (req, res, next) {
	zadm.reboot(req.params.id, function (code, resp) {
		res.send(code, resp);
		return next();
	});
});

server.del('/containers/:id', function (req, res, next) {
	zadm.destroy(req.params.id, true, function (code, resp) {
		res.send(code, resp);
		return next();
	});
});

server.get('/containers/:id/stats', function (req, res, next) {
	zadm.getstats(req.params.id,function (code, resp) {
		res.send(code, resp);
		return next();
	});
});


server.post('/containers/create', function (req, res, next) {
	console.log("req json:" + JSON.stringify(req.body, null, 4));
	console.log("query " + JSON.stringify(req.query,null,4));
	if(req.query.name) {
		/* TODO Validate name */
		req.body.alias = req.query.name;
	}
	zadm.create_container(req.body, function (code, resp) {
		res.send(code, resp);
		return next();
	});
});


server.listen(8080, function () {
	console.log('%s listening at %s', server.name, server.url);
});
