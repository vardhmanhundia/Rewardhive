FROM node:20-alpine

WORKDIR /app

# Build context is the repo root so shared/ is available.
# Copy package files
COPY apps/web/package*.json ./

# Install dependencies
RUN npm install

# Copy application code and the shared package (under the app root so its
# imports resolve against the app's node_modules)
COPY apps/web/ ./
COPY shared/ ./shared/

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Set API URL (can be overridden at runtime)
ENV VITE_API_URL=http://localhost:8000

# Run preview server
CMD ["npm", "run", "preview"]
