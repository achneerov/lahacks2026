#!/bin/bash
# Deletes all users except the 6 seeded ones (IDs 1-6).
# Related data in other tables cascades automatically.

DB="$(dirname "$0")/backend/db/app.db"

COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM users WHERE id > 6;")
sqlite3 "$DB" "DELETE FROM users WHERE id > 6;"

echo "Deleted $COUNT non-seed user(s)."
