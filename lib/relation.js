RelationError = Error.progeny('RelationError', { init: function(m) { this.name = this.className; this.message = m; } });

var extend = require('extend'),
  noop = function() {};

Relation = Object.progeny('Relation', {
  init: function(modelClass, model) {
    this.modelClass = modelClass;

    model ? (this.model = model) : (this._query = {});

    this.loaded = false;
    this.items = null;
    this.size = null;
    this.RSVP = { success: noop, error: noop, wasKept: false };
  },
  kept: function(value) {
    this.loaded = true;
    this.RSVP.wasKept = value;
    this.items = this.size = null;

    if(Array.isArray(value)) {
      this.items = value;
    } else if(isNumber(value)) {
      this.size = value;
    }

    makeRSVPCallback.call(this);
  },
  then: function(success, error) {
    this.RSVP.success = success || noop;
    this.RSVP.error = error || noop;

    makeRSVPCallback.call(this);
  },
  query: function() {
    return this._query ? extend({}, this._query) : null;
  },
  count: function() { var that = this;
    var count = new Document.Count(this);

    this.modelClass.adapter().count(function(result) {
      that.loaded = true;
      count.kept(result);
    });

    return count;
  },
  find: function(options) { var that = this;
    this.loaded = false;

    if(this.model) {
      this.modelClass.adapter().where({_id: this.model.id}, function(value) {
        that.loaded = true;

        value = Array.isArray(value) ? that.model.class.shortToLong(value[0]) : value;

        that.model.kept(value);
      });

      return this.model;
    } else {
      var Model = this.modelClass;
      options = Model.longToShort(options);

      this.modelClass.adapter().where(options, function(value) {
        if(Array.isArray(value)) {
          value = value.map(function(options) {
            var model = new Model({_id: null});
            model.kept(Model.shortToLong(options));

            return model;
          });
        }

        that.kept(value);
      });

      return this;
    }
  },
  asJSON: function() {
    if(this.items) {
      return this.items.map(function(model) {
        return model.asJSON();
      });
    } else if (isNumber(this.size)) {
      return this.size;
    }

    return null;
  },
  create: function(options) { var that = this;
    this.loaded = false;

    if(!this.model) throw new RelationError('Non-model creates are not supported.');

    options = extend(options, { createdAt: new Date(), updatedAt: new Date() });
    options = this.modelClass.longToShort(options);

    this.modelClass.adapter().create(options, function(value) {
      that.loaded = true;

      value = that.model.class.shortToLong(value);

      that.model.kept(value);
    });

    return this.model;
  },
  update: function(options) { var that = this;
    this.loaded = false;

    options = extend(options, { updatedAt: new Date() });
    options = this.modelClass.longToShort(options);

    if(this.model) {
      this.modelClass.adapter().update({_id: this.model.id}, options, function(value) {
        that.loaded = true;
        that.model.kept(value);
      });

      return this.model;
    } else {
      // TODO query should translate fields when the value of _query can change
      this.modelClass.adapter().update(this._query, options, function(value) {
        that.kept(value);
      });

      return this;
    }
  }
});

function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function makeRSVPCallback() {
  if(this.loaded) {
    if(!this.RSVP.wasKept) this.RSVP.error.call(this);
    else this.RSVP.success.call(this, this.RSVP.wasKept);
  }
}

module.exports = Relation;
