# Multi-Architecture Docker Build Guide

This guide explains how to build Docker images for multiple architectures (AMD64 and ARM64) so that Hemmelig can run on both x86_64 and ARM-based Kubernetes nodes.

## Prerequisites

-   Docker with Buildx support (included in Docker Desktop 19.03+ and Docker Engine 19.03+)
-   For pushing to a registry: Docker Hub, GitHub Container Registry (ghcr.io), or another container registry account

## Quick Start

### Build and Push to Registry

```bash
# Build and push multi-arch image to registry
PUSH=true IMAGE_NAME=your-registry/hemmelig IMAGE_TAG=v1.0.0 ./docker-build-multiarch.sh

# Or use npm script
npm run docker-build-multiarch-push
```

### Build Locally (for testing)

The script automatically detects when you're building for a single platform and will load the image into your local Docker daemon:

```bash
# Build for AMD64 and load locally (recommended for local testing)
PLATFORMS=linux/amd64 ./docker-build-multiarch.sh

# Build for ARM64 and load locally (if you're on an ARM machine)
PLATFORMS=linux/arm64 ./docker-build-multiarch.sh

# Or use npm script with platform specification
PLATFORMS=linux/amd64 npm run docker-build-multiarch
```

After building, you can run the image locally:

```bash
docker run -p 3000:3000 hemmelig:latest
```

**Note:** If you build for multiple platforms (the default), the image cannot be loaded directly into your local Docker daemon. Use a single platform for local testing, or push to a registry.

## Environment Variables

The build script supports the following environment variables:

-   `IMAGE_NAME`: Docker image name (default: `hemmelig`)
-   `IMAGE_TAG`: Docker image tag (default: `latest`)
-   `REGISTRY`: Container registry URL (e.g., `ghcr.io`, `docker.io`, `your-registry.com`)
-   `PLATFORMS`: Comma-separated list of platforms (default: `linux/amd64,linux/arm64`)
-   `PUSH`: Set to `true` to push to registry after build (default: `false`)

### Examples

```bash
# Build for GitHub Container Registry
PUSH=true REGISTRY=ghcr.io IMAGE_NAME=your-username/hemmelig IMAGE_TAG=v1.0.0 ./docker-build-multiarch.sh

# Build for Docker Hub
PUSH=true REGISTRY=docker.io IMAGE_NAME=your-username/hemmelig IMAGE_TAG=latest ./docker-build-multiarch.sh

# Build for custom registry
PUSH=true REGISTRY=registry.example.com IMAGE_NAME=hemmelig IMAGE_TAG=latest ./docker-build-multiarch.sh

# Build for specific platforms only
PLATFORMS=linux/arm64 ./docker-build-multiarch.sh
```

## GitHub Actions

The project uses a GitHub Actions workflow (`.github/workflows/release.yml`) that automatically builds and pushes multi-arch images when you push to the `main` branch.

### How It Works

1. **Push to main**: When you merge code to the `main` branch, the workflow triggers
2. **Semantic Release**: The workflow runs `semantic-release` to determine the new version based on your commit messages
3. **Tag Creation**: Semantic-release creates a git tag (e.g., `v1.6.1`) if a new release is warranted
4. **Multi-Arch Build**: The workflow builds a multi-architecture Docker image for both `linux/amd64` and `linux/arm64`
5. **Image Tagging**: The image is tagged with:
    - Full version: `1.6.1`
    - Minor version: `1.6`
    - Major version: `1`
    - `latest` (for the default branch)

### Setting up GitHub Actions

1. Ensure your repository has GitHub Actions enabled
2. The workflow uses `GH_TOKEN` secret for semantic-release (create this in repository settings)
3. Images are automatically pushed to `ghcr.io/<your-username>/<repo-name>`
4. The workflow uses GitHub Actions cache for faster builds

### Manual Builds

For manual builds or testing, use the local build script:

```bash
# Build and push manually
PUSH=true REGISTRY=ghcr.io IMAGE_NAME=your-username/hemmelig IMAGE_TAG=v1.0.0 ./docker-build-multiarch.sh
```

## Verifying Multi-Arch Images

After pushing, verify that your image supports multiple architectures:

```bash
docker buildx imagetools inspect your-registry/hemmelig:tag
```

You should see output showing both `linux/amd64` and `linux/arm64` platforms.

## Kubernetes Usage

When deploying to Kubernetes, the image will automatically work on both AMD64 and ARM64 nodes. Kubernetes will pull the correct architecture-specific image based on the node's architecture.

Example Kubernetes deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
    name: hemmelig
spec:
    replicas: 3
    template:
        spec:
            containers:
                - name: hemmelig
                  image: your-registry/hemmelig:latest
                  # No need to specify nodeSelector for architecture
                  # Kubernetes will automatically use the correct image
```

If you want to ensure pods run on specific architectures, you can use node selectors:

```yaml
spec:
    template:
        spec:
            nodeSelector:
                kubernetes.io/arch: arm64 # or amd64
            containers:
                - name: hemmelig
                  image: your-registry/hemmelig:latest
```

## Troubleshooting

### Buildx not found

If you get an error about buildx not being found:

```bash
# Install buildx (if not already installed)
docker buildx install
```

### QEMU errors on macOS/Windows

If you encounter QEMU-related errors when building ARM64 images on AMD64 hosts, ensure you have QEMU installed. Docker Desktop usually includes this automatically.

### Build fails with "no space left on device"

Multi-arch builds require more disk space. Clean up Docker:

```bash
docker system prune -a
docker buildx prune
```

## Additional Resources

-   [Docker Buildx Documentation](https://docs.docker.com/buildx/)
-   [Multi-platform images](https://docs.docker.com/build/building/multi-platform/)
