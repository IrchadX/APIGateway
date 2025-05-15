#!/bin/bash
# Startup script for Fluent Bit and NestJS application

# Load environment variables
source /etc/environment

# Ensure log directory exists
mkdir -p $LOG_DIR
chmod 755 $LOG_DIR

# Start cron service for log rotation
service cron start
tail -f /var/log/cron.log &

# Function to check if a process is running
check_process() {
  if ! ps -p $1 > /dev/null; then
    return 1
  fi
  return 0
}

# Start Fluent Bit
start_fluent_bit() {
  echo "$(date) - Starting Fluent Bit..."
  /opt/fluent-bit/bin/fluent-bit -c /fluent-bit/etc/fluent-bit.conf &
  FLUENT_PID=$!
  sleep 3
  if ! check_process $FLUENT_PID; then
    echo "$(date) - ERROR: Fluent Bit failed to start"
    return 1
  fi
  echo "$(date) - Fluent Bit started successfully (PID: $FLUENT_PID)"
  return 0
}

# Start NestJS application
start_application() {
  echo "$(date) - Starting NestJS application..."
  cd /usr/src/app
  
  # Regenerate Prisma client to ensure compatibility
  npx prisma generate
  
  node dist/src/main.js &
  APP_PID=$!
  sleep 3
  if ! check_process $APP_PID; then
    echo "$(date) - ERROR: Application failed to start"
    return 1
  fi
  echo "$(date) - Application started successfully (PID: $APP_PID)"
  return 0
}

# Initial startup
start_fluent_bit
start_application

# Monitoring loop
while true; do
  # Check Fluent Bit
  if ! check_process $FLUENT_PID; then
    echo "$(date) - Fluent Bit stopped, restarting..."
    start_fluent_bit
  fi
  
  # Check Application
  if ! check_process $APP_PID; then
    echo "$(date) - Application stopped, restarting..."
    start_application
  fi
  
  # Run log rotation check hourly
  if [ "$(date +%M)" == "00" ]; then
    /usr/local/bin/rotate-logs >> $LOG_DIR/rotation.log 2>&1
  fi
  
  sleep 30
done