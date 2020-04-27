/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. 
 *
 * Copyright (c) 2020, Carlos Neira cneirabustos@gmail.com 
 */

const request = require('request');

/* This will return the container configuration
 * data, callback will receive the configuration object.
 *  library is the library of the image for example : library/ubuntu or
 *  gitea/gitea  and tag the release of the container for example : latest
 */

function docker_get_config(library, tag, cb) {
    token = undefined;
    request('https://auth.docker.io/token?service=registry.docker.io&scope=repository:' + library + ':pull&service=registry.docker.io', {
        json: true
    }, (err, res, body) => {
        if (err) {
            return console.log(err);
        }
        token = body.token;
        request('https://registry-1.docker.io/v2/' + library + '/manifests/' + tag, {
            json: true,
            headers: {
                'Authorization': 'Bearer ' + token,
                'Accept': 'application/vnd.docker.distribution.manifest.v2+json'
            }
        }, (err, res, body) => {
            if (err) {
                return console.log(err);
            }
            digest = body.config.digest;
            request('https://registry-1.docker.io/v2/' + library + '/blobs/' + digest, {
                json: true,
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Accept': 'application/vnd.docker.distribution.manifest.v2+json'
                }
            }, (err, res, body) => {
                if (err) {
                    return console.log(err);
                }
                container_config = body.container_config;
                conf = container_config;
                console.log(conf);
                cb(err, conf);
            });
        });
    });
};

function foo(err, obj) {
    env = conf.Env.join(' ');
    entrypoint = conf.Entrypoint.join(' ');
    cmd = conf.Cmd;
    if (cmd[2] == "#(nop) ")
	cmd = ' ';
    else 
    cmd = conf.Cmd.join(' ');

	console.log(env + ' ' + entrypoint + ' ' + cmd);
   
}
docker_get_config("gitea/gitea", "latest", foo);
module.exports.get_docker_config = docker_get_config;
