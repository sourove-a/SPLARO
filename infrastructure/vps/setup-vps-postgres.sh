#!/bin/bash
# SPLARO VPS — harden local PostgreSQL (backup mirror; live app uses Supabase)
# Run once as root: bash infrastructure/vps/setup-vps-postgres.sh

set -euo pipefail

CRED_FILE="/root/.splaro-db-cred"
CONF_DROPIN="/etc/postgresql/14/main/conf.d/splaro-tuning.conf"

log() { echo "[vps-postgres] $*"; }

[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }

if [ ! -f "$CRED_FILE" ]; then
  DBPASS="$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)"
  cat > "$CRED_FILE" <<EOF
DBUSER=splaro
DBNAME=splaro_db
DBPASS=$DBPASS
EOF
  chmod 600 "$CRED_FILE"
  log "Created $CRED_FILE"
fi

# shellcheck disable=SC1090
source "$CRED_FILE"
DBUSER="${DBUSER:-splaro}"
DBNAME="${DBNAME:-splaro_db}"
DBPASS="${DBPASS:?missing DBPASS in cred file}"

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DBUSER') THEN
    CREATE ROLE $DBUSER LOGIN PASSWORD '$DBPASS';
  ELSE
    ALTER ROLE $DBUSER PASSWORD '$DBPASS';
  END IF;
END \$\$;
SELECT 'CREATE DATABASE $DBNAME OWNER $DBUSER'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DBNAME')\\gexec
GRANT ALL PRIVILEGES ON DATABASE $DBNAME TO $DBUSER;
SQL

mkdir -p "$(dirname "$CONF_DROPIN")"
cat > "$CONF_DROPIN" <<'EOF'
# SPLARO VPS — local PostgreSQL (backup mirror only, 127.0.0.1)
listen_addresses = '127.0.0.1'
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1536MB
work_mem = 8MB
maintenance_work_mem = 128MB
wal_buffers = 16MB
checkpoint_completion_target = 0.9
random_page_cost = 1.1
effective_io_concurrency = 200
log_min_duration_statement = 1000
EOF

systemctl restart postgresql
log "PostgreSQL tuned and restarted (local only)"

mkdir -p /opt/splaro/backups /var/log/splaro
chmod 700 /opt/splaro/backups

log "Local DB: $DBUSER@127.0.0.1/$DBNAME"
log "Live app stays on Supabase — use backup-database.sh for daily sync"
