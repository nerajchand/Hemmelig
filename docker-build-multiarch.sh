#!/bin/bash

# Multi-architecture Docker build script for Hemmelig
# This script builds Docker images for both AMD64 and ARM64 architectures

set -e

# Default values
IMAGE_NAME="${IMAGE_NAME:-hemmelig}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
REGISTRY="${REGISTRY:-}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
PUSH="${PUSH:-false}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Building multi-architecture Docker image${NC}"
echo -e "Image: ${GREEN}${IMAGE_NAME}:${IMAGE_TAG}${NC}"
echo -e "Platforms: ${GREEN}${PLATFORMS}${NC}"
echo ""

# Check if buildx is available
if ! docker buildx version &> /dev/null; then
    echo -e "${YELLOW}Warning: docker buildx not found. Installing...${NC}"
    docker buildx install || {
        echo "Error: Could not install docker buildx. Please install it manually."
        exit 1
    }
fi

# Create a new builder instance if it doesn't exist
BUILDER_NAME="hemmelig-multiarch-builder"
if ! docker buildx inspect "$BUILDER_NAME" &> /dev/null; then
    echo -e "${BLUE}Creating new buildx builder: ${BUILDER_NAME}${NC}"
    docker buildx create --name "$BUILDER_NAME" --use --bootstrap
else
    echo -e "${BLUE}Using existing buildx builder: ${BUILDER_NAME}${NC}"
    docker buildx use "$BUILDER_NAME"
fi

# Get Git information for build args
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_TAG=$(git describe --tags --exact-match 2>/dev/null || echo "")

echo -e "${BLUE}Git SHA: ${GREEN}${GIT_SHA}${NC}"
if [ -n "$GIT_TAG" ]; then
    echo -e "${BLUE}Git Tag: ${GREEN}${GIT_TAG}${NC}"
fi
echo ""

# Build the image
FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"
if [ -n "$REGISTRY" ]; then
    FULL_IMAGE_NAME="${REGISTRY}/${FULL_IMAGE_NAME}"
fi

echo -e "${BLUE}Building image: ${GREEN}${FULL_IMAGE_NAME}${NC}"
echo ""

# Build arguments
BUILD_ARGS="--platform ${PLATFORMS}"
BUILD_ARGS="${BUILD_ARGS} --build-arg GIT_SHA=${GIT_SHA}"
if [ -n "$GIT_TAG" ]; then
    BUILD_ARGS="${BUILD_ARGS} --build-arg GIT_TAG=${GIT_TAG}"
fi

# Check if building for a single platform (for local loading)
SINGLE_PLATFORM=false
if [[ "$PLATFORMS" != *","* ]]; then
    SINGLE_PLATFORM=true
fi

# Add --push if PUSH is true, or --load if single platform and not pushing
if [ "$PUSH" = "true" ]; then
    BUILD_ARGS="${BUILD_ARGS} --push"
    echo -e "${YELLOW}Will push to registry after build${NC}"
elif [ "$SINGLE_PLATFORM" = "true" ]; then
    BUILD_ARGS="${BUILD_ARGS} --load"
    echo -e "${YELLOW}Building for single platform - image will be loaded locally${NC}"
else
    # For multi-arch builds, we can't use --load, so we'll just build without loading
    # The image will be available in the buildx cache
    echo -e "${YELLOW}Note: Multi-arch images cannot be loaded locally with --load.${NC}"
    echo -e "${YELLOW}The image will be built and cached. To push to registry, set PUSH=true${NC}"
    echo -e "${YELLOW}For local testing, build for a single platform:${NC}"
    echo -e "${YELLOW}  PLATFORMS=linux/amd64 ./docker-build-multiarch.sh${NC}"
fi

# Execute the build
docker buildx build \
    $BUILD_ARGS \
    -t "${FULL_IMAGE_NAME}" \
    -f Dockerfile \
    .

echo ""
echo -e "${GREEN}✓ Build complete!${NC}"

if [ "$PUSH" = "true" ]; then
    echo -e "${GREEN}✓ Image pushed to registry${NC}"
    echo ""
    echo "To verify the image, run:"
    echo "  docker buildx imagetools inspect ${FULL_IMAGE_NAME}"
elif [ "$SINGLE_PLATFORM" = "true" ]; then
    echo -e "${GREEN}✓ Image built and loaded locally${NC}"
    echo ""
    echo "You can now run the image with:"
    echo "  docker run -p 3000:3000 ${FULL_IMAGE_NAME}"
else
    echo ""
    echo "To push the image to a registry, run:"
    echo "  PUSH=true ./docker-build-multiarch.sh"
    echo ""
    echo "To build for local use, run:"
    echo "  PLATFORMS=linux/amd64 ./docker-build-multiarch.sh"
fi

