# Define build arguments
ARG NODE_VERSION=20
ARG ALPINE_VERSION=3.19

# Use build arguments in the FROM statement
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION}

# Install build dependencies and Python
RUN apk add --no-cache \
    autoconf \
    automake \
    build-base \
    cairo \
    cairo-dev \
    fontconfig \
    fontconfig-dev \
    freetype \
    freetype-dev \
    g++ \
    giflib \
    giflib-dev \
    harfbuzz \
    jpeg \
    jpeg-dev \
    librsvg \
    libtool \
    make \
    pango \
    pango-dev \
    pixman-dev \
    pkgconfig \
    python3 \
    ttf-dejavu \
    ttf-liberation \
    # Add vips specifically for sharp
    vips \
    vips-dev

# Set environment variables to prefer system libraries
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=0
ENV CANVAS_IGNORE_GLOBAL_GIO=1
ENV NODE_ENV=production

# Create font directories
RUN mkdir -p /usr/share/fonts/truetype/custom

# Copy application fonts (do this before switching to non-root user)
COPY src/app/fonts/* /usr/share/fonts/truetype/custom/
RUN fc-cache -f -v

# Install PM2 only (yarn is already included)
RUN npm install -g pm2

# Create app directory and set permissions
WORKDIR /app
RUN mkdir -p logs && chown -R node:node /app

# Switch to non-root user
USER node

# Install app dependencies
COPY --chown=node:node package*.json ./
# Remove existing lock files to avoid conflicts
RUN rm -f yarn.lock package-lock.json
# Install dependencies and generate new yarn.lock
RUN yarn install

# Copy app source
COPY --chown=node:node . .

# Build the Next.js application
RUN yarn build:prod

# Expose ports
EXPOSE ${PORT} ${PM2_PORT}

# Start PM2 with ecosystem config
CMD ["pm2-runtime", "ecosystem.config.js"] 