const zone = require('zonelib');
const ipaddr = require('ipaddr.js');
//// Tests
//var o = {
//    brand: "sparse",
//    autoboot: "false",
//    zonepath: "/zones/test01",
//    net: [{
//        physical: "vnic0",
//        gateway: "192.168.1.1",
//        ips: ["192.168.1.108"],
//    }],
//};
//
//zone.destroy("test04");
//var z = zone.create_zone_spec(o);
//zone.create("test04", z);

const commandLineArgs = require('command-line-args')

/* first - parse the main command name */
let mainDefinitions = [
  { name: 'name', defaultOption: true }
]
const mainCommand = commandLineArgs(mainDefinitions, { stopAtFirstUnknown: true })
let argv = mainCommand._unknown || []

console.log('mainCommand is '); 
console.log(mainCommand)

/* second - parse the main command options */
if (mainCommand.name === 'create') {
  const runDefinitions = [
    { name: 'tag' },
    { name: 'addr' },
    { name: 'brand', alias: 'b' },
    { name: 'count', alias: 'c' }
  ]
  const runOptions = commandLineArgs(runDefinitions, { argv, stopAtFirstUnknown: true })
  argv = runOptions._unknown || []

  console.log(' runOptions are ')
  console.log(runOptions)

//  /* third - parse the sub-command  */
//  const subCommandDefinitions = [
//    { name: 'name', defaultOption: true }
//  ]
//  const subCommand = commandLineArgs(subCommandDefinitions, { argv, stopAtFirstUnknown: true })
//
//  console.log(' subCommand is')
//  console.log(subCommand)
}
