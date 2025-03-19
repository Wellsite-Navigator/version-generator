# Contributing to Version Generator

Thank you for your interest in contributing to Version Generator! This document provides guidelines and instructions for contributing.

## Development Setup

1. Clone the repository:
   ```bash
   git clone git@wellsite.github.com:Wellsite-Navigator/version-generator.git
   cd version-generator
   ```

2. Install dependencies:
   ```bash   
   pnpm install
   ```

3. Build the project:
   ```bash
   pnpm build
   ```

4. Run tests:
   ```bash
   pnpm test
   ```

## Pull Request Process

1. Fork the repository and create your branch from `main`.
2. Make your changes and ensure tests pass.
3. Update documentation if necessary.
4. Submit a pull request.

## Testing

Please make sure to write tests for any new features or bug fixes. Run the tests before submitting a pull request:

```bash
pnpm test
```

## Versioning

We use our own version generator to version this package. there is no need to set a version string in the package.json file

## License

By contributing, you agree that your contributions will be licensed under the project's license.
