# Use an official Node.js runtime as a parent image
FROM node:18

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app's code into the container
COPY . .

ENV PORT=${PORT:-5000}

# Expose the port your app runs on (default: 5000)
EXPOSE $PORT

# Define the command to run your app
CMD ["npm", "start"]