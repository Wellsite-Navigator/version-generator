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
- `--android`: Enable Android version code generation
- `--android-package`: Android package name for Play Store API
- `--android-service-account-key`: Service account key for Play Store API (JSON string or base64-encoded JSON)
- `--android-track`: Track to use for Play Store API (production, beta, alpha) (default: production)
- `--android-major-increment`: Increment for major version changes (default: 10)
- `--ios`: Enable iOS build number generation
- `--ios-bundle-id`: iOS bundle ID for App Store Connect API
- `--ios-api-key-id`: App Store Connect API Key ID
- `--ios-api-issuer-id`: App Store Connect API Issuer ID
- `--ios-api-private-key`: App Store Connect API Private Key (can be base64-encoded)

> **Note**: When running locally, the tool uses local git commands to get version information. The `GITHUB_TOKEN` environment variable is **not required** for local usage.
>
> However, if the tool detects it's running in a GitHub Actions environment (when `GITHUB_ACTIONS=true`), it will use the GitHub API instead of local git commands, and in this case, the `GITHUB_TOKEN` is required.


## NPM SemVer Versions of Packages using this Version Generator

Although we are using a unique version schema, we still effectively have two parts to our version.
{standard semver component} - {pre-release identifier}

So version restrictions like `^1.0.0@main` will continue to work appropriately.

You can use this repository as an example. Each build of this package is published with a unique version number using this version generator. We also tag each build with a release channel that is equivalent to its branch name. This allows us to get the latest version from the a specific branch.
`^1.0.0@main` will get the latest version of 1.x.y from the main branch.
`~1.0.0@main` will get the latest version of 1.0.x from the main branch.
`1.0.0@main` will get the specific version of 1.0.0 from the main branch.

## Android Version Code Generation

This tool can automatically generate Android version codes by querying the Google Play Developer API to find the highest existing version code and incrementing it appropriately.

### Setup

1. Create a service account in the Google Cloud Console with access to the Google Play Android Developer API
2. Download the service account key JSON file
3. When using in GitHub Actions, encode the JSON as base64:
   ```bash
   cat service-account-key.json | base64
   ```
4. Store the base64-encoded string as a GitHub secret

### Usage in GitHub Actions

```yaml
- name: Generate version
  uses: wellsite/version-generator@v1
  with:
    root-dir: '.'
    destination: 'version.json'
    format: 'json'
    android: 'true'
    android-package: 'com.example.app'
    android-service-account-key: ${{ secrets.PLAY_STORE_SERVICE_ACCOUNT_KEY }}
    android-track: 'production'
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> **Important**: The `GITHUB_TOKEN` environment variable is **required** when running in GitHub Actions. The tool detects the GitHub Actions environment and uses the GitHub API instead of local git commands. GitHub Actions automatically provides this token, but you need to explicitly pass it to the action's environment as shown above. Without it, the version generation will fail with an error.

The tool will automatically detect if the service account key is base64-encoded and decode it before use.

## iOS Build Number Generation

This tool can automatically generate iOS build numbers by querying the App Store Connect API to find the highest existing build number for a specific version and incrementing it appropriately.

### Setup

1. **Create an API Key in App Store Connect**:
   - Log in to [App Store Connect](https://appstoreconnect.apple.com/)
   - Go to "Users and Access" > "Keys" tab
   - Click the "+" button to add a new key
   - Enter a name for the key (e.g., "Version Generator")
   - Select the "App Manager" role (minimum required for accessing build information)
   - Click "Generate"

2. **Collect the required credentials**:
   - **Key ID**: This is displayed on the screen after generating the key (e.g., `ABC1234567`)
   - **Issuer ID**: This is found at the top of the Keys page (e.g., `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
   - **Private Key**: Download the `.p8` file when prompted. This file can only be downloaded once!
   - **Bundle ID**: This is your app's bundle identifier (e.g., `com.example.app`). You can find this in:
     - Xcode: In your app target's General tab
     - App Store Connect: Apps > Your App > App Information > Bundle ID

3. **Prepare the private key for use**:
   - For local use, you can use the file path or the contents of the file
   - For GitHub Actions, encode the private key as base64:
     ```bash
     cat AuthKey_XXXXXXXX.p8 | base64
     ```

4. **Store securely**:
   - For GitHub Actions, store the Key ID, Issuer ID, and base64-encoded private key as GitHub secrets
   - Never commit these values to your repository

### Usage in CLI

