#!/usr/bin/env node
var fs = require('fs');
var app = require('../index');

var targetPath = process.argv[2];
if (!targetPath) {
  console.log("Usage: "+__filename+" <target_file.target> [<nexus_url>] [-m] [-n]");
  console.log("-m\t Don't use nexus_url for maven settings.xml");
  console.log("-n\t Don't use nexus_url for nexus post script");
  process.exit(-1);
}
var nexus_url = "$nexusUrl"
var hasNexusUrl = process.argv.length >= 4 && process.argv[3];
if (hasNexusUrl) {
	nexus_url = process.argv[3];
}
var useInMaven = hasNexusUrl;
var useInNexus = hasNexusUrl;
for (var i = 4; i < process.argv.length; i++) {
	if (process.argv[i] == "-m")
		useInMaven = false;
	if (process.argv[i] == "-n")
		useInNexus = false;
}

fs.accessSync(targetPath, fs.F_OK);

app.init(targetPath, nexus_url, useInMaven, useInNexus);
