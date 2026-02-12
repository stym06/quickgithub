package llm

import (
	"encoding/json"
	"fmt"
	"path"
	"sort"
	"strings"

	"github.com/stym06/quickgithub/worker/internal/tasks"
)

const (
	minChunkTokens = 2000
	maxChunkTokens = 8000
	charsPerToken  = 4
)

// ChunkByDirectory groups file structures by top-level directory and returns
// balanced chunks suitable for LLM processing.
func ChunkByDirectory(structures []tasks.FileStructure) []tasks.DirectoryChunk {
	// Group files by top-level directory.
	groups := make(map[string][]tasks.FileStructure)
	for _, f := range structures {
		dir := topLevelDir(f.Path)
		groups[dir] = append(groups[dir], f)
	}

	// Build initial chunks with token estimates.
	var chunks []tasks.DirectoryChunk
	for dir, files := range groups {
		est := estimateTokens(files)
		chunks = append(chunks, tasks.DirectoryChunk{
			DirPath:       dir,
			Files:         files,
			TokenEstimate: est,
		})
	}

	// Merge small chunks together.
	chunks = mergeSmallChunks(chunks)

	// Split large chunks.
	chunks = splitLargeChunks(chunks)

	// Sort by priority: entry-point dirs first, then src-like, then others.
	sort.Slice(chunks, func(i, j int) bool {
		return dirPriority(chunks[i].DirPath) < dirPriority(chunks[j].DirPath)
	})

	return chunks
}

// topLevelDir returns the first path component, or "root" for top-level files.
func topLevelDir(filePath string) string {
	parts := strings.SplitN(filePath, "/", 3)
	if len(parts) <= 1 {
		return "root"
	}
	return parts[0]
}

// estimateTokens approximates the token count for a set of file structures.
func estimateTokens(files []tasks.FileStructure) int {
	data, _ := json.Marshal(files)
	return len(data) / charsPerToken
}

// mergeSmallChunks combines chunks smaller than minChunkTokens.
func mergeSmallChunks(chunks []tasks.DirectoryChunk) []tasks.DirectoryChunk {
	var result []tasks.DirectoryChunk
	var pendingFiles []tasks.FileStructure
	var pendingDirs []string
	pendingTokens := 0

	for _, ch := range chunks {
		if ch.TokenEstimate >= minChunkTokens {
			result = append(result, ch)
			continue
		}

		pendingFiles = append(pendingFiles, ch.Files...)
		pendingDirs = append(pendingDirs, ch.DirPath)
		pendingTokens += ch.TokenEstimate

		if pendingTokens >= minChunkTokens {
			result = append(result, tasks.DirectoryChunk{
				DirPath:       strings.Join(pendingDirs, "+"),
				Files:         pendingFiles,
				TokenEstimate: pendingTokens,
			})
			pendingFiles = nil
			pendingDirs = nil
			pendingTokens = 0
		}
	}

	// Flush remaining.
	if len(pendingFiles) > 0 {
		result = append(result, tasks.DirectoryChunk{
			DirPath:       strings.Join(pendingDirs, "+"),
			Files:         pendingFiles,
			TokenEstimate: pendingTokens,
		})
	}

	return result
}

// splitLargeChunks breaks chunks that exceed maxChunkTokens into smaller pieces.
func splitLargeChunks(chunks []tasks.DirectoryChunk) []tasks.DirectoryChunk {
	var result []tasks.DirectoryChunk
	for _, ch := range chunks {
		if ch.TokenEstimate <= maxChunkTokens {
			result = append(result, ch)
			continue
		}

		// Split by subdirectory within this top-level dir.
		subGroups := make(map[string][]tasks.FileStructure)
		for _, f := range ch.Files {
			subDir := secondLevelDir(f.Path, ch.DirPath)
			subGroups[subDir] = append(subGroups[subDir], f)
		}

		var current []tasks.FileStructure
		currentTokens := 0
		partIdx := 0

		for _, files := range subGroups {
			est := estimateTokens(files)
			if currentTokens+est > maxChunkTokens && len(current) > 0 {
				result = append(result, tasks.DirectoryChunk{
					DirPath:       fmt.Sprintf("%s (part %d)", ch.DirPath, partIdx),
					Files:         current,
					TokenEstimate: currentTokens,
				})
				current = nil
				currentTokens = 0
				partIdx++
			}
			current = append(current, files...)
			currentTokens += est
		}
		if len(current) > 0 {
			dirPath := ch.DirPath
			if partIdx > 0 {
				dirPath = fmt.Sprintf("%s (part %d)", ch.DirPath, partIdx)
			}
			result = append(result, tasks.DirectoryChunk{
				DirPath:       dirPath,
				Files:         current,
				TokenEstimate: currentTokens,
			})
		}
	}
	return result
}

// secondLevelDir extracts the subdirectory under a top-level directory.
func secondLevelDir(filePath, topDir string) string {
	rel := strings.TrimPrefix(filePath, topDir+"/")
	dir := path.Dir(rel)
	if dir == "." {
		return topDir
	}
	parts := strings.SplitN(dir, "/", 2)
	return topDir + "/" + parts[0]
}

// dirPriority returns a priority score (lower = higher priority) for directory names.
func dirPriority(dir string) int {
	d := strings.ToLower(dir)
	switch {
	case d == "root":
		return 0
	case strings.Contains(d, "cmd") || strings.Contains(d, "bin"):
		return 1
	case strings.Contains(d, "src") || strings.Contains(d, "lib") || strings.Contains(d, "pkg") || strings.Contains(d, "app"):
		return 2
	case strings.Contains(d, "internal") || strings.Contains(d, "core"):
		return 3
	case strings.Contains(d, "api") || strings.Contains(d, "server"):
		return 4
	case strings.Contains(d, "test") || strings.Contains(d, "spec"):
		return 8
	case strings.Contains(d, "doc") || strings.Contains(d, "example"):
		return 9
	default:
		return 5
	}
}
