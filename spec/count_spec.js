require('./helpers/spec_helper');

var Count = require('../lib/count');

describe(Count.className, function() {
  var count, relation;

  beforeEach(function() {
    count = new Count(relation = jasmine.createSpy('Relation'));
  });

  it('should have the relation', function() {
    expect(count.relation).toBe(relation);
  });

  it('should not have the count', function() {
    expect(count.count).toBeNull();
  });

  it('should not be loaded', function() {
    expect(count.loaded).toBe(false);
  });

  describe('when the promise is kept', function() {
    it('should set the count', function() {
      count.kept(94);

      expect(count.count).toBe(94);
    });

    describe('promise api', function() {
      var result;

      beforeEach(function() {
        result = -1;
      });

      describe('once kept successfully', function() {
        beforeEach(function() {
          count.then(function(r) {
            result = r;
          });

          count.kept(55);
        });

        it('should have loaded', function() {
          expect(count.loaded).toBe(true);
        });

        it('should have the count', function() {
          expect(count.count).toBe(55);
        });

        it('should call success', function() {
          expect(result).toBe(55);
        });

        it('calls additional callbacks immediately', function(done) {
          count.then(function(other) {
            expect(other).toBe(55); done();
          });
        });
      });

      describe('once kept erroneously', function() {
        var errored;

        beforeEach(function() {
          errored = false;

          count.then(function(r) {
            result = r;
          }, function() {
            errored = true;
          });

          count.kept(null);
        });

        it('should have loaded', function() {
          expect(count.loaded).toBe(true);
        });

        it('should not have the count', function() {
          expect(count.count).toBeNull();
        });

        it('should not call the success', function() {
          expect(result).toBe(-1);
        });

        it('should call the error', function() {
          expect(errored).toBe(true);
        });

        it('calls additional callbacks immediately', function(done) {
          count.then(function() {}, done);
        });
      });
    });
  });

  describe('#loaded', function() {
    it('should not be loaded', function() {
      expect(count.loaded).toBe(false);
    });

    describe('when the promise has been kept', function() {
      beforeEach(function() {
        count.kept(1);
      });

      it('should be loaded', function() {
        expect(count.loaded).toBe(true);
      });
    });
  });
});
