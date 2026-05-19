#!/usr/bin/env bash
set -e

echo "Installing dependencies..."
npm install

echo "Generating Prisma client..."
npx prisma generate

echo "Waiting for database..."
until pg_isready -U postgres 2>/dev/null; do
  sleep 1
done

echo "Pushing schema to database..."
npx prisma db push

echo "Seeding admin user..."
npx tsx prisma/seed.ts

echo ""
echo "========================================="
echo "  Dev environment ready!"
echo "  Run: npm run dev"
echo "  Open: http://localhost:3000"
echo "  Login: admin@example.com / changeme"
echo "========================================="
