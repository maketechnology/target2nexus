
var fs = require('fs');
var xml2js = require('xml2js');

var nexus = {
  url: 'http://172.17.0.2:8081/nexus',
  user: 'admin',
  pass: 'admin123'
};

//console.log("Using target file:", targetPath);

function run(targetPath) {
  fs.readFile(targetPath, function(err, data) {
    if (err) {
      console.log("Cannot parse xml:", err);
      process.exit(-1);
    }
    var url = nexus.url + '/service/local';
    var cred = nexus.user+':'+nexus.pass;

    var parser = new xml2js.Parser();
    parser.parseString(data, function (err, result) {
      //console.log(JSON.stringify(result, null,  2));
      //console.log(JSON.stringify(result.locations, null,  2));
      var stream = fs.createWriteStream("postToNexus.sh");
      stream.once('open', function(fd) {
        function out(args) {
          stream.write(args + "\n");
        }

        out('#!/bin/sh');

        var mirrors = [];

        result.target.locations[0].location.forEach(function(location) {
          var repo = location.repository[0].$;

          var repoId = repo.id || rmTraillingSlash(repo.location);

          out('echo "Posting new repo: '+ repoId + ', ' + repo.location +'"');
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
                "remoteStorageUrl": repo.location,
                "authentication": null,
                "connectionSettings": null
              }
            }
          };
          out('curl -X POST -u '+cred+' -H "Content-Type: application/json" -d \''+JSON.stringify(newRepo)+'\' '+url+'/repositories');

          mirrors.push({
            //mirror: {
              id: repoId + '.mirror',
              name: repoId + ' Mirror',
              // tycho uses url as id for .target files: https://wiki.eclipse.org/Tycho/Target_Platform/Authentication_and_Mirrors
              mirrorOf: repoId,
              url: '${nexus.url}' + '/content/repositories/'+ repoId,
              layout: 'p2',
              mirrorOfLayouts: 'p2'
            //}
          });
        });

        out('echo "Nexus Repositories:"');
        out('curl '+url+'/repositories | grep name');

        stream.end();

        fs.chmodSync('./postToNexus.sh', 0700);

        console.log('Created postToNexus.sh');

        createSettings(mirrors);
      });
      //console.dir(result.target.locations);
    });
  });
}

function createSettings(mirrors) {
  mirrors.unshift({
    //mirror: {
      id: 'internal-repository',
      name: 'Maven Repository Manager running on Nexus',
      url: '${nexus.url}' + '/content/groups/public/',
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

function rmTraillingSlash(site) {
  return site.replace(/\/+$/, "");
}

exports.init = function(targetPath) {
  run(targetPath);
};
