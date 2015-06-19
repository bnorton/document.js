var Channel = Document.progeny('Channel', {
  displayName: function() {
    return 'Channel: '+this.get('name');
  }
}, {
  classMethods: {
    fields: {
      String: { name: 'n', slug: 's', token: 't' },
      Integer: { buffered: 'bu', capped: 'c'}
    },
    belongsTo: ['user'],
    allow: ['name', 'user_id', 'slug', 'token', 'buffered'],
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
