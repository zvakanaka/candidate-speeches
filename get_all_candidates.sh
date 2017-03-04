#!/bin/bash
if [ -z $1 ]; then
  echo "Usage: bash $(basename $0) year"
  exit 1
fi
for i in $( node app.js $1 ); do
    if [[ $i =~ ^-?[0-9]+$ ]]; then
      echo "Getting speeches for $i"
      node app.js $1 $i
    fi
done
mkdir candidate-speeches-$1
mv *csv candidate-speeches-$1
