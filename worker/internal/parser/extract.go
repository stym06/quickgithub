package parser

import (
	"regexp"
	"strings"
	"unicode"

	sitter "github.com/smacker/go-tree-sitter"
)

// FunctionSig represents a function or method signature.
type FunctionSig struct {
	Name       string `json:"name"`
	Params     string `json:"params"`
	ReturnType string `json:"returnType,omitempty"`
	IsExported bool   `json:"isExported"`
	DocComment string `json:"docComment,omitempty"`
}

// ClassSig represents a class or type definition with its members.
type ClassSig struct {
	Name       string        `json:"name"`
	Methods    []FunctionSig `json:"methods,omitempty"`
	Fields     []string      `json:"fields,omitempty"`
	IsExported bool          `json:"isExported"`
}

// FileStructure contains the extracted structural information from a source file.
type FileStructure struct {
	Path      string        `json:"path"`
	Language  string        `json:"language"`
	Imports   []string      `json:"imports,omitempty"`
	Exports   []string      `json:"exports,omitempty"`
	Functions []FunctionSig `json:"functions,omitempty"`
	Classes   []ClassSig    `json:"classes,omitempty"`
	Constants []string      `json:"constants,omitempty"`
	TypeDefs  []string      `json:"typeDefs,omitempty"`
}

// ExtractStructure walks the AST and extracts code structure for the given language.
// For unsupported languages, it falls back to regex-based extraction.
func ExtractStructure(source []byte, tree *sitter.Tree, lang string) FileStructure {
	fs := FileStructure{Language: lang}

	if tree == nil {
		return extractFallback(source, fs)
	}

	root := tree.RootNode()

	switch lang {
	case "go":
		extractGo(root, source, &fs)
	case "typescript", "tsx":
		extractTypeScript(root, source, &fs)
	case "javascript", "jsx":
		extractJavaScript(root, source, &fs)
	case "python":
		extractPython(root, source, &fs)
	case "rust":
		extractRust(root, source, &fs)
	case "java":
		extractJava(root, source, &fs)
	default:
		return extractFallback(source, fs)
	}

	return fs
}

// nodeText returns the source text of a tree-sitter node.
func nodeText(node *sitter.Node, source []byte) string {
	return node.Content(source)
}

// truncateDocComment keeps only the first 2 lines of a doc comment.
func truncateDocComment(comment string) string {
	lines := strings.SplitN(comment, "\n", 3)
	if len(lines) <= 2 {
		return strings.TrimSpace(comment)
	}
	return strings.TrimSpace(strings.Join(lines[:2], "\n"))
}

// precedingComment gets the comment node directly above the given node, if any.
func precedingComment(node *sitter.Node, source []byte) string {
	prev := node.PrevNamedSibling()
	if prev == nil {
		return ""
	}
	t := prev.Type()
	if t == "comment" || t == "block_comment" || t == "line_comment" {
		return truncateDocComment(nodeText(prev, source))
	}
	return ""
}

// iterChildren calls fn for each child of node.
func iterChildren(node *sitter.Node, fn func(child *sitter.Node)) {
	for i := 0; i < int(node.NamedChildCount()); i++ {
		fn(node.NamedChild(i))
	}
}

// --- Go ---

func extractGo(root *sitter.Node, source []byte, fs *FileStructure) {
	iterChildren(root, func(child *sitter.Node) {
		switch child.Type() {
		case "import_declaration":
			extractGoImports(child, source, fs)
		case "function_declaration":
			extractGoFunc(child, source, fs)
		case "method_declaration":
			extractGoFunc(child, source, fs)
		case "type_declaration":
			extractGoType(child, source, fs)
		case "const_declaration":
			extractGoConsts(child, source, fs)
		}
	})
}

func extractGoImports(node *sitter.Node, source []byte, fs *FileStructure) {
	iterChildren(node, func(child *sitter.Node) {
		if child.Type() == "import_spec_list" {
			iterChildren(child, func(spec *sitter.Node) {
				path := findChildByType(spec, "interpreted_string_literal")
				if path != nil {
					fs.Imports = append(fs.Imports, strings.Trim(nodeText(path, source), `"`))
				}
			})
		} else if child.Type() == "import_spec" {
			path := findChildByType(child, "interpreted_string_literal")
			if path != nil {
				fs.Imports = append(fs.Imports, strings.Trim(nodeText(path, source), `"`))
			}
		}
	})
}

