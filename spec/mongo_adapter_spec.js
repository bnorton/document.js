require('./helpers/spec_helper');

(function() {
  var MongoAdapter = require('../lib/mongo_adapter'),
    objectID = require('mongodb').ObjectID,
    options = { ids: { valid: '553a4177626e6ffa49540000', invalid: '5466-5a17b124f', converted: objectID('553a4177626e6ffa49540000') } };

  global.itBehavesLikeAnAdapter(MongoAdapter, options, function(scope) {
    /* Add extra adapter specific items here */

    it('should have the channels collection', function() {
      expect(scope.adapter.collection().collectionName).toBe('channels');
    });
  });
})();
