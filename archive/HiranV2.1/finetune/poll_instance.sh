#!/bin/bash
# Poll Vast.ai instance until running
ID="${1:-33786516}"
for i in $(seq 1 30); do
    S=$(vastai show instance "$ID" 2>&1 | tail -1 | awk '{print $3}')
    echo "$(date +%H:%M:%S) [$i] status=$S"
    if [ "$S" = "running" ]; then
        echo "INSTANCE $ID IS READY!"
        vastai ssh-url "$ID"
        exit 0
    fi
    sleep 20
done
echo "TIMEOUT after 10 minutes"
exit 1
