#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="noora-health-frontend:latest"
CONTAINER_NAME="noora-health-frontend"

echo "Building Docker image: ${IMAGE_NAME} ..."
docker build -t "${IMAGE_NAME}" .

echo "Stopping and removing any existing container named ${CONTAINER_NAME} (if present)..."
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}\$"; then
  docker rm -f "${CONTAINER_NAME}"
fi

echo "Stopping and removing any containers created from image ${IMAGE_NAME} (if present)..."
CONTAINERS_FROM_IMAGE="$(docker ps -a --filter "ancestor=${IMAGE_NAME}" -q || true)"
if [ -n "${CONTAINERS_FROM_IMAGE}" ]; then
  docker rm -f ${CONTAINERS_FROM_IMAGE}
fi

echo "Running container ${CONTAINER_NAME} from image ${IMAGE_NAME} on host port 3000..."
docker run --name "${CONTAINER_NAME}" -p 3000:80 "${IMAGE_NAME}"


