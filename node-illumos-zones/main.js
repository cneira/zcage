var fs = require('fs'),
    xml2js = require('xml2js');
const
    { spawnSync } = require( 'child_process' );


function mapToObj(inputMap) {
    let obj = {};

    inputMap.forEach(function(value, key){
        obj[key] = value
    });

    return obj;
}

function ZonesString() {

   var zoneadm = spawnSync( 'zoneadm', [ 'list', '-cp' ] );
   var zones = zoneadm.stdout.toString().split('\n');
   zones.pop();
   return zones;
}

function Zonedata(zonestring) {

	var values = zonestring.toString().split(':');
	var keys = ["zoneid","zonename","state","zone-path","uuid","brand","ip-type"];
	var m = new Map();
	values.pop();
	for (var i = 0 ,len = values.length; i < len ; i++) {
		m.set(keys[i],values[i]);	
	}
	return mapToObj(m);
}

function ListZones() {

	var zones = ZonesString();
	var zone_data;
	var zoneobjs =[];
	
	for ( var i = 0, len = zones.length; i<len ; i++) {
		zoneobjs.push(Zonedata(zones[i]));
	}
	return zoneobjs;
}

function GetZoneData(zonename) {

	var zones = ListZones();
 	var zone = zones.filter(function (e) {
		return  e.zonename == zonename;
		});	
	addmeta(zone[0]);
	console.log("onedata", JSON.stringify(zone[0], null, 4));
	
	return zone[0];
}
//TODO: create a generic function to manage brand metadata
function addmeta(zoneobj) {
	if (zoneobj.state == "running") {
		var zname = zoneobj.zonename;
		zoneobj.hostname = ExecZonecmd(zname,"hostname");	
		if(zoneobj.brand == "lx") { 
		zoneobj.usedmem_percentage = ExecZonecmd(zname,
			"free | grep Mem | awk '{print $3/$2 * 100.0}'");
		zoneobj.freemem_percentage = ExecZonecmd(zname,
			"free | grep Mem | awk '{print $4/$2 * 100.0}'");
		}
	}
}

function deleteZone(zonename) {
   var zonecfg = spawnSync( 'zonecfg', [ '-z', zonename,'delete' ] );
   console.log("info ", zonecfg.stdout.toString());
   return zonecfg.stdout.toString();		
}

function GetZoneInfo(zonename) {
   var zonecfg = spawnSync( 'zonecfg', [ '-z', zonename,'info' ] );
   console.log("info ", zonecfg.stdout.toString());
   return zonecfg.stdout.toString();		
}

function ExecZonecmd(zonename, cmd) {
   var zlogin = spawnSync( 'pfexec', ['zlogin', zonename, cmd ] );
   console.log("info ", zlogin.stdout.toString());
   return zlogin.stdout.toString();		
}
