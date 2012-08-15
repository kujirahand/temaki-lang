#!/bin/sh
DIRNAME=`dirname $0`
export TEMAKI_HOME=${DIRNAME}

${DIRNAME}/rhino.sh \
  cmd-temaki.js \
  $*

