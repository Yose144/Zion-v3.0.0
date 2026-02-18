# 🔨 Multi-Platform Build System

Automated cross-compilation for ZION Universal Miner across all major platforms.

## 🎯 Supported Platforms

| Platform | Architecture | Status | Binary Name |
|----------|-------------|--------|-------------|
| **macOS** | Intel (x86_64) | ✅ Tested | `zion-miner-macos-intel` |
| **macOS** | Apple Silicon (ARM64) | ✅ Tested | `zion-miner-macos-arm64` |
| **Linux** | x86_64 | ✅ Tested | `zion-miner-linux-x64` |
| **Linux** | ARM64 | ✅ CI Only | `zion-miner-linux-arm64` |
| **Windows** | x86_64 | ✅ CI Only | `zion-miner-windows-x64.exe` |

## 🚀 Quick Build

### Local Build (Current Platform)

```bash
cd 2.9.5/zion-native
cargo build --release
```

Binary will be at: `target/release/zion-miner`

### Cross-Platform Build

```bash
# Build for all platforms
./2.9.5/scripts/build-all-platforms.sh all

# Build for specific platform
./2.9.5/scripts/build-all-platforms.sh linux
./2.9.5/scripts/build-all-platforms.sh macos
./2.9.5/scripts/build-all-platforms.sh windows
```

Binaries will be in: `builds/`

## 🔧 Setup for Cross-Compilation

### Install `cross` (Recommended)

```bash
cargo install cross
```

### Platform-Specific Requirements

#### macOS → Windows/Linux

```bash
# Install cross
cargo install cross

# Docker Desktop required for cross
# Download from: https://www.docker.com/products/docker-desktop
```

#### Linux → macOS/Windows

```bash
# Install cross
cargo install cross

# Docker required
sudo apt install docker.io
sudo systemctl start docker
sudo usermod -aG docker $USER
```

#### Windows → macOS/Linux

```powershell
# Install cross
cargo install cross

# Docker Desktop required
# Download from: https://www.docker.com/products/docker-desktop

# WSL2 required for cross
wsl --install
```

## 📦 Release Process

### 1. Update Version

Edit `2.9.5/zion-native/Cargo.toml`:
```toml
[workspace.package]
version = "2.9.5"
```

### 2. Build All Platforms

```bash
./2.9.5/scripts/build-all-platforms.sh all
```

### 3. Test Binaries

```bash
# macOS
./builds/zion-miner-macos-arm64 --version

# Linux (via Docker)
docker run --rm -v $PWD/builds:/builds ubuntu:22.04 /builds/zion-miner-linux-x64 --version

# Windows (via Wine)
wine ./builds/zion-miner-windows-x64.exe --version
```

### 4. Create GitHub Release

```bash
# Tag release
git tag -a v2.9.5 -m "Release v2.9.5"
git push origin v2.9.5

# GitHub Actions will automatically:
# 1. Build all platforms
# 2. Create release archives
# 3. Generate checksums
# 4. Publish release
```

## 🤖 GitHub Actions CI/CD

Automated builds triggered on:
- **Push to main**: Build & test
- **Tags (v*)**: Build, test, and release
- **Pull requests**: Build & test

### Workflow File

`.github/workflows/build-miner.yml`

### Manual Trigger

1. Go to: **Actions** tab on GitHub
2. Select: **Build ZION Universal Miner**
3. Click: **Run workflow**
4. Choose branch and run

## 🐛 Troubleshooting

### `cross` Build Fails

```bash
# Update Docker images
docker pull ghcr.io/cross-rs/x86_64-unknown-linux-gnu:latest

# Clear cache
cargo clean
```

### macOS ARM64 Build on Intel

```bash
# Install Rosetta 2
softwareupdate --install-rosetta

# Add ARM64 target
rustup target add aarch64-apple-darwin

# Build
cargo build --release --target aarch64-apple-darwin
```

### Windows Build Fails (Missing MSVC)

**Option 1: Install Visual Studio Build Tools**
```bash
# Download from: https://visualstudio.microsoft.com/downloads/
# Select: "Desktop development with C++"
```

**Option 2: Use cross**
```bash
cargo install cross
cross build --release --target x86_64-pc-windows-msvc
```

### Linux ARM64 Binary Won't Run

```bash
# For testing on ARM64 machine:
scp builds/zion-miner-linux-arm64 user@raspberry-pi:~
ssh user@raspberry-pi
chmod +x ~/zion-miner-linux-arm64
~/zion-miner-linux-arm64 --version
```

## 📊 Build Sizes

Expected binary sizes (stripped):

| Platform | Size | Notes |
|----------|------|-------|
| macOS ARM64 | ~4.2 MB | Native Apple Silicon |
| macOS Intel | ~4.4 MB | Rosetta 2 compatible |
| Linux x64 | ~4.0 MB | Statically linked |
| Linux ARM64 | ~3.8 MB | For Raspberry Pi, etc. |
| Windows x64 | ~4.6 MB | MSVC runtime |

## 🔐 Security

### Binary Checksums

After each build, checksums are generated:

```bash
cd builds
shasum -a 256 * > checksums-sha256.txt
```

Verify downloaded binaries:
```bash
shasum -c checksums-sha256.txt
```

### Code Signing (Future)

- **macOS**: Apple Developer certificate
- **Windows**: Authenticode signing
- **Linux**: GPG signature

## 🌐 Release Channels

### Stable (main branch)

```bash
git checkout main
./2.9.5/scripts/build-all-platforms.sh all
```

### Beta (development branch)

```bash
git checkout development
./2.9.5/scripts/build-all-platforms.sh all
```

### Nightly (automated)

GitHub Actions builds nightly from `main` branch.

## 📝 Changelog

See [CHANGELOG.md](../CHANGELOG.md) for version history.

## 🤝 Contributing

### Adding New Target

1. **Update build script**: `scripts/build-all-platforms.sh`
2. **Update CI**: `.github/workflows/build-miner.yml`
3. **Test build**: `cargo build --target NEW_TARGET`
4. **Update docs**: This file

### Example: Add FreeBSD

```bash
# Add to build script
build_target "x86_64-unknown-freebsd" "zion-miner-freebsd-x64" "FreeBSD x86_64"

# Add to CI matrix
- os: ubuntu-latest
  target: x86_64-unknown-freebsd
  name: freebsd-x64
```

## 📞 Support

- **Build Issues**: [GitHub Issues](https://github.com/zionterranova/zion/issues)
- **Discord**: [#development](https://discord.gg/zionterranova)

---

**Happy Building!** 🔨🚀
