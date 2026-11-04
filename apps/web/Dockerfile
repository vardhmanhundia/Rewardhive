FROM node:20-alpine

WORKDIR /app/apps/web

# Build context is the repo root so shared/ is available.
# Copy package files
COPY apps/web/package*.json ./

# Install dependencies
RUN npm install

# Copy application code and shared data, preserving the repo layout so
# tsconfig/vite path aliases (../../shared) resolve correctly.
COPY apps/web/ ./
COPY shared/ /app/shared/

# Expose port
EXPOSE 3000

# Set API URL (can be overridden at runtime)
ENV VITE_API_URL=http://localhost:8000

# Run dev server with hot-reload
CMD ["npm", "run", "dev"]
