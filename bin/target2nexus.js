#!/usr/bin/env node
var fs = require('fs');
var app = require('../index');

var targetPath = process.argv[2];
if (!targetPath) {
  console.log("Usage: "+__filename+" <target_file.target> [<nexus_url>]");
  process.exit(-1);
}
var nexus_url = "$url"
if (process.argv[3]) {
	nexus_url = process.argv[3];
}

fs.accessSync(targetPath, fs.F_OK);

app.init(targetPath, nexus_url);
