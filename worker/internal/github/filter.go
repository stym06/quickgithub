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
// maxCriticalSizeBytes is a higher size limit for tier-0 critical files (READMEs, configs).
// If maxCriticalSizeBytes <= 0, it defaults to maxSizeBytes.
func FilterTree(entries []TreeEntry, maxFiles, maxSizeBytes int, maxCriticalSizeBytes ...int) []TreeEntry {
	criticalSize := maxSizeBytes
	if len(maxCriticalSizeBytes) > 0 && maxCriticalSizeBytes[0] > 0 {
		criticalSize = maxCriticalSizeBytes[0]
	}

	var filtered []TreeEntry

	for _, entry := range entries {
		if shouldInclude(entry, maxSizeBytes, criticalSize) {
			filtered = append(filtered, entry)
		}
	}

	if len(filtered) <= maxFiles {
		return filtered
	}

	return prioritize(filtered, maxFiles)
}

func shouldInclude(entry TreeEntry, maxSizeBytes, maxCriticalSizeBytes int) bool {
	base := filepath.Base(entry.Path)

	// Critical files get a higher size limit.
	sizeLimit := maxSizeBytes
	if isCriticalFile(base) {
		sizeLimit = maxCriticalSizeBytes
	}
	if entry.Size > sizeLimit {
		return false
	}

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

// isCriticalFile returns true for files that deserve a higher size limit.
func isCriticalFile(baseName string) bool {
	lower := strings.ToLower(baseName)
	switch lower {
	case "readme.md", "readme", "readme.rst", "readme.txt",
		"package.json", "go.mod", "cargo.toml", "pyproject.toml",
		"setup.py", "requirements.txt", "gemfile", "pom.xml",
		"build.gradle", "composer.json":
		return true
	}
	return false
}

// tier classifies a file into priority tiers for selection when over the limit.
// Tier 0: Critical project files (READMEs, manifests, configs).
// Tier 1: Entry points (main.go, index.ts, app.py, cmd/**/*.go, src/main.*, etc.).
// Tier 2: Source code in recognized source directories.
// Tier 3: Other source files not in recognized directories.
// Tier 4: Test files, examples, docs, fixtures.
func tier(entry TreeEntry) int {
	base := filepath.Base(entry.Path)
	baseLower := strings.ToLower(base)
	pathLower := strings.ToLower(entry.Path)
	parts := strings.Split(entry.Path, "/")

	// Tier 0: Critical project files.
	tier0Files := map[string]bool{
		"readme.md": true, "readme": true, "readme.rst": true, "readme.txt": true,
		"package.json": true, "go.mod": true, "cargo.toml": true,
		"pyproject.toml": true, "setup.py": true, "requirements.txt": true,
		"gemfile": true, "pom.xml": true, "build.gradle": true,
		"composer.json": true, "dockerfile": true, "makefile": true,
		"docker-compose.yml": true, "docker-compose.yaml": true,
	}
	if tier0Files[baseLower] {
		return 0
	}

	// Tier 4: Test files, examples, docs, fixtures (check early to deprioritize).
	if isTestOrAuxFile(pathLower, baseLower) {
		return 4
	}

	// Tier 1: Entry points.
	nameNoExt := strings.TrimSuffix(baseLower, filepath.Ext(baseLower))
	entryPointNames := map[string]bool{
		"main": true, "index": true, "app": true, "server": true, "cli": true,
	}
	if entryPointNames[nameNoExt] {
		return 1
	}
	// cmd/**/*.go pattern (Go CLI entry points).
	if len(parts) >= 2 && strings.ToLower(parts[0]) == "cmd" {
		return 1
	}
	// src/main.*, src/index.*, src/app.* patterns.
	if len(parts) >= 2 && strings.ToLower(parts[0]) == "src" && entryPointNames[nameNoExt] {
		return 1
	}
	// bin/ directory files.
	for _, part := range parts[:len(parts)-1] {
		if strings.ToLower(part) == "bin" {
			return 1
		}
	}

	// Tier 2: Source code in recognized source directories.
	sourceDirs := map[string]bool{
		"src": true, "lib": true, "pkg": true, "cmd": true, "app": true,
		"internal": true, "core": true, "api": true, "server": true,
		"services": true, "handlers": true, "controllers": true, "models": true,
		"routes": true, "middleware": true, "components": true, "pages": true,
	}
	for _, part := range parts[:len(parts)-1] {
		if sourceDirs[strings.ToLower(part)] {
			return 2
		}
	}

	// Tier 3: Everything else.
	return 3
}

// isTestOrAuxFile returns true for test files, examples, docs, and fixtures.
func isTestOrAuxFile(pathLower, baseLower string) bool {
	// Test file patterns.
	if strings.HasSuffix(baseLower, "_test.go") ||
		strings.HasSuffix(baseLower, ".test.ts") ||
		strings.HasSuffix(baseLower, ".test.tsx") ||
		strings.HasSuffix(baseLower, ".test.js") ||
		strings.HasSuffix(baseLower, ".test.jsx") ||
		strings.HasSuffix(baseLower, ".spec.ts") ||
		strings.HasSuffix(baseLower, ".spec.tsx") ||
		strings.HasSuffix(baseLower, ".spec.js") ||
		strings.HasSuffix(baseLower, ".spec.jsx") ||
		strings.HasPrefix(baseLower, "test_") ||
		strings.HasSuffix(baseLower, "_test.py") {
		return true
	}

	// Directories that indicate non-primary content.
	auxDirs := map[string]bool{
		"examples": true, "example": true, "docs": true, "doc": true,
		"fixtures": true, "fixture": true, "mocks": true, "mock": true,
		"stubs": true, "samples": true, "sample": true, "demo": true,
		"demos": true, "benchmarks": true, "benchmark": true,
		"e2e": true, "cypress": true, "playwright": true,
		"stories": true, "storybook": true, ".storybook": true,
	}
	parts := strings.Split(pathLower, "/")
	for _, part := range parts[:len(parts)-1] {
		if auxDirs[part] {
			return true
		}
	}

	return false
}

// detectPackages finds package root directories (those containing manifests)
// to enable fair monorepo representation.
func detectPackages(entries []TreeEntry) map[string]bool {
	manifestFiles := map[string]bool{
		"package.json": true, "go.mod": true, "cargo.toml": true,
		"pyproject.toml": true, "setup.py": true, "pom.xml": true,
		"build.gradle": true, "composer.json": true, "gemfile": true,
	}

	pkgRoots := make(map[string]bool)
	for _, entry := range entries {
		base := strings.ToLower(filepath.Base(entry.Path))
		if !manifestFiles[base] {
			continue
		}
		dir := filepath.Dir(entry.Path)
		if dir == "." {
			dir = ""
		}
		// Only count subdirectory manifests (not the root one).
		if dir != "" {
			pkgRoots[dir] = true
		}
	}
	return pkgRoots
}

// packageRoot returns the monorepo package root for a file path, or "" if it
// doesn't belong to a detected package.
func packageRoot(filePath string, pkgRoots map[string]bool) string {
	dir := filepath.Dir(filePath)
	for dir != "." && dir != "" {
		if pkgRoots[dir] {
			return dir
		}
		dir = filepath.Dir(dir)
	}
	return ""
}

func prioritize(entries []TreeEntry, maxFiles int) []TreeEntry {
	pkgRoots := detectPackages(entries)
	isMonorepo := len(pkgRoots) > 1

	// Sort: by tier, then alphabetically within each tier.
	sort.Slice(entries, func(i, j int) bool {
		ti, tj := tier(entries[i]), tier(entries[j])
		if ti != tj {
			return ti < tj
		}
		return entries[i].Path < entries[j].Path
	})

	if !isMonorepo || len(entries) <= maxFiles {
		if len(entries) > maxFiles {
			entries = entries[:maxFiles]
		}
		return entries
	}

	// Monorepo-aware selection: ensure each package gets fair representation.
	// Reserve a portion of slots proportionally, then fill the rest by priority.
	selected := make(map[int]bool)
	pkgCounts := make(map[string]int) // files per package in result
	totalPkgs := len(pkgRoots)

	// Each package gets at least minPerPkg slots (from its highest-priority files).
	minPerPkg := maxFiles / (totalPkgs + 1) // +1 for root/non-package files
	if minPerPkg < 5 {
		minPerPkg = 5
	}
	if minPerPkg > 100 {
		minPerPkg = 100
	}

	// First pass: guarantee minimum representation per package.
	for i, entry := range entries {
		pkg := packageRoot(entry.Path, pkgRoots)
		if pkg == "" {
			continue
		}
		if pkgCounts[pkg] < minPerPkg {
			selected[i] = true
			pkgCounts[pkg]++
		}
	}

	// Second pass: fill remaining slots by global priority order.
	for i := range entries {
		if len(selected) >= maxFiles {
			break
		}
		if !selected[i] {
			selected[i] = true
		}
	}

	result := make([]TreeEntry, 0, len(selected))
	for i, entry := range entries {
		if selected[i] {
			result = append(result, entry)
		}
	}
	return result
}
