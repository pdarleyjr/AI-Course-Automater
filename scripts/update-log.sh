#!/bin/bash
# Shell script to update the project log

if [ $# -lt 2 ]; then
    echo "Usage: $0 <entry_type> <entry_title> [entry_content]"
    exit 1
fi

ENTRY_TYPE="$1"
ENTRY_TITLE="$2"
ENTRY_CONTENT="$3"

# Get current date
DATE=$(date +"%Y-%m-%d")
LOG_FILE="$(dirname "$0")/../PROJECT_LOG.md"

# Check if the date section already exists
if grep -q "## $DATE" "$LOG_FILE"; then
    echo -e "\033[0;36mDate section already exists. Adding entry under existing date.\033[0m"
    
    # Prepare the new entry
    NEW_ENTRY="\n### $ENTRY_TITLE\n\n"
    if [ -n "$ENTRY_CONTENT" ]; then
    # Replace \n with actual newlines
    FORMATTED_CONTENT=$(echo -e "$ENTRY_CONTENT")
        NEW_ENTRY+="$FORMATTED_CONTENT\n"
    fi
    
    # Insert the new entry after the date header
    sed -i.bak "s/## $DATE/## $DATE\n$NEW_ENTRY/" "$LOG_FILE"
    rm "${LOG_FILE}.bak"
else
    echo -e "\033[0;36mCreating new date section and adding entry.\033[0m"
    
    # Prepare the new date section and entry
    NEW_SECTION="\n## $DATE\n\n### $ENTRY_TITLE\n\n"
    if [ -n "$ENTRY_CONTENT" ]; then
    # Replace \n with actual newlines
    FORMATTED_CONTENT=$(echo -e "$ENTRY_CONTENT")
        NEW_SECTION+="$FORMATTED_CONTENT\n"
    fi
    
    # Find the position to insert the new section (before Tasks Backlog)
    if grep -q "## Tasks Backlog" "$LOG_FILE"; then
        sed -i.bak "/## Tasks Backlog/i\\$NEW_SECTION" "$LOG_FILE"
        rm "${LOG_FILE}.bak"
    else
        # If no Tasks Backlog section, append to the end of the file
        echo -e "$NEW_SECTION" >> "$LOG_FILE"
    fi
fi

echo -e "\033[0;32mProject log updated successfully!\033[0m"
echo -e "\033[0;32mAdded '$ENTRY_TITLE' under '$ENTRY_TYPE' for $DATE\033[0m"