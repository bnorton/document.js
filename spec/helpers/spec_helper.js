(function(once) { if(once) return function() {};
  global.itBehavesLikeAnAdapter = require('./adapter_helper');
  global._specHelper = true;

  beforeEach(function() {
  });

  afterEach(function() {
    Document.Adapter.clear();
  });

  module.exports = global._specHelper
})(global._specHelper);
