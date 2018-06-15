const zone = require('zonelib');
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
const commandLineUsage = require('command-line-usage')

const optionDefinitions = [
  {
    name: 'help',
    alias: 'h',
    type: Boolean,
    description: 'Display this usage guide.'
  },
  {
    name: 'src',
    type: String,
    multiple: true,
    description: 'The input files to process',
    typeLabel: '<files>' },
  {
    name: 'timeout',
    alias: 't',
    type: Number,
    description: 'Timeout value in ms',
    typeLabel: '<ms>' },
  {
    name: 'log',
    alias: 'l',
    type: String,
    description: 'info, warn or error'
  }
]

const options = commandLineArgs(optionDefinitions)

if (options.help) {
  const usage = commandLineUsage([
    {
      header: 'Typical Example',
      content: 'A simple example demonstrating typical usage.'
    },
    {
      header: 'Options',
      optionList: optionDefinitions
    },
    {
      content: 'Project home: {underline https://github.com/me/example}'
    }
  ])
  console.log(usage)
} else {
  console.log(options)
}
