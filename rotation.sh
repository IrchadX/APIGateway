#!/bin/bash
# This script handles log rotation for Fluent Bit logs
# It should be run by cron or another scheduler

# Configuration
LOG_DIR="/logs"
MAX_LOG_FILES=5
MAX_DAYS=7

# Rotate Fluent Bit logs
rotate_logs() {
  local log_file="$1"
  local timestamp=$(date +"%Y%m%d-%H%M%S")
  
  if [ -f "$log_file" ] && [ -s "$log_file" ]; then
    cp "$log_file" "${log_file}.${timestamp}"
    echo "" > "$log_file"
    echo "Rotated $log_file to ${log_file}.${timestamp}"
  fi
}

# Clean up old log files
cleanup_logs() {
  local log_pattern="$1"
  
  # Delete logs older than MAX_DAYS days
  find "$LOG_DIR" -type f -name "$log_pattern" -mtime +$MAX_DAYS -delete
  
  # Keep only the MAX_LOG_FILES most recent files
  ls -t "$LOG_DIR"/$log_pattern | tail -n +$((MAX_LOG_FILES + 1)) | xargs -r rm
}

# Main execution
echo "Starting log rotation at $(date)"

# Rotate all Fluent Bit logs
rotate_logs "$LOG_DIR/fluent_all.log"
rotate_logs "$LOG_DIR/fluent_error.log"
rotate_logs "$LOG_DIR/fluent_info.log"
rotate_logs "$LOG_DIR/fluent_warn.log"

# Rotate application logs
rotate_logs "$LOG_DIR/application.log"

# Clean up old rotated logs
cleanup_logs "fluent_*.log.*"
cleanup_logs "application.log.*"

echo "Log rotation completed at $(date)"