#!/usr/bin/env node

const temaki = require('./temaki.js');
const argv = process.argv;
const engine = argv.shift();
const script_exec = argv.shift();
const script = argv.shift();

if (script === undefined) {
  console.log('[USAGE] temaki (script)');
  process.exit();
}

const fs = require('fs');
const src = fs.readFileSync(script, "utf-8");

temaki.print = function (s) {
  console.log(s);
};

temaki.eval(src);

