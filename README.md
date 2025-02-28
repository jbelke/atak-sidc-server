<p align="center">
<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny" width="480" height="429" viewBox="36 21 160 143"><script xmlns=""/><script xmlns=""/><script xmlns=""/><circle cx="100" cy="100" r="60" stroke-width="4" stroke="black" fill="rgb(128,224,255)" fill-opacity="1"/><path d="m 60,84 40,20 40,-20 0,8 -40,25 -40,-25 z" stroke-width="3" stroke="none" fill="black"/><text x="170" y="50" text-anchor="start" font-size="35" font-family="Arial" font-weight="bold" fill="black">X</text><script xmlns=""/></svg>
</p>

# ATAK SIDC Server

A high-performance server for generating military symbols using SIDC (Symbol Identification Coding Scheme) codes. This server provides a REST API for converting SIDC codes into various formats including SVG, PNG, and 3D models.

## ⚠️ Disclaimer

THIS SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. The authors and contributors make no warranties about the software and disclaim liability for all uses of the software, to the fullest extent permitted by applicable law.

By using this software, you acknowledge that:

- You use it at your own risk
- The authors and contributors are not responsible for any damage or issues that may arise from its use
- No support or maintenance is guaranteed

## 🚀 Features

- Convert SIDC codes to SVG/PNG formats
- Generate 3D models for military symbols
- Support for multiple military symbol standards
- High-performance dual-server setup with PM2
- Dockerized deployment
- Environment-based configuration

## 🗒️ Roadmap

- Generate 3D models for military symbols

## 🛠️ Prerequisites

- Docker
- Docker Compose
- Node.js 20+ (for local development)

## 📦 Quick Start

1. Clone the repository:

```bash
git clone https://github.com/jbelke/atak-sidc-server.git

cd atak-sidc-server
```

2. Create your environment file:

```bash
cp .env.sample .env
```

3. Start the server:

```bash
./start-stop.sh
```

The server will be available at:

- Primary port: http://localhost:8080
- Secondary port: http://localhost:8081

## 🔧 Configuration

All configuration is done through environment variables. Copy `.env.sample` to `.env` and adjust the values as needed:

```env
# Server Configuration
PORT=8080
PM2_PORT=8081

# Node Environment
NODE_ENV=production

# Docker Configuration
DOCKER_IMAGE_NAME=atak-sidc-server
DOCKER_CONTAINER_NAME=atak-sidc-server
DOCKER_NETWORK=atak-network
```

## 🚀 Getting Started

Choose your preferred deployment method from the options below:

### 🐳 Using Docker Compose (Recommended)

    The fastest way to get up and running with production-ready settings:

```bash 
    docker-compose up -d
```

    This will start the service in detached mode. You can check the logs with:

```bash
    docker-compose logs -f
```

    To stop the service:

```bash
    docker-compose down
```

### 📦 Manual Installation

    For more control over the environment and deployment:

```bash
    # Install dependencies
    yarn install

    # Start the service
    yarn dev
```

    This will start the development server on port 8082.

## 📦 Project Structure

The project is organized as follows:

- `src/`: Source code for the API service
- `public/`: Static assets
- `next.config.js`: Configuration for Next.js

## 🔑 API Endpoints

The API provides the following endpoints:

### 📄 Generate Symbol

Generate a military symbol in the specified format.

**Endpoint:**

http://localhost:8080/api/APP6/10133000001207000000.jpg?size=500
http://localhost:8080/api/APP6/10133000001207000000.png?size=500
http://localhost:8080/api/APP6/10133000001207000000.gif?size=500
http://localhost:8080/api/APP6/10133000001207000000.webp?size=500
http://localhost:8080/api/APP6/10133000001207000000.avif?size=500
http://localhost:8080/api/APP6/10133000001207000000.svg?size=500
http://localhost:8080/api/APP6/10133000001207000000.gif?size=500

**Parameters:**

- `symbol`: The symbol to generate (e.g., `10133000001207000000`)
- `format`: The output format (e.g., `svg`, `png`, `jpg`, `gif`, `webp`, `avif`)
- `size`: The size of the output image (e.g., `500`)

> Note: The symbol is the last 14 digits of the SIDC.

## ☕ Buy Me a Coffee

If you find this project helpful and want to support its development, you can buy me a coffee!

[<img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="200">](https://www.buymeacoffee.com/jbelke)
