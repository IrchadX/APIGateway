#!/bin/bash
# Ensure log directory exists with correct permissions
LOG_DIR="/app/logs"
mkdir -p "$LOG_DIR"
chmod -R 777 "$LOG_DIR"

# Verify permissions by creating a test file
echo "Testing log directory at $(date)" > "$LOG_DIR/permission_test.log"
cat "$LOG_DIR/permission_test.log"
rm "$LOG_DIR/permission_test.log"

mkdir -p /app/logs
chmod 777 /app/logs

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