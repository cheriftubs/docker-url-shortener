# Use the official Node.js 16 image as the base image
FROM node:16

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the Lambda function code to the working directory
COPY . .

# Specify the command to run your Lambda function
CMD ["npm", "start"]
