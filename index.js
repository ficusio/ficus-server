//if (global.v8debug) global.v8debug.Debug.setBreakOnException();

var compiledModulePrefixes = ['koa(?:-[\\w\\d]+)*', 'co-[\\w\\d-]+'];

var ignoreFileRE = new RegExp(
  "node_modules(?!(?:.*/)(?:" + compiledModulePrefixes.join('|') + ")(?:$|/))"
);

require('6to5/register')(ignoreFileRE);

require('./src/app');
