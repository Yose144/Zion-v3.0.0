FROM node:22-slim

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy source
COPY . .

# Create data directories
RUN mkdir -p /app/data/releases

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

# Start server
CMD ["node", "server.js"]
