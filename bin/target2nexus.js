#!/usr/bin/env node
var fs = require('fs');
var app = require('../index');

var targetPath = process.argv[2];
if (!targetPath) {
  console.log("Usage: "+__filename+" <target_file.target>");
  process.exit(-1);
}

fs.accessSync(targetPath, fs.F_OK);

app.init(targetPath);
