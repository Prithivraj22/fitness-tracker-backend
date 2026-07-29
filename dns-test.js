const dns = require("dns").promises;

dns.resolveSrv("_mongodb._tcp.commoncluster.vfruw.mongodb.net")
  .then(console.log)
  .catch(console.error);