```bash
# Generate version with iOS build number
npx @wellsite/version-generator \
  --destination version.json \
  --ios \
  --ios-bundle-id com.example.app \
  --ios-api-key-id XXXXXXXXXX \
  --ios-api-issuer-id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  --ios-api-private-key-path ./AuthKey_XXXXXXXX.p8
```

### Usage in GitHub Actions

```yaml
- name: Generate version
  uses: wellsite/version-generator@v1
  with:
    root-dir: '.'
    destination: 'version.json'
    format: 'json'
    ios: 'true'
    ios-bundle-id: 'com.example.app'
    ios-api-key-id: ${{ secrets.APP_STORE_API_KEY_ID }}
    ios-api-issuer-id: ${{ secrets.APP_STORE_API_ISSUER_ID }}
    ios-api-private-key: ${{ secrets.APP_STORE_API_PRIVATE_KEY }}
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The tool will automatically detect if the private key is base64-encoded and decode it before use.

### How iOS Build Number Generation Works

The iOS build number generation follows these steps:

1. The tool authenticates with the App Store Connect API using the provided credentials
2. It queries the API for all builds with the specified bundle ID and version string (CFBundleShortVersionString)
3. It finds the highest existing build number (CFBundleVersion) for that version
4. If builds are found, it increments the highest build number by 1
5. If no builds are found, it starts with build number 1

This ensures that each new build has a monotonically increasing build number, which is required by the App Store.

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

// Generate version information with Android version code
const versionInfoWithAndroid = await generatePackageVersion('.', {
  android: {
    enabled: true,
    packageName: 'com.example.app',
    serviceAccountKey: '{ ... }', // Service account key JSON
    track: 'production',
    majorVersionIncrement: 10
  }
});
console.log(versionInfoWithAndroid);

// Generate version information with iOS build number
const versionInfoWithIos = await generatePackageVersion('.', {
  ios: {
    enabled: true,
    bundleId: 'com.example.app',
    apiKeyId: 'XXXXXXXXXX',
    apiIssuerId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    apiPrivateKey: '-----BEGIN PRIVATE KEY-----\n...' // Private key content
  }
});
console.log(versionInfoWithIos);

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
| `android` | Enable Android version code generation | No | `false` |
| `android-package` | Android package name for Play Store API | No | - |
| `android-service-account-key` | Service account key JSON for Play Store API (as a string) | No | - |
| `android-track` | Track to use for Play Store API (production, beta, alpha) | No | `production` |
| `android-major-increment` | Increment for major version changes | No | `10` |
| `ios` | Enable iOS build number generation | No | `false` |
| `ios-bundle-id` | iOS bundle ID for App Store Connect API | No | - |
| `ios-api-key-id` | App Store Connect API Key ID | No | - |
| `ios-api-issuer-id` | App Store Connect API Issuer ID | No | - |
| `ios-api-private-key` | App Store Connect API Private Key (can be base64-encoded) | No | - |

### Outputs

- `version`: The generated version string
- `major`: The major version number
- `minor`: The minor version number
- `patch`: The patch version number (commit count since the last tag)
- `branchName`: The current branch name
- `commitHash`: The current commit hash
- `appReleaseVersion`: The app release version (only major.minor.patch) for mobile app versioning
- `androidVersionCode`: The Android version code (only available when android input is true)
- `iosBuildNumber`: The iOS build number (only available when ios input is true)

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
  "commitHash": "5678abc",
  "appReleaseVersion": "1.2.4",
  "androidVersionCode": 15
}
```

> **Important**: This tool requires at least one git tag to exist in your repository. If no tags exist, the action will fail with an error message. It is the user's responsibility to ensure that at least one tag exists in the repository before using this action.

### Android Version Code Generation

The tool can generate Android version codes by querying the Google Play Developer API to find the highest existing version code and incrementing it appropriately. This ensures that your version codes are always higher than what's currently published, which is a requirement for Android app updates.

#### How It Works

1. When the `--android` flag is provided, the tool will query the Google Play Developer API to find the highest version code across all tracks (or a specific track if specified).
2. If no existing version code is found (first-time publishing), it will start with version code 1.
3. If an existing version code is found, it will:
   - Increment by `majorVersionIncrement` (default: 10) if the major version has increased
   - Increment by 1 if the major version is the same

This approach ensures that:
- Version codes are always increasing
- There's room for patching older versions
- The tool works even for new apps with no published versions

#### Requirements

To use this feature, you need:
1. A Google Play Developer account
2. A service account with appropriate permissions
3. The package name of your Android app

#### Authentication

Create a service account in the Google Cloud Console and grant it access to your Google Play Developer account. Download the JSON key file and provide it to the tool using the `--android-key` option.

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
