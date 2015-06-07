require('progenitor.js')();

var noop = function(c) { c && c(); };

Adapter = Object.progeny('Adapter', {
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

exports = module.exports = Adapter;
