#!/bin/sh
set -eu

cli=${1:-build/cb_cli}

for lines in 1000 2000 4000 8000; do
    printf 'lines=%s ' "$lines"
    awk -v count="$lines" 'BEGIN {
        for (i = 0; i < count; i++) {
            print "const value" i " = call(arg" i ");"
        }
    }' | /usr/bin/time -p "$cli" javascript >/dev/null
done
