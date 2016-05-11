#!/usr/bin/env node
var fs = require('fs');
var app = require('../index');

var targetPath = process.argv[2];
if (!targetPath) {
  console.log("Usage: "+__filename+" <target_file.target> [<nexus_url>] [-m] [-n] [-r eclipse.repo.id[,eclipse.repo.id]...]");
  console.log("-m\t Don't use nexus_url for maven settings.xml");
  console.log("-n\t Don't use nexus_url for nexus post script");
  console.log("-r\t Comma sepated list of repo ids to mirror from https://repo.eclipse.org");
  process.exit(-1);
}
var nexus_url = "$nexusUrl"
var hasNexusUrl = process.argv.length >= 4 && process.argv[3];
if (hasNexusUrl) {
	nexus_url = process.argv[3];
}
var eclipseRepoIds = ["rcptt-releases"];
var useInMaven = hasNexusUrl;
var useInNexus = hasNexusUrl;
for (var i = 4; i < process.argv.length; i++) {
	if (process.argv[i] == "-m")
		useInMaven = false;
	if (process.argv[i] == "-n")
		useInNexus = false;
	if (process.argv[i] == "-r")
		eclipseRepoIds = process.argv[i+1].split(",");
}

fs.accessSync(targetPath, fs.F_OK);

app.init(targetPath, nexus_url, useInMaven, useInNexus, eclipseRepoIds);
