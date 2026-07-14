#!/bin/bash
# Setup script — ensures .env exists and DB is initialized.
# Run automatically by `bun run dev` if .env is missing.

set -e
cd "$(dirname "$0")/.."

# 1. If .env doesn't exist, create it from .env.example (or minimal template)
if [ ! -f .env ]; then
  echo "[setup] .env not found — creating from .env.example"
  if [ -f .env.example ]; then
    cp .env.example .env
  else
    # Minimal .env if .env.example is also missing
    cat > .env << 'EOF'
DATABASE_URL=file:./db/custom.db
ADMIN_PASSWORD=WARDEN
EOF
  fi
  echo "[setup] Created .env — edit it to add your Supabase credentials."
fi

# 2. Ensure db/ directory exists
mkdir -p db

# 3. If DATABASE_URL is the relative default, convert to absolute path
# (Prisma sometimes has issues with relative paths)
DB_URL=$(grep -E "^DATABASE_URL=" .env | cut -d= -f2- | tr -d '"' | tr -d "'")
if echo "$DB_URL" | grep -q "^file:./"; then
  # Relative path → make absolute
  REL_PATH="${DB_URL#file:}"
  ABS_PATH="$(cd "$(dirname "$REL_PATH")" 2>/dev/null && pwd)/$(basename "$REL_PATH")"
  sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=file:$ABS_PATH|" .env
  rm -f .env.bak
  echo "[setup] Converted DATABASE_URL to absolute path: file:$ABS_PATH"
fi

# 4. Generate Prisma client
echo "[setup] Running prisma generate..."
bunx prisma generate 2>/dev/null || npx prisma generate 2>/dev/null || true

# 5. Push schema to DB
echo "[setup] Running prisma db push..."
bunx prisma db push 2>/dev/null || npx prisma db push 2>/dev/null || true

echo "[setup] Done."
