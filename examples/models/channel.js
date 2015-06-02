Channel = Document.progeny('Channel', {
}, {
  classMethods: {
    attrs: {
      String: { name: 'n', slug: 's', token: 't' },
      Integer: { buffered: 'bu', capped: 'c'}
    },
    allow: ['name', 'slug', 'token', 'buffered'],
    validate: {
      presence: ['name'],
      format: { slug: /^#\w+/ }
    },
    beforeCreate: [
      function() { this.set('token', 'C-'+(Math.random()*10000000)) }
    ]
  }
});

module.exports = Channel;
