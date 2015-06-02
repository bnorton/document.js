module.exports = function(klass, extras) {
  describe(klass.className, function() {
    var adapter, channelA, channelB, withRecords = function(done) {
      adapter.create({_id: 123, name: 'Channel A', buffered: 400}, function(r) {
        channelA = r; adapter.create({_id: 456, name: 'Channel B', buffered: 400}, function(rr) {
          channelB = rr; done();
        });
      });
    };

    extras && extras.call(this);

    beforeEach(function() {
      channelA = channelB = null;
    });

    afterEach(function(done) {
      adapter.clear(done);
    });

    it('connects', function(done) {
      klass.connect(function() {
        adapter = new klass('Channel');
        adapter.clear(done);
      });
    });

    describe('#count', function() {
      it('should be zero', function(done) {
        adapter.count(function(count) {
          expect(count).toBe(0); done();
        });
      });

      describe('with records', function() {
        beforeEach(withRecords);

        describe('on success', function() {
          var number;

          beforeEach(function(done) {
            adapter.count(function(count) {
              number = count;
              done();
            });
          });

          it('should be the count', function() {
            expect(number).toBe(2);
          });
        });
      });
    });

    describe('#create', function() {
      beforeEach(function(done) {
        adapter.create({_id: 667, name: 'Channel 667'}, done);
      });

      it('should add the record to the store', function(done) {
        adapter.count(function(count) {
          expect(count).toBe(1); done();
        });
      });

      it('should add the records to the store', function(done) {
        adapter.create({_id: 778}, function(r) {
          expect(r._id).toBe(778);

          adapter.count(function(count) {
            expect(count).toBe(2); done();
          });
        });
      });
    });

    describe('#update', function() {
      describe('with records', function() {
        beforeEach(withRecords);

        it('should update the single record in the store', function(done) {
          adapter.update({_id: 123}, {name: 'newish name'}, function() {
            adapter.where({_id: 123}, function(items) {
              expect(items.length).toBe(1);
              expect(items[0]._id).toBe(123);
              expect(items[0].name).toBe('newish name'); done();
            });
          });
        });

        it('should update the many records record in the store', function(done) {
          adapter.update({buffered: 400}, {name: 'newish name'}, function() {
            adapter.where({buffered: 400}, function(items) {
              expect(items.length).toBe(2);
              expect(items[0]._id).toBe(123);
              expect(items[0].name).toBe('newish name');
              expect(items[1]._id).toBe(456);
              expect(items[1].name).toBe('newish name'); done();
            });
          });
        });
      });
    });

    describe('#remove', function() {
      beforeEach(withRecords);

      describe('via count', function() {
        beforeEach(function(done) {
          adapter.count(function(count) {
            expect(count).toBe(2); done();
          });
        });

        it('should remove the model', function(done) {
          adapter.remove(channelA, function() {
            adapter.count(function(count) {
              expect(count).toBe(1);

              adapter.remove(channelB, function() {
                adapter.count(function(count) {
                  expect(count).toBe(0); done();
                });
              });
            });
          });
        });
      });

      describe('via where', function() {
        beforeEach(function(done) {
          adapter.where({_id: channelA._id}, function(items) {
            expect(items).toEqual([channelA]); done();
          });
        });

        it('should not find the model', function(done) {
          adapter.remove(channelA, function() {
            adapter.where({_id: channelA._id}, function(items) {
              expect(items).toEqual([]); done();
            });
          });
        });
      });
    });

    describe('#first', function() {
      it('should not have the result', function(done) {
        adapter.first(function(item) {
          expect(item).toBe(null); done();
        });
      });

      describe('with records', function() {
        beforeEach(withRecords);

        it('should have the result', function(done) {
          adapter.first(function(item) {
            expect(item._id).toBe(channelA._id); done();
          });
        });
      });
    });

    describe('#last', function() {
      it('should not have the result', function(done) {
        adapter.first(function(item) {
          expect(item).toBe(null); done();
        });
      });

      describe('with records', function() {
        beforeEach(withRecords);

        it('should have the result', function(done) {
          adapter.last(function(item) {
            expect(item._id).toBe(channelB._id); done();
          });
        });
      });
    });

    describe('#where', function() {
      it('should be empty', function(done) {
        adapter.where({_id: 123}, function(items) {
          expect(items).toEqual([]); done();
        });
      });

      describe('with records', function() {
        beforeEach(withRecords);

        it('finds record A', function(done) {
          adapter.where({_id: 123}, function(items) {
            expect(items).toEqual([channelA]); done();
          });
        });

        it('finds record B', function(done) {
          adapter.where({_id: 456}, function(items) {
            expect(items).toEqual([channelB]); done();
          });
        });

        it('should have all matches', function(done) {
          adapter.where({buffered: 400}, function(items) {
            expect(items).toEqual([channelA, channelB]); done();
          });
        });

        it('should return multiple scoped matches', function(done) {
          adapter.where({_id: 456, buffered: 400}, function(items) {
            expect(items).toEqual([channelB]); done();
          });
        });
      });
    });

    describe('#clear', function() {
      it('should be zero', function(done) {
        adapter.count(function(count) {
          expect(count).toBe(0); done();
        });
      });

      describe('with records', function() {
        beforeEach(withRecords);

        describe('via count', function() {
          beforeEach(function(done) {
            adapter.count(function(count) {
              expect(count).toBe(2); done();
            });
          });

          it('should be zero', function(done) {
            adapter.clear(function() {
              adapter.count(function(count) {
                expect(count).toBe(0); done();
              });
            });
          });
        });
      });
    });

    it('disconnects', function(done) {
      klass.disconnect(done);
    });
  });
};
