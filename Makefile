all: build minify headerify

build:
	node_modules/browserify/bin/cmd.js lib/index.js --standalone model --exclude mongodb > index.js

minify:
	node_modules/uglify-js/bin/uglifyjs index.js --compress --mangle --stats --output index.min.js

headerify:
	@cat ./lib/header.js
	@cat ./lib/header.js > tmp.js && cat index.js >> tmp.js && mv tmp.js index.js

clean:
	@rm index.js index.min.js

test: build headerify
	@if [ -e ./node_modules/.bin/minijasminenode2 ]; then ./node_modules/.bin/minijasminenode2 --verbose --forceexit **/*_spec.js; else printf "\nMini Jasmine not installed @ ./node_modules/.bin/minijasminenode2...\n\nTrying npm install\n\n" && npm install; fi;
