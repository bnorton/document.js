require('./helpers/spec_helper');

(function() {
  var MongoAdapter = require('../lib/mongo_adapter');

  global.itBehavesLikeAnAdapter(MongoAdapter, function() {
    /* Add extra adapter specific items here */
  });
})();
