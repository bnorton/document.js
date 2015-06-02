require('./helpers/spec_helper');

var Relation = require('../index').Relation;

describe(Relation.className, function() {
  var Channel, relation;

  beforeEach(function() {
    Channel || (Channel = require('../examples/models/channel'));

    relation = new Relation(Channel);
  });

  it('should have the model class', function() {
    expect(relation.modelClass).toBe(Channel);
  });

  it('should have the adapter', function() {
    expect(relation.adapter instanceof MemoryAdapter).toBe(true);
    expect(relation.adapter).toBe(Channel.adapter);
  });

  it('should not be loaded', function() {
    expect(relation.loaded).toBe(false);
  });

  it('should not have size or items', function() {
    expect(relation.items).toBeNull();
    expect(relation.size).toBeNull();
  });

  it('should have the query', function() {
    expect(relation.query()).toEqual({});
  });

  describe('#count', function() {
    var Count = require('../lib/count'), count, callback;

    beforeEach(function() {
      callback = null;

      spyOn(relation.adapter, 'count').and.callFake(function(c) {
        callback = c;
      });

      count = relation.count();
      spyOn(count, 'kept');
    });

    it('should return a count', function() {
      expect(count instanceof Count).toBe(true);
    });

    it('should have the relation', function() {
      expect(count.relation).toBe(relation);
    });

    it('should not be loaded', function() {
      expect(relation.loaded).toBe(false);
    });

    it('should call the adapter count', function() {
      relation.count();
      expect(relation.adapter.count).toHaveBeenCalled();
    });

    describe('when the adapter succeeds', function() {
      beforeEach(function() {
        callback(26);
      });

      it('should be loaded', function() {
        expect(relation.loaded).toBe(true);
      });

      it('should have have the count', function() {
        expect(count.kept).toHaveBeenCalledWith(26);
      });
    });

    describe('when the adapter errors', function() {
      beforeEach(function() {
        callback(null);
      });

      it('should be loaded', function() {
        expect(relation.loaded).toBe(true);
      });

      it('should have have the count', function() {
        expect(count.kept).toHaveBeenCalledWith(null);
      });
    });
  });

  describe('#find', function() {
    var model, object, find, findOptions, callback;

    beforeEach(function() {
      model = object = findOptions = callback = null;
    });

    describe('for a query', function() {
      beforeEach(function() {
        relation = new Relation(Channel);

        spyOn(relation.adapter, 'where').and.callFake(function(b,c) {
          findOptions = b; callback = c;
        });

        object = relation.find({buffered: 5, foo: 'bar'});
      });

      it('should return a relation', function() {
        expect(object instanceof Relation).toBe(true);
      });

      it('should not be loaded', function() {
        expect(relation.loaded).toBe(false);
      });

      it('should call the adapter find with the options' , function() {
        expect(findOptions).toEqual({buffered: 5, foo: 'bar'});
      });

      describe('when the adapter succeeds', function() {
        beforeEach(function() {
          callback([{_id: 445, name: 'Channel 445'}, {_id: 556, name: 'Channel 556'}]);
        });

        it('should be loaded', function() {
          expect(relation.loaded).toBe(true);
        });

        it('should have the models', function() {
          var models = relation.items;

          expect(models.length).toBe(2);
          expect(models[0].id).toBe(445);
          expect(models[0].get('name')).toBe('Channel 445');
          expect(models[1].id).toBe(556);
          expect(models[1].get('name')).toBe('Channel 556');
        });

        it('should not have the size', function() {
          expect(relation.size).toBeNull();
        });
      });

      describe('when the adapter fails', function() {
        beforeEach(function() {
          callback(null);
        });

        it('should be loaded', function() {
          expect(relation.loaded).toBe(true);
        });

        it('should not have the models', function() {
          expect(relation.items).toBeNull();
        });

        it('should not have the number of records', function() {
          expect(relation.size).toBeNull();
        });
      });
    });

    describe('with a model', function() {
      beforeEach(function() {
        model = new Channel({_id: 5});
        relation = new Relation(Channel, model);

        spyOn(relation.adapter, 'where').and.callFake(function(b,c) {
          findOptions = b; callback = c;
        });

        spyOn(model, 'kept');

        find = relation.find();
      });

      it('should return the model', function() {
        expect(find instanceof Channel).toBe(true);
        expect(find).toBe(model);
      });

      it('should not be loaded', function() {
        expect(relation.loaded).toBe(false);
      });

      it('should call the adapter find with the model id' , function() {
        expect(findOptions).toEqual({_id: 5});
      });

      describe('when the adapter succeeds', function() {
        beforeEach(function() {
          callback([{_id: 5, name: 'From adapter'}]);
        });

        it('should be loaded', function() {
          expect(relation.loaded).toBe(true);
        });

        it('should return the result', function() {
          expect(model.kept).toHaveBeenCalledWith({_id: 5, name: 'From adapter'});
        });
      });

      describe('when the adapter errors', function() {
        beforeEach(function() {
          callback(null);
        });

        it('should be loaded', function() {
          expect(relation.loaded).toBe(true);
        });

        it('should return the result', function() {
          expect(model.kept).toHaveBeenCalledWith(null);
        });
      });
    });
  });

  describe('#asJSON', function() {
    it('should be null', function() {
      expect(relation.asJSON()).toBeNull();
    });

    describe('when there are items', function() {
      beforeEach(function() {
        relation.items = [new Channel({id: 2}), new Channel({id: 4, name: 'Four'})];
      });

      it('should be the items', function() {
        var json = relation.asJSON();

        expect(json.length).toBe(2);
        expect(json[0].id).toBe('2');
        expect(json[1].id).toBe('4');
        expect(json[1].name).toBe('Four');
      })
    });

    describe('when there is a size', function() {
      beforeEach(function() {
        relation.size = 5;
      });

      it('should be the size', function() {
        expect(relation.asJSON()).toBe(5);
      });
    });
  });

  describe('#create', function() {
    var model, object, adapterOptions, adapterCallback;

    describe('with a model', function() {
      beforeEach(function() {
        model = new Channel({id: 556});
        spyOn(model, 'kept');

        relation = new Relation(Channel, model);
        adapterOptions = adapterCallback = null;

        spyOn(relation.adapter, 'create').and.callFake(function(b,c) {
          adapterOptions = b; adapterCallback = c;
        });

        object = relation.create({_id: 556, name: 'Name value'});
      });

      it('should return the model', function() {
        expect(object instanceof Channel).toBe(true);
        expect(object).toBe(model);
      });

      it('should send the create to the adapter', function() {
        expect(relation.adapter.create).toHaveBeenCalled();
        expect(adapterOptions).toEqual({_id: 556, name: 'Name value'});
      });

      describe('when the adapter succeeds', function() {
        beforeEach(function() {
          adapterCallback(true);
        });

        it('should be loaded', function() {
          expect(relation.loaded).toBe(true);
        });

        it('should keep the promise', function() {
          expect(model.kept).toHaveBeenCalledWith(true);
        });
      });

      describe('when the adapter errors', function() {
        beforeEach(function() {
          adapterCallback(null);
        });

        it('should be loaded', function() {
          expect(relation.loaded).toBe(true);
        });

        it('should keep the promise', function() {
          expect(model.kept).toHaveBeenCalledWith(null);
        });
      });
    });
  });

  describe('#update', function() {
    var model, object, adapterFinder, adapterOptions, adapterCallback;

    describe('for a query', function() {
      var success, error;

      beforeEach(function() {
        success = error = false;

        adapterFinder = adapterOptions = adapterCallback = null;
        spyOn(relation.adapter, 'update').and.callFake(function(a,b,c) {
          adapterFinder = a; adapterOptions = b; adapterCallback = c;
        });

        relation.loaded = true;

        object = relation.update({name: 'Name value'});
        object.then(function(s) {
          success = s;
        }, function() {
          error = true;
        });
      });

      it('should not have the model', function() {
        expect(relation.model).toBeUndefined();
      });

      it('should return the relation', function() {
        expect(object instanceof Relation).toBe(true);
        expect(object).toBe(relation);
      });

      it('should not be loaded', function() {
        expect(relation.loaded).toBe(false);
      });

      it('should update all records', function() {
        expect(relation.adapter.update).toHaveBeenCalled();
        expect(adapterFinder).toEqual({});
        expect(adapterOptions).toEqual({name: 'Name value'});
      });

      describe('when the adapter succeeds', function() {
        beforeEach(function() {
          adapterCallback(true);
        });

        it('should be loaded', function() {
          expect(relation.loaded).toBe(true);
        });

        it('should make the success callback', function() {
          expect(success).toBe(true);
          expect(error).toBe(false);
        });
      });

      describe('when the adapter errors', function() {
        beforeEach(function() {
          adapterCallback(null);
        });

        it('should be loaded', function() {
          expect(relation.loaded).toBe(true);
        });

        it('should make the error callback', function() {
          expect(success).toBe(false);
          expect(error).toBe(true);
        });
      });
    });

    describe('with a model', function() {
      beforeEach(function() {
        model = new Channel({id: 556});
        spyOn(model, 'kept');

        relation = new Relation(Channel, model);
        adapterFinder = adapterOptions = adapterCallback = null;

        spyOn(relation.adapter, 'update').and.callFake(function(a,b,c) {
          adapterFinder = a; adapterOptions = b; adapterCallback = c;
        });

        object = relation.update({name: 'Name value'});
      });

      it('should not have the query', function() {
        expect(relation.query()).toBeNull();
      });

      it('should return the model', function() {
        expect(object instanceof Channel).toBe(true);
        expect(object).toBe(model);
      });

      it('should send the update to the adapter', function() {
        expect(relation.adapter.update).toHaveBeenCalled();
        expect(adapterFinder).toEqual({_id: 556});
        expect(adapterOptions).toEqual({name: 'Name value'});
      });

      describe('when the adapter succeeds', function() {
        beforeEach(function() {
          adapterCallback(true);
        });

        it('should be loaded', function() {
          expect(relation.loaded).toBe(true);
        });

        it('should keep the promise', function() {
          expect(model.kept).toHaveBeenCalledWith(true);
        });
      });

      describe('when the adapter errors', function() {
        beforeEach(function() {
          adapterCallback(null);
        });

        it('should be loaded', function() {
          expect(relation.loaded).toBe(true);
        });

        it('should keep the promise', function() {
          expect(model.kept).toHaveBeenCalledWith(null);
        });
      });
    });
  });
});
