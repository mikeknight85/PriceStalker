#!/bin/sh
set -eu

# Named Docker volumes are mounted after the image is built and therefore start
# as root-owned. Repair the two writable mounts before dropping privileges.
for directory in /app/backend/logs /app/backend/debug_html; do
  mkdir -p "$directory"
  chown -R node:node "$directory"
done

exec setpriv --reuid=node --regid=node --init-groups "$@"
