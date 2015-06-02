var noop = function() {},
  adapters = [],
  extend = require('extend'),
  objectID = require('mongodb').ObjectID,
  BaseAdapter = require('./base_adapter');

MemoryAdapter = BaseAdapter.progeny('MemoryAdapter', {
  init: function() {
    this._data = [];
  }, create: function(options, callback) {
    options._id || (options._id = objectID());
    this._data.push(options);

    adapters.push(this);

    callback(options);
  }, update: function(options, updates, callback) {
    var count = 0;

    this.where(options, function(items) {
      count = items.length;

      items.forEach(function(item) {
        extend(item, updates);
      });

      callback(count || null);
    });
  }, count: function(callback) {
    callback(this._data.length);
  }, first: function(callback) {
    callback(this._data[0] || null);
  }, last: function(callback) {
    callback(this._data[this._data.length-1] || null);
  }, where: function(options, callback) {
    if(!options) { // TODO test this at the adapter level
      callback && callback(null);
      return;
    }

    var keys = Object.keys(options);

    if(!keys.length) {
      callback(this.all());
    }

    callback(this._data.filter(function(model) {
      var matches = true;

      keys.forEach(function(k) {
        if(model[k] !== options[k])
          matches = false;
      });

      return matches;
    }));
  }, all: function() {
    return this._data.slice();
  },
  remove: function(options, callback) {
    this._data = this._data.filter(function(model) {
      return model._id !== options._id;
    });

    callback(true);
  }, clear: function(callback) {
    this._data = [];

    callback(true);
  }
}, {
  classMethods: {
    clear: function() {
      adapters.forEach(function(adapter) {
        adapter.clear(noop);
      });
    }
  }
});

exports = module.exports = MemoryAdapter;