#!/usr/bin/env rhino

var System = java.lang.System;
var TEMAKI_HOME = System.getenv("TEMAKI_HOME");
if (TEMAKI_HOME == null) TEMAKI_HOME = '.';

load(TEMAKI_HOME+"/temaki.js");
Temaki.useDebug = false;
Temaki.print = function (s) { print(s); }

if (arguments.length == 0) {
  print("USAGE> cmd-temaki.js (filename)");
  print("USAGE> cmd-temaki.js -e 'code'");
  quit();
}

var opt = {debug:false, evalmode:false, target:""};
for (var i = 0; i < arguments.length; i++) {
  var s = arguments[i];
  if (s == "-debug" || s == "-d" || s == "debug") {
    opt.debug = true;
  }
  else if (s == "-e" || s == "eval") {
    opt.evalmode = true;
  }
  else {
    if (opt.target == "") {
      opt.target = s;
    } else {
      opt.target += " " + s;
    }
  }
}

if (opt.debug) Temaki.useDebug = true;
if (opt.evalmode) {
  var code = opt.target;
  Temaki.eval(code);
} else {
  var code = readFile(opt.target);
  Temaki.eval(code);
}

// Temaki.eval("5 v set : %v print");
// Temaki.eval("# 5 print\n 3 print");
// Temaki.eval("1 2 3 * + .");
// Temaki.eval("{ %i print } func set : %func 1 5 i for");

