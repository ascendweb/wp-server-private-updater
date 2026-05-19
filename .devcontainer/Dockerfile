FROM node:24-slim

RUN apt-get update && apt-get install -y \
    postgresql-client \
    git \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=development
