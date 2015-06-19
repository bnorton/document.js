/*!
 * document.js (c) 2015 Brian Norton
 * This library may be freely distributed under the MIT license.
 */
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.model = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

},{"progenitor.js":20}],2:[function(require,module,exports){
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

},{"progenitor.js":20}],3:[function(require,module,exports){
require('progenitor.js')();

var extend = require('extend'),
  inflect = require('i')(),
  adapterCache = { },
  noop = function() { };

Document = Object.progeny('Document', {
  init: function(options, relation) {
    this._data = {};
    this._changes = {};

    assignOptions.call(this, options);

    this.relation = relation;
    this.RSVP = { success: noop, error: noop };
    this.loaded = false;
  },
  isValid: function() {
    var i, name, valid = true,
      validate = this.class.validate || {},
      presence = validate.presence || [],
      format = validate.format || {},
      formatNames = Object.keys(format),
      custom = validate.custom || [];

    for(i=0; i<presence.length; ++i) {
      if(! this.get(presence[i])) {
        valid = false; break;
      }
    }

    if(!valid) return false;

    for(i=0; i<formatNames.length; ++i) {
      name = formatNames[i];

      if(!format[name].test(this.get(name))) {
        valid = false; break;
      }
    }

    for(i=0; i<custom.length; ++i) {
      if(!custom[i].call(this)) {
        valid = false; break;
      }
    }

    return valid;
  },
  get: function(name) {
    if(name == 'id') return this.id;

    if(this.class.belongsTo.indexOf(name) >= 0) {
      var id = this.get(inflect.foreign_key(name));

      return id && Document[inflect.classify(name)].find(id);
    } else if(this.class.namedFields[name]) {
      return this._data[name] || null;
    }
  },
  set: function() { var name, from, to, options = arguments[0],
    keyValue = arguments.length == 2, result = {};

    if(!arguments[0]) return;
    if(keyValue) { options = {};
      options[arguments[0]] = arguments[1];
    }

    for(name in options) {
      var belongsTo = this.class.belongsTo.indexOf(name) >= 0;

      if(belongsTo) {
        var key = inflect.foreign_key(name);
        options[key] = options[name].id;
        name = key;
      }

      if(belongsTo || this.class.namedFields[name]) {
        if((from = this.get(name)) != (to = options[name])) {
          this._changes[name] = [from, to];
        }

        if(name === '_id')
          this.id = to;

        this._data[name] = result[name] = to;
      }
    }

    return (keyValue ? result[arguments[0]] : result);
  },
  changedAttributes: function() {
    return extend({}, this._changes);
  },
  save: function() {
    var that = this,
      changedAttrs = {},
      notValid = !this.isValid(),
      noChanges = !Object.keys(this.changedAttributes()).length;

    if(notValid || (noChanges && this.persisted)) {
      this.loaded = true;
      return this;
    }

    this.loaded = false;
    this.relation = new Document.Relation(this.class, this);

    if(this.persisted) {
      Object.keys(this._changes).forEach(function(key) {
        changedAttrs[key] = that.get(key);
      });

      return this.relation.update(changedAttrs);
    } else {
      (this.class.beforeCreate || []).forEach(function(fn) { fn.call(that); });

      return this.relation.create(extend({}, this._data));
    }
  },
  update: function() {
    this.set.apply(this, arguments);

    return this.save();
  },
  destroy: function() { var that = this;
    this.loaded = false;

    this.class.adapter().remove({_id: this.id}, function(value) {
      that.loaded = true;

      that.kept(that.isDestroyed = !!value);
    });

    return this;
  },
  kept: function(options) {
    this.set(options);

    this.loaded = true;

    if(this.RSVP.wasKept = !!options) {
      this._changes = {};
      this.persisted = true;
      this.RSVP.success(this);
    } else {
      this.RSVP.error();
    }
  },
  then: function(success, error) {
    this.RSVP.success = success || noop;
    this.RSVP.error = error || noop;

    if(this.loaded) {
      if(this.RSVP.wasKept) {
        this.RSVP.success(this);
      } else {
        this.RSVP.error();
      }
    }
  },
  asJSON: function() {
    var name, json = {
      id: this.id.toString(),
      createdAt: this.get('createdAt'),
      updatedAt: this.get('updatedAt')
    }, allow = this.class.allow || [];

    for(var i = 0; i < allow.length; ++i) {
      name = allow[i];

      if(/(.+)_id$/.test(name)) { var value = this.get(name);
        value = value ? value.toString() : value;

        json[name.slice(0,-3)] = { id: (json[name] = value)  };
      } else {
        json[name] = this.get(name);
      }
    }

    return json;
  }
}, {
  classMethods: {
    namedFields: null,
    shortFields: null,
    defaultFields: {
      ObjectID: { _id: '_id' },
      Date: { createdAt: 'cT',  updatedAt: 'uT' }
    },
    adapter: function() {
      return adapterCache[this.className] || (adapterCache[this.className] = new Document.Adapter(this));
    },
    inherited: function(base) { var fields;
      this[base.className] = base;

      base.fields || (base.fields = {});
      base.belongsTo || (base.belongsTo = []);

      base.fields.ObjectID = extend({}, this.defaultFields.ObjectID, base.fields.ObjectID);
      base.fields.Date = extend({}, this.defaultFields.Date, base.fields.Date);
      base.namedFields = {}; base.shortFields = {};

      base.belongsTo.forEach(function(name) {
        base.fields.ObjectID[inflect.foreign_key(name)] = name.slice(0,1)+'_id';
      });

      for(var type in base.fields) {
        for(var attr in (fields = base.fields[type])) {
          base.namedFields[attr] = fields[attr];
          base.shortFields[fields[attr]] = attr;
        }
      }
    },
    find: function(id) { var model;
      if(id && (typeof id == 'string' || id._bsontype === 'ObjectID')) {
        this.loaded = false;
        id = Document.Adapter.ids.isValid(id) ? Document.Adapter.ids.next(id) : id;

        var relation = new Document.Relation(this, model = new this({_id: id}));

        return (model.relation = relation).find();
      } else {
        return new Document.Relation(this).find(id);
      }
    },
    count: function() { return new Document.Relation(this).count() },
    first: function() { return adapterDirection.call(this, 'first') },
    last: function() { return adapterDirection.call(this, 'last') },
    shortToLong: function(opts) { return _translateFields.call(this, this.shortFields, opts); },
    longToShort: function(opts) { return _translateFields.call(this, this.namedFields, opts); }
  }
});

function assignOptions(options) {
  var id = options.id || options._id;

  this.persisted = false;

  if(id) {
    if(Document.Adapter.ids.isValid(id)) {
      this.id = Document.Adapter.ids.next(id);
    } else if(id._bsontype === 'ObjectID') {
      this.id = id;
    } else {
      this.id = id.toString();
    }
  } else if(id === null) {
    this.id = null;
  } else {
    this.id = Document.Adapter.ids.next();
  }

  this.set(extend({_id: this.id }, optionsWithout(options, ['id', '_id'])));
  this._changes = {};
}

function adapterDirection(name) { // implements .first and .last
  var model = new this({_id: null});
  this.adapter()[name].call(this.adapter(), function(options) {
    options = model.class.shortToLong(options);

    model.kept(options);
  });

  return model;
}

function optionsWithout(options, items) {
  var other = {};

  for(var o in options) {
    if(items.indexOf(o) == -1) {
      other[o] = options[o];
    }
  }

  return other;
}

function _translateFields(fields, opts) {
  if(!opts || typeof opts !== 'object')
    return opts;

  var options = {};

  Object.keys(opts).forEach(function(key) {
    options[fields[key] || key] = opts[key];
  });

  return options;
}

extend(Document, {
  Relation: require('./relation'),
  Count: require('./count')
});

exports = module.exports = function(options) {
  options = (options || {});
  options.store || (options.store = 'memory');

  if('memory mongo'.split(' ').indexOf(options.store) == -1) {
    throw new Error('Only the `memory` and `mongo` stores are available.');
  }

  require('./memory_adapter'); require('./mongo_adapter');
  Document.Adapter = require('./'+options.store+'_adapter');

  return Document;
};

},{"./count":2,"./memory_adapter":4,"./mongo_adapter":5,"./relation":6,"extend":12,"i":14,"progenitor.js":20}],4:[function(require,module,exports){
var noop = function() {},
  adapters = [],
  extend = require('extend'),
  base62 = require('base-62.js'),
  Adapter = require('./adapter');

MemoryAdapter = Adapter.progeny('MemoryAdapter', {
  init: function() {
    this._data = [];
  }, create: function(options, callback) {
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
        if(Array.isArray(model[k])) {
          if(model[k].indexOf(options[k]) == -1)
            matches = false;
        } else if(model[k] != options[k])
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
    },
    ids: {
      isValid: function(id) { return !!id; },
      next: function(id) { return id || base62.token(); }
    }
  }
});

exports = module.exports = MemoryAdapter;

},{"./adapter":1,"base-62.js":7,"extend":12}],5:[function(require,module,exports){
var config = require('json.mustache.js'),
  inflect = require('i')(),
  objectID = function() { return require('mongodb').ObjectID },
  Adapter = require('./adapter');

MongoAdapter = Adapter.progeny('MongoAdapter', {
  collection: function() {
    if(this._collection) return this._collection;

    var connection = this.class.connection;
    if(!connection) throw new Error('MongoDB not connected');

    return (this._collection = connection.collection(inflect.tableize(this.modelClass.className)));
  },
  create: function(options, callback) {
    this.collection().insertOne(options, function(err, info) {
      callback(err ? null : options);
    });
  },
  update: function(options, updates, callback) {
    var done = function(err, doc) {
      callback(err ? null : doc);
    };

    if(options._id) {
      this.collection().updateOne(options, { $set: updates }, done);
    } else {
      this.collection().updateMany(options, { $set: updates }, done);
    }
  },
  count: function(callback) {
    this.collection().count(function(err, count) {
      callback(err ? null : count);
    });
  },
  first: function(callback) {
    this.collection().find({}).limit(1).sort({_id: 1}).toArray(function(err, docs) {
      callback(err ? null : (docs[0] || null));
    });
  },
  last: function(callback) {
    this.collection().find({}).limit(1).sort({_id: -1}).toArray(function(err, docs) {
      callback(err ? null : (docs[0] || null));
    });
  },
  where: function(options, callback) {
    if(!options) { // TODO test this at the adapter level
      callback && callback(null);
      return;
    }

    this.collection().find(options).toArray(function(err, docs) {
      callback(err ? null : docs);
    });
  },
  remove: function(options, callback) {
    this.collection().deleteMany(options, function(err, info) {
      callback(err ? null : options);
    });
  },
  clear: function(callback) {
    this.collection().remove({}, callback);
  }
}, {
  classMethods: {
    connection: null,
    connect: function(callback) {
      var that = this, url = config('mongo').url;

      require('mongodb').MongoClient.connect(url, function(error, database) {
        if(error) { console.warn('Error connecting to MongoDB error: ', error,  '<---'); throw new Error('DB connect error', error); }

        that.connection = database;
        callback();
      });
    },
    disconnect: function(callback) {
      this.connection.close(); callback();
    },
    ids: {
      isValid: function(id) {
        return objectID().isValid(id);
      }, next: function(id) {
        return objectID()(id);
      }
    }
  }
});

exports = module.exports = MongoAdapter;

},{"./adapter":1,"i":14,"json.mustache.js":19,"mongodb":undefined}],6:[function(require,module,exports){
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

exports = module.exports = Relation;

},{"extend":12}],7:[function(require,module,exports){
(function (global){
/*!
 * base-62.js (c) 2015 Brian Norton
 * This library may be freely distributed under the MIT license.
 */
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.base62 = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* big.js v3.0.2 https://github.com/MikeMcl/big.js/LICENCE */
;(function (global) {
    'use strict';

/*
  big.js v3.0.2
  A small, fast, easy-to-use library for arbitrary-precision decimal arithmetic.
  https://github.com/MikeMcl/big.js/
  Copyright (c) 2014 Michael Mclaughlin <M8ch88l@gmail.com>
  MIT Expat Licence
*/

/***************************** EDITABLE DEFAULTS ******************************/

    // The default values below must be integers within the stated ranges.

    /*
     * The maximum number of decimal places of the results of operations
     * involving division: div and sqrt, and pow with negative exponents.
     */
    var DP = 20,                           // 0 to MAX_DP

        /*
         * The rounding mode used when rounding to the above decimal places.
         *
         * 0 Towards zero (i.e. truncate, no rounding).       (ROUND_DOWN)
         * 1 To nearest neighbour. If equidistant, round up.  (ROUND_HALF_UP)
         * 2 To nearest neighbour. If equidistant, to even.   (ROUND_HALF_EVEN)
         * 3 Away from zero.                                  (ROUND_UP)
         */
        RM = 1,                            // 0, 1, 2 or 3

        // The maximum value of DP and Big.DP.
        MAX_DP = 1E6,                      // 0 to 1000000

        // The maximum magnitude of the exponent argument to the pow method.
        MAX_POWER = 1E6,                   // 1 to 1000000

        /*
         * The exponent value at and beneath which toString returns exponential
         * notation.
         * JavaScript's Number type: -7
         * -1000000 is the minimum recommended exponent value of a Big.
         */
        TO_EXP_NEG = -7,                   // 0 to -1000000

        /*
         * The exponent value at and above which toString returns exponential
         * notation.
         * JavaScript's Number type: 21
         * 1000000 is the maximum recommended exponent value of a Big.
         * (This limit is not enforced or checked.)
         */
        TO_EXP_POS = 21,                   // 0 to 1000000

/******************************************************************************/

        // The shared prototype object.
        P = {},
        isValid = /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i,
        Big;


    /*
     * Create and return a Big constructor.
     *
     */
    function bigFactory() {

        /*
         * The Big constructor and exported function.
         * Create and return a new instance of a Big number object.
         *
         * n {number|string|Big} A numeric value.
         */
        function Big(n) {
            var x = this;

            // Enable constructor usage without new.
            if (!(x instanceof Big)) {
                return n === void 0 ? bigFactory() : new Big(n);
            }

            // Duplicate.
            if (n instanceof Big) {
                x.s = n.s;
                x.e = n.e;
                x.c = n.c.slice();
            } else {
                parse(x, n);
            }

            /*
             * Retain a reference to this Big constructor, and shadow
             * Big.prototype.constructor which points to Object.
             */
            x.constructor = Big;
        }

        Big.prototype = P;
        Big.DP = DP;
        Big.RM = RM;

        return Big;
    }


    // Private functions


    /*
     * Return a string representing the value of Big x in normal or exponential
     * notation to dp fixed decimal places or significant digits.
     *
     * x {Big} The Big to format.
     * dp {number} Integer, 0 to MAX_DP inclusive.
     * toE {number} 1 (toExponential), 2 (toPrecision) or undefined (toFixed).
     */
    function format(x, dp, toE) {
        var Big = x.constructor,

            // The index (normal notation) of the digit that may be rounded up.
            i = dp - (x = new Big(x)).e,
            c = x.c;

        // Round?
        if (c.length > ++dp) {
            rnd(x, i, Big.RM);
        }

        if (!c[0]) {
            ++i;
        } else if (toE) {
            i = dp;

        // toFixed
        } else {
            c = x.c;

            // Recalculate i as x.e may have changed if value rounded up.
            i = x.e + i + 1;
        }

        // Append zeros?
        for (; c.length < i; c.push(0)) {
        }
        i = x.e;

        /*
         * toPrecision returns exponential notation if the number of
         * significant digits specified is less than the number of digits
         * necessary to represent the integer part of the value in normal
         * notation.
         */
        return toE === 1 || toE && (dp <= i || i <= TO_EXP_NEG) ?

          // Exponential notation.
          (x.s < 0 && c[0] ? '-' : '') +
            (c.length > 1 ? c[0] + '.' + c.join('').slice(1) : c[0]) +
              (i < 0 ? 'e' : 'e+') + i

          // Normal notation.
          : x.toString();
    }


    /*
     * Parse the number or string value passed to a Big constructor.
     *
     * x {Big} A Big number instance.
     * n {number|string} A numeric value.
     */
    function parse(x, n) {
        var e, i, nL;

        // Minus zero?
        if (n === 0 && 1 / n < 0) {
            n = '-0';

        // Ensure n is string and check validity.
        } else if (!isValid.test(n += '')) {
            throwErr(NaN);
        }

        // Determine sign.
        x.s = n.charAt(0) == '-' ? (n = n.slice(1), -1) : 1;

        // Decimal point?
        if ((e = n.indexOf('.')) > -1) {
            n = n.replace('.', '');
        }

        // Exponential form?
        if ((i = n.search(/e/i)) > 0) {

            // Determine exponent.
            if (e < 0) {
                e = i;
            }
            e += +n.slice(i + 1);
            n = n.substring(0, i);

        } else if (e < 0) {

            // Integer.
            e = n.length;
        }

        // Determine leading zeros.
        for (i = 0; n.charAt(i) == '0'; i++) {
        }

        if (i == (nL = n.length)) {

            // Zero.
            x.c = [ x.e = 0 ];
        } else {

            // Determine trailing zeros.
            for (; n.charAt(--nL) == '0';) {
            }

            x.e = e - i - 1;
            x.c = [];

            // Convert string to array of digits without leading/trailing zeros.
            for (e = 0; i <= nL; x.c[e++] = +n.charAt(i++)) {
            }
        }

        return x;
    }


    /*
     * Round Big x to a maximum of dp decimal places using rounding mode rm.
     * Called by div, sqrt and round.
     *
     * x {Big} The Big to round.
     * dp {number} Integer, 0 to MAX_DP inclusive.
     * rm {number} 0, 1, 2 or 3 (DOWN, HALF_UP, HALF_EVEN, UP)
     * [more] {boolean} Whether the result of division was truncated.
     */
    function rnd(x, dp, rm, more) {
        var u,
            xc = x.c,
            i = x.e + dp + 1;

        if (rm === 1) {

            // xc[i] is the digit after the digit that may be rounded up.
            more = xc[i] >= 5;
        } else if (rm === 2) {
            more = xc[i] > 5 || xc[i] == 5 &&
              (more || i < 0 || xc[i + 1] !== u || xc[i - 1] & 1);
        } else if (rm === 3) {
            more = more || xc[i] !== u || i < 0;
        } else {
            more = false;

            if (rm !== 0) {
                throwErr('!Big.RM!');
            }
        }

        if (i < 1 || !xc[0]) {

            if (more) {

                // 1, 0.1, 0.01, 0.001, 0.0001 etc.
                x.e = -dp;
                x.c = [1];
            } else {

                // Zero.
                x.c = [x.e = 0];
            }
        } else {

            // Remove any digits after the required decimal places.
            xc.length = i--;

            // Round up?
            if (more) {

                // Rounding up may mean the previous digit has to be rounded up.
                for (; ++xc[i] > 9;) {
                    xc[i] = 0;

                    if (!i--) {
                        ++x.e;
                        xc.unshift(1);
                    }
                }
            }

            // Remove trailing zeros.
            for (i = xc.length; !xc[--i]; xc.pop()) {
            }
        }

        return x;
    }


    /*
     * Throw a BigError.
     *
     * message {string} The error message.
     */
    function throwErr(message) {
        var err = new Error(message);
        err.name = 'BigError';

        throw err;
    }


    // Prototype/instance methods


    /*
     * Return a new Big whose value is the absolute value of this Big.
     */
    P.abs = function () {
        var x = new this.constructor(this);
        x.s = 1;

        return x;
    };


    /*
     * Return
     * 1 if the value of this Big is greater than the value of Big y,
     * -1 if the value of this Big is less than the value of Big y, or
     * 0 if they have the same value.
    */
    P.cmp = function (y) {
        var xNeg,
            x = this,
            xc = x.c,
            yc = (y = new x.constructor(y)).c,
            i = x.s,
            j = y.s,
            k = x.e,
            l = y.e;

        // Either zero?
        if (!xc[0] || !yc[0]) {
            return !xc[0] ? !yc[0] ? 0 : -j : i;
        }

        // Signs differ?
        if (i != j) {
            return i;
        }
        xNeg = i < 0;

        // Compare exponents.
        if (k != l) {
            return k > l ^ xNeg ? 1 : -1;
        }

        i = -1;
        j = (k = xc.length) < (l = yc.length) ? k : l;

        // Compare digit by digit.
        for (; ++i < j;) {

            if (xc[i] != yc[i]) {
                return xc[i] > yc[i] ^ xNeg ? 1 : -1;
            }
        }

        // Compare lengths.
        return k == l ? 0 : k > l ^ xNeg ? 1 : -1;
    };


    /*
     * Return a new Big whose value is the value of this Big divided by the
     * value of Big y, rounded, if necessary, to a maximum of Big.DP decimal
     * places using rounding mode Big.RM.
     */
    P.div = function (y) {
        var x = this,
            Big = x.constructor,
            // dividend
            dvd = x.c,
            //divisor
            dvs = (y = new Big(y)).c,
            s = x.s == y.s ? 1 : -1,
            dp = Big.DP;

        if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
            throwErr('!Big.DP!');
        }

        // Either 0?
        if (!dvd[0] || !dvs[0]) {

            // If both are 0, throw NaN
            if (dvd[0] == dvs[0]) {
                throwErr(NaN);
            }

            // If dvs is 0, throw +-Infinity.
            if (!dvs[0]) {
                throwErr(s / 0);
            }

            // dvd is 0, return +-0.
            return new Big(s * 0);
        }

        var dvsL, dvsT, next, cmp, remI, u,
            dvsZ = dvs.slice(),
            dvdI = dvsL = dvs.length,
            dvdL = dvd.length,
            // remainder
            rem = dvd.slice(0, dvsL),
            remL = rem.length,
            // quotient
            q = y,
            qc = q.c = [],
            qi = 0,
            digits = dp + (q.e = x.e - y.e) + 1;

        q.s = s;
        s = digits < 0 ? 0 : digits;

        // Create version of divisor with leading zero.
        dvsZ.unshift(0);

        // Add zeros to make remainder as long as divisor.
        for (; remL++ < dvsL; rem.push(0)) {
        }

        do {

            // 'next' is how many times the divisor goes into current remainder.
            for (next = 0; next < 10; next++) {

                // Compare divisor and remainder.
                if (dvsL != (remL = rem.length)) {
                    cmp = dvsL > remL ? 1 : -1;
                } else {

                    for (remI = -1, cmp = 0; ++remI < dvsL;) {

                        if (dvs[remI] != rem[remI]) {
                            cmp = dvs[remI] > rem[remI] ? 1 : -1;
                            break;
                        }
                    }
                }

                // If divisor < remainder, subtract divisor from remainder.
                if (cmp < 0) {

                    // Remainder can't be more than 1 digit longer than divisor.
                    // Equalise lengths using divisor with extra leading zero?
                    for (dvsT = remL == dvsL ? dvs : dvsZ; remL;) {

                        if (rem[--remL] < dvsT[remL]) {
                            remI = remL;

                            for (; remI && !rem[--remI]; rem[remI] = 9) {
                            }
                            --rem[remI];
                            rem[remL] += 10;
                        }
                        rem[remL] -= dvsT[remL];
                    }
                    for (; !rem[0]; rem.shift()) {
                    }
                } else {
                    break;
                }
            }

            // Add the 'next' digit to the result array.
            qc[qi++] = cmp ? next : ++next;

            // Update the remainder.
            if (rem[0] && cmp) {
                rem[remL] = dvd[dvdI] || 0;
            } else {
                rem = [ dvd[dvdI] ];
            }

        } while ((dvdI++ < dvdL || rem[0] !== u) && s--);

        // Leading zero? Do not remove if result is simply zero (qi == 1).
        if (!qc[0] && qi != 1) {

            // There can't be more than one zero.
            qc.shift();
            q.e--;
        }

        // Round?
        if (qi > digits) {
            rnd(q, dp, Big.RM, rem[0] !== u);
        }

        return q;
    };


    /*
     * Return true if the value of this Big is equal to the value of Big y,
     * otherwise returns false.
     */
    P.eq = function (y) {
        return !this.cmp(y);
    };


    /*
     * Return true if the value of this Big is greater than the value of Big y,
     * otherwise returns false.
     */
    P.gt = function (y) {
        return this.cmp(y) > 0;
    };


    /*
     * Return true if the value of this Big is greater than or equal to the
     * value of Big y, otherwise returns false.
     */
    P.gte = function (y) {
        return this.cmp(y) > -1;
    };


    /*
     * Return true if the value of this Big is less than the value of Big y,
     * otherwise returns false.
     */
    P.lt = function (y) {
        return this.cmp(y) < 0;
    };


    /*
     * Return true if the value of this Big is less than or equal to the value
     * of Big y, otherwise returns false.
     */
    P.lte = function (y) {
         return this.cmp(y) < 1;
    };


    /*
     * Return a new Big whose value is the value of this Big minus the value
     * of Big y.
     */
    P.sub = P.minus = function (y) {
        var i, j, t, xLTy,
            x = this,
            Big = x.constructor,
            a = x.s,
            b = (y = new Big(y)).s;

        // Signs differ?
        if (a != b) {
            y.s = -b;
            return x.plus(y);
        }

        var xc = x.c.slice(),
            xe = x.e,
            yc = y.c,
            ye = y.e;

        // Either zero?
        if (!xc[0] || !yc[0]) {

            // y is non-zero? x is non-zero? Or both are zero.
            return yc[0] ? (y.s = -b, y) : new Big(xc[0] ? x : 0);
        }

        // Determine which is the bigger number.
        // Prepend zeros to equalise exponents.
        if (a = xe - ye) {

            if (xLTy = a < 0) {
                a = -a;
                t = xc;
            } else {
                ye = xe;
                t = yc;
            }

            t.reverse();
            for (b = a; b--; t.push(0)) {
            }
            t.reverse();
        } else {

            // Exponents equal. Check digit by digit.
            j = ((xLTy = xc.length < yc.length) ? xc : yc).length;

            for (a = b = 0; b < j; b++) {

                if (xc[b] != yc[b]) {
                    xLTy = xc[b] < yc[b];
                    break;
                }
            }
        }

        // x < y? Point xc to the array of the bigger number.
        if (xLTy) {
            t = xc;
            xc = yc;
            yc = t;
            y.s = -y.s;
        }

        /*
         * Append zeros to xc if shorter. No need to add zeros to yc if shorter
         * as subtraction only needs to start at yc.length.
         */
        if (( b = (j = yc.length) - (i = xc.length) ) > 0) {

            for (; b--; xc[i++] = 0) {
            }
        }

        // Subtract yc from xc.
        for (b = i; j > a;){

            if (xc[--j] < yc[j]) {

                for (i = j; i && !xc[--i]; xc[i] = 9) {
                }
                --xc[i];
                xc[j] += 10;
            }
            xc[j] -= yc[j];
        }

        // Remove trailing zeros.
        for (; xc[--b] === 0; xc.pop()) {
        }

        // Remove leading zeros and adjust exponent accordingly.
        for (; xc[0] === 0;) {
            xc.shift();
            --ye;
        }

        if (!xc[0]) {

            // n - n = +0
            y.s = 1;

            // Result must be zero.
            xc = [ye = 0];
        }

        y.c = xc;
        y.e = ye;

        return y;
    };


    /*
     * Return a new Big whose value is the value of this Big modulo the
     * value of Big y.
     */
    P.mod = function (y) {
        var yGTx,
            x = this,
            Big = x.constructor,
            a = x.s,
            b = (y = new Big(y)).s;

        if (!y.c[0]) {
            throwErr(NaN);
        }

        x.s = y.s = 1;
        yGTx = y.cmp(x) == 1;
        x.s = a;
        y.s = b;

        if (yGTx) {
            return new Big(x);
        }

        a = Big.DP;
        b = Big.RM;
        Big.DP = Big.RM = 0;
        x = x.div(y);
        Big.DP = a;
        Big.RM = b;

        return this.minus( x.times(y) );
    };


    /*
     * Return a new Big whose value is the value of this Big plus the value
     * of Big y.
     */
    P.add = P.plus = function (y) {
        var t,
            x = this,
            Big = x.constructor,
            a = x.s,
            b = (y = new Big(y)).s;

        // Signs differ?
        if (a != b) {
            y.s = -b;
            return x.minus(y);
        }

        var xe = x.e,
            xc = x.c,
            ye = y.e,
            yc = y.c;

        // Either zero?
        if (!xc[0] || !yc[0]) {

            // y is non-zero? x is non-zero? Or both are zero.
            return yc[0] ? y : new Big(xc[0] ? x : a * 0);
        }
        xc = xc.slice();

        // Prepend zeros to equalise exponents.
        // Note: Faster to use reverse then do unshifts.
        if (a = xe - ye) {

            if (a > 0) {
                ye = xe;
                t = yc;
            } else {
                a = -a;
                t = xc;
            }

            t.reverse();
            for (; a--; t.push(0)) {
            }
            t.reverse();
        }

        // Point xc to the longer array.
        if (xc.length - yc.length < 0) {
            t = yc;
            yc = xc;
            xc = t;
        }
        a = yc.length;

        /*
         * Only start adding at yc.length - 1 as the further digits of xc can be
         * left as they are.
         */
        for (b = 0; a;) {
            b = (xc[--a] = xc[a] + yc[a] + b) / 10 | 0;
            xc[a] %= 10;
        }

        // No need to check for zero, as +x + +y != 0 && -x + -y != 0

        if (b) {
            xc.unshift(b);
            ++ye;
        }

         // Remove trailing zeros.
        for (a = xc.length; xc[--a] === 0; xc.pop()) {
        }

        y.c = xc;
        y.e = ye;

        return y;
    };


    /*
     * Return a Big whose value is the value of this Big raised to the power n.
     * If n is negative, round, if necessary, to a maximum of Big.DP decimal
     * places using rounding mode Big.RM.
     *
     * n {number} Integer, -MAX_POWER to MAX_POWER inclusive.
     */
    P.pow = function (n) {
        var x = this,
            one = new x.constructor(1),
            y = one,
            isNeg = n < 0;

        if (n !== ~~n || n < -MAX_POWER || n > MAX_POWER) {
            throwErr('!pow!');
        }

        n = isNeg ? -n : n;

        for (;;) {

            if (n & 1) {
                y = y.times(x);
            }
            n >>= 1;

            if (!n) {
                break;
            }
            x = x.times(x);
        }

        return isNeg ? one.div(y) : y;
    };


    /*
     * Return a new Big whose value is the value of this Big rounded to a
     * maximum of dp decimal places using rounding mode rm.
     * If dp is not specified, round to 0 decimal places.
     * If rm is not specified, use Big.RM.
     *
     * [dp] {number} Integer, 0 to MAX_DP inclusive.
     * [rm] 0, 1, 2 or 3 (ROUND_DOWN, ROUND_HALF_UP, ROUND_HALF_EVEN, ROUND_UP)
     */
    P.round = function (dp, rm) {
        var x = this,
            Big = x.constructor;

        if (dp == null) {
            dp = 0;
        } else if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
            throwErr('!round!');
        }
        rnd(x = new Big(x), dp, rm == null ? Big.RM : rm);

        return x;
    };


    /*
     * Return a new Big whose value is the square root of the value of this Big,
     * rounded, if necessary, to a maximum of Big.DP decimal places using
     * rounding mode Big.RM.
     */
    P.sqrt = function () {
        var estimate, r, approx,
            x = this,
            Big = x.constructor,
            xc = x.c,
            i = x.s,
            e = x.e,
            half = new Big('0.5');

        // Zero?
        if (!xc[0]) {
            return new Big(x);
        }

        // If negative, throw NaN.
        if (i < 0) {
            throwErr(NaN);
        }

        // Estimate.
        i = Math.sqrt(x.toString());

        // Math.sqrt underflow/overflow?
        // Pass x to Math.sqrt as integer, then adjust the result exponent.
        if (i === 0 || i === 1 / 0) {
            estimate = xc.join('');

            if (!(estimate.length + e & 1)) {
                estimate += '0';
            }

            r = new Big( Math.sqrt(estimate).toString() );
            r.e = ((e + 1) / 2 | 0) - (e < 0 || e & 1);
        } else {
            r = new Big(i.toString());
        }

        i = r.e + (Big.DP += 4);

        // Newton-Raphson iteration.
        do {
            approx = r;
            r = half.times( approx.plus( x.div(approx) ) );
        } while ( approx.c.slice(0, i).join('') !==
                       r.c.slice(0, i).join('') );

        rnd(r, Big.DP -= 4, Big.RM);

        return r;
    };


    /*
     * Return a new Big whose value is the value of this Big times the value of
     * Big y.
     */
    P.mul = P.times = function (y) {
        var c,
            x = this,
            Big = x.constructor,
            xc = x.c,
            yc = (y = new Big(y)).c,
            a = xc.length,
            b = yc.length,
            i = x.e,
            j = y.e;

        // Determine sign of result.
        y.s = x.s == y.s ? 1 : -1;

        // Return signed 0 if either 0.
        if (!xc[0] || !yc[0]) {
            return new Big(y.s * 0);
        }

        // Initialise exponent of result as x.e + y.e.
        y.e = i + j;

        // If array xc has fewer digits than yc, swap xc and yc, and lengths.
        if (a < b) {
            c = xc;
            xc = yc;
            yc = c;
            j = a;
            a = b;
            b = j;
        }

        // Initialise coefficient array of result with zeros.
        for (c = new Array(j = a + b); j--; c[j] = 0) {
        }

        // Multiply.

        // i is initially xc.length.
        for (i = b; i--;) {
            b = 0;

            // a is yc.length.
            for (j = a + i; j > i;) {

                // Current sum of products at this digit position, plus carry.
                b = c[j] + yc[i] * xc[j - i - 1] + b;
                c[j--] = b % 10;

                // carry
                b = b / 10 | 0;
            }
            c[j] = (c[j] + b) % 10;
        }

        // Increment result exponent if there is a final carry.
        if (b) {
            ++y.e;
        }

        // Remove any leading zero.
        if (!c[0]) {
            c.shift();
        }

        // Remove trailing zeros.
        for (i = c.length; !c[--i]; c.pop()) {
        }
        y.c = c;

        return y;
    };


    /*
     * Return a string representing the value of this Big.
     * Return exponential notation if this Big has a positive exponent equal to
     * or greater than TO_EXP_POS, or a negative exponent equal to or less than
     * TO_EXP_NEG.
     */
    P.toString = P.valueOf = P.toJSON = function () {
        var x = this,
            e = x.e,
            str = x.c.join(''),
            strL = str.length;

        // Exponential notation?
        if (e <= TO_EXP_NEG || e >= TO_EXP_POS) {
            str = str.charAt(0) + (strL > 1 ? '.' + str.slice(1) : '') +
              (e < 0 ? 'e' : 'e+') + e;

        // Negative exponent?
        } else if (e < 0) {

            // Prepend zeros.
            for (; ++e; str = '0' + str) {
            }
            str = '0.' + str;

        // Positive exponent?
        } else if (e > 0) {

            if (++e > strL) {

                // Append zeros.
                for (e -= strL; e-- ; str += '0') {
                }
            } else if (e < strL) {
                str = str.slice(0, e) + '.' + str.slice(e);
            }

        // Exponent zero.
        } else if (strL > 1) {
            str = str.charAt(0) + '.' + str.slice(1);
        }

        // Avoid '-0'
        return x.s < 0 && x.c[0] ? '-' + str : str;
    };


    /*
     ***************************************************************************
     * If toExponential, toFixed, toPrecision and format are not required they
     * can safely be commented-out or deleted. No redundant code will be left.
     * format is used only by toExponential, toFixed and toPrecision.
     ***************************************************************************
     */


    /*
     * Return a string representing the value of this Big in exponential
     * notation to dp fixed decimal places and rounded, if necessary, using
     * Big.RM.
     *
     * [dp] {number} Integer, 0 to MAX_DP inclusive.
     */
    P.toExponential = function (dp) {

        if (dp == null) {
            dp = this.c.length - 1;
        } else if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
            throwErr('!toExp!');
        }

        return format(this, dp, 1);
    };


    /*
     * Return a string representing the value of this Big in normal notation
     * to dp fixed decimal places and rounded, if necessary, using Big.RM.
     *
     * [dp] {number} Integer, 0 to MAX_DP inclusive.
     */
    P.toFixed = function (dp) {
        var str,
            x = this,
            neg = TO_EXP_NEG,
            pos = TO_EXP_POS;

        // Prevent the possibility of exponential notation.
        TO_EXP_NEG = -(TO_EXP_POS = 1 / 0);

        if (dp == null) {
            str = x.toString();
        } else if (dp === ~~dp && dp >= 0 && dp <= MAX_DP) {
            str = format(x, x.e + dp);

            // (-0).toFixed() is '0', but (-0.1).toFixed() is '-0'.
            // (-0).toFixed(1) is '0.0', but (-0.01).toFixed(1) is '-0.0'.
            if (x.s < 0 && x.c[0] && str.indexOf('-') < 0) {
        //E.g. -0.5 if rounded to -0 will cause toString to omit the minus sign.
                str = '-' + str;
            }
        }
        TO_EXP_NEG = neg;
        TO_EXP_POS = pos;

        if (!str) {
            throwErr('!toFix!');
        }

        return str;
    };


    /*
     * Return a string representing the value of this Big rounded to sd
     * significant digits using Big.RM. Use exponential notation if sd is less
     * than the number of digits necessary to represent the integer part of the
     * value in normal notation.
     *
     * sd {number} Integer, 1 to MAX_DP inclusive.
     */
    P.toPrecision = function (sd) {

        if (sd == null) {
            return this.toString();
        } else if (sd !== ~~sd || sd < 1 || sd > MAX_DP) {
            throwErr('!toPre!');
        }

        return format(this, sd - 1, 2);
    };


    // Export


    Big = bigFactory();

    //AMD.
    if (typeof define === 'function' && define.amd) {
        define(function () {
            return Big;
        });

    // Node and other CommonJS-like environments that support module.exports.
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = Big;

    //Browser.
    } else {
        global.Big = Big;
    }
})(this);

},{}],2:[function(require,module,exports){
/*!
* @fn randomInt(options)
* @brief generate random integers
* @param options.min the minimum value (default: 0)
* @param options.max the maximum value (default: 4294967295)
* @return an integer between the min/max bounds
*/
randomInt = function(options)
{
	if (options === undefined || options === null)
		options = {}
	if (options.min === undefined || options === null)
		options.min = 0
	if (options.max === undefined || options === null)
		options.max = 4294967295
	if (options.min > options.max) {
		var tmp = options.min
		options.min = options.max
		options.max = tmp
	}

	return Math.floor((Math.random() * (options.max - options.min)) + options.min)
}

/*!
* @fn randomFloat(options)
* @brief generate random floats
* @param options.min the minimum value (default: 0.0)
* @param options.max the maximum value (default: 1.0)
* @return a float between the min/max bounds
*/
randomFloat = function(options)
{
	if (options === undefined || options === null)
		options = {}
	if (options.min === undefined || options === null)
		options.min = 0.0
	if (options.max === undefined || options === null)
		options.max = 1.0

	return (Math.random() * (options.max - options.min)) + options.min
}

/*!
 * @fn randomString(options)
 * @brief generate random strings
 * @param options.length the length of the string to generate (default: 20)
 * @param options.set one of alpha|numeric|alphanum|hex|custom (default: alphanum)
 * @param options.custom if set is custom, provides a set of characters used for the string generation (string or array)
 * @returns a string containing random characters from the selected set of the given length
 * @discussion when generating a string of hexadecimal set, the alpha-characters are uppercase, use .toLowerCase() on the result to switch to lowercase
 */
randomString = function(options)
{
	if (options === undefined || options === null)
		options = {}
	if (options.length === undefined || options.length === null)
		options.length = 20
	if (options.set === undefined || options.set === null)
		options.set = "alphanum"

	var charset
	switch (options.set)
	{
		case "alpha":
			charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
			break

		case "alphanum":
			charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
			break

		case "num":
			charset = "0123456789"
			break

		case "hex":
			charset = "0123456789ABCDEF"
			break

		case "custom":
			if (options.custom === undefined || options.custom === null) {
				console.error("can't generate a random string with custom set of characters if options.custom is null or undefined")
				return ""
			}
			charset = options.custom
			break
	}

	var result = ""
	for (var i = 0; i < options.length; i++) {
		var int = randomInt({min: 0, max: charset.length})
		result += charset[int]
	}
	return result
}

module.exports.randomInt = randomInt
module.exports.randomFloat = randomFloat
module.exports.randomString = randomString

},{}],3:[function(require,module,exports){
var Big = require('big.js'),
  generate = require('random.js').randomInt,
  characterSet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

Base62 = {
  encode: function(integer) { var original = integer;
    integer = integer.toString();

    try {
      Big(integer)
    } catch(e) {
      console.log('Big init error on ', original, integer);
    }

    var bigInt = Big(integer), result = '';
    if (integer == '0') { return '0'; }

    while (bigInt.gt(0)) {
      result = characterSet[bigInt.mod(62).toFixed()] + result;
      bigInt = Big(bigInt.div(62).toFixed(2).split('.')[0]); // Math.floor() aka round down
    }

    return result;
  },
  decode: function(base62String) {
    base62String = base62String.toString();

    var result = Big(0), big62 = Big(62),
      characters = base62String.split('').reverse();

    characters.forEach(function(character, index) {
      result = result.plus(big62.pow(index).times(characterSet.indexOf(character)));
    });

    return result.toFixed();
  },
  encodeHex: function(hexString) {
    return Base62.encode(hexToInt(hexString.toString()))
  },
  decodeHex: function(base62String) {
    return intToHex(Base62.decode(base62String));
  },
  token: function() {
    return random()+random()+random()+random()+random();
  }
};

function random() {
  return Base62.encode(generate());
}

function intToHex(decStr) {
  var hex = convertBase(decStr, 10, 16);
  return hex ? hex : null;
}

function hexToInt(hexStr) {
  return convertBase(hexStr.toString().toLowerCase(), 16, 10);
}

// START These methods are provided thanks to http://www.danvk.org/hex2dec.html
//
function add(x, y, base) {
  var z = [];
  var n = Math.max(x.length, y.length);
  var carry = 0;
  var i = 0;
  while (i < n || carry) {
    var xi = i < x.length ? x[i] : 0;
    var yi = i < y.length ? y[i] : 0;
    var zi = carry + xi + yi;
    z.push(zi % base);
    carry = Math.floor(zi / base);
    i++;
  }
  return z;
}

function multiplyByNumber(num, x, base) {
  if (num < 0) return null;
  if (num == 0) return [];

  var result = [];
  var power = x;
  while (true) {
    if (num & 1) {
      result = add(result, power, base);
    }
    num = num >> 1;
    if (num === 0) break;
    power = add(power, power, base);
  }

  return result;
}

function parseToDigitsArray(str, base) {
  var digits = str.split('');
  var ary = [];
  for (var i = digits.length - 1; i >= 0; i--) {
    var n = parseInt(digits[i], base);
    if (isNaN(n)) return null;
    ary.push(n);
  }
  return ary;
}

function convertBase(str, fromBase, toBase) {
  var digits = parseToDigitsArray(str, fromBase);
  if (digits === null) return null;

  var outArray = [];
  var power = [1];
  for (var i = 0; i < digits.length; i++) {
    if (digits[i]) {
      outArray = add(outArray, multiplyByNumber(digits[i], power, toBase), toBase);
    }
    power = multiplyByNumber(fromBase, power, toBase);
  }

  var out = '';
  for (var i = outArray.length - 1; i >= 0; i--) {
    out += outArray[i].toString(toBase);
  }
  return out;
}
//
// END These methods are provided thanks to http://www.danvk.org/hex2dec.html

exports = module.exports = Base62;

},{"big.js":1,"random.js":2}]},{},[3])(3)
});
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"big.js":8,"random.js":9}],8:[function(require,module,exports){
/* big.js v3.0.2 https://github.com/MikeMcl/big.js/LICENCE */
;(function (global) {
    'use strict';

/*
  big.js v3.0.2
  A small, fast, easy-to-use library for arbitrary-precision decimal arithmetic.
  https://github.com/MikeMcl/big.js/
  Copyright (c) 2014 Michael Mclaughlin <M8ch88l@gmail.com>
  MIT Expat Licence
*/

/***************************** EDITABLE DEFAULTS ******************************/

    // The default values below must be integers within the stated ranges.

    /*
     * The maximum number of decimal places of the results of operations
     * involving division: div and sqrt, and pow with negative exponents.
     */
    var DP = 20,                           // 0 to MAX_DP

        /*
         * The rounding mode used when rounding to the above decimal places.
         *
         * 0 Towards zero (i.e. truncate, no rounding).       (ROUND_DOWN)
         * 1 To nearest neighbour. If equidistant, round up.  (ROUND_HALF_UP)
         * 2 To nearest neighbour. If equidistant, to even.   (ROUND_HALF_EVEN)
         * 3 Away from zero.                                  (ROUND_UP)
         */
        RM = 1,                            // 0, 1, 2 or 3

        // The maximum value of DP and Big.DP.
        MAX_DP = 1E6,                      // 0 to 1000000

        // The maximum magnitude of the exponent argument to the pow method.
        MAX_POWER = 1E6,                   // 1 to 1000000

        /*
         * The exponent value at and beneath which toString returns exponential
         * notation.
         * JavaScript's Number type: -7
         * -1000000 is the minimum recommended exponent value of a Big.
         */
        TO_EXP_NEG = -7,                   // 0 to -1000000

        /*
         * The exponent value at and above which toString returns exponential
         * notation.
         * JavaScript's Number type: 21
         * 1000000 is the maximum recommended exponent value of a Big.
         * (This limit is not enforced or checked.)
         */
        TO_EXP_POS = 21,                   // 0 to 1000000

/******************************************************************************/

        // The shared prototype object.
        P = {},
        isValid = /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i,
        Big;


    /*
     * Create and return a Big constructor.
     *
     */
    function bigFactory() {

        /*
         * The Big constructor and exported function.
         * Create and return a new instance of a Big number object.
         *
         * n {number|string|Big} A numeric value.
         */
        function Big(n) {
            var x = this;

            // Enable constructor usage without new.
            if (!(x instanceof Big)) {
                return n === void 0 ? bigFactory() : new Big(n);
            }

            // Duplicate.
            if (n instanceof Big) {
                x.s = n.s;
                x.e = n.e;
                x.c = n.c.slice();
            } else {
                parse(x, n);
            }

            /*
             * Retain a reference to this Big constructor, and shadow
             * Big.prototype.constructor which points to Object.
             */
            x.constructor = Big;
        }

        Big.prototype = P;
        Big.DP = DP;
        Big.RM = RM;

        return Big;
    }


    // Private functions


    /*
     * Return a string representing the value of Big x in normal or exponential
     * notation to dp fixed decimal places or significant digits.
     *
     * x {Big} The Big to format.
     * dp {number} Integer, 0 to MAX_DP inclusive.
     * toE {number} 1 (toExponential), 2 (toPrecision) or undefined (toFixed).
     */
    function format(x, dp, toE) {
        var Big = x.constructor,

            // The index (normal notation) of the digit that may be rounded up.
            i = dp - (x = new Big(x)).e,
            c = x.c;

        // Round?
        if (c.length > ++dp) {
            rnd(x, i, Big.RM);
        }

        if (!c[0]) {
            ++i;
        } else if (toE) {
            i = dp;

        // toFixed
        } else {
            c = x.c;

            // Recalculate i as x.e may have changed if value rounded up.
            i = x.e + i + 1;
        }

        // Append zeros?
        for (; c.length < i; c.push(0)) {
        }
        i = x.e;

        /*
         * toPrecision returns exponential notation if the number of
         * significant digits specified is less than the number of digits
         * necessary to represent the integer part of the value in normal
         * notation.
         */
        return toE === 1 || toE && (dp <= i || i <= TO_EXP_NEG) ?

          // Exponential notation.
          (x.s < 0 && c[0] ? '-' : '') +
            (c.length > 1 ? c[0] + '.' + c.join('').slice(1) : c[0]) +
              (i < 0 ? 'e' : 'e+') + i

          // Normal notation.
          : x.toString();
    }


    /*
     * Parse the number or string value passed to a Big constructor.
     *
     * x {Big} A Big number instance.
     * n {number|string} A numeric value.
     */
    function parse(x, n) {
        var e, i, nL;

        // Minus zero?
        if (n === 0 && 1 / n < 0) {
            n = '-0';

        // Ensure n is string and check validity.
        } else if (!isValid.test(n += '')) {
            throwErr(NaN);
        }

        // Determine sign.
        x.s = n.charAt(0) == '-' ? (n = n.slice(1), -1) : 1;

        // Decimal point?
        if ((e = n.indexOf('.')) > -1) {
            n = n.replace('.', '');
        }

        // Exponential form?
        if ((i = n.search(/e/i)) > 0) {

            // Determine exponent.
            if (e < 0) {
                e = i;
            }
            e += +n.slice(i + 1);
            n = n.substring(0, i);

        } else if (e < 0) {

            // Integer.
            e = n.length;
        }

        // Determine leading zeros.
        for (i = 0; n.charAt(i) == '0'; i++) {
        }

        if (i == (nL = n.length)) {

            // Zero.
            x.c = [ x.e = 0 ];
        } else {

            // Determine trailing zeros.
            for (; n.charAt(--nL) == '0';) {
            }

            x.e = e - i - 1;
            x.c = [];

            // Convert string to array of digits without leading/trailing zeros.
            for (e = 0; i <= nL; x.c[e++] = +n.charAt(i++)) {
            }
        }

        return x;
    }


    /*
     * Round Big x to a maximum of dp decimal places using rounding mode rm.
     * Called by div, sqrt and round.
     *
     * x {Big} The Big to round.
     * dp {number} Integer, 0 to MAX_DP inclusive.
     * rm {number} 0, 1, 2 or 3 (DOWN, HALF_UP, HALF_EVEN, UP)
     * [more] {boolean} Whether the result of division was truncated.
     */
    function rnd(x, dp, rm, more) {
        var u,
            xc = x.c,
            i = x.e + dp + 1;

        if (rm === 1) {

            // xc[i] is the digit after the digit that may be rounded up.
            more = xc[i] >= 5;
        } else if (rm === 2) {
            more = xc[i] > 5 || xc[i] == 5 &&
              (more || i < 0 || xc[i + 1] !== u || xc[i - 1] & 1);
        } else if (rm === 3) {
            more = more || xc[i] !== u || i < 0;
        } else {
            more = false;

            if (rm !== 0) {
                throwErr('!Big.RM!');
            }
        }

        if (i < 1 || !xc[0]) {

            if (more) {

                // 1, 0.1, 0.01, 0.001, 0.0001 etc.
                x.e = -dp;
                x.c = [1];
            } else {

                // Zero.
                x.c = [x.e = 0];
            }
        } else {

            // Remove any digits after the required decimal places.
            xc.length = i--;

            // Round up?
            if (more) {

                // Rounding up may mean the previous digit has to be rounded up.
                for (; ++xc[i] > 9;) {
                    xc[i] = 0;

                    if (!i--) {
                        ++x.e;
                        xc.unshift(1);
                    }
                }
            }

            // Remove trailing zeros.
            for (i = xc.length; !xc[--i]; xc.pop()) {
            }
        }

        return x;
    }


    /*
     * Throw a BigError.
     *
     * message {string} The error message.
     */
    function throwErr(message) {
        var err = new Error(message);
        err.name = 'BigError';

        throw err;
    }


    // Prototype/instance methods


    /*
     * Return a new Big whose value is the absolute value of this Big.
     */
    P.abs = function () {
        var x = new this.constructor(this);
        x.s = 1;

        return x;
    };


    /*
     * Return
     * 1 if the value of this Big is greater than the value of Big y,
     * -1 if the value of this Big is less than the value of Big y, or
     * 0 if they have the same value.
    */
    P.cmp = function (y) {
        var xNeg,
            x = this,
            xc = x.c,
            yc = (y = new x.constructor(y)).c,
            i = x.s,
            j = y.s,
            k = x.e,
            l = y.e;

        // Either zero?
        if (!xc[0] || !yc[0]) {
            return !xc[0] ? !yc[0] ? 0 : -j : i;
        }

        // Signs differ?
        if (i != j) {
            return i;
        }
        xNeg = i < 0;

        // Compare exponents.
        if (k != l) {
            return k > l ^ xNeg ? 1 : -1;
        }

        i = -1;
        j = (k = xc.length) < (l = yc.length) ? k : l;

        // Compare digit by digit.
        for (; ++i < j;) {

            if (xc[i] != yc[i]) {
                return xc[i] > yc[i] ^ xNeg ? 1 : -1;
            }
        }

        // Compare lengths.
        return k == l ? 0 : k > l ^ xNeg ? 1 : -1;
    };


    /*
     * Return a new Big whose value is the value of this Big divided by the
     * value of Big y, rounded, if necessary, to a maximum of Big.DP decimal
     * places using rounding mode Big.RM.
     */
    P.div = function (y) {
        var x = this,
            Big = x.constructor,
            // dividend
            dvd = x.c,
            //divisor
            dvs = (y = new Big(y)).c,
            s = x.s == y.s ? 1 : -1,
            dp = Big.DP;

        if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
            throwErr('!Big.DP!');
        }

        // Either 0?
        if (!dvd[0] || !dvs[0]) {

            // If both are 0, throw NaN
            if (dvd[0] == dvs[0]) {
                throwErr(NaN);
            }

            // If dvs is 0, throw +-Infinity.
            if (!dvs[0]) {
                throwErr(s / 0);
            }

            // dvd is 0, return +-0.
            return new Big(s * 0);
        }

        var dvsL, dvsT, next, cmp, remI, u,
            dvsZ = dvs.slice(),
            dvdI = dvsL = dvs.length,
            dvdL = dvd.length,
            // remainder
            rem = dvd.slice(0, dvsL),
            remL = rem.length,
            // quotient
            q = y,
            qc = q.c = [],
            qi = 0,
            digits = dp + (q.e = x.e - y.e) + 1;

        q.s = s;
        s = digits < 0 ? 0 : digits;

        // Create version of divisor with leading zero.
        dvsZ.unshift(0);

        // Add zeros to make remainder as long as divisor.
        for (; remL++ < dvsL; rem.push(0)) {
        }

        do {

            // 'next' is how many times the divisor goes into current remainder.
            for (next = 0; next < 10; next++) {

                // Compare divisor and remainder.
                if (dvsL != (remL = rem.length)) {
                    cmp = dvsL > remL ? 1 : -1;
                } else {

                    for (remI = -1, cmp = 0; ++remI < dvsL;) {

                        if (dvs[remI] != rem[remI]) {
                            cmp = dvs[remI] > rem[remI] ? 1 : -1;
                            break;
                        }
                    }
                }

                // If divisor < remainder, subtract divisor from remainder.
                if (cmp < 0) {

                    // Remainder can't be more than 1 digit longer than divisor.
                    // Equalise lengths using divisor with extra leading zero?
                    for (dvsT = remL == dvsL ? dvs : dvsZ; remL;) {

                        if (rem[--remL] < dvsT[remL]) {
                            remI = remL;

                            for (; remI && !rem[--remI]; rem[remI] = 9) {
                            }
                            --rem[remI];
                            rem[remL] += 10;
                        }
                        rem[remL] -= dvsT[remL];
                    }
                    for (; !rem[0]; rem.shift()) {
                    }
                } else {
                    break;
                }
            }

            // Add the 'next' digit to the result array.
            qc[qi++] = cmp ? next : ++next;

            // Update the remainder.
            if (rem[0] && cmp) {
                rem[remL] = dvd[dvdI] || 0;
            } else {
                rem = [ dvd[dvdI] ];
            }

        } while ((dvdI++ < dvdL || rem[0] !== u) && s--);

        // Leading zero? Do not remove if result is simply zero (qi == 1).
        if (!qc[0] && qi != 1) {

            // There can't be more than one zero.
            qc.shift();
            q.e--;
        }

        // Round?
        if (qi > digits) {
            rnd(q, dp, Big.RM, rem[0] !== u);
        }

        return q;
    };


    /*
     * Return true if the value of this Big is equal to the value of Big y,
     * otherwise returns false.
     */
    P.eq = function (y) {
        return !this.cmp(y);
    };


    /*
     * Return true if the value of this Big is greater than the value of Big y,
     * otherwise returns false.
     */
    P.gt = function (y) {
        return this.cmp(y) > 0;
    };


    /*
     * Return true if the value of this Big is greater than or equal to the
     * value of Big y, otherwise returns false.
     */
    P.gte = function (y) {
        return this.cmp(y) > -1;
    };


    /*
     * Return true if the value of this Big is less than the value of Big y,
     * otherwise returns false.
     */
    P.lt = function (y) {
        return this.cmp(y) < 0;
    };


    /*
     * Return true if the value of this Big is less than or equal to the value
     * of Big y, otherwise returns false.
     */
    P.lte = function (y) {
         return this.cmp(y) < 1;
    };


    /*
     * Return a new Big whose value is the value of this Big minus the value
     * of Big y.
     */
    P.sub = P.minus = function (y) {
        var i, j, t, xLTy,
            x = this,
            Big = x.constructor,
            a = x.s,
            b = (y = new Big(y)).s;

        // Signs differ?
        if (a != b) {
            y.s = -b;
            return x.plus(y);
        }

        var xc = x.c.slice(),
            xe = x.e,
            yc = y.c,
            ye = y.e;

        // Either zero?
        if (!xc[0] || !yc[0]) {

            // y is non-zero? x is non-zero? Or both are zero.
            return yc[0] ? (y.s = -b, y) : new Big(xc[0] ? x : 0);
        }

        // Determine which is the bigger number.
        // Prepend zeros to equalise exponents.
        if (a = xe - ye) {

            if (xLTy = a < 0) {
                a = -a;
                t = xc;
            } else {
                ye = xe;
                t = yc;
            }

            t.reverse();
            for (b = a; b--; t.push(0)) {
            }
            t.reverse();
        } else {

            // Exponents equal. Check digit by digit.
            j = ((xLTy = xc.length < yc.length) ? xc : yc).length;

            for (a = b = 0; b < j; b++) {

                if (xc[b] != yc[b]) {
                    xLTy = xc[b] < yc[b];
                    break;
                }
            }
        }

        // x < y? Point xc to the array of the bigger number.
        if (xLTy) {
            t = xc;
            xc = yc;
            yc = t;
            y.s = -y.s;
        }

        /*
         * Append zeros to xc if shorter. No need to add zeros to yc if shorter
         * as subtraction only needs to start at yc.length.
         */
        if (( b = (j = yc.length) - (i = xc.length) ) > 0) {

            for (; b--; xc[i++] = 0) {
            }
        }

        // Subtract yc from xc.
        for (b = i; j > a;){

            if (xc[--j] < yc[j]) {

                for (i = j; i && !xc[--i]; xc[i] = 9) {
                }
                --xc[i];
                xc[j] += 10;
            }
            xc[j] -= yc[j];
        }

        // Remove trailing zeros.
        for (; xc[--b] === 0; xc.pop()) {
        }

        // Remove leading zeros and adjust exponent accordingly.
        for (; xc[0] === 0;) {
            xc.shift();
            --ye;
        }

        if (!xc[0]) {

            // n - n = +0
            y.s = 1;

            // Result must be zero.
            xc = [ye = 0];
        }

        y.c = xc;
        y.e = ye;

        return y;
    };


    /*
     * Return a new Big whose value is the value of this Big modulo the
     * value of Big y.
     */
    P.mod = function (y) {
        var yGTx,
            x = this,
            Big = x.constructor,
            a = x.s,
            b = (y = new Big(y)).s;

        if (!y.c[0]) {
            throwErr(NaN);
        }

        x.s = y.s = 1;
        yGTx = y.cmp(x) == 1;
        x.s = a;
        y.s = b;

        if (yGTx) {
            return new Big(x);
        }

        a = Big.DP;
        b = Big.RM;
        Big.DP = Big.RM = 0;
        x = x.div(y);
        Big.DP = a;
        Big.RM = b;

        return this.minus( x.times(y) );
    };


    /*
     * Return a new Big whose value is the value of this Big plus the value
     * of Big y.
     */
    P.add = P.plus = function (y) {
        var t,
            x = this,
            Big = x.constructor,
            a = x.s,
            b = (y = new Big(y)).s;

        // Signs differ?
        if (a != b) {
            y.s = -b;
            return x.minus(y);
        }

        var xe = x.e,
            xc = x.c,
            ye = y.e,
            yc = y.c;

        // Either zero?
        if (!xc[0] || !yc[0]) {

            // y is non-zero? x is non-zero? Or both are zero.
            return yc[0] ? y : new Big(xc[0] ? x : a * 0);
        }
        xc = xc.slice();

        // Prepend zeros to equalise exponents.
        // Note: Faster to use reverse then do unshifts.
        if (a = xe - ye) {

            if (a > 0) {
                ye = xe;
                t = yc;
            } else {
                a = -a;
                t = xc;
            }

            t.reverse();
            for (; a--; t.push(0)) {
            }
            t.reverse();
        }

        // Point xc to the longer array.
        if (xc.length - yc.length < 0) {
            t = yc;
            yc = xc;
            xc = t;
        }
        a = yc.length;

        /*
         * Only start adding at yc.length - 1 as the further digits of xc can be
         * left as they are.
         */
        for (b = 0; a;) {
            b = (xc[--a] = xc[a] + yc[a] + b) / 10 | 0;
            xc[a] %= 10;
        }

        // No need to check for zero, as +x + +y != 0 && -x + -y != 0

        if (b) {
            xc.unshift(b);
            ++ye;
        }

         // Remove trailing zeros.
        for (a = xc.length; xc[--a] === 0; xc.pop()) {
        }

        y.c = xc;
        y.e = ye;

        return y;
    };


    /*
     * Return a Big whose value is the value of this Big raised to the power n.
     * If n is negative, round, if necessary, to a maximum of Big.DP decimal
     * places using rounding mode Big.RM.
     *
     * n {number} Integer, -MAX_POWER to MAX_POWER inclusive.
     */
    P.pow = function (n) {
        var x = this,
            one = new x.constructor(1),
            y = one,
            isNeg = n < 0;

        if (n !== ~~n || n < -MAX_POWER || n > MAX_POWER) {
            throwErr('!pow!');
        }

        n = isNeg ? -n : n;

        for (;;) {

            if (n & 1) {
                y = y.times(x);
            }
            n >>= 1;

            if (!n) {
                break;
            }
            x = x.times(x);
        }

        return isNeg ? one.div(y) : y;
    };


    /*
     * Return a new Big whose value is the value of this Big rounded to a
     * maximum of dp decimal places using rounding mode rm.
     * If dp is not specified, round to 0 decimal places.
     * If rm is not specified, use Big.RM.
     *
     * [dp] {number} Integer, 0 to MAX_DP inclusive.
     * [rm] 0, 1, 2 or 3 (ROUND_DOWN, ROUND_HALF_UP, ROUND_HALF_EVEN, ROUND_UP)
     */
    P.round = function (dp, rm) {
        var x = this,
            Big = x.constructor;

        if (dp == null) {
            dp = 0;
        } else if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
            throwErr('!round!');
        }
        rnd(x = new Big(x), dp, rm == null ? Big.RM : rm);

        return x;
    };


    /*
     * Return a new Big whose value is the square root of the value of this Big,
     * rounded, if necessary, to a maximum of Big.DP decimal places using
     * rounding mode Big.RM.
     */
    P.sqrt = function () {
        var estimate, r, approx,
            x = this,
            Big = x.constructor,
            xc = x.c,
            i = x.s,
            e = x.e,
            half = new Big('0.5');

        // Zero?
        if (!xc[0]) {
            return new Big(x);
        }

        // If negative, throw NaN.
        if (i < 0) {
            throwErr(NaN);
        }

        // Estimate.
        i = Math.sqrt(x.toString());

        // Math.sqrt underflow/overflow?
        // Pass x to Math.sqrt as integer, then adjust the result exponent.
        if (i === 0 || i === 1 / 0) {
            estimate = xc.join('');

            if (!(estimate.length + e & 1)) {
                estimate += '0';
            }

            r = new Big( Math.sqrt(estimate).toString() );
            r.e = ((e + 1) / 2 | 0) - (e < 0 || e & 1);
        } else {
            r = new Big(i.toString());
        }

        i = r.e + (Big.DP += 4);

        // Newton-Raphson iteration.
        do {
            approx = r;
            r = half.times( approx.plus( x.div(approx) ) );
        } while ( approx.c.slice(0, i).join('') !==
                       r.c.slice(0, i).join('') );

        rnd(r, Big.DP -= 4, Big.RM);

        return r;
    };


    /*
     * Return a new Big whose value is the value of this Big times the value of
     * Big y.
     */
    P.mul = P.times = function (y) {
        var c,
            x = this,
            Big = x.constructor,
            xc = x.c,
            yc = (y = new Big(y)).c,
            a = xc.length,
            b = yc.length,
            i = x.e,
            j = y.e;

        // Determine sign of result.
        y.s = x.s == y.s ? 1 : -1;

        // Return signed 0 if either 0.
        if (!xc[0] || !yc[0]) {
            return new Big(y.s * 0);
        }

        // Initialise exponent of result as x.e + y.e.
        y.e = i + j;

        // If array xc has fewer digits than yc, swap xc and yc, and lengths.
        if (a < b) {
            c = xc;
            xc = yc;
            yc = c;
            j = a;
            a = b;
            b = j;
        }

        // Initialise coefficient array of result with zeros.
        for (c = new Array(j = a + b); j--; c[j] = 0) {
        }

        // Multiply.

        // i is initially xc.length.
        for (i = b; i--;) {
            b = 0;

            // a is yc.length.
            for (j = a + i; j > i;) {

                // Current sum of products at this digit position, plus carry.
                b = c[j] + yc[i] * xc[j - i - 1] + b;
                c[j--] = b % 10;

                // carry
                b = b / 10 | 0;
            }
            c[j] = (c[j] + b) % 10;
        }

        // Increment result exponent if there is a final carry.
        if (b) {
            ++y.e;
        }

        // Remove any leading zero.
        if (!c[0]) {
            c.shift();
        }

        // Remove trailing zeros.
        for (i = c.length; !c[--i]; c.pop()) {
        }
        y.c = c;

        return y;
    };


    /*
     * Return a string representing the value of this Big.
     * Return exponential notation if this Big has a positive exponent equal to
     * or greater than TO_EXP_POS, or a negative exponent equal to or less than
     * TO_EXP_NEG.
     */
    P.toString = P.valueOf = P.toJSON = function () {
        var x = this,
            e = x.e,
            str = x.c.join(''),
            strL = str.length;

        // Exponential notation?
        if (e <= TO_EXP_NEG || e >= TO_EXP_POS) {
            str = str.charAt(0) + (strL > 1 ? '.' + str.slice(1) : '') +
              (e < 0 ? 'e' : 'e+') + e;

        // Negative exponent?
        } else if (e < 0) {

            // Prepend zeros.
            for (; ++e; str = '0' + str) {
            }
            str = '0.' + str;

        // Positive exponent?
        } else if (e > 0) {

            if (++e > strL) {

                // Append zeros.
                for (e -= strL; e-- ; str += '0') {
                }
            } else if (e < strL) {
                str = str.slice(0, e) + '.' + str.slice(e);
            }

        // Exponent zero.
        } else if (strL > 1) {
            str = str.charAt(0) + '.' + str.slice(1);
        }

        // Avoid '-0'
        return x.s < 0 && x.c[0] ? '-' + str : str;
    };


    /*
     ***************************************************************************
     * If toExponential, toFixed, toPrecision and format are not required they
     * can safely be commented-out or deleted. No redundant code will be left.
     * format is used only by toExponential, toFixed and toPrecision.
     ***************************************************************************
     */


    /*
     * Return a string representing the value of this Big in exponential
     * notation to dp fixed decimal places and rounded, if necessary, using
     * Big.RM.
     *
     * [dp] {number} Integer, 0 to MAX_DP inclusive.
     */
    P.toExponential = function (dp) {

        if (dp == null) {
            dp = this.c.length - 1;
        } else if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
            throwErr('!toExp!');
        }

        return format(this, dp, 1);
    };


    /*
     * Return a string representing the value of this Big in normal notation
     * to dp fixed decimal places and rounded, if necessary, using Big.RM.
     *
     * [dp] {number} Integer, 0 to MAX_DP inclusive.
     */
    P.toFixed = function (dp) {
        var str,
            x = this,
            neg = TO_EXP_NEG,
            pos = TO_EXP_POS;

        // Prevent the possibility of exponential notation.
        TO_EXP_NEG = -(TO_EXP_POS = 1 / 0);

        if (dp == null) {
            str = x.toString();
        } else if (dp === ~~dp && dp >= 0 && dp <= MAX_DP) {
            str = format(x, x.e + dp);

            // (-0).toFixed() is '0', but (-0.1).toFixed() is '-0'.
            // (-0).toFixed(1) is '0.0', but (-0.01).toFixed(1) is '-0.0'.
            if (x.s < 0 && x.c[0] && str.indexOf('-') < 0) {
        //E.g. -0.5 if rounded to -0 will cause toString to omit the minus sign.
                str = '-' + str;
            }
        }
        TO_EXP_NEG = neg;
        TO_EXP_POS = pos;

        if (!str) {
            throwErr('!toFix!');
        }

        return str;
    };


    /*
     * Return a string representing the value of this Big rounded to sd
     * significant digits using Big.RM. Use exponential notation if sd is less
     * than the number of digits necessary to represent the integer part of the
     * value in normal notation.
     *
     * sd {number} Integer, 1 to MAX_DP inclusive.
     */
    P.toPrecision = function (sd) {

        if (sd == null) {
            return this.toString();
        } else if (sd !== ~~sd || sd < 1 || sd > MAX_DP) {
            throwErr('!toPre!');
        }

        return format(this, sd - 1, 2);
    };


    // Export


    Big = bigFactory();

    //AMD.
    if (typeof define === 'function' && define.amd) {
        define(function () {
            return Big;
        });

    // Node and other CommonJS-like environments that support module.exports.
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = Big;

    //Browser.
    } else {
        global.Big = Big;
    }
})(this);

},{}],9:[function(require,module,exports){
/*!
* @fn randomInt(options)
* @brief generate random integers
* @param options.min the minimum value (default: 0)
* @param options.max the maximum value (default: 4294967295)
* @return an integer between the min/max bounds
*/
randomInt = function(options)
{
	if (options === undefined || options === null)
		options = {}
	if (options.min === undefined || options === null)
		options.min = 0
	if (options.max === undefined || options === null)
		options.max = 4294967295
	if (options.min > options.max) {
		var tmp = options.min
		options.min = options.max
		options.max = tmp
	}

	return Math.floor((Math.random() * (options.max - options.min)) + options.min)
}

/*!
* @fn randomFloat(options)
* @brief generate random floats
* @param options.min the minimum value (default: 0.0)
* @param options.max the maximum value (default: 1.0)
* @return a float between the min/max bounds
*/
randomFloat = function(options)
{
	if (options === undefined || options === null)
		options = {}
	if (options.min === undefined || options === null)
		options.min = 0.0
	if (options.max === undefined || options === null)
		options.max = 1.0

	return (Math.random() * (options.max - options.min)) + options.min
}

/*!
 * @fn randomString(options)
 * @brief generate random strings
 * @param options.length the length of the string to generate (default: 20)
 * @param options.set one of alpha|numeric|alphanum|hex|custom (default: alphanum)
 * @param options.custom if set is custom, provides a set of characters used for the string generation (string or array)
 * @returns a string containing random characters from the selected set of the given length
 * @discussion when generating a string of hexadecimal set, the alpha-characters are uppercase, use .toLowerCase() on the result to switch to lowercase
 */
randomString = function(options)
{
	if (options === undefined || options === null)
		options = {}
	if (options.length === undefined || options.length === null)
		options.length = 20
	if (options.set === undefined || options.set === null)
		options.set = "alphanum"

	var charset
	switch (options.set)
	{
		case "alpha":
			charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
			break

		case "alphanum":
			charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
			break

		case "num":
			charset = "0123456789"
			break

		case "hex":
			charset = "0123456789ABCDEF"
			break

		case "custom":
			if (options.custom === undefined || options.custom === null) {
				console.error("can't generate a random string with custom set of characters if options.custom is null or undefined")
				return ""
			}
			charset = options.custom
			break
	}

	var result = ""
	for (var i = 0; i < options.length; i++) {
		var int = randomInt({min: 0, max: charset.length})
		result += charset[int]
	}
	return result
}

module.exports.randomInt = randomInt
module.exports.randomFloat = randomFloat
module.exports.randomString = randomString

},{}],10:[function(require,module,exports){

},{}],11:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            currentQueue[queueIndex].run();
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],12:[function(require,module,exports){
var hasOwn = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;
var undefined;

var isArray = function isArray(arr) {
	if (typeof Array.isArray === 'function') {
		return Array.isArray(arr);
	}

	return toStr.call(arr) === '[object Array]';
};

var isPlainObject = function isPlainObject(obj) {
	'use strict';
	if (!obj || toStr.call(obj) !== '[object Object]') {
		return false;
	}

	var has_own_constructor = hasOwn.call(obj, 'constructor');
	var has_is_property_of_method = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !has_own_constructor && !has_is_property_of_method) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) {}

	return key === undefined || hasOwn.call(obj, key);
};

