Below is an updated version of your README in markdown that reintroduces the details on how CFBundleVersion and versionCode are determined, along with the improvements made earlier. Let me know if you need any further adjustments.

---

# Version Generator

A tool that generates package versions based on Git information. It can be used as a CLI, a GitHub Action, or as a direct dependency in your code.

---

## Overview

The version generator creates version strings using Git data following the schema:

```
<major>.<minor>.<patch>-<branch-name>.<commit-hash>
```

For example:

```
v1.2-feature-branch.4-g5678abc
```

The tool extracts the version components as follows:

| Component      | Description                                             | Source                                                                      |
|----------------|---------------------------------------------------------|-----------------------------------------------------------------------------|
| **major**      | Major version number                                    | Extracted from the latest Git tag (e.g., `v1.2` → `1`)                      |
| **minor**      | Minor version number                                    | Extracted from the latest Git tag (e.g., `v1.2` → `2`)                      |
| **patch**      | Patch version number                                    | Number of commits since the latest tag                                      |
| **branch-name**| Current branch name                                     | Git branch name (cleaned of special characters)                             |
| **commit-hash**| Short commit hash                                       | Short hash of the current commit                                            |

> **Important**: The tool requires at least one Git tag (formatted as `v<major>.<minor>`) to exist in your repository. Without a tag, the action will fail with an error message.

This approach automatically creates versions based on commit history and allows you to quickly trace back any commit from a version string. It also helps identify which branch the code originates from.

---

## Version Tagging

To update the major or minor version, create a new tag in the format:

```bash
v<major>.<minor>
```

For example:

```bash
git tag -a v1.2 -m "Release version 1.2"
git push origin v1.2
```

---

## Typical Uses

- **Service Versioning**: Embed the version string in your service (e.g., under `/version.json`) to quickly identify the deployed version.
- **Artifact Versioning**: Use the version string to tag deployment artifacts, ensuring clarity on which package version is being deployed.

---

## Mobile App Version Considerations

For app packages, both iOS and Android have specific versioning requirements.

### iOS Versioning

- **CFBundleShortVersionString**: Represents the version of the app in the store. The App Store uses this string (formatted as `<major>.<minor>.<patch>`) to determine release ordering. Use the `appReleaseVersion` produced by the tool.
- **CFBundleVersion**: Ensures uniqueness between builds with identical version strings. This string can consist of up to three integers separated by periods.

### Android Versioning

- Android version strings are public and ideally follow the `<major>.<minor>.<patch>` format. Use the `appReleaseVersion` produced by the tool.
- Android does not use the version string for release ordering. Instead, it relies on a monotonically increasing integer called `versionCode`.

### Detailed Mobile Versioning

- **iOS**:  
  The tool queries App Store Connect to determine the current build number for the given version string. If that version string does not yet exist in the App Store or TestFlight, the build number defaults to `1`. The commit hash is then encoded as an integer, and these two values are combined into an `iosBuildNumberString` using the format:

  ```
  <buildNumber>.<encoded-commitHash>
  ```

  The first value ensures monotonically increasing build numbers for release ordering, while the second value allows you to decode and retrieve the commit hash. This `iosBuildNumberString` is used to set the `CFBundleVersion`.

- **Android**:  
  The tool queries the Google Play Store API to retrieve the latest build version code used across all tracks and then increments it by one. Additionally, if the major version of the package in the store is different from the package being built, the version code is increased by a configurable increment (default: 10). The resulting `androidVersionCode` is used to set the `versionCode` in your Android app.

> **Note**: To generate values specific to iOS or Android, use the appropriate CLI flags or GitHub Action inputs.

---

## Usage

### As a CLI Tool

You can install the version generator globally or as a dev dependency.

#### Installation

Add the package to your project:

```bash
npm add -d @wellsite/version-generator
```

#### Running the Tool

To display help:

```bash
# npm
npx @wellsite/version-generator --help

# pnpm
pnpm dlx @wellsite/version-generator --help
```

#### CLI Options

- `--root-dir, -r`: Root directory of the repository (**required**)
- `--destination, -d`: Destination path (relative to the root) to write the version file (optional)
- `--format, -f`: Output format: `string` or `json` (default: `string`)
- `--android`: Enable Android version code generation
- `--android-package`: Android package name for the Play Store API
- `--android-service-account-key`: Service account key for the Play Store API (JSON string or base64-encoded)
- `--android-track`: Track for the Play Store API (production, beta, alpha; default: production)
- `--android-major-increment`: Increment for major version changes (default: 10)
- `--ios`: Enable iOS build number generation
- `--ios-bundle-id`: iOS bundle ID for the App Store Connect API
- `--ios-api-key-id`: App Store Connect API Key ID
- `--ios-api-issuer-id`: App Store Connect API Issuer ID
- `--ios-api-private-key`: App Store Connect API Private Key (can be base64-encoded)

> **Local Usage**: The tool uses local Git commands and does not require a `GITHUB_TOKEN`.  
> **GitHub Actions**: When running in a GitHub Actions environment (`GITHUB_ACTIONS=true`), the tool uses the GitHub API and requires `GITHUB_TOKEN`.

#### JSON Output Format

When using the JSON format, the output includes additional metadata:

```json
{
  "version": "1.2.4-g5678abc",
  "major": "1",
  "minor": "2",
  "patch": 4,
  "branchName": "main",
  "commitHash": "5678abc",
  "appReleaseVersion": "1.2.4",
  "androidVersionCode": 15, 
  "iosBuildNumberString": "1.23234323"
}
```

