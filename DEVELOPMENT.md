# Development Guide

This document provides detailed information for developers working on the version-generator project.

## Project Structure

```
version-generator/
├── .github/
│   ├── local-workflows/   # Local testing workflows (not committed to git)
│   │   └── test-action.yml
│   └── workflows/         # GitHub Actions workflows
│       └── publish.yml
├── dist/                  # Compiled output (not committed to git)
├── examples/              # Example workflows for users
├── src/                   # Source code
│   ├── cli.ts             # CLI implementation
│   ├── cli.test.ts        # CLI tests
│   ├── index.ts           # Main implementation
│   └── index.test.ts      # Tests
├── action.yml             # GitHub Action definition
├── tsconfig.json          # TypeScript configuration
├── tsconfig.build.json    # TypeScript build configuration
└── package.json           # Package configuration
```

## Development Workflow

### Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd version-generator
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

### Building

Build the project:
```bash
pnpm build
```

This will:
1. Remove the `dist` directory
2. Compile TypeScript files using `tsconfig.build.json`
3. Make the CLI executable

### Testing

Run tests:
```bash
pnpm test
```

### Testing the GitHub Action Locally

To test the GitHub Action locally, you can use [act](https://github.com/nektos/act):

```bash
# Install act
brew install act

# Run the test workflow
act -j test-action -W .github/local-workflows/test-action.yml
```

### Manual Testing

You can also test the CLI directly:

```bash
# Build the project
pnpm build

# Run the CLI
node dist/cli.js --root-dir . --format json

# Or, if you've linked the package
generate-version --root-dir . --format json
```

## Publishing

### Publishing to npm Registry

The package is automatically published to the npm registry when a new release is created on GitHub. The publish workflow is defined in `.github/workflows/publish.yml`.

To publish manually:

```bash
# Build the project
pnpm build

# Publish to npm registry
pnpm publish --access public
```

### Publishing as a GitHub Action

The GitHub Action is automatically available when users reference it in their workflows:

```yaml
- name: Generate Version
  uses: Wellsite-Navigator/version-generator@v1
  with:
    root-dir: '.'
    destination: 'version.json'
    format: 'json'
```

## Troubleshooting

### Test Files in Build Output

If you see test files in the build output, make sure:

1. The `tsconfig.build.json` file is correctly configured to exclude test files
2. The build script in `package.json` is using `tsconfig.build.json`
3. The test files follow the naming convention `*.test.ts`

### GitHub Action Testing

If the GitHub Action test is failing:

1. Check that the repository has at least one tag
2. Verify that the checkout action is configured correctly
3. Make sure the Node.js and pnpm versions match those in `action.yml`
