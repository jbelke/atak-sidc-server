#!/bin/bash
set -a
source .env
set +a
docker exec ${DOCKER_CONTAINER_NAME} pm2 $@ 