require('./helpers/spec_helper');

(function() {
  var MemoryAdapter = require('../lib/memory_adapter');

  global.itBehavesLikeAnAdapter(MemoryAdapter, function() {
    /* Add extra adapter specific items here */
  });
})();
