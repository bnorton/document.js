require('progenitor.js')();

var noop = function() {};

Count = Object.progeny('Count', {
  init: function(relation) {
    this.relation = relation;
    this.count = null;
    this.loaded = false;
    this.RSVP = { success: noop, error: noop };
  },
  kept: function(number) {
    this.count = isNumber(number) ? number : null;
    this.loaded = true;

    makeRSVPCallback.call(this);
  },
  then: function(success, error) {
    this.RSVP.success = success || noop;
    this.RSVP.error = error || noop;

    makeRSVPCallback.call(this);
  }
});

function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function makeRSVPCallback() {
  if(this.loaded) {
    if(this.count === null) this.RSVP.error.call(this);
    else this.RSVP.success.call(this, this.count);
  }
}

exports = module.exports = Count;
