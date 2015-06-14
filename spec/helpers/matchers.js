(function() {
  expectToBeNow = function(actual) {
    if(!actual)
      throw new Error('Expected to be given a date-like object');

    var ms = Math.abs((new Date().getTime() - new Date(actual).getTime()));

    if(ms > 50) {
      throw new Error('Expected '+actual+' to be withing 50ms of *now* but was '+ms+'ms');
    }
  };
})();
