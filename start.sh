#!/bin/bash

#!/bin/bash
# Add this at the beginning of your start.sh script

# Debugging logging
echo "==== DEBUGGING INFORMATION ===="
echo "Current user: $(whoami)"
echo "Current directory: $(pwd)"
echo "LOG_DIR value: $LOG_DIR"
echo "Checking log directory permission and existence"
mkdir -p ${LOG_DIR}
chmod 777 ${LOG_DIR}
ls -la ${LOG_DIR}
echo "Testing log file creation..."
touch ${LOG_DIR}/test_file.log
if [ $? -eq 0 ]; then
  echo "Successfully created test file"
  cat "Test content" > ${LOG_DIR}/test_file.log
  echo "Written test content to file"
  cat ${LOG_DIR}/test_file.log
  echo "File content displayed successfully"
  rm ${LOG_DIR}/test_file.log
else
  echo "Failed to create test file"
fi
echo "============================="
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