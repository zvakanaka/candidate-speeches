#!/bin/bash
if [ -z $1 ]; then
  echo "Usage: bash $(basename $0) year"
  exit 1
fi
echo "Getting speeches for year, $1"
sleep 1
for i in $( node app.js $1 ); do
    if [[ $i =~ ^-?[0-9]+$ ]]; then
      echo "Getting speeches for candidate $i"
      sleep 1
      node app.js $1 $i
    fi
done
mkdir candidate-speeches-$1
mv *$1.csv candidate-speeches-$1