func extractGoFunc(node *sitter.Node, source []byte, fs *FileStructure) {
	nameNode := findChildByType(node, "identifier")
	if nameNode == nil {
		nameNode = findChildByType(node, "field_identifier")
	}
	if nameNode == nil {
		return
	}
	name := nodeText(nameNode, source)

	params := ""
	if pl := findChildByType(node, "parameter_list"); pl != nil {
		params = nodeText(pl, source)
	}

	ret := ""
	if rl := findChildByType(node, "result"); rl != nil {
		ret = nodeText(rl, source)
	}

	doc := precedingComment(node, source)

	fs.Functions = append(fs.Functions, FunctionSig{
		Name:       name,
		Params:     params,
		ReturnType: ret,
		IsExported: isGoExported(name),
		DocComment: doc,
	})
}

func extractGoType(node *sitter.Node, source []byte, fs *FileStructure) {
	iterChildren(node, func(spec *sitter.Node) {
		if spec.Type() != "type_spec" {
			return
		}
		nameNode := findChildByType(spec, "type_identifier")
		if nameNode == nil {
			return
		}
		name := nodeText(nameNode, source)

		typeBody := findChildByType(spec, "struct_type")
		if typeBody != nil {
			cls := ClassSig{Name: name, IsExported: isGoExported(name)}
			fieldList := findChildByType(typeBody, "field_declaration_list")
			if fieldList != nil {
				iterChildren(fieldList, func(field *sitter.Node) {
					if field.Type() == "field_declaration" {
						cls.Fields = append(cls.Fields, strings.TrimSpace(nodeText(field, source)))
					}
				})
			}
			fs.Classes = append(fs.Classes, cls)
		} else {
			fs.TypeDefs = append(fs.TypeDefs, name)
		}
	})
}

func extractGoConsts(node *sitter.Node, source []byte, fs *FileStructure) {
	iterChildren(node, func(child *sitter.Node) {
		if child.Type() == "const_spec" {
			nameNode := findChildByType(child, "identifier")
			if nameNode != nil {
				fs.Constants = append(fs.Constants, nodeText(nameNode, source))
			}
		}
	})
}

func isGoExported(name string) bool {
	if name == "" {
		return false
	}
	return unicode.IsUpper(rune(name[0]))
}

// --- TypeScript / TSX ---

func extractTypeScript(root *sitter.Node, source []byte, fs *FileStructure) {
	iterChildren(root, func(child *sitter.Node) {
		switch child.Type() {
		case "import_statement":
			fs.Imports = append(fs.Imports, cleanImport(nodeText(child, source)))
		case "export_statement":
			extractTSExport(child, source, fs)
		case "function_declaration":
			extractTSFunc(child, source, fs, false)
		case "class_declaration":
			extractTSClass(child, source, fs, false)
		case "lexical_declaration":
			extractTSArrowFunc(child, source, fs, false)
		case "type_alias_declaration":
			nameNode := findChildByType(child, "type_identifier")
			if nameNode != nil {
				fs.TypeDefs = append(fs.TypeDefs, nodeText(nameNode, source))
			}
		case "interface_declaration":
			nameNode := findChildByType(child, "type_identifier")
			if nameNode != nil {
				fs.TypeDefs = append(fs.TypeDefs, nodeText(nameNode, source))
			}
		}
	})
}

func extractTSExport(node *sitter.Node, source []byte, fs *FileStructure) {
	iterChildren(node, func(child *sitter.Node) {
		switch child.Type() {
		case "function_declaration":
			extractTSFunc(child, source, fs, true)
		case "class_declaration":
			extractTSClass(child, source, fs, true)
		case "lexical_declaration":
			extractTSArrowFunc(child, source, fs, true)
		case "type_alias_declaration":
			nameNode := findChildByType(child, "type_identifier")
			if nameNode != nil {
				name := nodeText(nameNode, source)
				fs.TypeDefs = append(fs.TypeDefs, name)
				fs.Exports = append(fs.Exports, name)
			}
		case "interface_declaration":
			nameNode := findChildByType(child, "type_identifier")
			if nameNode != nil {
				name := nodeText(nameNode, source)
				fs.TypeDefs = append(fs.TypeDefs, name)
				fs.Exports = append(fs.Exports, name)
			}
		default:
			text := strings.TrimSpace(nodeText(node, source))
			if text != "" && !strings.HasPrefix(text, "export {") {
				// skip re-exports
			}
			if strings.HasPrefix(text, "export {") || strings.HasPrefix(text, "export default") {
				fs.Exports = append(fs.Exports, cleanExport(text))
			}
		}
	})
}

