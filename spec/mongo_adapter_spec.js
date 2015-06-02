require('./helpers/spec_helper');

(function() {
  var MongoAdapter = require('../lib/mongo_adapter');

  global.itBehavesLikeAnAdapter(MongoAdapter, function(scope) {
    /* Add extra adapter specific items here */

    it('should have the channels collection', function() {
      expect(scope.adapter.collection().collectionName).toBe('channels');
    });
  });
})();
