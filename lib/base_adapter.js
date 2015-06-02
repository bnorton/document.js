require('progenitor.js')();

var noop = function(c) { c && c(); };

BaseAdapter = Object.progeny('BaseAdapter', {
  init: function(modelClass) {
    this.modelClass = modelClass;
  }
}, {
  classMethods: {
    connect: noop,
    clear: noop,
    disconnect: noop
  }
});

exports = module.exports = BaseAdapter;
