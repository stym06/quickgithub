package github

import (
	"path/filepath"
	"sort"
	"strings"
)

// excludedDirs are directories to always skip during filtering.
var excludedDirs = map[string]bool{
	"node_modules":       true,
	"vendor":             true,
	".git":               true,
	"dist":               true,
	"build":              true,
	"__pycache__":        true,
	"target":             true,
	".next":              true,
	"coverage":           true,
	"venv":               true,
	".venv":              true,
	"__tests__":          true,
	"tests":              true,
	"test":               true,
	"test_data":          true,
	"testdata":           true,
	".github/workflows":  true,
	".circleci":          true,
	".husky":             true,
	".vscode":            true,
	".idea":              true,
	".terraform":         true,
	".cache":             true,
	".parcel-cache":      true,
	".sass-cache":        true,
	".turbo":             true,
	".vercel":            true,
	".netlify":           true,
	".serverless":        true,
	"__snapshots__":      true,
	".nyc_output":        true,
	".pytest_cache":      true,
	".mypy_cache":        true,
	".tox":               true,
	".eggs":              true,
	"htmlcov":            true,
	".gradle":            true,
	".mvn":               true,
	"out":                true,
	"obj":                true,
	".angular":           true,
}

// excludedExtensions are binary/non-text file extensions to always skip.
var excludedExtensions = map[string]bool{
	// Images
	".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".bmp": true,
	".ico": true, ".svg": true, ".webp": true, ".tiff": true, ".tif": true,
	// Fonts
	".woff": true, ".woff2": true, ".ttf": true, ".otf": true, ".eot": true,
	// Audio/Video
	".mp3": true, ".mp4": true, ".wav": true, ".ogg": true, ".webm": true,
	".avi": true, ".mov": true, ".flac": true,
	// Archives
	".zip": true, ".tar": true, ".gz": true, ".bz2": true, ".xz": true,
	".rar": true, ".7z": true, ".jar": true,
	// Compiled/Binary
	".exe": true, ".dll": true, ".so": true, ".dylib": true, ".a": true,
	".o": true, ".obj": true, ".class": true, ".pyc": true, ".pyo": true,
	".wasm": true, ".beam": true,
	// Data/DB
	".sqlite": true, ".db": true, ".bin": true, ".dat": true,
	// Documents
	".pdf": true, ".doc": true, ".docx": true, ".xls": true, ".xlsx": true,
	".ppt": true, ".pptx": true,
	// Misc non-text
	".DS_Store": true, ".lock": true,
}

// alwaysIncludeFiles are filenames to always include regardless of extension.
var alwaysIncludeFiles = map[string]bool{
	"Dockerfile":       true,
	"Makefile":         true,
	"package.json":     true,
	"go.mod":           true,
	"Cargo.toml":       true,
	"pyproject.toml":   true,
	"setup.py":         true,
	"requirements.txt": true,
	"Gemfile":          true,
	"README.md":        true,
	"README":           true,
	"LICENSE":          true,
}

// alwaysSkipSuffixes are file suffixes to always skip.
var alwaysSkipSuffixes = []string{
	"package-lock.json", "yarn.lock", "pnpm-lock.yaml",
	"Cargo.lock", "go.sum", "Gemfile.lock", "poetry.lock",
	".min.js", ".min.css", ".map", ".snap",
	".pb.go", ".d.ts",
}

// alwaysSkipContains are substrings in filenames that cause skipping.
var alwaysSkipContains = []string{
	".generated.", "_generated.",
}

// FilterTree filters tree entries to the most relevant files for documentation.
func FilterTree(entries []TreeEntry, maxFiles, maxSizeBytes int) []TreeEntry {
	var filtered []TreeEntry

	for _, entry := range entries {
		if shouldInclude(entry, maxSizeBytes) {
			filtered = append(filtered, entry)
		}
	}

	if len(filtered) <= maxFiles {
		return filtered
	}

	return prioritize(filtered, maxFiles)
}

func shouldInclude(entry TreeEntry, maxSizeBytes int) bool {
	// Size check.
	if entry.Size > maxSizeBytes {
		return false
	}

	base := filepath.Base(entry.Path)

	// Always-skip patterns.
	for _, suffix := range alwaysSkipSuffixes {
		if strings.HasSuffix(entry.Path, suffix) {
			return false
		}
	}
	for _, substr := range alwaysSkipContains {
		if strings.Contains(base, substr) {
			return false
		}
	}

	// Excluded directories.
	parts := strings.Split(entry.Path, "/")
	for _, part := range parts[:len(parts)-1] { // Check each directory component.
		if excludedDirs[part] {
			return false
		}
	}
	// Also check combined paths like ".github/workflows".
	for i := 0; i < len(parts)-2; i++ {
		combined := parts[i] + "/" + parts[i+1]
		if excludedDirs[combined] {
			return false
		}
	}

	// Always-include files.
	if alwaysIncludeFiles[base] {
		return true
	}

	// Exclude known binary/non-text extensions.
	ext := strings.ToLower(filepath.Ext(entry.Path))
	if excludedExtensions[ext] {
		return false
	}

	// Files with no extension — include (Makefile, Dockerfile, scripts, etc.).
	// Everything else that passed the above checks — include.
	return true
}

// tier classifies a file into priority tiers for selection when over the limit.
func tier(entry TreeEntry) int {
	base := filepath.Base(entry.Path)
	baseLower := strings.ToLower(base)

	// Tier 1: critical project files.
	tier1Files := []string{
		"readme.md", "readme", "package.json", "go.mod", "cargo.toml",
		"pyproject.toml", "setup.py", "requirements.txt", "gemfile",
	}
	for _, f := range tier1Files {
		if baseLower == f {
			return 1
		}
	}
	// Main/index files.
	nameNoExt := strings.TrimSuffix(baseLower, filepath.Ext(baseLower))
	if nameNoExt == "main" || nameNoExt == "index" || nameNoExt == "app" || nameNoExt == "mod" {
		return 1
	}

	// Tier 2: source directories (check any path component, not just prefix).
	tier2Dirs := map[string]bool{
		"src": true, "lib": true, "pkg": true, "cmd": true, "app": true, "internal": true,
	}
	parts := strings.Split(entry.Path, "/")
	for _, part := range parts[:len(parts)-1] {
		if tier2Dirs[part] {
			return 2
		}
	}

	// Tier 3: everything else (examples, scripts, configs).
	return 3
}

func prioritize(entries []TreeEntry, maxFiles int) []TreeEntry {
	// Sort: by tier, then alphabetically within each tier.
	// Depth is NOT used as a tiebreaker — deeply nested source files are just
	// as important as shallow ones.
	sort.Slice(entries, func(i, j int) bool {
		ti, tj := tier(entries[i]), tier(entries[j])
		if ti != tj {
			return ti < tj
		}
		return entries[i].Path < entries[j].Path
	})

	if len(entries) > maxFiles {
		entries = entries[:maxFiles]
	}
	return entries
}
