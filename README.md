# document.js

[![Circle CI](https://circleci.com/gh/bnorton/document.js.svg?style=svg)](https://circleci.com/gh/bnorton/document.js)  
[![npm version](https://badge.fury.io/js/document.js.svg)](http://badge.fury.io/js/document.js)

#Getting started

###Install it
```bash
$ npm install document.js
```

###Require it
```javascript
var Document = require('document.js');
```

###Use it
```javascript
Channel = Document.progeny('Channel', {
}, {
  classMethods: {
    fields: {
      String: { slug: 's', name: 'n', token: 't' },
      Date: { firstMessageAt: 'fma' },
      Integer: { keepAlive: 'ka', buffered: 'b', capped: 'c' },
      Object: { info: 'i' }
    },
    belongsTo: ['user'],
    // hasMany: ['messages'], TODO
    allow: ['name', 'token', 'userId', 'firstMessageAt', 'buffered', 'capped'],
    validate: {
      presence: ['name', 'userId'],
      format: { slug: /^#\w{4,16}/ },
      custom: [
        function() { return Object.keys(this.get('info')).length > 0 }
      ]
    },
    beforeCreate: [
      function() {
        this.set('token', '{{random token generator}}');
      }
    ]
  }
});
```
For the full API see the [document definition](https://github.com/bnorton/document.js/wiki/document-definition) docs.
