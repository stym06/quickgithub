package parser

import (
	sitter "github.com/smacker/go-tree-sitter"
	"github.com/smacker/go-tree-sitter/golang"
	"github.com/smacker/go-tree-sitter/java"
	"github.com/smacker/go-tree-sitter/javascript"
	"github.com/smacker/go-tree-sitter/python"
	"github.com/smacker/go-tree-sitter/rust"
	"github.com/smacker/go-tree-sitter/typescript/tsx"
	"github.com/smacker/go-tree-sitter/typescript/typescript"
)

// langEntry maps a file extension to a tree-sitter language and a canonical name.
type langEntry struct {
	Lang *sitter.Language
	Name string
}

var extToLang = map[string]langEntry{
	".go":   {Lang: golang.GetLanguage(), Name: "go"},
	".ts":   {Lang: typescript.GetLanguage(), Name: "typescript"},
	".tsx":  {Lang: tsx.GetLanguage(), Name: "tsx"},
	".js":   {Lang: javascript.GetLanguage(), Name: "javascript"},
	".jsx":  {Lang: tsx.GetLanguage(), Name: "jsx"},
	".py":   {Lang: python.GetLanguage(), Name: "python"},
	".rs":   {Lang: rust.GetLanguage(), Name: "rust"},
	".java": {Lang: java.GetLanguage(), Name: "java"},
}

// GetLanguage returns the tree-sitter language for the given file extension,
// or nil if the extension is not supported.
func GetLanguage(ext string) *sitter.Language {
	if entry, ok := extToLang[ext]; ok {
		return entry.Lang
	}
	return nil
}

// GetLanguageName returns the canonical language name for the given file extension,
// or an empty string if unsupported.
func GetLanguageName(ext string) string {
	if entry, ok := extToLang[ext]; ok {
		return entry.Name
	}
	return ""
}

// SupportedExtensions returns all file extensions that have tree-sitter support.
func SupportedExtensions() []string {
	exts := make([]string, 0, len(extToLang))
	for ext := range extToLang {
		exts = append(exts, ext)
	}
	return exts
}
