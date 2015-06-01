all: build headerify

build:
	@cat lib/index.js > index.js

headerify:
	@cat ./lib/header.js
	@cat ./lib/header.js > tmp.js && cat index.js >> tmp.js && mv tmp.js index.js

clean:
	@rm index.js

test: build
	@if [ -e ./node_modules/.bin/minijasminenode2 ]; then ./node_modules/.bin/minijasminenode2 --verbose --forceexit **/*_spec.js; else printf "\nMini Jasmine not installed @ ./node_modules/.bin/minijasminenode2...\n\nTrying npm install\n\n" && npm install; fi;
