#!/bin/sh

DIR="$( cd "$( dirname "$0" )" && pwd )"

LIB=$DIR/../target/lib

if [ ! -d $LIB ]; then
    echo "lib directory not found, did you run \`mvn package\`?";
    exit 1;
fi

CLASSPATH=''

for jarfile in `find $LIB -type f -name "*.jar"`; do CLASSPATH=$CLASSPATH:$jarfile; done

java -cp $CLASSPATH accumulo/AmqpWebAnalytics
