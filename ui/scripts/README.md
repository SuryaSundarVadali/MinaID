# Upload Cache to GitHub Releases

This directory contains scripts to help deploy large ZKP cache files to external hosting.

## Quick Start

```bash
# 1. Edit the script with your GitHub username
nano upload-cache-to-github.sh
# Change line 7: REPO_OWNER="your-github-username"

# 2. Make sure you have GitHub CLI installed
gh --version  # Should show version number

# 3. Login to GitHub (if not already)
gh auth login

# 4. Run the upload script
./upload-cache-to-github.sh
```

## What This Does

1. Creates a GitHub Release tagged `v1.0.0-cache`
2. Uploads all files from `../public/cache/` to the release
3. Provides a URL to use for `NEXT_PUBLIC_CACHE_URL`

## After Upload

1. **Set Vercel Environment Variable**:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add: `NEXT_PUBLIC_CACHE_URL`
   - Value: `https://github.com/YOUR-USERNAME/MinaID/releases/download/v1.0.0-cache`

2. **Redeploy**:
   ```bash
   git commit --allow-empty -m "Use external cache"
   git push
   ```

3. **Test**:
   - Visit: `https://your-app.vercel.app/test-cache-api`
   - All files should show status 200

## Prerequisites

- GitHub CLI (`gh`) installed
- Logged in to GitHub (`gh auth login`)
- Write access to the repository

## Install GitHub CLI

### macOS
```bash
brew install gh
```

### Linux
```bash
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh
```

### Windows
```powershell
winget install --id GitHub.cli
```

Or download from: https://cli.github.com/

## Troubleshooting

### "gh: command not found"
Install GitHub CLI using instructions above.

### "gh auth status: Not logged in"
Run: `gh auth login` and follow prompts.

### "Release already exists"
The script will use the existing release and add/update files.

### Upload fails for large files
GitHub allows up to 2GB per file. All our cache files are under this limit.

## Alternative: Manual Upload

If the script doesn't work, you can manually upload via GitHub web interface:

1. Go to: `https://github.com/YOUR-USERNAME/MinaID/releases/new`
2. Tag version: `v1.0.0-cache`
3. Title: `ZKP Cache Files v1.0.0`
4. Drag and drop files from `ui/public/cache/`
5. Publish release
6. Copy release URL for environment variable

## Files Being Uploaded

Total: ~1.3GB, ~75 files including:
- Proving keys (step-pk-*, wrap-pk-*): ~700MB
- Verification keys (step-vk-*, wrap-vk-*): ~2MB
- SRS files: ~16MB
- Lagrange basis: ~6MB
- Headers: ~10KB

Upload time depends on your internet speed (~10-30 minutes for 1.3GB).
