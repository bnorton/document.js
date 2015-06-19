var User = Document.progeny('User', {
  name: function() {
    var first = this.get('firstName'),
      last = this.get('lastName');

    return last ? (first + ' ' + last) : first;
  }
}, {
  classMethods: {
    fields: {
      String: { firstName: 'fn', lastName: 'ln', email: 'e' }
    },
    allow: ['email', 'name'],
    validate: {
      presence: ['email'],
      format: { email: /.+@.+\..{2,3}/ }
    }
  }
});

module.exports = User;
