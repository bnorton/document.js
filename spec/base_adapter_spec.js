require('./helpers/spec_helper');

var BaseAdapter = require('../lib/base_adapter');

describe(BaseAdapter.className, function() {
  it('exists', function() {
    expect(BaseAdapter).not.toBeUndefined();
  });
});
