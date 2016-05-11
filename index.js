
var fs = require('fs');
var xml2js = require('xml2js');

var nexus = {
  url: '',
  user: 'admin',
  pass: 'admin123'
};

//console.log("Using target file:", targetPath);

function run(targetPath) {
  var cred = nexus.user+':'+nexus.pass;
  var stream = fs.createWriteStream("postToNexus.sh");
  stream.once('open', function(fd) {
    function out(args) {
      stream.write(args + "\n");
    }

    out('#!/bin/sh');
    out('url=' + nexus.urlForScript + '/service/local');
    out('echo Nexus url: $url');

    var mirrors = [];
    
    fs.readFile(targetPath, function(err, data) {
      if (err) {
        console.log("Cannot parse xml:", err);
        process.exit(-1);
      }
      var parser = new xml2js.Parser();
      parser.parseString(data, function (err, result) {
        //console.log(JSON.stringify(result, null,  2));
        //console.log(JSON.stringify(result.locations, null,  2));
        var repoIds = ["rcptt-releases"];
        postProxiesFromEclipseRepo(mirrors, out, cred, repoIds);
        postProxiesFromTarget(result, mirrors, out, cred);

        out('echo "Nexus Repositories:"');
        out('curl $url/repositories | grep name');

        stream.end();

        fs.chmodSync('./postToNexus.sh', 0700);

        console.log('Created postToNexus.sh');

        createSettings(mirrors);
        //console.dir(result.target.locations);
      });
    });

  });
}

function postProxiesFromEclipseRepo(mirrors, out, cred, repoIds) {
  for (var i = 0; i < repoIds.length; i++) {

    var request = require('request');
    request('https://repo.eclipse.org/service/local/repositories/'+repoIds[i], function (error, response, body) {
      if (!error && response.statusCode == 200) {
        console.log(body);
      }
      else {
        console.log("Cannot mirror: " + repoIds[i], response.statusCode);
        process.exit(-1);
      }
    })
  }
}

function postProxiesFromTarget(result, mirrors, out, cred) {
  result.target.locations[0].location.forEach(function(location) {
  var repo = location.repository[0].$;

  var repoId = repo.id || rmTrailingSlash(repo.location);
  var repoLocation = addTrailingSlash(repo.location);

  out('echo "Posting new repo: '+ repoId + ', ' + repoLocation +'"');
  var newRepo = {
    "data": {
      "repoType": "proxy",
      "id": repoId,
      "name": repoId,
      "browseable": true,
      "indexable": false,
      "notFoundCacheTTL": 1440,
      "artifactMaxAge": -1,
      "metadataMaxAge": 1440,
      "itemMaxAge": 1440,
      "repoPolicy": "MIXED",
      "provider": "p2",
      "providerRole": "org.sonatype.nexus.proxy.repository.Repository",
      "downloadRemoteIndexes": false,
      "autoBlockActive": true,
      "fileTypeValidation": true,
      "exposed": true,
      "checksumPolicy": "WARN",
      "remoteStorage": {
        "remoteStorageUrl": repoLocation,
        "authentication": null,
        "connectionSettings": null
      }
    }
  };
  out('curl -X POST -u '+cred+' -H "Content-Type: application/json" -d \''+JSON.stringify(newRepo)+'\' $url/repositories');

  function validMirrorId(repoId) {
    var cleanString = repoId.replace(/[@\|\%&\$<\(\)>\+\,/\:\?\*\\]/g, "");
    return cleanString;
  }

  mirrors.push({
    //mirror: {
      id: validMirrorId(repoId) + '.mirror',
      name: repoId + ' Mirror',
      // tycho uses url as id for .target files: https://wiki.eclipse.org/Tycho/Target_Platform/Authentication_and_Mirrors
      mirrorOf: repoId,
      url: nexus.urlForMaven + '/content/repositories/'+ repoId + '/',
      layout: 'p2',
      mirrorOfLayouts: 'p2'
    //}
  });
});
}

function createSettings(mirrors) {
  mirrors.unshift({
    //mirror: {
      id: 'internal-repository',
      name: 'Maven Repository Manager running on Nexus',
      url: nexus.urlForMaven + '/content/groups/public/',
      mirrorOf: '*'
    //}
  });
  var builder = new xml2js.Builder();
  var settingsXml = builder.buildObject({
    settings: {
      interactiveMode: false,
      offline: false,
      mirrors: {mirror: mirrors},
      profiles: [
        {
          profile: {
            id: 'nexus',
            repositories: [
              {
                repository: {
                  id: 'central',
                  url: 'http://central',
                  releases: {enabled: true},
                  snapshots: {enabled: false}
                }
              }
            ],
            pluginRepositories: [
              {
                pluginRepository: {
                  id: 'central',
                  url: 'http://central',
                  releases: {enabled: true},
                  snapshots: {enabled: false}
                }
              }
            ]
          }
        }
      ],
      activeProfiles: {
        activeProfile: 'nexus'
      }
    }
  });

  fs.writeFile('settings-nexus.xml', settingsXml, function (err) {
      if (err)
          return console.log(err);
      console.log('Created settings-nexus.xml');
  });
}

function rmTrailingSlash(site) {
  return site.replace(/\/+$/, "");
}

function addTrailingSlash(site) {
  return site.replace(/\/?$/, '/');
}

exports.init = function(targetPath, nexus_url, useInMaven, useInNexus) {
  nexus.url = nexus_url;
  nexus.urlForMaven = (useInMaven) ? nexus_url : '${nexus.url}';
  nexus.urlForScript = (useInNexus) ? nexus_url : "$1" ;
  run(targetPath);
};
