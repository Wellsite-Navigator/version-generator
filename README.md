# Version Generator

A tool that generates version files based on git information, designed to work both as a CLI and a GitHub Action.

## Installation

```bash
pnpm add -g @wellsite/version-generator
```

## Usage as CLI

```bash
generate-version --root-dir <path> [--destination <path>] [--format <string|json>]
```

### Options

- `--root-dir, -r`: Root directory of the repository (required)
- `--destination, -d`: Destination path relative to root directory where the version file should be written (optional)
- `--format, -f`: Output format - 'string' or 'json' (default: 'string')

## Usage as GitHub Action

Add the following to your GitHub workflow file:

```yaml
name: Generate Version

on:
  push:
    branches: [main]

jobs:
  generate-version:
    runs-on: ubuntu-latest
    steps:
      - name: Generate Version
        uses: Wellsite-Navigator/version-generator@v1
        with:
          root-dir: '.'
          destination: 'version.json'
          format: 'json'
```

### Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `root-dir` | Root directory of the repository | Yes | `.` |
| `destination` | Destination path relative to root directory where the version file should be written | No | - |
| `format` | Output format (string or json) | No | `string` |

### Outputs

- `version`: The generated version string

## Testing the Action Locally

To test the GitHub Action locally before publishing, you can use the provided local workflow:

```bash
# Clone the repository
git clone <repository-url>
cd version-generator

# Install dependencies
pnpm install

# Build the package
pnpm build

# Run the local test workflow (if you have act installed)
act -j test-action -W .github/local-workflows/test-action.yml
```

Alternatively, you can test the CLI directly:

```bash
# Build the package
pnpm build

# Run the CLI
node dist/cli.js --root-dir . --format json
```

## How it works

The version generator creates version strings based on git information:

1. For tagged commits: Uses the tag as the version (e.g., `v1.2.3`)
2. For commits after a tag: Appends commit count and hash (e.g., `v1.2.3-4-g5678abc`)
3. For feature branches: Includes branch name (e.g., `v1.2.3-feature-branch.4-g5678abc`)

> **Important**: This tool requires at least one git tag to exist in your repository. If no tags exist, the action will fail with an error message. It is the user's responsibility to ensure that at least one tag exists in the repository before using this action.

## Troubleshooting

### Error: No git tags found

If you encounter the error `No git tags found fatal: No names found, cannot describe anything`, it means that your repository doesn't have any git tags. The version generator requires at least one tag to function properly.

To resolve this issue, you have two options:

1. **Create a tag manually before running the action**:
   ```bash
   git tag -a v0.0.0 -m "Initial version"
   git push origin v0.0.0
   ```

2. **Add a step in your workflow to create a tag if none exists**:
   ```yaml
   - name: Check if tag exists and create if needed
     run: |
       if ! git tag -l | grep -q .; then
         echo "No tags found, creating initial tag v0.0.0"
         git config --local user.email "action@github.com"
         git config --local user.name "GitHub Action"
         git tag -a v0.0.0 -m "Initial version"
       else
         echo "Tags already exist, skipping initial tag creation"
       fi
   ```

See the [workflow-with-tag-creation.yml](./examples/workflow-with-tag-creation.yml) example for a complete workflow that includes tag creation.

### Error: Failed to get commit count from tag

If you encounter an error related to getting the commit count, make sure your repository has at least one tag. The action is configured to work with shallow clones (fetch-depth: 1) by default.

## Development

For more information on developing and contributing to this project, see [DEVELOPMENT.md](./DEVELOPMENT.md).

## License

MIT
