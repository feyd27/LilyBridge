# Use an official Node.js image. This also sets your Node.js version.
FROM node:20-slim

# Set the working directory inside the container
WORKDIR /app

# Install the system dependencies your app needs (like rustc)
# We run this first to leverage Docker's layer caching.
RUN apt-get update && apt-get install -y rustc build-essential

# Copy the package.json and package-lock.json files for both root and backend
# This allows us to install dependencies efficiently in the next step.
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install all npm dependencies for the backend
RUN cd backend && npm ci

# Copy the rest of your application code
COPY . .

# Set the command to run your application
CMD [ "npm", "start", "--prefix", "backend" ]