func extractTSFunc(node *sitter.Node, source []byte, fs *FileStructure, exported bool) {
	nameNode := findChildByType(node, "identifier")
	if nameNode == nil {
		return
	}
	name := nodeText(nameNode, source)
	params := ""
	if pl := findChildByType(node, "formal_parameters"); pl != nil {
		params = nodeText(pl, source)
	}
	ret := ""
	if ta := findChildByType(node, "type_annotation"); ta != nil {
		ret = nodeText(ta, source)
	}
	doc := precedingComment(node, source)

	fs.Functions = append(fs.Functions, FunctionSig{
		Name:       name,
		Params:     params,
		ReturnType: ret,
		IsExported: exported,
		DocComment: doc,
	})
	if exported {
		fs.Exports = append(fs.Exports, name)
	}
}

func extractTSClass(node *sitter.Node, source []byte, fs *FileStructure, exported bool) {
	nameNode := findChildByType(node, "type_identifier")
	if nameNode == nil {
		nameNode = findChildByType(node, "identifier")
	}
	if nameNode == nil {
		return
	}
	name := nodeText(nameNode, source)
	cls := ClassSig{Name: name, IsExported: exported}

	body := findChildByType(node, "class_body")
	if body != nil {
		iterChildren(body, func(member *sitter.Node) {
			switch member.Type() {
			case "method_definition":
				mName := findChildByType(member, "property_identifier")
				if mName != nil {
					p := ""
					if pl := findChildByType(member, "formal_parameters"); pl != nil {
						p = nodeText(pl, source)
					}
					cls.Methods = append(cls.Methods, FunctionSig{
						Name:   nodeText(mName, source),
						Params: p,
					})
				}
			case "public_field_definition":
				cls.Fields = append(cls.Fields, strings.TrimSpace(nodeText(member, source)))
			}
		})
	}

	fs.Classes = append(fs.Classes, cls)
	if exported {
		fs.Exports = append(fs.Exports, name)
	}
}

func extractTSArrowFunc(node *sitter.Node, source []byte, fs *FileStructure, exported bool) {
	iterChildren(node, func(decl *sitter.Node) {
		if decl.Type() != "variable_declarator" {
			return
		}
		nameNode := findChildByType(decl, "identifier")
		if nameNode == nil {
			return
		}
		arrow := findChildByType(decl, "arrow_function")
		if arrow == nil {
			return
		}
		name := nodeText(nameNode, source)
		params := ""
		if pl := findChildByType(arrow, "formal_parameters"); pl != nil {
			params = nodeText(pl, source)
		}
		ret := ""
		if ta := findChildByType(arrow, "type_annotation"); ta != nil {
			ret = nodeText(ta, source)
		}
		doc := precedingComment(node, source)
		fs.Functions = append(fs.Functions, FunctionSig{
			Name:       name,
			Params:     params,
			ReturnType: ret,
			IsExported: exported,
			DocComment: doc,
		})
		if exported {
			fs.Exports = append(fs.Exports, name)
		}
	})
}

// --- JavaScript / JSX (reuses TS extraction since tree-sitter grammars are compatible) ---

func extractJavaScript(root *sitter.Node, source []byte, fs *FileStructure) {
	iterChildren(root, func(child *sitter.Node) {
		switch child.Type() {
		case "import_statement":
			fs.Imports = append(fs.Imports, cleanImport(nodeText(child, source)))
		case "export_statement":
			extractTSExport(child, source, fs)
		case "function_declaration":
			extractTSFunc(child, source, fs, false)
		case "class_declaration":
			extractTSClass(child, source, fs, false)
		case "lexical_declaration":
			extractTSArrowFunc(child, source, fs, false)
		}
	})
}

// --- Python ---

func extractPython(root *sitter.Node, source []byte, fs *FileStructure) {
	iterChildren(root, func(child *sitter.Node) {
		switch child.Type() {
		case "import_statement", "import_from_statement":
			fs.Imports = append(fs.Imports, strings.TrimSpace(nodeText(child, source)))
		case "function_definition":
			extractPyFunc(child, source, fs)
		case "class_definition":
			extractPyClass(child, source, fs)
		case "expression_statement":
			extractPyAllExport(child, source, fs)
		}
	})
}

func extractPyFunc(node *sitter.Node, source []byte, fs *FileStructure) {
	nameNode := findChildByType(node, "identifier")
	if nameNode == nil {
		return
	}
	name := nodeText(nameNode, source)
	params := ""
	if pl := findChildByType(node, "parameters"); pl != nil {
		params = nodeText(pl, source)
	}
	ret := ""
	if ra := findChildByType(node, "type"); ra != nil {
		ret = nodeText(ra, source)
	}
	doc := ""
	body := findChildByType(node, "block")
	if body != nil && body.NamedChildCount() > 0 {
		first := body.NamedChild(0)
		if first.Type() == "expression_statement" {
			str := findChildByType(first, "string")
			if str != nil {
				doc = truncateDocComment(nodeText(str, source))
			}
		}
	}

	fs.Functions = append(fs.Functions, FunctionSig{
		Name:       name,
		Params:     params,
		ReturnType: ret,
		IsExported: !strings.HasPrefix(name, "_"),
		DocComment: doc,
	})
}