module.exports = function extend() {
	'use strict';
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0],
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if (typeof target === 'boolean') {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
		target = {};
	}

	for (; i < length; ++i) {
		options = arguments[i];
		// Only deal with non-null/undefined values
		if (options != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target === copy) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
					if (copyIsArray) {
						copyIsArray = false;
						clone = src && isArray(src) ? src : [];
					} else {
						clone = src && isPlainObject(src) ? src : {};
					}

					// Never move original objects, clone them
					target[name] = extend(deep, clone, copy);

				// Don't bring in undefined values
				} else if (copy !== undefined) {
					target[name] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};


},{}],13:[function(require,module,exports){
// Default inflections
module.exports = function (inflect) {

  inflect.plural(/$/, 's');
  inflect.plural(/s$/i, 's');
  inflect.plural(/(ax|test)is$/i, '$1es');
  inflect.plural(/(octop|vir)us$/i, '$1i');
  inflect.plural(/(octop|vir)i$/i, '$1i');
  inflect.plural(/(alias|status)$/i, '$1es');
  inflect.plural(/(bu)s$/i, '$1ses');
  inflect.plural(/(buffal|tomat)o$/i, '$1oes');
  inflect.plural(/([ti])um$/i, '$1a');
  inflect.plural(/([ti])a$/i, '$1a');
  inflect.plural(/sis$/i, 'ses');
  inflect.plural(/(?:([^f])fe|([lr])f)$/i, '$1ves');
  inflect.plural(/(hive)$/i, '$1s');
  inflect.plural(/([^aeiouy]|qu)y$/i, '$1ies');
  inflect.plural(/(x|ch|ss|sh)$/i, '$1es');
  inflect.plural(/(matr|vert|ind)(?:ix|ex)$/i, '$1ices');
  inflect.plural(/([m|l])ouse$/i, '$1ice');
  inflect.plural(/([m|l])ice$/i, '$1ice');
  inflect.plural(/^(ox)$/i, '$1en');
  inflect.plural(/^(oxen)$/i, '$1');
  inflect.plural(/(quiz)$/i, '$1zes');


  inflect.singular(/s$/i, '');
  inflect.singular(/(n)ews$/i, '$1ews');
  inflect.singular(/([ti])a$/i, '$1um');
  inflect.singular(/((a)naly|(b)a|(d)iagno|(p)arenthe|(p)rogno|(s)ynop|(t)he)ses$/i, '$1sis');
  inflect.singular(/(^analy)ses$/i, '$1sis');
  inflect.singular(/([^f])ves$/i, '$1fe');
  inflect.singular(/(hive)s$/i, '$1');
  inflect.singular(/(tive)s$/i, '$1');
  inflect.singular(/([lr])ves$/i, '$1f');
  inflect.singular(/([^aeiouy]|qu)ies$/i, '$1y');
  inflect.singular(/(s)eries$/i, '$1eries');
  inflect.singular(/(m)ovies$/i, '$1ovie');
  inflect.singular(/(x|ch|ss|sh)es$/i, '$1');
  inflect.singular(/([m|l])ice$/i, '$1ouse');
  inflect.singular(/(bus)es$/i, '$1');
  inflect.singular(/(o)es$/i, '$1');
  inflect.singular(/(shoe)s$/i, '$1');
  inflect.singular(/(cris|ax|test)es$/i, '$1is');
  inflect.singular(/(octop|vir)i$/i, '$1us');
  inflect.singular(/(alias|status)es$/i, '$1');
  inflect.singular(/^(ox)en/i, '$1');
  inflect.singular(/(vert|ind)ices$/i, '$1ex');
  inflect.singular(/(matr)ices$/i, '$1ix');
  inflect.singular(/(quiz)zes$/i, '$1');
  inflect.singular(/(database)s$/i, '$1');

  inflect.irregular('child', 'children');
  inflect.irregular('person', 'people');
  inflect.irregular('man', 'men');
  inflect.irregular('child', 'children');
  inflect.irregular('sex', 'sexes');
  inflect.irregular('move', 'moves');
  inflect.irregular('cow', 'kine');
  inflect.irregular('zombie', 'zombies');

  inflect.uncountable(['equipment', 'information', 'rice', 'money', 'species', 'series', 'fish', 'sheep', 'jeans']);
}

},{}],14:[function(require,module,exports){
// Requiring modules

module.exports = function (attach) {
  var methods = require('./methods');

  if (attach) {
    require('./native')(methods);
  }

  return methods
};

},{"./methods":16,"./native":17}],15:[function(require,module,exports){
// A singleton instance of this class is yielded by Inflector.inflections, which can then be used to specify additional
// inflection rules. Examples:
//
//     BulletSupport.Inflector.inflect ($) ->
//       $.plural /^(ox)$/i, '$1en'
//       $.singular /^(ox)en/i, '$1'
//
//       $.irregular 'octopus', 'octopi'
//
//       $.uncountable "equipment"
//
// New rules are added at the top. So in the example above, the irregular rule for octopus will now be the first of the
// pluralization and singularization rules that is runs. This guarantees that your rules run before any of the rules that may
// already have been loaded.

var util = require('./util');

var Inflections = function () {
  this.plurals = [];
  this.singulars = [];
  this.uncountables = [];
  this.humans = [];
  require('./defaults')(this);
  return this;
};

// Specifies a new pluralization rule and its replacement. The rule can either be a string or a regular expression.
// The replacement should always be a string that may include references to the matched data from the rule.
Inflections.prototype.plural = function (rule, replacement) {
  if (typeof rule == 'string') {
    this.uncountables = util.array.del(this.uncountables, rule);
  }
  this.uncountables = util.array.del(this.uncountables, replacement);
  this.plurals.unshift([rule, replacement]);
};

// Specifies a new singularization rule and its replacement. The rule can either be a string or a regular expression.
// The replacement should always be a string that may include references to the matched data from the rule.
Inflections.prototype.singular = function (rule, replacement) {
  if (typeof rule == 'string') {
    this.uncountables = util.array.del(this.uncountables, rule);
  }
  this.uncountables = util.array.del(this.uncountables, replacement);
  this.singulars.unshift([rule, replacement]);
};

// Specifies a new irregular that applies to both pluralization and singularization at the same time. This can only be used
// for strings, not regular expressions. You simply pass the irregular in singular and plural form.
//
//     irregular 'octopus', 'octopi'
//     irregular 'person', 'people'
Inflections.prototype.irregular =  function (singular, plural) {
  this.uncountables = util.array.del(this.uncountables, singular);
  this.uncountables = util.array.del(this.uncountables, plural);
  if (singular[0].toUpperCase() == plural[0].toUpperCase()) {
    this.plural(new RegExp("(" + singular[0] + ")" + singular.slice(1) + "$", "i"), '$1' + plural.slice(1));
    this.plural(new RegExp("(" + plural[0] + ")" + plural.slice(1) + "$", "i"), '$1' + plural.slice(1));
    this.singular(new RegExp("(" + plural[0] + ")" + plural.slice(1) + "$", "i"), '$1' + singular.slice(1));
  } else {
    this.plural(new RegExp("" + (singular[0].toUpperCase()) + singular.slice(1) + "$"), plural[0].toUpperCase() + plural.slice(1));
    this.plural(new RegExp("" + (singular[0].toLowerCase()) + singular.slice(1) + "$"), plural[0].toLowerCase() + plural.slice(1));
    this.plural(new RegExp("" + (plural[0].toUpperCase()) + plural.slice(1) + "$"), plural[0].toUpperCase() + plural.slice(1));
    this.plural(new RegExp("" + (plural[0].toLowerCase()) + plural.slice(1) + "$"), plural[0].toLowerCase() + plural.slice(1));
    this.singular(new RegExp("" + (plural[0].toUpperCase()) + plural.slice(1) + "$"), singular[0].toUpperCase() + singular.slice(1));
    this.singular(new RegExp("" + (plural[0].toLowerCase()) + plural.slice(1) + "$"), singular[0].toLowerCase() + singular.slice(1));
  }
};

// Specifies a humanized form of a string by a regular expression rule or by a string mapping.
// When using a regular expression based replacement, the normal humanize formatting is called after the replacement.
// When a string is used, the human form should be specified as desired (example: 'The name', not 'the_name')
//
//     human /(.*)_cnt$/i, '$1_count'
//     human "legacy_col_person_name", "Name"
Inflections.prototype.human = function (rule, replacement) {
  this.humans.unshift([rule, replacement]);
}

// Add uncountable words that shouldn't be attempted inflected.
//
//     uncountable "money"
//     uncountable ["money", "information"]
Inflections.prototype.uncountable = function (words) {
  this.uncountables = this.uncountables.concat(words);
}

// Clears the loaded inflections within a given scope (default is _'all'_).
// Give the scope as a symbol of the inflection type, the options are: _'plurals'_,
// _'singulars'_, _'uncountables'_, _'humans'_.
//
//     clear 'all'
//     clear 'plurals'
Inflections.prototype.clear = function (scope) {
  if (scope == null) scope = 'all';
  switch (scope) {
    case 'all':
      this.plurals = [];
      this.singulars = [];
      this.uncountables = [];
      this.humans = [];
    default:
      this[scope] = [];
  }
}

// Clears the loaded inflections and initializes them to [default](../inflections.html)
Inflections.prototype.default = function () {
  this.plurals = [];
  this.singulars = [];
  this.uncountables = [];
  this.humans = [];
  require('./defaults')(this);
  return this;
};

module.exports = new Inflections();

},{"./defaults":13,"./util":18}],16:[function(require,module,exports){
// The Inflector transforms words from singular to plural, class names to table names, modularized class names to ones without,
// and class names to foreign keys. The default inflections for pluralization, singularization, and uncountable words are kept
// in inflections.coffee
//
// If you discover an incorrect inflection and require it for your application, you'll need
// to correct it yourself (explained below).

var util = require('./util');

var inflect = module.exports;

// Import [inflections](inflections.html) instance
inflect.inflections = require('./inflections')

// Gives easy access to add inflections to this class
inflect.inflect = function (inflections_function) {
  inflections_function(inflect.inflections);
};

// By default, _camelize_ converts strings to UpperCamelCase. If the argument to _camelize_
// is set to _false_ then _camelize_ produces lowerCamelCase.
//
// _camelize_ will also convert '/' to '.' which is useful for converting paths to namespaces.
//
//     "bullet_record".camelize()             // => "BulletRecord"
//     "bullet_record".camelize(false)        // => "bulletRecord"
//     "bullet_record/errors".camelize()      // => "BulletRecord.Errors"
//     "bullet_record/errors".camelize(false) // => "bulletRecord.Errors"
//
// As a rule of thumb you can think of _camelize_ as the inverse of _underscore_,
// though there are cases where that does not hold:
//
//     "SSLError".underscore.camelize // => "SslError"
inflect.camelize = function(lower_case_and_underscored_word, first_letter_in_uppercase) {
  var result;
  if (first_letter_in_uppercase == null) first_letter_in_uppercase = true;
  result = util.string.gsub(lower_case_and_underscored_word, /\/(.?)/, function($) {
    return "." + (util.string.upcase($[1]));
  });
  result = util.string.gsub(result, /(?:_)(.)/, function($) {
    return util.string.upcase($[1]);
  });
  if (first_letter_in_uppercase) {
    return util.string.upcase(result);
  } else {
    return util.string.downcase(result);
  }
};

// Makes an underscored, lowercase form from the expression in the string.
//
// Changes '.' to '/' to convert namespaces to paths.
//
//     "BulletRecord".underscore()         // => "bullet_record"
//     "BulletRecord.Errors".underscore()  // => "bullet_record/errors"
//
// As a rule of thumb you can think of +underscore+ as the inverse of +camelize+,
// though there are cases where that does not hold:
//
//     "SSLError".underscore().camelize() // => "SslError"
inflect.underscore = function (camel_cased_word) {
  var self;
  self = util.string.gsub(camel_cased_word, /\./, '/');
  self = util.string.gsub(self, /([A-Z]+)([A-Z][a-z])/, "$1_$2");
  self = util.string.gsub(self, /([a-z\d])([A-Z])/, "$1_$2");
  self = util.string.gsub(self, /-/, '_');
  return self.toLowerCase();
};

// Replaces underscores with dashes in the string.
//
//     "puni_puni".dasherize()   // => "puni-puni"
inflect.dasherize = function (underscored_word) {
  return util.string.gsub(underscored_word, /_/, '-');
};

// Removes the module part from the expression in the string.
//
//     "BulletRecord.String.Inflections".demodulize() // => "Inflections"
//     "Inflections".demodulize()                     // => "Inflections"
inflect.demodulize = function (class_name_in_module) {
  return util.string.gsub(class_name_in_module, /^.*\./, '');
};

// Creates a foreign key name from a class name.
// _separate_class_name_and_id_with_underscore_ sets whether
// the method should put '_' between the name and 'id'.
//
//     "Message".foreign_key()      // => "message_id"
//     "Message".foreign_key(false) // => "messageid"
//     "Admin::Post".foreign_key()  // => "post_id"
inflect.foreign_key = function (class_name, separate_class_name_and_id_with_underscore) {
  if (separate_class_name_and_id_with_underscore == null) {
    separate_class_name_and_id_with_underscore = true;
  }
  return inflect.underscore(inflect.demodulize(class_name)) + (separate_class_name_and_id_with_underscore ? "_id" : "id");
};

// Turns a number into an ordinal string used to denote the position in an
// ordered sequence such as 1st, 2nd, 3rd, 4th.
//
//     ordinalize(1)     // => "1st"
//     ordinalize(2)     // => "2nd"
//     ordinalize(1002)  // => "1002nd"
//     ordinalize(1003)  // => "1003rd"
//     ordinalize(-11)   // => "-11th"
//     ordinalize(-1021) // => "-1021st"
inflect.ordinalize = function (number) {
  var _ref;
  number = parseInt(number);
  if ((_ref = Math.abs(number) % 100) === 11 || _ref === 12 || _ref === 13) {
    return "" + number + "th";
  } else {
    switch (Math.abs(number) % 10) {
      case 1:
        return "" + number + "st";
      case 2:
        return "" + number + "nd";
      case 3:
        return "" + number + "rd";
      default:
        return "" + number + "th";
    }
  }
};

// Checks a given word for uncountability
//
//     "money".uncountability()     // => true
//     "my money".uncountability()  // => true
inflect.uncountability = function (word) {
  return inflect.inflections.uncountables.some(function(ele, ind, arr) {
    return word.match(new RegExp("(\\b|_)" + ele + "$", 'i')) != null;
  });
};

// Returns the plural form of the word in the string.
//
//     "post".pluralize()             // => "posts"
//     "octopus".pluralize()          // => "octopi"
//     "sheep".pluralize()            // => "sheep"
//     "words".pluralize()            // => "words"
//     "CamelOctopus".pluralize()     // => "CamelOctopi"
inflect.pluralize = function (word) {
  var plural, result;
  result = word;
  if (word === '' || inflect.uncountability(word)) {
    return result;
  } else {
    for (var i = 0; i < inflect.inflections.plurals.length; i++) {
      plural = inflect.inflections.plurals[i];
      result = util.string.gsub(result, plural[0], plural[1]);
      if (word.match(plural[0]) != null) break;
    }
    return result;
  }
};

// The reverse of _pluralize_, returns the singular form of a word in a string.
//
//     "posts".singularize()            // => "post"
//     "octopi".singularize()           // => "octopus"
//     "sheep".singularize()            // => "sheep"
//     "word".singularize()             // => "word"
//     "CamelOctopi".singularize()      // => "CamelOctopus"
inflect.singularize = function (word) {
  var result, singular;
  result = word;
  if (word === '' || inflect.uncountability(word)) {
    return result;
  } else {
    for (var i = 0; i < inflect.inflections.singulars.length; i++) {
      singular = inflect.inflections.singulars[i];
      result = util.string.gsub(result, singular[0], singular[1]);
      if (word.match(singular[0])) break;
    }
    return result;
  }
};

// Capitalizes the first word and turns underscores into spaces and strips a
// trailing "_id", if any. Like _titleize_, this is meant for creating pretty output.
//
//     "employee_salary".humanize()   // => "Employee salary"
//     "author_id".humanize()         // => "Author"
inflect.humanize = function (lower_case_and_underscored_word) {
  var human, result;
  result = lower_case_and_underscored_word;
  for (var i = 0; i < inflect.inflections.humans.length; i++) {
    human = inflect.inflections.humans[i];
    result = util.string.gsub(result, human[0], human[1]);
  }
  result = util.string.gsub(result, /_id$/, "");
  result = util.string.gsub(result, /_/, " ");
  return util.string.capitalize(result, true);
};

// Capitalizes all the words and replaces some characters in the string to create
// a nicer looking title. _titleize_ is meant for creating pretty output. It is not
// used in the Bullet internals.
//
//
//     "man from the boondocks".titleize()   // => "Man From The Boondocks"
//     "x-men: the last stand".titleize()    // => "X Men: The Last Stand"
inflect.titleize = function (word) {
  var self;
  self = inflect.humanize(inflect.underscore(word));
  self = util.string.gsub(self, /[^a-zA-Z:']/, ' ');
  return util.string.capitalize(self);
};

// Create the name of a table like Bullet does for models to table names. This method
// uses the _pluralize_ method on the last word in the string.
//
//     "RawScaledScorer".tableize()   // => "raw_scaled_scorers"
//     "egg_and_ham".tableize()       // => "egg_and_hams"
//     "fancyCategory".tableize()     // => "fancy_categories"
inflect.tableize = function (class_name) {
  return inflect.pluralize(inflect.underscore(class_name));
};

// Create a class name from a plural table name like Bullet does for table names to models.
// Note that this returns a string and not a Class.
//
//     "egg_and_hams".classify()   // => "EggAndHam"
//     "posts".classify()          // => "Post"
//
// Singular names are not handled correctly:
//
//     "business".classify()       // => "Busines"
inflect.classify = function (table_name) {
  return inflect.camelize(inflect.singularize(util.string.gsub(table_name, /.*\./, '')));
}

},{"./inflections":15,"./util":18}],17:[function(require,module,exports){
module.exports = function (obj) {

  var addProperty = function (method, func) {
    String.prototype.__defineGetter__(method, func);
  }

  var stringPrototypeBlacklist = [
    '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__', 'charAt', 'constructor',
    'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', 'toString', 'valueOf', 'charCodeAt',
    'indexOf', 'lastIndexof', 'length', 'localeCompare', 'match', 'replace', 'search', 'slice', 'split', 'substring',
    'toLocaleLowerCase', 'toLocaleUpperCase', 'toLowerCase', 'toUpperCase', 'trim', 'trimLeft', 'trimRight', 'gsub'
  ];

  Object.keys(obj).forEach(function (key) {
    if (key != 'inflect' && key != 'inflections') {
      if (stringPrototypeBlacklist.indexOf(key) !== -1) {
        console.log('warn: You should not override String.prototype.' + key);
      } else {
        addProperty(key, function () {
          return obj[key](this);
        });
      }
    }
  });

}

},{}],18:[function(require,module,exports){
// Some utility functions in js

var u = module.exports = {
  array: {
    // Returns a copy of the array with the value removed once
    //
    //     [1, 2, 3, 1].del 1 #=> [2, 3, 1]
    //     [1, 2, 3].del 4    #=> [1, 2, 3]
    del: function (arr, val) {
      var index = arr.indexOf(val);
      if (index != -1) {
        if (index == 0) {
         return arr.slice(1)
        } else {
          return arr.slice(0, index).concat(arr.slice(index+1));
        }
      } else {
        return arr;
      }
    },

    // Returns the first element of the array
    //
    //     [1, 2, 3].first() #=> 1
    first: function(arr) {
      return arr[0];
    },

    // Returns the last element of the array
    //
    //     [1, 2, 3].last()  #=> 3
    last: function(arr) {
      return arr[arr.length-1];
    }
  },
  string: {
    // Returns a copy of str with all occurrences of pattern replaced with either replacement or the return value of a function.
    // The pattern will typically be a Regexp; if it is a String then no regular expression metacharacters will be interpreted
    // (that is /\d/ will match a digit, but ‘\d’ will match a backslash followed by a ‘d’).
    //
    // In the function form, the current match object is passed in as a parameter to the function, and variables such as
    // $[1], $[2], $[3] (where $ is the match object) will be set appropriately. The value returned by the function will be
    // substituted for the match on each call.
    //
    // The result inherits any tainting in the original string or any supplied replacement string.
    //
    //     "hello".gsub /[aeiou]/, '*'      #=> "h*ll*"
    //     "hello".gsub /[aeiou]/, '<$1>'   #=> "h<e>ll<o>"
    //     "hello".gsub /[aeiou]/, ($) {
    //       "<#{$[1]}>"                    #=> "h<e>ll<o>"
    //
    gsub: function (str, pattern, replacement) {
      var i, match, matchCmpr, matchCmprPrev, replacementStr, result, self;
      if (!((pattern != null) && (replacement != null))) return u.string.value(str);
      result = '';
      self = str;
      while (self.length > 0) {
        if ((match = self.match(pattern))) {
          result += self.slice(0, match.index);
          if (typeof replacement === 'function') {
            match[1] = match[1] || match[0];
            result += replacement(match);
          } else if (replacement.match(/\$[1-9]/)) {
            matchCmprPrev = match;
            matchCmpr = u.array.del(match, void 0);
            while (matchCmpr !== matchCmprPrev) {
              matchCmprPrev = matchCmpr;
              matchCmpr = u.array.del(matchCmpr, void 0);
            }
            match[1] = match[1] || match[0];
            replacementStr = replacement;
            for (i = 1; i <= 9; i++) {
              if (matchCmpr[i]) {
                replacementStr = u.string.gsub(replacementStr, new RegExp("\\\$" + i), matchCmpr[i]);
              }
            }
            result += replacementStr;
          } else {
            result += replacement;
          }
          self = self.slice(match.index + match[0].length);
        } else {
          result += self;
          self = '';
        }
      }
      return result;
    },

    // Returns a copy of the String with the first letter being upper case
    //
    //     "hello".upcase #=> "Hello"
    upcase: function(str) {
      var self = u.string.gsub(str, /_([a-z])/, function ($) {
        return "_" + $[1].toUpperCase();
      });
      self = u.string.gsub(self, /\/([a-z])/, function ($) {
        return "/" + $[1].toUpperCase();
      });
      return self[0].toUpperCase() + self.substr(1);
    },

    // Returns a copy of capitalized string
    //
    //     "employee salary" #=> "Employee Salary"
    capitalize: function (str, spaces) {
      var self = str.toLowerCase();
      if(!spaces) {
        self = u.string.gsub(self, /\s([a-z])/, function ($) {
          return " " + $[1].toUpperCase();
        });
      }
      return self[0].toUpperCase() + self.substr(1);
    },

    // Returns a copy of the String with the first letter being lower case
    //
    //     "HELLO".downcase #=> "hELLO"
    downcase: function(str) {
      var self = u.string.gsub(str, /_([A-Z])/, function ($) {
        return "_" + $[1].toLowerCase();
      });
      self = u.string.gsub(self, /\/([A-Z])/, function ($) {
        return "/" + $[1].toLowerCase();
      });
      return self[0].toLowerCase() + self.substr(1);
    },

    // Returns a string value for the String object
    //
    //     "hello".value() #=> "hello"
    value: function (str) {
      return str.substr(0);
    }
  }
}

},{}],19:[function(require,module,exports){
(function (process){
/*!
 * json.mustache.js (c) 2015 Brian Norton
 * This library may be freely distributed under the MIT license.
 */
var files = require('fs'),
  cache = {};

json = function(name, env) {
  env || (env = process.env.NODE_ENV);

  var cacheKey = name+':'+env;

  if(cache[cacheKey])
    return cache[cacheKey];

  var string, key, config = JSON.parse(files.readFileSync(process.cwd()+'/config/'+name+'.json'))[env],
    keys = Object.keys(config);

  for(var i=0; i<keys.length; ++i) {
    key = keys[i]; string = config[key];

    if(typeof string == 'string') {
      config[key] = string.replace(/\{\{(\w+)\}\}/g, function(match, group, start) {
        return config[group] || match;
      });
    }
  }

  return cache[cacheKey] = config;
};

exports = module.exports = json;

}).call(this,require('_process'))
},{"_process":11,"fs":10}],20:[function(require,module,exports){
(function (global){
/*!
 * progenitor.js (c) 2015 Brian Norton
 * This library may be freely distributed under the MIT license.
 */
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.progenitor = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var hasOwn = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;
var undefined;

var isArray = function isArray(arr) {
	if (typeof Array.isArray === 'function') {
		return Array.isArray(arr);
	}

	return toStr.call(arr) === '[object Array]';
};

var isPlainObject = function isPlainObject(obj) {
	'use strict';
	if (!obj || toStr.call(obj) !== '[object Object]') {
		return false;
	}

	var has_own_constructor = hasOwn.call(obj, 'constructor');
	var has_is_property_of_method = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !has_own_constructor && !has_is_property_of_method) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) {}

	return key === undefined || hasOwn.call(obj, key);
};

module.exports = function extend() {
	'use strict';
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0],
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if (typeof target === 'boolean') {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
		target = {};
	}

	for (; i < length; ++i) {
		options = arguments[i];
		// Only deal with non-null/undefined values
		if (options != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target === copy) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
					if (copyIsArray) {
						copyIsArray = false;
						clone = src && isArray(src) ? src : [];
					} else {
						clone = src && isPlainObject(src) ? src : {};
					}

					// Never move original objects, clone them
					target[name] = extend(deep, clone, copy);

				// Don't bring in undefined values
				} else if (copy !== undefined) {
					target[name] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};


},{}],2:[function(require,module,exports){
var noop = function() {},
  extend = require('extend'),
  progenyCache = {};

var progenitorFactory = function(baseClass) {
  baseClass.classMethods || (baseClass.classMethods = {});
  baseClass.classMethods.inherited || (baseClass.classMethods.inherited = noop);

  baseClass.instanceMethods || (baseClass.instanceMethods = {});
  baseClass.instanceMethods.init || (baseClass.instanceMethods.init = noop);

  return function(newClassName, methods, options) { var klass;
    if(klass = progenyCache[newClassName]) {
      return klass;
    }

    methods = ((typeof methods == 'function') ? methods() : methods) || {};
    options = ((typeof options == 'function') ? options() : options) || {};

    options.classMethods || (options.classMethods = {});

    klass = function(isDefinition) {
      if(isDefinition === 'prototype-definition') return;

      baseClass.instanceMethods.init.apply(this, arguments); // instance.super.init
      instanceMethods.init.apply(this, arguments); // instance.init
    };

    var callSuperClass = function(name) { return baseClass.classMethods[name] && baseClass.classMethods[name].apply(this, Array.prototype.slice.call(arguments, 1));},
      defaultClassMethods = { class: baseClass, className: newClassName, super: callSuperClass, progeny: progenitorFactory(klass) },
      classMethods = extend({}, baseClass.classMethods, defaultClassMethods, options.classMethods);

    extend(klass, klass.classMethods = classMethods);

    var callSuperInstance = function(name) { return baseClass.instanceMethods[name] && baseClass.instanceMethods[name].apply(this, Array.prototype.slice.call(arguments, 1));},
      defaultInstanceMethods = { constructor: baseClass, class: klass, className: newClassName, super: callSuperInstance, init: noop },
      instanceMethods = extend({}, baseClass.instanceMethods, defaultInstanceMethods, methods);

    klass.prototype = new baseClass('prototype-definition');

    extend(klass.prototype, klass.instanceMethods = instanceMethods);

    baseClass.classMethods.inherited.apply(baseClass, [klass]);

    return (progenyCache[newClassName] = klass);
  }
};

exports = module.exports = function() {
  Object.progeny || (Object.progeny = progenitorFactory(Object));
  Error.progeny || (Error.progeny = progenitorFactory(Error));
};

},{"extend":1}]},{},[2])(2)
});
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"extend":12}]},{},[3])(3)
});