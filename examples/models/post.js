var Post = Document.progeny('Post', {
}, {
  classMethods: {
    belongsTo: ['user'],
    allow: ['user', 'user_id']
  }
});

module.exports = Post;
