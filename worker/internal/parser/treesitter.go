package parser

import (
	"context"

	sitter "github.com/smacker/go-tree-sitter"
)

// Parser wraps a tree-sitter parser for reuse across multiple files.
type Parser struct {
	parser *sitter.Parser
}

// NewParser creates a new reusable tree-sitter parser.
func NewParser() *Parser {
	return &Parser{
		parser: sitter.NewParser(),
	}
}

// Parse parses the given source bytes using the specified language and returns
// the resulting syntax tree. The parser can be reused for different languages
// across calls.
func (p *Parser) Parse(source []byte, lang *sitter.Language) (*sitter.Tree, error) {
	p.parser.SetLanguage(lang)
	tree, err := p.parser.ParseCtx(context.Background(), nil, source)
	if err != nil {
		return nil, err
	}
	return tree, nil
}
