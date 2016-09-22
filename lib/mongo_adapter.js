var fs = require('fs'),
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
      var that = this,
        url = JSON.parse(fs.readFileSync(process.cwd()+'/config/mongo.json'))[process.env.NODE_ENV];

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

module.exports = MongoAdapter;
