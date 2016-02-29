var express = require('express');
var router = express.Router();
var dns = require('dns');
var async = require("async");

var dispatch = require("dispatch-client");
var webhookService = require("webhook-service");

var WEBHOOK_REMOTE = "http://localhost:8000/webhook/googledns/";

// Set our network DNS lookup to be google's DNS
dns.setServers(["8.8.8.8", "8.8.4.4"])

// Register ourselves with the dispatch server to find and share URIs for services
var dispatcher = new dispatch.Client("http://localhost:20000");
dispatcher.register("service-googledns", ["dns"]);

// Setup the new webhook service responder
var webhookedService = new webhookService.Service(WEBHOOK_REMOTE);
webhookedService.useRouter(router);
webhookedService.callResolver(resolveData);
webhookedService.start();


function resolveData(queuedItem, next) {
    console.log("Resolving [%s]\n\t%s", queuedItem.uuid, queuedItem.fqdn);
    
    var rrtypes = ["A", "AAAA", "MX", "TXT", "SRV", "NS", "CNAME", "SOA"];
    var hostname = queuedItem.fqdn;
    var records = {};
    
    async.each(
        rrtypes,
        
        // iterator function
        function (rrtype, callback) {
            console.log("Looking up %s records for [%s]", rrtype, hostname);
            
            // do a DNS resolve of this record type
            dns.resolve(hostname, rrtype, function (err, addresses) {
                console.log("\t%s\n\t%s", rrtype, JSON.stringify(addresses));
                records[rrtype] = addresses;
                
                callback();
            })
        },
        
        // complete
        function (err) {
            console.log("Address resolution complete");
            webhookedService.saveResolved(queuedItem.uuid, records);
            
            webhookedService.tickleWebhook(queuedItem.uuid, next);
        }
    );
}

module.exports = router;
