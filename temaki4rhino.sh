#!/bin/sh
DIRNAME=`dirname $0`
CLASSPATH=.:${DIRNAME}/jar/js.jar:${CLASSPATH}

java \
  -Dfile.encoding=UTF-8 \
  -cp ${CLASSPATH} \
  org.mozilla.javascript.tools.shell.Main $*
 

