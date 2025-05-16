#!/bin/bash
# Log rotation script for Fluent Bit and application logs

# Load environment variables
source /etc/environment

# Ensure log directory exists
mkdir -p $LOG_DIR
chmod 755 $LOG_DIR

# Function to rotate logs
rotate_logs() {
  local log_file="$1"
  local timestamp=$(date +"%Y%m%d-%H%M%S")
  
  if [ -f "$log_file" ] && [ -s "$log_file" ]; then
    # Compress and rotate the log file
    gzip -c "$log_file" > "${log_file}.${timestamp}.gz"
    > "$log_file" # Truncate the original file
    echo "$(date) - Rotated $log_file to ${log_file}.${timestamp}.gz"
  fi
}

# Function to clean up old logs
cleanup_logs() {
  local log_pattern="$1"
  
  # Delete logs older than MAX_DAYS days
  find "$LOG_DIR" -type f -name "$log_pattern" -mtime +$MAX_DAYS -delete
  
  # Keep only the MAX_LOG_FILES most recent files
  ls -t "$LOG_DIR"/$log_pattern 2>/dev/null | tail -n +$(($MAX_LOG_FILES + 1)) | xargs -r rm -f
}

# Main execution
echo "$(date) - Starting log rotation"

# Rotate Fluent Bit logs
rotate_logs "$LOG_DIR/fluent_all.log"
rotate_logs "$LOG_DIR/fluent_error.log"
rotate_logs "$LOG_DIR/fluent_info.log"
rotate_logs "$LOG_DIR/fluent_warn.log"
 
# Rotate application logs
rotate_logs "$LOG_DIR/application.log"

# Clean up old rotated logs
cleanup_logs "fluent_*.log.*.gz"
cleanup_logs "application.log.*.gz"

echo "$(date) - Log rotation completed"