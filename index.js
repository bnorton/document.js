require('progenitor.js')();

var extend = require('extend'),
  objectID = require('mongodb').ObjectID,
  Adapter = process.env.NODE_ENV === 'test' ? require('./lib/memory_adapter') : require('./lib/mongo_adapter'),
  noop = function() { };

Document = Object.progeny('Document', {
  init: function(options, relation) { var id = options.id || options._id;
    id || (this.id = null);
    id && (this.id = (objectID.isValid(id) || id._bsontype) ? id : id.toString());

    this.relation = relation;

    this._changes = {};
    this._data = extend({}, options);
    this._data._id = this._data_id || this._data.id;

    delete this._data.id;

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

    if(this.class.namedAttrs[name]) {
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
      if(this.class.namedAttrs[name]) {
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
      changes = this.changedAttributes();

    if(notValid || (changes == {} && this.id)) {
      this.loaded = true;
      return this;
    }

    this.loaded = false;
    this.relation = new Document.Relation(this.class, this);

    if(this.id) {
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

    this.class.adapter.remove({_id: this.id}, function(value) {
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
    };

    for(var i = 0; i < this.class.allow.length; ++i) {
      name = this.class.allow[i];

      json[name] = this.get(name);
    }

    return json;
  }
}, {
  classMethods: {
    namedAttrs: null,
    shortAttrs: null,
    inherited: function(base) { var attrs;
      base.adapter = new Adapter(base);
      base.attrs.ObjectID = extend({ _id: '_id' }, base.attrs.ObjectID);
      base.attrs.Date = extend({ createdAt: 'cT',  updatedAt: 'uT' }, base.attrs.Date);
      base.namedAttrs = {}; base.shortAttrs = {};

      for(var type in base.attrs) {
        for(var attr in (attrs = base.attrs[type])) {
          base.namedAttrs[attr] = attrs[attr];
          base.shortAttrs[attrs[attr]] = attr;
        }
      }
    },
    find: function(id) { var model;
      if(id && (typeof id == 'string' || id._bsontype == 'ObjectID')) {
        this.loaded = false;
        id = objectID.isValid(id) ? objectID(id) : id;

        var relation = new Document.Relation(this, model = new this({_id: id}));

        return (model.relation = relation).find();
      } else {
        return new Document.Relation(this).find(id);
      }
    },
    count: function() { return new Document.Relation(this).count() },
    first: function() { return adapterDirection.call(this, 'first') },
    last: function() { return adapterDirection.call(this, 'last') }
  }
});

function adapterDirection(name) {
  var model = new this({_id: null});
  this.adapter[name].call(this.adapter, function(options) {
    model.kept(options);
  });

  return model;
}

extend(Document, {
  Relation: require('./lib/relation'),
  Adapter: Adapter
});

exports = module.exports = Document;