func extractPyClass(node *sitter.Node, source []byte, fs *FileStructure) {
	nameNode := findChildByType(node, "identifier")
	if nameNode == nil {
		return
	}
	name := nodeText(nameNode, source)
	cls := ClassSig{Name: name, IsExported: !strings.HasPrefix(name, "_")}

	body := findChildByType(node, "block")
	if body != nil {
		iterChildren(body, func(member *sitter.Node) {
			if member.Type() == "function_definition" {
				mName := findChildByType(member, "identifier")
				if mName != nil {
					p := ""
					if pl := findChildByType(member, "parameters"); pl != nil {
						p = nodeText(pl, source)
					}
					cls.Methods = append(cls.Methods, FunctionSig{
						Name:   nodeText(mName, source),
						Params: p,
					})
				}
			}
		})
	}

	fs.Classes = append(fs.Classes, cls)
}

func extractPyAllExport(node *sitter.Node, source []byte, fs *FileStructure) {
	text := nodeText(node, source)
	if strings.Contains(text, "__all__") {
		// Extract names from __all__ = ["name1", "name2"]
		re := regexp.MustCompile(`["'](\w+)["']`)
		matches := re.FindAllStringSubmatch(text, -1)
		for _, m := range matches {
			fs.Exports = append(fs.Exports, m[1])
		}
	}
}

// --- Rust ---

func extractRust(root *sitter.Node, source []byte, fs *FileStructure) {
	iterChildren(root, func(child *sitter.Node) {
		switch child.Type() {
		case "use_declaration":
			fs.Imports = append(fs.Imports, strings.TrimSpace(nodeText(child, source)))
		case "function_item":
			extractRustFunc(child, source, fs)
		case "struct_item":
			extractRustStruct(child, source, fs)
		case "impl_item":
			extractRustImpl(child, source, fs)
		case "const_item":
			nameNode := findChildByType(child, "identifier")
			if nameNode != nil {
				fs.Constants = append(fs.Constants, nodeText(nameNode, source))
			}
		case "type_item":
			nameNode := findChildByType(child, "type_identifier")
			if nameNode != nil {
				fs.TypeDefs = append(fs.TypeDefs, nodeText(nameNode, source))
			}
		case "enum_item":
			nameNode := findChildByType(child, "type_identifier")
			if nameNode != nil {
				fs.TypeDefs = append(fs.TypeDefs, nodeText(nameNode, source))
			}
		}
	})
}

func extractRustFunc(node *sitter.Node, source []byte, fs *FileStructure) {
	nameNode := findChildByType(node, "identifier")
	if nameNode == nil {
		return
	}
	name := nodeText(nameNode, source)
	params := ""
	if pl := findChildByType(node, "parameters"); pl != nil {
		params = nodeText(pl, source)
	}
	ret := ""
	if retType := findChildByType(node, "type_identifier"); retType != nil {
		ret = nodeText(retType, source)
	}
	exported := hasVisibilityModifier(node, source)
	doc := precedingComment(node, source)

	fs.Functions = append(fs.Functions, FunctionSig{
		Name:       name,
		Params:     params,
		ReturnType: ret,
		IsExported: exported,
		DocComment: doc,
	})
}

func extractRustStruct(node *sitter.Node, source []byte, fs *FileStructure) {
	nameNode := findChildByType(node, "type_identifier")
	if nameNode == nil {
		return
	}
	name := nodeText(nameNode, source)
	exported := hasVisibilityModifier(node, source)
	cls := ClassSig{Name: name, IsExported: exported}

	fieldList := findChildByType(node, "field_declaration_list")
	if fieldList != nil {
		iterChildren(fieldList, func(field *sitter.Node) {
			if field.Type() == "field_declaration" {
				fName := findChildByType(field, "field_identifier")
				if fName != nil {
					cls.Fields = append(cls.Fields, nodeText(fName, source))
				}
			}
		})
	}

	fs.Classes = append(fs.Classes, cls)
}

