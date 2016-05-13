
var fs = require('fs');
var xml2js = require('xml2js');
var Promise = require('bluebird');

var nexus = {
  url: '',
  user: 'admin',
  pass: 'admin123'
};

//console.log("Using target file:", targetPath);

function run(targetPath, repoIds) {
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
        postProxiesFromEclipseRepo(mirrors, out, cred, repoIds)
        .then(function() {
          postProxiesFromTarget(result, mirrors, out, cred);

          out('echo "Nexus Repositories:"');
          out("curl --silent $url/repositories | grep -E '<id>|contentResourceURI'");

          stream.end();

          fs.chmodSync('./postToNexus.sh', 0700);

          console.log('Created postToNexus.sh');

          createSettings(mirrors);
        });
      });
    });
  });
}

function postProxiesFromEclipseRepo(mirrors, out, cred, repoIds) {
  var request = require('request-promise');
  return Promise.each(Object.keys(repoIds), function(i) {
    var opts = {
      url: 'https://repo.eclipse.org/service/local/repositories/'+repoIds[i].trim(), 
      headers: {
        "Accept": "application/json"
      },
      json: true
    };
    //console.log(opts.url);

    return request(opts).then(function (data) {
      //console.log(data);

      var repo = data.data;
      var repoId = repo.id;
      var repoLocation = repo.contentResourceURI;
      var mirrorId = validMirrorId(repoId);

      out('echo "Posting new repo: '+ mirrorId + ', ' + repoLocation +'"');
      var newRepo = {
        "data": {
          "repoType": "proxy",
          "id": mirrorId,
          "name": repo.name,
          "browseable": true,
          "indexable": false,
          "notFoundCacheTTL": 10080,
          "artifactMaxAge": -1,
          "metadataMaxAge": 10080,
          "itemMaxAge": 10080,
          "repoPolicy": repo.repoPolicy,
          "provider": repo.provider,
          "format": repo.format,
          "providerRole": repo.providerRole,
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
      out('curl --silent -X POST -u '+cred+' -H "Content-Type: application/json" -d \''+JSON.stringify(newRepo)+'\' $url/repositories');

      mirrors.push({
        //mirror: {
          id: mirrorId + '.mirror',
          name: mirrorId + ' Mirror',
          // tycho uses url as id for .target files: https://wiki.eclipse.org/Tycho/Target_Platform/Authentication_and_Mirrors
          mirrorOf: repoLocation,
          url: nexus.urlForMaven + '/content/repositories/'+ mirrorId + '/'
        //}
      });
    });
  });
}

function postProxiesFromTarget(result, mirrors, out, cred) {
  result.target.locations[0].location.forEach(function(location) {
    var repo = location.repository[0].$;

    var repoId = repo.id || rmTrailingSlash(repo.location);
    var repoLocation = addTrailingSlash(repo.location);
    var mirrorId = validMirrorId(repoId);

    out('echo "Posting new repo: '+ mirrorId + ', ' + repoLocation +'"');
    var newRepo = {
      "data": {
        "repoType": "proxy",
        "id": mirrorId,
        "name": mirrorId,
        "browseable": true,
        "indexable": false,
        "notFoundCacheTTL": 10080,
        "artifactMaxAge": -1,
        "metadataMaxAge": 10080,
        "itemMaxAge": 10080,
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
    out('curl --silent -X POST -u '+cred+' -H "Content-Type: application/json" -d \''+JSON.stringify(newRepo)+'\' $url/repositories');

    mirrors.push({
      //mirror: {
        id: mirrorId + '.mirror',
        name: mirrorId + ' Mirror',
        // tycho uses url as id for .target files: https://wiki.eclipse.org/Tycho/Target_Platform/Authentication_and_Mirrors
        mirrorOf: repoId,
        url: nexus.urlForMaven + '/content/repositories/'+ mirrorId + '/',
        layout: 'p2',
        mirrorOfLayouts: 'p2'
      //}
    });
  });
}

function validMirrorId(repoId) {
  //var cleanString = repoId.replace(/[@\|\%&\$<\(\)>\+\,/\:\?\*\\]/g, "");
  var cleanString =  repoId.replace(/[@\|\%&\$<\(\)>\+\,/\:\?\*\\]/g, "");
  if (repoId.indexOf('http') != -1) {
    var url = require('url').parse(repoId);
    cleanString = url.hostname + '_' + url.pathname.substr(1)
      .replace('nexus', '')
      .replace('content', '')
      .replace('updates', '')
      .replace('update', '')
      .replace(/[@\|\%&\$<\(\)>\+\,/\:\?\*\\]/g, "-");
  }
  return cleanString;
}

function createSettings(mirrors) {
  mirrors.unshift({
    //mirror: {
      id: 'internal-repository',
      name: 'Maven Repository Manager running on Nexus',
      url: nexus.urlForMaven + '/content/groups/public/',
      mirrorOf: 'central'
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

exports.init = function(targetPath, nexus_url, useInMaven, useInNexus, eclipseRepoIds) {
  nexus.url = nexus_url;
  nexus.urlForMaven = (useInMaven) ? nexus_url : '${nexus.url}';
  nexus.urlForScript = (useInNexus) ? nexus_url : "$1" ;
  run(targetPath, eclipseRepoIds);
};
