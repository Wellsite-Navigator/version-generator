# Version Generator

A tool that generates version files based on git information, designed to work as a CLI, a GitHub Action, or as a direct dependency in your code.

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


## NPM SemVer Versions of Packages using this Version Generator

Although we are using a unique version schema, we still effectively have two parts to our version.
{standard semver component} - {pre-release identifier}

So version restrictions like `^1.0.0@main` will continue to work appropriately.

You can use this repository as an example. Each build of this package is published with a unique version number using this version generator. We also tag each build with a release channel that is equivalent to its branch name. This allows us to get the latest version from the a specific branch.
`^1.0.0@main` will get the latest version of 1.x.y from the main branch.
`~1.0.0@main` will get the latest version of 1.0.x from the main branch.
`1.0.0@main` will get the specific version of 1.0.0 from the main branch.



## Usage as a Dependency

You can also use the version generator directly in your code:

```bash
pnpm add @wellsite/version-generator
```

```javascript
const { generatePackageVersion, generateAndWriteVersion } = require('@wellsite/version-generator');

// Generate version information without writing to a file
const versionInfo = await generatePackageVersion('.');
console.log(versionInfo);

// Or generate and write to a file
const versionInfo = await generateAndWriteVersion('.', 'version.json');
console.log(versionInfo);
```

Or in TypeScript:

```typescript
import { generatePackageVersion, generateAndWriteVersion } from '@wellsite/version-generator';

// Generate version information without writing to a file
const versionInfo = await generatePackageVersion('.');
console.log(versionInfo);

// Or generate and write to a file
const versionInfo = await generateAndWriteVersion('.', 'version.json');
console.log(versionInfo);
```

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
- `major`: The major version number
- `minor`: The minor version number
- `patch`: The patch version number (commit count since the last tag)
- `branchName`: The current branch name
- `commitHash`: The current commit hash
- `appReleaseVersion`: The app release version (only major.minor.patch) for mobile app versioning

## How it works

The version generator creates version strings based on git information.

The schema is `<major>`.`<minor>`.`<patch>`-`<branch-name>`.`<commit-hash>`

Example: `v1.2-feature-branch.4-g5678abc`

| Component | Description | Source |
|-----------|-------------|--------|
| `major` | Major version number | Extracted from the latest git tag (e.g., `v1.2` → `1`) |
| `minor` | Minor version number | Extracted from the latest git tag (e.g., `v1.2` → `2`) |
| `patch` | Patch version number | Number of commits since the latest tag |
| `branch-name` | Current branch name | Git branch name (cleaned of special characters) |
| `commit-hash` | Short commit hash | Short hash of the current commit |

To update the major or minor version, you need to create a new tag in the format `v<major>.<minor>` (e.g., `v1.2`).

### JSON Output Format

When using the JSON format, the output includes additional metadata:

```json
{
  "version": "v1.2.4-g5678abc",
  "major": "1",
  "minor": "2",
  "patch": 4,
  "branchName": "main",
  "commitHash": "5678abc"
}
```

> **Important**: This tool requires at least one git tag to exist in your repository. If no tags exist, the action will fail with an error message. It is the user's responsibility to ensure that at least one tag exists in the repository before using this action.

### GitHub Action Versioning

This project uses a systematic approach to versioning and tags the major version of each build. This allows github action flows to pin their version of the action to the latest build of a major version.

```yaml
uses: Wellsite-Navigator/version-generator@v1  # Uses the latest v1.x.x release via the v1 tag
```

The `@v1` syntax is a shorthand for the latest release of the `v1` major version build


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

### Error: Failed to get commit count from tag

If you encounter an error related to getting the commit count, make sure your repository has at least one tag. The action is configured to work with shallow clones (fetch-depth: 1) by default.

## Development

For more information on developing and contributing to this project, see [DEVELOPMENT.md](./DEVELOPMENT.md).


## License

MIT
