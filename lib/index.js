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
    } else if(typeof this[name] === 'function') {
      return this[name].call(this);
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
