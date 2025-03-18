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
    root-dir: '.'
    destination: 'version.json'
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
  run: generate-version --root-dir . --destination version.json --format json
```

## Version Management

When releasing a new version:

1. Update the version in `package.json`
2. Create a new tag and release on GitHub
3. The GitHub Actions workflow will publish the new version to npm

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
