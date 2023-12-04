# We don't want to start from scratch.
# That is why we tell node here to use the current node image as base.
FROM node:16 AS development

# The /app directory should act as the main application directory
WORKDIR /node

# Copy the app package and package-lock.json file
COPY package*.json ./

# Install node packages
RUN npm install

# Copy or project directory (locally) in the current directory of our docker image (/app)
COPY . .

EXPOSE $PORT

# Set host to localhost / the docker image
ENV NUXT_HOST=0.0.0.0

# Set app port
ENV NUXT_PORT=$PORT

# Start the app
CMD [ "npm", "start" ]