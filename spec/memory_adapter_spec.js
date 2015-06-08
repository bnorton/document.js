require('./helpers/spec_helper');

(function() {
  var MemoryAdapter = require('../lib/memory_adapter'),
    options = { ids: { valid: '5466-5a17b124f', invalid: null, converted: '5466-5a17b124f' } };

  global.itBehavesLikeAnAdapter(MemoryAdapter, options, function() {
    /* Add extra adapter specific items here */
  });
})();
