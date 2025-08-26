# Use Node.js 18 LTS as base image
FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
# Using npm install to avoid lockfile mismatch errors during CI/build
RUN npm install --omit=dev

# Copy source code
COPY . .

# Create directory for database
RUN mkdir -p /app/data

# Expose port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/database.db

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the application
CMD ["npm", "start"]