---

### In GitHub Actions

Here’s an example workflow step:

```yaml
- name: Generate version
  uses: wellsite/version-generator@v1
  with:
    root-dir: '.'
    destination: 'version.json'
    format: 'json'
    android: 'true'
    android-package: 'com.example.app'
    android-service-account-key: ${{ secrets.PLAY_STORE_SERVICE_ACCOUNT_KEY_BASE64 }}
    android-track: 'production'
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### GitHub Action Inputs

| Input                         | Description                                                         | Required | Default      |
|-------------------------------|---------------------------------------------------------------------|----------|--------------|
| `root-dir`                    | Root directory of the repository                                    | Yes      | `.`          |
| `destination`                 | Destination path for the version file (relative to root)            | No       | –            |
| `format`                      | Output format (`string` or `json`)                                  | No       | `string`     |
| `android`                     | Enable Android version code generation                             | No       | `false`      |
| `android-package`             | Android package name for the Play Store API                          | No       | –            |
| `android-service-account-key` | Service account key for the Play Store API (as JSON string)           | No       | –            |
| `android-track`               | Track for the Play Store API (production, beta, alpha)              | No       | `production` |
| `android-major-increment`     | Increment for major version changes                                  | No       | `10`         |
| `ios`                         | Enable iOS build number generation                                   | No       | `false`      |
| `ios-bundle-id`               | iOS bundle ID for the App Store Connect API                          | No       | –            |
| `ios-api-key-id`              | App Store Connect API Key ID                                           | No       | –            |
| `ios-api-issuer-id`           | App Store Connect API Issuer ID                                        | No       | –            |
| `ios-api-private-key`         | App Store Connect API Private Key (can be base64-encoded)              | No       | –            |

#### GitHub Action Outputs

- `version`: The generated version string.
- `major`: Major version number.
- `minor`: Minor version number.
- `patch`: Patch version number (commit count since the last tag).
- `branchName`: Current branch name.
- `commitHash`: Current commit hash.
- `appReleaseVersion`: App release version (only major.minor.patch) for mobile apps.
- `androidVersionCode`: Android version code (if Android input is enabled).
- `iosBuildNumber`: iOS build number (if iOS input is enabled).

---

### As a Dependency

You can also use the version generator directly in your code.

#### Installation

```bash
pnpm add @wellsite/version-generator
```

#### Example Usage in JavaScript

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
    apiPrivateKey: '-----BEGIN PRIVATE KEY-----\n...', // Can also be base64-encoded
  }
});
console.log(versionInfoWithIos);

// Alternatively, generate and write to a file
const writtenVersionInfo = await generateAndWriteVersion('.', 'version.json');
console.log(writtenVersionInfo);
```

The returned object includes properties such as:

```json
{
  "version": "1.0.0-main.12345abc",
  "appReleaseVersion": "1.0.0",
  "iosBuildNumberString": "42",
  "iosBuildNumber": 42,
  // ...other properties
}
```

---

## Mobile Setup Details

### Android Setup

The tool can automatically generate Android version codes by:

1. **Creating a Service Account**: In the Google Cloud Console with access to the Google Play Android Developer API.
2. **Downloading the Service Account Key JSON**.
3. **Encoding the Key**: For GitHub Actions, encode the JSON as base64:
   ```bash
   cat service-account-key.json | base64
   ```
4. **Storing the Key**: Add the base64-encoded string as a GitHub secret.
5. **Inviting the Service Account**: Invite the service account (via its email) to your Google Play Console.

### iOS App Store Setup

The tool automatically generates iOS build numbers by:

1. **Creating an API Key in App Store Connect**.
2. **Collecting Credentials**:
   - **Key ID**: Displayed after generating the key (e.g., `ABC1234567`).
   - **Issuer ID**: Found at the top of the Keys page.
   - **Private Key**: Download the `.p8` file (downloadable only once).
   - **Bundle ID**: Your app's bundle identifier (e.g., `com.example.app`).
3. **Preparing the Private Key**: Encode it as base64:
   ```bash
   cat AuthKey_XXXXXXXX.p8 | base64
   ```
4. **Storing Securely**: For GitHub Actions, store the Key ID, Issuer ID, and base64-encoded private key as secrets. **Never commit these values to your repository.**

---

## Troubleshooting

### Error: "No git tags found"

If you see the error:

```
No git tags found fatal: No names found, cannot describe anything
```

It means your repository lacks any Git tags. The version generator requires at least one tag to function.

**Solution**:

Create an initial tag manually:

```bash
git tag -a v0.0.0 -m "Initial version"
git push origin v0.0.0
```

### Error: "Failed to get commit count from tag"

Ensure that your repository has at least one tag. Note that the action is configured to work with shallow clones (e.g., `fetch-depth: 1`), which may affect commit count retrieval.

---

## Development

For more information on contributing and developing this project, please see [DEVELOPMENT.md](./DEVELOPMENT.md).

---

## GitHub Action Versioning

The project uses a systematic versioning approach by tagging the major version of each build. This enables GitHub Action workflows to pin their version of the action to the latest build of a major version. For example:

```yaml
uses: Wellsite-Navigator/version-generator@v1  # Uses the latest v1.x.x release via the v1 tag
```

The `@v1` syntax is shorthand for always using the latest release in the `v1` major version series.

---

## License

This project is licensed under the [MIT License](./LICENSE).

---