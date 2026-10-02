const dns = require("dns").promises;

dns.resolveSrv("_mongodb._tcp.commoncluster.vfruw.mongodb.net")
  .then(() => process.exit(0))
  .catch(() => process.exit(1));