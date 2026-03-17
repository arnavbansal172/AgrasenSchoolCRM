#!/bin/bash

# Configuration
DATA_DIR="./backend/data"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="SAVM_Backup_$TIMESTAMP.tar.gz"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "📦 Starting school data backup..."

# Create compressed archive
if [ -d "$DATA_DIR" ]; then
    tar -czf "$BACKUP_DIR/$BACKUP_NAME" "$DATA_DIR"
    echo "✅ Backup completed successfully!"
    echo "📄 Saved as: $BACKUP_DIR/$BACKUP_NAME"
    
    # Optional: Keep only last 30 backups to save space
    ls -t "$BACKUP_DIR"/*.tar.gz | tail -n +31 | xargs -r rm
    echo "🧹 Cleaned old backups (keeping last 30)."
else
    echo "❌ Error: Data directory $DATA_DIR not found."
    exit 1
fi
