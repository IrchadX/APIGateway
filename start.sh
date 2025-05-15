#!/bin/bash
# Make sure log directory exists and has proper permissions
mkdir -p /logs
chmod 777 /logs

# Start Fluent Bit in the background
/fluent-bit/bin/fluent-bit -c /fluent-bit/etc/fluent-bit.conf &
FLUENT_PID=$!

# Wait a moment to ensure Fluent Bit is up
sleep 3

# Check if Fluent Bit started successfully
if ! kill -0 $FLUENT_PID 2>/dev/null; then
  echo "Fluent Bit failed to start. Exiting..."
  exit 1
fi

echo "Fluent Bit started successfully."
echo "Log files will be written to /logs directory"

# Start the NestJS application
cd /app
node dist/src/main.js