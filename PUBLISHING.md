# Publishing Guide

This document provides instructions for publishing the version-generator package to the npm registry and using it as a GitHub Action.

## Publishing to npm Registry

### Prerequisites

1. You need an npm account. If you don't have one, create it at [npmjs.com](https://www.npmjs.com/signup).
2. You need to be added as a collaborator to the `@wellsite` organization on npm.

### Automatic Publishing (Recommended)

The package is automatically published to npm when a new GitHub release is created:

1. Go to the [GitHub repository](https://github.com/Wellsite-Navigator/version-generator)
2. Click on "Releases" in the right sidebar
3. Click "Draft a new release"
4. Choose a tag (e.g., `v1.0.0`)
5. Add a title and description
6. Click "Publish release"

The GitHub Actions workflow will automatically build, test, and publish the package to npm.

### Manual Publishing

If you need to publish manually:

```bash
# Login to npm
pnpm login

# Build the package
pnpm build

# Publish to npm
pnpm publish --access public
```

## Using as a GitHub Action

Once published, the action can be used in GitHub workflows in two ways:

### 1. Using the GitHub Action from the Marketplace

```yaml
- name: Generate Version
  uses: Wellsite-Navigator/version-generator@v1
  with:
    dir: '.'
    outputFilePath: 'version.json'
    format: 'json'
```

### 2. Using the npm Package

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '22'

- name: Setup pnpm
  uses: pnpm/action-setup@v4
  with:
    version: 10.6.2

- name: Install version-generator
  run: pnpm add -g @wellsite/version-generator

- name: Generate Version
  run: generate-version --dir . --output-file version.json --format json
```

## Version Management

### Versioning Strategy

This project uses a combination of:

1. **Specific version tags** (e.g., `v1.0`, `v2.3`) for marking releases
2. **Detailed version strings** for npm packages
3. **Major version branches** for GitHub Actions references

### Specific Version Tags

When a release is created, a specific version tag in the format `vX.Y` (e.g., `v1.0`, `v2.3`) is created to mark that release. These tags are used to:

1. Mark official releases
2. Calculate the patch number (number of commits since the last tag)
3. Provide a reference point for version history

> **Important**: The version generator will only consider tags in the exact format `vX.Y` (e.g., `v1.2`) for version calculations. Tags like `v1` (major version only) or `v1.2.3` (with patch version) will be ignored. This allows major version branches (`v1`, `v2`) to coexist with version tags without interfering with version calculations.

### Automatic Versioning

The package uses its own version generator to create version numbers based on git information:

1. When a GitHub Release is created, the publish workflow runs
2. The workflow uses the CLI to generate a version based on git tags and commits
3. This version is used to update package.json before publishing
4. A major version branch (e.g., `v1`) is automatically created/updated to point to the latest release

### Major Version Branches

For GitHub Actions, users reference the action using major version branches:

```yaml
uses: Wellsite-Navigator/version-generator@v1  # Always uses the latest v1.x.x release
```

These major version branches are automatically maintained by the publish workflow, which:

1. Extracts the major version from the generated detailed version
2. Creates or updates the major version branch to point to the current commit
3. Force pushes the branch to the repository

This approach allows users to reference a stable major version while still getting all the detailed version information in the npm package. Using branches instead of tags for major versions ensures that our patch versioning (which counts commits since the last tag) remains accurate.

## Troubleshooting

### Authentication Issues

If you encounter authentication issues when publishing:

1. Make sure you're logged in to npm with `pnpm login`
2. Verify you have the correct permissions in the @wellsite organization
3. Check that the NPM_TOKEN secret is correctly set in the GitHub repository

### Package Not Found

If users can't find or install the package:

1. Verify the package was successfully published by checking [npmjs.com](https://www.npmjs.com/package/@wellsite/version-generator)
2. Make sure users are using the correct package name with the organization prefix: `@wellsite/version-generator`

### GitHub Action Not Working

If the GitHub Action doesn't work:

1. Make sure the repository is public so GitHub Actions can access it
2. Verify the action.yml file is correctly configured
3. Check that the user has at least one git tag in their repository
