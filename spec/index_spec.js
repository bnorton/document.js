require('./helpers/spec_helper');

var extend = require('extend');

var Channel = require('../examples/models/channel'),
  User = require('../examples/models/user');

describe(Document.className, function() {
  var model, relation, __id = 1;
  var createChannel = function(options) {
    options = extend({name: 'Channel '+ (++__id), slug: '#updates'}, options);

    return (new Channel(options)).save();
  };

  var createUser = function() {
    return (new User({email: 'john+'+parseInt(Math.random()*100, 10)+'@example.com'})).save()
  };

  beforeEach(function() {
    relation = jasmine.createSpy('Relation');

    model = new Channel({id: '123', name: 'Channel 123', slug: '#foo-bars', buffered: 200}, relation);
  });

  it('should have the fields', function() {
    expect(Channel.namedFields).toEqual({ _id: '_id', name: 'n',  slug: 's', token: 't', buffered: 'bu', capped: 'c', createdAt: 'cT', updatedAt: 'uT', user_id: 'u_id'});
    expect(User.namedFields).toEqual({ _id: '_id', firstName: 'fn', lastName: 'ln', email: 'e',  createdAt: 'cT', updatedAt: 'uT' });
  });

  it('should have the short fields', function() {
    expect(Channel.shortFields).toEqual({ _id: '_id', n: 'name',  s: 'slug', t: 'token', bu: 'buffered', c: 'capped', cT: 'createdAt', uT: 'updatedAt', u_id: 'user_id' });
    expect(User.shortFields).toEqual({ _id: '_id', fn: 'firstName', ln: 'lastName', e: 'email', cT: 'createdAt', uT: 'updatedAt' });
  });

  it('allows modification of the default fields', function() {
    Document.defaultFields.Date.createdAt = 'cr_at';
    var Obscure = require('../examples/models/obscure');

    expect(Obscure.fields.Date.createdAt).toBe('cr_at');
  });

  describe('.new', function() {
    it('should have the relation', function() {
      expect(model.relation).toBe(relation);
    });

    it('should have the id', function() {
      expect(model.id).toBe('123');
    });

    it('should have the data', function() {
      expect(model._data).toEqual({_id: '123', name: 'Channel 123', slug: '#foo-bars', buffered: 200});
    });

    it('should not be loaded', function() {
      expect(model.loaded).toBe(false);
    });

    it('should be persisted', function() {
      expect(model.persisted).toBe(false);
    });

    it('should have the attributes', function() {
      expect(model.get('name')).toBe('Channel 123');
      expect(model.get('slug')).toBe('#foo-bars');
      expect(model.get('buffered')).toBe(200);
    });

    describe('when the promise is kept', function() {
      var result;

      beforeEach(function() {
        result = null;
      });

      it('should update with new values', function() {
        model.kept({_id: '9945', name: 'New loaded name'});

        expect(model.id).toBe('9945');
        expect(model.get('id')).toBe('9945');
        expect(model.get('name')).toBe('New loaded name');
      });

      describe('once kept successfully', function() {
        beforeEach(function() {
          model.then(function(r) {
            result = r;
          });

          model.kept({name: 'Foo'});
        });

        it('should be loaded', function() {
          expect(model.loaded).toBe(true);
        });

        it('should update with new values', function() {
          expect(model.get('name')).toBe('Foo');
        });

        it('should have the id', function() {
          expect(result.id).toBe(model.id);
        });

        it('calls additional callbacks immediately', function() {
          var other = null;
          model.then(function(r) { other = r; });

          expect(other.id).toBe(model.id);
        });
      });

      describe('once kept erroneously', function() {
        var errored;

        beforeEach(function() {
          errored = false;

          model.then(function(r) {
            result = r;
          }, function() {
            errored = true;
          });

          model.kept(null);
        });

        it('should have loaded', function() {
          expect(model.loaded).toBe(true);
        });

        it('should not call the success', function() {
          expect(result).toBeNull();
        });

        it('should call the error', function() {
          expect(errored).toBe(true);
        });

        it('calls additional callbacks immediately', function() {
          var called = false;
          model.then(function() {}, function() {
            called = true;
          });

          expect(called).toBe(true);
        });
      });
    });
  });

  describe('#belongsTo', function() {
    it('should add the association', function() {
      expect(model.get('user')).toBeNull();
    });

    it('should have the user id', function() {
      expect(model.get('user_id')).toBeNull();
    });

    describe('when assigning a user', function() {
      var user;

      beforeEach(function(done) {
        user = createUser({firstName: 'James'});
        user.then(function() {
          model.set('user', user);
          done();
        });
      });

      it('should set the user id', function() {
        expect(model.get('user_id')).toBe(user.id);
      });

      it('should not store the user', function() {
        expect(model._data.user_id).toBe(user.id);
        expect(model._data.user).toBeUndefined();
      });

      it('should have the changes', function() {
        expect(model.changedAttributes()).toEqual({user_id: [null, user.id]});
      });

      it('should have the user', function() {
        expect(model.get('user') instanceof User).toBe(true);
      });

      it('should return the user', function(done) {
        var result = model.get('user');
        result.then(function() {
          expect(result.id).toBe(user.id);
          done();
        });
      });
    });

    describe('when assigning a user by id', function() {
      var user;

      beforeEach(function(done) {
        user = createUser({firstName: 'James'});
        user.then(function() {
          model.set('user_id', user.id);
          done();
        });
      });

      it('should set the user id', function() {
        expect(model.get('user_id')).toBe(user.id);
      });

      it('should have the user', function() {
        expect(model.get('user') instanceof User).toBe(true);
      });

      it('should have the changes', function() {
        expect(model.changedAttributes()).toEqual({user_id: [null, user.id]});
      });

      it('should return the user', function(done) {
        var result = model.get('user');
        result.then(function() {
          expect(result.id).toBe(user.id);
          done();
        });
      });
    });
  });

  describe('#loaded', function() {
    beforeEach(function() {
      model.loaded = false;
    });

    describe('when the promise has been kept', function() {
      beforeEach(function() {
        model.kept();
      });

      it('should be loaded', function() {
        expect(model.loaded).toBe(true);
      });
    });
  });

  describe('#persisted', function() {
    beforeEach(function() {
      model = new Channel({name: 'New channel', slug: "#new"});
    });

    it('should be given an id', function() {
      expect(model.id).toBeDefined();
      expect(model._data._id).toBe(model.id);
    });

    it('should not be persisted', function() {
      expect(model.persisted).toBe(false);
    });

    describe('when the id is given', function() {
      beforeEach(function() {
        model = new Channel({id: '55', name: 'New channel', slug: "#new"});
      });

      it('should be given an id', function() {
        expect(model.id).toBe('55');
        expect(model._data._id).toBe('55');
      });

      it('should not be persisted', function() {
        expect(model.persisted).toBe(false);
      });
    });

    describe('when record is saved', function() {
      beforeEach(function() {
        model.kept({_id: '44'});
      });

      it('should be persisted', function() {
        expect(model.persisted).toBe(true);
      });
    });

    describe('when record fails to save', function() {
      beforeEach(function() {
        model.kept(null);
      });

      it('should not be persisted', function() {
        expect(model.persisted).toBe(false);
      });
    });
  });

  describe('#get', function() {
    it('should return the attribute', function() {
      expect(model.id).toBe('123');
      expect(model.get('id')).toBe('123');
      expect(model.get('name')).toBe('Channel 123');
      expect(model.get('slug')).toBe('#foo-bars');
      expect(model.get('buffered')).toBe(200);
    });

    it('should return computed values', function() {
      expect(model.get('displayName')).toBe('Channel: Channel 123');
    });

    it('should not have missing keys', function() {
      expect(model.get('missing')).toBeUndefined();
    });
  });

  describe('#set', function() {
    it('should change the attribute', function() {
      model.set('name', 'New Name');

      expect(model.get('name')).toBe('New Name');
    });

    it('should return the attribute', function() {
      expect(model.set('name', 'New Name')).toBe('New Name');
    });

    describe('when un-setting', function() {
      beforeEach(function() {
        model.set('name', undefined);
      });

      it('should be null', function() {
        expect(model.get('name')).toBeNull();
      });

      it('should be null', function() {
        expect(model._data.name).toBeNull();
      });
    });

    describe('when setting 0', function() {
      beforeEach(function() {
        model.set('name', 0);
      });

      it('should be the value', function() {
        expect(model.get('name')).toBe(0);
      });
    });

    describe('when given attributes not on the whitelist', function() {
      var result;

      beforeEach(function() {
        expect(model.class.allow.indexOf('oddball')).toBe(-1);

        result = model.set('oddball', 'what?');
      });

      it('should not change the attribute', function() {
        expect(model.get('oddball')).toBeUndefined();
      });

      it('should not return the attribute', function() {
        expect(result).toBeUndefined();
      });
    });

    describe('for an object', function() {
      var options;

      beforeEach(function() {
        options = { slug: '#new-slug', name: 'New Name Obj' };
      });

      it('should set the attributes', function() {
        model.set(options);

        expect(model.get('slug')).toBe('#new-slug');
        expect(model.get('name')).toBe('New Name Obj');
      });

      it('should return the attributes', function() {
        expect(model.set(options)).toEqual({slug: '#new-slug', name: 'New Name Obj'});
      });

      describe('when given attributes not on the whitelist', function() {
        var result;

        beforeEach(function() {
          expect(model.class.allow.indexOf('oddball')).toBe(-1);

          options.oddball = 'what?';

          result = model.set(options);
        });

        it('should not change the attribute', function() {
          expect(model.get('oddball')).toBeUndefined();
        });

        it('should return the whitelist members', function() {
          expect(result).toEqual({slug: '#new-slug', name: 'New Name Obj'});
        });
      });
    });
  });

  describe('#asJSON', function() {
    var id;

    beforeEach(function() {
      id = Document.Adapter.ids.next();
    });

    it('should be the allowed fields', function() {
      expect(Object.keys(model.asJSON())).toEqual(['id', 'createdAt', 'updatedAt', 'name', 'user', 'user_id', 'slug', 'token', 'buffered']);
    });

    it('should have the values', function() {
      expect(model.asJSON()).toEqual({id: '123', createdAt: null, updatedAt: null, name: 'Channel 123', user_id: null, user: { id: null }, slug: '#foo-bars', token: null, buffered: 200})
    });

    it('should convert the id', function() {
      model.id = id;
      expect(model.asJSON().id).toBe(id.toString());
    });

    describe('for the *_id fields', function() {
      var json;

      beforeEach(function() {
        model.set('user_id', id);

        json = model.asJSON();
      });

      it('should have the user id', function() {
        expect(json.user_id).toBe(id.toString());
      });

      it('should have the embedded user', function() {
        expect(Object.keys(json.user).length).toBe(1);
        expect(json.user.id).toBe(id.toString());
      });
    });

    describe('when a document specifies a belongs to relation', function() {
      var user, json, Post = require('../examples/models/post');

      beforeEach(function() {
        user = createUser();

        model = new Post({user: user});

        expect(Post.allow.indexOf('user_id')).toBe(1);
        expect(Post.allow.indexOf('user')).toBe(0); // Order matters

        json = model.asJSON();
      });

      it('should include the user id (the default of allow: [user_id])', function() {
        expect(json.user_id).toBe(user.id.toString());
      });

      it('should include the expanded user', function() {
        expect(Object.keys(json.user).length).toBeGreaterThan(3);
        expect(json.user).toEqual(user.asJSON());
      });
    });
  });

  describe('#isValid', function() {
    it('should be valid', function() {
      expect(model.isValid()).toBe(true);
    });

    describe('when an attribute is missing', function() {
      beforeEach(function() {
        model.set('name', null);
      });

      it('should not be valid', function() {
        expect(Channel.classMethods.validate.presence).toEqual(['name']);
        expect(model.isValid()).toBe(false);
      });
    });

    describe('for not-matching attributes', function() {
      beforeEach(function() {
        model.set('slug', 'mal-formatted');
      });

      it('should not be valid', function() {
        expect(Channel.classMethods.validate.format.slug).toEqual(/^#\w+/);

        expect(model.isValid()).toBe(false);
      });
    });

    describe('for custom validation', function() {
      beforeEach(function() {
        expect(model.class.validate.custom).toBeUndefined();

        model.class.validate.custom = [function() {
          return this.get('buffered') === 96459;
        }];

        model.set('buffered', 96459);
      });

      afterEach(function() {
        model.class.validate.custom = undefined;
      });

      it('should be valid', function() {
        expect(model.isValid()).toBe(true);
      });

      describe('when it fails', function() {
        beforeEach(function() {
          model.set('buffered', 19);
        });

        it('should not be valid', function() {
          expect(model.isValid()).toBe(false);
        });
      });
    });
  });

  describe('#changedAttributes', function() {
    it('should be empty', function() {
      expect(model.changedAttributes()).toEqual({});
    });

    describe('when an attribute have been set', function() {
      beforeEach(function() {
        model.set('name', 'changed set name');
      });

      it('should have the changes', function() {
        expect(model.changedAttributes()).toEqual({name: ['Channel 123', 'changed set name']});
      });
    });

    describe('when attributes have been set', function() {
      beforeEach(function() {
        model.set({name: 'changed set name', buffered: 500});
      });

      it('should have the changes', function() {
        expect(model.changedAttributes()).toEqual({
          name: ['Channel 123', 'changed set name'],
          buffered: [200, 500]
        });
      });

      describe('when the promise is kept', function() {
        describe('success', function() {
          beforeEach(function() {
            model.kept({name: 'changed set name'});
          });

          it('should be empty', function() {
            expect(model.changedAttributes()).toEqual({});
          });
        });

        describe('error', function() {
          beforeEach(function() {
            model.kept(null);
          });

          it('should retain the changes', function() {
            expect(model.changedAttributes()).toEqual({
              name: ['Channel 123', 'changed set name'],
              buffered: [200, 500]
            });
          });
        });
      });
    });
  });

  describe('#save', function() {
    var relation;

    beforeEach(function() {
      model = new Channel({name: 'Channel hi', slug: '#updates'});

      relation = new Document.Relation(Channel, model);

      spyOn(relation, 'create').and.returnValue('Document:create');
      spyOn(relation, 'update').and.returnValue('Document:update');

      spyOn(Document, 'Relation').and.returnValue(relation);
    });

    describe('on create', function() {
      it('should not be loaded', function() {
        model.save();
        expect(model.loaded).toBe(false);
      });

      it('should not be persisted', function() {
        model.save();
        expect(model.persisted).toBe(false);
      });

      it('should return Relation#create', function() {
        expect(model.save()).toBe('Document:create');
      });

      it('should send the model data to the relation', function() {
        model.save();

        var options = relation.create.calls.mostRecent().args[0];

        expect(options.name).toBe('Channel hi');
        expect(options.slug).toBe('#updates');
      });

      it('should trigger before create hooks', function() {
        model.save();

        expect(model.get('token')).toMatch(/C-\d+\.\d+/);
      });

      describe('when the model is not valid', function() {
        beforeEach(function() {
          spyOn(model, 'isValid').and.returnValue(false);

          model.save();
        });

        it('should be loaded', function() {
          expect(model.loaded).toBe(true);
        });

        it('should not send the create', function() {
          expect(Document.Relation).not.toHaveBeenCalled();
        });

        it('should not trigger before create hooks', function() {
          expect(model.get('token')).toBeNull();
        });
      });
    });

    describe('on update', function() {
      beforeEach(function() {
        model.persisted = true;
      });

      it('should be loaded', function() {
        model.save();

        expect(model.loaded).toBe(true);
      });

      it('should return the model', function() {
        expect(model.save()).toBe(model);
      });

      describe('when there are changes', function() {
        beforeEach(function() {
          model.set('buffered', 900);
        });

        it('should have the changes', function() {
          expect(model.changedAttributes()).toEqual({buffered: [null, 900]});
        });

        it('should not be loaded', function() {
          model.save();
          expect(model.loaded).toBe(false);
        });

        it('should have the relation', function() {
          model.save();
          expect(model.relation).toBe(relation);
        });

        it('should send the changes to the relation', function() {
          model.save();
          expect(relation.update).toHaveBeenCalledWith({buffered: 900});
        });

        it('should return Relation#update', function() {
          expect(model.save()).toBe('Document:update');
        });

        describe('when the model is not valid', function() {
          beforeEach(function() {
            spyOn(model, 'isValid').and.returnValue(false);

            model.save();
          });

          it('should be loaded', function() {
            expect(model.loaded).toBe(true);
          });

          it('should not have the relation', function() {
            expect(model.relation).toBeUndefined();
          });

          it('should not send the changes to the relation', function() {
            expect(relation.update).not.toHaveBeenCalled();
          });
        });
      });
    });
  });

  describe('#update', function() {
    var object;

    beforeEach(function() {
      spyOn(model, 'set');
      spyOn(model, 'save').and.returnValue('hello');

      object = model.update('key', 'value');
    });

    it('should set the items', function() {
      expect(model.set).toHaveBeenCalledWith('key', 'value');
    });

    it('should save the model', function() {
      expect(model.save).toHaveBeenCalled();
    });

    it('should return what save returns', function() {
      expect(object).toBe('hello');
    });
  });

  describe('#destroy', function() {
    var removeOptions, callback, result;

    beforeEach(function() {
      removeOptions = callback = result = null;

      spyOn(Channel.adapter(), 'remove').and.callFake(function(b,c) {
        removeOptions = b; callback = c;
      });

      model.save();

      spyOn(model, 'kept').and.callThrough();
      result = model.destroy();
    });

    it('should be a model', function() {
      expect(result instanceof Channel).toBe(true);
    });

    it('should not be loaded', function() {
      expect(model.loaded).toBe(false);
    });

    it('should remove the model', function() {
      expect(removeOptions).toEqual({_id: model.id});
    });

    describe('when the adapter succeeds', function() {
      beforeEach(function() {
        callback(true);
      });

      it('should be loaded', function() {
        expect(model.loaded).toBe(true);
      });

      it('should be destroyed', function() {
        expect(model.isDestroyed).toBe(true);
      });

      it('should return the result', function() {
        expect(model.kept).toHaveBeenCalledWith(true);
      });
    });

    describe('when the adapter errors', function() {
      beforeEach(function() {
        callback(null);
      });

      it('should be loaded', function() {
        expect(model.loaded).toBe(true);
      });

      it('should not be destroyed', function() {
        expect(model.isDestroyed).toBe(false);
      });

      it('should return the result', function() {
        expect(model.kept).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('class methods', function() {
    beforeEach(function(done) {
      model = createChannel({name: 'Channel 998', buffered: 200});
      model.then(done);
    });

    describe('.count', function() {
      it('should have the count', function() {
        expect(Channel.count().className).toBe('Count');
      });

      it('should have the count', function(done) {
        Channel.count().then(function(c) {
          expect(c).toBe(1); done();
        });
      });

      describe('with more models', function() {
        beforeEach(function(done) {
          createChannel().then(function() {
            createChannel().then(done);
          });
        });

        it('should have the count', function(done) {
          Channel.count().then(function(c) {
            expect(c).toBe(3); done();
          });
        });
      });

      describe('when other models are added', function() {
        beforeEach(function(done) {
          createUser().then(function() {
            createUser().then(done);
          });
        });

        it('should be scoped to this model', function(done) {
          Channel.count().then(function(c) {
            expect(c).toBe(1); done();
          });
        });

        it('should have the users', function(done) {
          User.count().then(function(c) {
            expect(c).toBe(2); done();
          });
        });
      });
    });

    describe('.find', function() {
      var id;

      beforeEach(function() {
        id = null;
      });

      describe('for a string', function() {
        beforeEach(function() {
          id = model.id.toString();
        });

        it('should return the shell', function() {
          expect(model.id).toBeDefined();
          expect(Channel.find(id).id).toEqual(model.id);
          expect(Channel.find(id) instanceof Channel).toEqual(true);
        });

        it('should find the model', function(done) {
          var channel = Channel.find(id);
          channel.then(function() {
            expect(channel.id).toEqual(model.id);
            expect(channel.get('name')).toBe('Channel 998');
            done();
          });
        });
      });

      describe('for an object id', function() {
        beforeEach(function() {
          id = model.id;
        });

        it('should return the shell', function() {
          expect(id).toBeDefined();
          expect(Channel.find(id).id).toEqual(id);
          expect(Channel.find(id) instanceof Channel).toEqual(true);
        });

        it('should find the model', function(done) {
          var channel = Channel.find(id);
          channel.then(function() {
            expect(channel.id).toEqual(id);
            expect(channel.get('name')).toBe('Channel 998');
            done();
          });
        });
      });

      describe('for a set of models', function() {
        it('should find the models', function(done) {
          var channels = Channel.find({buffered: 200});
          channels.then(function() {
            expect(channels.items.length).toBe(1);
            expect(channels.items[0].id).toEqual(model.id);
            expect(channels.items[0].get('id')).toEqual(model.id);
            expect(channels.items[0].get('name')).toBe('Channel 998');
            done();
          });
        });
      });

      describe('with more models', function() {
        var otherModel;

        beforeEach(function(done) {
          otherModel = createChannel({name: '456 channel', buffered: 200});
          otherModel.then(function() {
            createChannel().then(done);
          });
        });

        it('should have the model', function(done) {
          expect(otherModel.id).toBeDefined();

          var channel = Channel.find(otherModel.id);
          channel.then(function() {
            expect(channel.id).toEqual(otherModel.id);
            expect(channel.get('name')).toEqual('456 channel');
            done();
          });
        });

        describe('for a set of models', function() {
          var channels;

          beforeEach(function(done) {
            channels = Channel.find({buffered: 200});
            channels.then(done);
          });

          it('should have the models', function() {
            expect(model.id).toBeDefined();
            expect(otherModel.id).toBeDefined();

            expect(channels.items.length).toBe(2);

            expect(channels.items[0].id).toEqual(model.id);
            expect(channels.items[0].get('id')).toEqual(model.id);
            expect(channels.items[0].get('name')).toBe('Channel 998');
            expect(channels.items[1].get('id')).toEqual(otherModel.id);
            expect(channels.items[1].id).toEqual(otherModel.id);
            expect(channels.items[1].get('name')).toBe('456 channel');
          });
        });
      });

      describe('when not given an id', function() {
        it('should call error - undefined', function(done) {
          Channel.find().then(null, done);
        });

        it('should call error - null', function(done) {
          Channel.find(null).then(null, done);
        });
      });

      describe('when the model cannot be found', function(done) {
        it('should call error', function() {
          Channel.find('987').then(null, done);
        });
      });
    });

    describe('.first', function() {
      var callback, channel;

      beforeEach(function() {
        callback = null;

        spyOn(Channel.adapter(), 'first').and.callFake(function(c) {
          callback = c;
        });

        channel = Channel.first();
        spyOn(channel, 'kept').and.callThrough();
      });

      it('should be a model', function() {
        expect(Channel.first() instanceof Channel).toBe(true);
      });

      it('should not have an id', function() {
        expect(channel.id).toBeNull();
      });

      it('should not be loaded', function() {
        expect(channel.loaded).toBe(false);
      });

      describe('when the adapter succeeds', function() {
        beforeEach(function() {
          callback({_id: model.id, name: 'Adapter name', buffered: 5000});
        });

        it('should be loaded', function() {
          expect(channel.loaded).toBe(true);
        });

        it('should return the result', function() {
          expect(channel.kept).toHaveBeenCalledWith({_id: model.id, name: 'Adapter name', buffered: 5000});
        });

        it('should have the options', function() {
          expect(channel.id).toBe(model.id);
          expect(channel.get('id')).toBe(model.id);
          expect(channel.get('name')).toBe('Adapter name');
          expect(channel.get('buffered')).toBe(5000);
        });
      });

      describe('when the adapter errors', function() {
        beforeEach(function() {
          callback(null);
        });

        it('should be loaded', function() {
          expect(channel.loaded).toBe(true);
        });

        it('should return the result', function() {
          expect(channel.kept).toHaveBeenCalledWith(null);
        });

        it('should not have the options', function() {
          expect(channel.id).toBeNull();
          expect(channel.get('buffered')).toBeNull();
        });
      });
    });

    describe('.last', function() {
      var otherModel, callback, channel;

      beforeEach(function() {
        callback = null;

        spyOn(Channel.adapter(), 'last').and.callFake(function(c) {
          callback = c;
        });

        otherModel = createChannel({id: '500'});

        channel = Channel.last();
        spyOn(channel, 'kept').and.callThrough();
      });

      it('should be a model', function() {
        expect(Channel.last() instanceof Channel).toBe(true);
      });

      it('should not have an id', function() {
        expect(channel.id).toBeNull();
      });

      it('should not be loaded', function() {
        expect(channel.loaded).toBe(false);
      });

      describe('when the adapter succeeds', function() {
        beforeEach(function() {
          callback({_id: '500', name: 'Adapter name', buffered: 5000});
        });

        it('should be loaded', function() {
          expect(channel.loaded).toBe(true);
        });

        it('should return the result', function() {
          expect(channel.kept).toHaveBeenCalledWith({_id: '500', name: 'Adapter name', buffered: 5000});
        });

        it('should have the options', function() {
          expect(channel.id).toBe('500');
          expect(channel.get('id')).toBe('500');
          expect(channel.get('name')).toBe('Adapter name');
          expect(channel.get('buffered')).toBe(5000);
        });
      });

      describe('when the adapter errors', function() {
        beforeEach(function() {
          callback(null);
        });

        it('should be loaded', function() {
          expect(channel.loaded).toBe(true);
        });

        it('should return the result', function() {
          expect(channel.kept).toHaveBeenCalledWith(null);
        });

        it('should not have the options', function() {
          expect(channel.id).toBeNull();
          expect(channel.get('buffered')).toBeNull();
        });
      });
    });
  });
});