func extractRustImpl(node *sitter.Node, source []byte, fs *FileStructure) {
	typeNode := findChildByType(node, "type_identifier")
	if typeNode == nil {
		return
	}
	typeName := nodeText(typeNode, source)

	body := findChildByType(node, "declaration_list")
	if body == nil {
		return
	}

	iterChildren(body, func(member *sitter.Node) {
		if member.Type() == "function_item" {
			nameNode := findChildByType(member, "identifier")
			if nameNode == nil {
				return
			}
			name := nodeText(nameNode, source)
			params := ""
			if pl := findChildByType(member, "parameters"); pl != nil {
				params = nodeText(pl, source)
			}
			exported := hasVisibilityModifier(member, source)

			// Attach impl methods to existing class or create a new entry
			found := false
			for i := range fs.Classes {
				if fs.Classes[i].Name == typeName {
					fs.Classes[i].Methods = append(fs.Classes[i].Methods, FunctionSig{
						Name:       name,
						Params:     params,
						IsExported: exported,
					})
					found = true
					break
				}
			}
			if !found {
				fs.Classes = append(fs.Classes, ClassSig{
					Name: typeName,
					Methods: []FunctionSig{{
						Name:       name,
						Params:     params,
						IsExported: exported,
					}},
				})
			}
		}
	})
}

func hasVisibilityModifier(node *sitter.Node, source []byte) bool {
	for i := 0; i < int(node.ChildCount()); i++ {
		child := node.Child(i)
		if child.Type() == "visibility_modifier" {
			return true
		}
	}
	return false
}

// --- Java ---

func extractJava(root *sitter.Node, source []byte, fs *FileStructure) {
	iterChildren(root, func(child *sitter.Node) {
		switch child.Type() {
		case "import_declaration":
			fs.Imports = append(fs.Imports, cleanImport(nodeText(child, source)))
		case "class_declaration":
			extractJavaClass(child, source, fs)
		}
	})
}

func extractJavaClass(node *sitter.Node, source []byte, fs *FileStructure) {
	nameNode := findChildByType(node, "identifier")
	if nameNode == nil {
		return
	}
	name := nodeText(nameNode, source)
	exported := nodeHasModifier(node, source, "public")
	cls := ClassSig{Name: name, IsExported: exported}

	body := findChildByType(node, "class_body")
	if body != nil {
		iterChildren(body, func(member *sitter.Node) {
			switch member.Type() {
			case "method_declaration":
				mName := findChildByType(member, "identifier")
				if mName != nil {
					p := ""
					if pl := findChildByType(member, "formal_parameters"); pl != nil {
						p = nodeText(pl, source)
					}
					cls.Methods = append(cls.Methods, FunctionSig{
						Name:       nodeText(mName, source),
						Params:     p,
						IsExported: nodeHasModifier(member, source, "public"),
					})
				}
			case "field_declaration":
				cls.Fields = append(cls.Fields, strings.TrimSpace(nodeText(member, source)))
			}
		})
	}

	fs.Classes = append(fs.Classes, cls)
	if exported {
		fs.Exports = append(fs.Exports, name)
	}
}

func nodeHasModifier(node *sitter.Node, source []byte, modifier string) bool {
	mods := findChildByType(node, "modifiers")
	if mods == nil {
		return false
	}
	return strings.Contains(nodeText(mods, source), modifier)
}

// --- Fallback (regex-based) ---

var (
	reFuncGeneric  = regexp.MustCompile(`(?m)^(?:export\s+)?(?:async\s+)?(?:pub\s+)?(?:fn|func|function|def)\s+(\w+)`)
	reClassGeneric = regexp.MustCompile(`(?m)^(?:export\s+)?(?:pub\s+)?(?:class|struct|interface|trait)\s+(\w+)`)
)

func extractFallback(source []byte, fs FileStructure) FileStructure {
	for _, m := range reFuncGeneric.FindAllSubmatch(source, -1) {
		fs.Functions = append(fs.Functions, FunctionSig{Name: string(m[1])})
	}
	for _, m := range reClassGeneric.FindAllSubmatch(source, -1) {
		fs.Classes = append(fs.Classes, ClassSig{Name: string(m[1])})
	}
	return fs
}

// --- Helpers ---

func findChildByType(node *sitter.Node, childType string) *sitter.Node {
	for i := 0; i < int(node.NamedChildCount()); i++ {
		child := node.NamedChild(i)
		if child.Type() == childType {
			return child
		}
	}
	// Also check unnamed children for things like visibility_modifier
	for i := 0; i < int(node.ChildCount()); i++ {
		child := node.Child(i)
		if child.Type() == childType {
			return child
		}
	}
	return nil
}

func cleanImport(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimSuffix(s, ";")
	return s
}

func cleanExport(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimSuffix(s, ";")
	return s
}
