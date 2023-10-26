import ast


# List of function names
function_names = ["func1", "func2", "func3"]

# Define a visitor class to simplify the AST
class SimplifyAST(ast.NodeTransformer):
    def __init__(self):
        self.function_references = set(function_names)
        self.imports = set()

    def _ast_contains_func_call(self, node):
        if isinstance(node, list):
            return any([self._ast_contains_func_call(x) for x in node])
        for x in ast.walk(node):
            if isinstance(x, ast.Call) and (x.func.id in self.function_references if 'id' in x.func._fields else x.func.attr in self.function_references):
                return True
        return False

    # def visit_Module(self, node):
    #     return self.generic_visit(node)
    
    def visit_FunctionType(self, node):
        return None
    
    def visit_Expr(self, node):
        if self._ast_contains_func_call(node):
            return node
        return None
    
    def visit_NamedExpr(self, node):
        # walrus operator
        return self.generic_visit(node)
    
    def visit_Import(self, node):
        for alias in node.names:
            self.imports.add(alias.name)
        return None

    def visit_ImportFrom(self, node):
        if node.module is not None:
            for alias in node.names:
                if alias.name in self.function_references:
                    self.imports.add(f"{node.module}.{alias.name}")
                if alias.asname is not None:
                    self.function_references.add(alias.asname)
        return None
    
    def visit_Assign(self, node):
        # TODO: check node.value to include node.targets in the functions we are looking for (only for this file)
        if self._ast_contains_func_call(node):
            return node
        return None
    
    def visit_AugAssign(self, node):
        return self.generic_visit(node)
    
    def visit_AnnAssign(self, node):
        return self.generic_visit(node)
    
    def visit_Return(self, node):
        return None

    def visit_Pass(self, node):
        return None
    
    def visit_Break(self, node):
        return None
    
    def visit_Continue(self, node):
        return None
    
    def visit_Delete(self, node):
        return None
    
    def visit_Assert(self, node):
        return self.generic_visit(node)

    def visit_Global(self, node):
        return self.generic_visit(node)

    def visit_Nonlocal(self, node):
        return self.generic_visit(node)

    def visit_Await(self, node):
        return self.generic_visit(node)

    def visit_Yield(self, node):
        return self.generic_visit(node)

    def visit_YieldFrom(self, node):
        return self.generic_visit(node)

    def visit_Raise(self, node):
        return self.generic_visit(node)

    def visit_Try(self, node):
        return self.generic_visit(node)

    def visit_ExceptHandler(self, node):
        return self.generic_visit(node)

    def visit_ClassDef(self, node):
        return self.generic_visit(node)

    def visit_FunctionDef(self, node):
        # Should be finished before the script, when getting all the function names from all files
        # self.function_references.add(node.name)
        return self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node):
        return self.generic_visit(node)

    def visit_For(self, node):
        return self.visit(node.body)

    def visit_AsyncFor(self, node):
        return self.generic_visit(node)

    def visit_If(self, node):
        if self._ast_contains_func_call(node.test):
            b = self._ast_contains_func_call(node.body)
            e = self._ast_contains_func_call(node.orelse)
            if b or e:
                return ast.If(
                    test=node.test,
                    body=[self.visit(stmt) for stmt in node.body] if b else [],
                    orelse=[self.visit(stmt) for stmt in node.orelse] if e else [],
                )
            return node.test
        b = self._ast_contains_func_call(node.body)
        e = self._ast_contains_func_call(node.orelse)
        new_statements = []
        if b:
            if e:
                return ast.If(
                    test=node.test,
                    body=[self.visit(stmt) for stmt in node.body] if b else [],
                    orelse=[self.visit(stmt) for stmt in node.orelse] if e else [],
                )
            for statement in node.body:
                new_statements.append(self.visit(statement))
            return new_statements
        elif e:
            for statement in node.orelse:
                new_statements.append(self.visit(statement))
            return new_statements
        return None

    def visit_While(self, node):
        return self.visit(node.body)

    def visit_With(self, node):
        return self.generic_visit(node)

    def visit_AsyncWith(self, node):
        return self.generic_visit(node)

    def visit_JoinedStr(self, node):
        return self.generic_visit(node)

    def visit_FormattedValue(self, node):
        return self.generic_visit(node)

    def visit_Name(self, node):
        return self.generic_visit(node)

    def visit_Constant(self, node):
        return self.generic_visit(node)

    def visit_List(self, node):
        # Visit all elements in the list
        for item in node.elts:
            self.visit(item)

    def visit_ListComp(self, node):
        return self.generic_visit(node)

    def visit_GeneratorExp(self, node):
        return self.generic_visit(node)

    def visit_SetComp(self, node):
        return self.generic_visit(node)

    def visit_DictComp(self, node):
        return self.generic_visit(node)

    def visit_IfExp(self, node):
        return self.generic_visit(node)

    def visit_Set(self, node):
        return self.generic_visit(node)

    def visit_Dict(self, node):
        return self.generic_visit(node)

    def visit_UnaryOp(self, node):
        return self.generic_visit(node)

    def visit_BinOp(self, node):
        return self.generic_visit(node)

    def visit_Compare(self, node):
        return self.generic_visit(node)

    def visit_BoolOp(self, node):
        return self.generic_visit(node)

    def visit_Attribute(self, node):
        return self.generic_visit(node)

    def visit_Call(self, node):
        if isinstance(node.func, ast.Name) and (node.func.id in self.function_references if 'id' in node.func._fields else node.func.attr in self.function_references):
            return self.generic_visit(node)
        return None

    def visit_Subscript(self, node):
        return self.generic_visit(node)

    def visit_Starred(self, node):
        return self.generic_visit(node)

    def visit_Ellipsis(self, node):
        return self.generic_visit(node)

    def visit_Slice(self, node):
        return self.generic_visit(node)

    def visit_Match(self, node):
        return self.generic_visit(node)

    def visit_arg(self, node):
        return self.generic_visit(node)

    def visit_arguments(self, node):
        return self.generic_visit(node)

    def visit_keyword(self, node):
        return self.generic_visit(node)

    def visit_Lambda(self, node):
        return self.generic_visit(node)

    def visit_alias(self, node):
        return self.generic_visit(node)

    def visit_withitem(self, node):
        return self.generic_visit(node)

    def visit_match_case(self, node):
        return self.generic_visit(node)

    def visit_MatchValue(self, node):
        return self.generic_visit(node)

    def visit_MatchSingleton(self, node):
        return self.generic_visit(node)

    def visit_MatchSequence(self, node):
        return self.generic_visit(node)

    def visit_MatchStar(self, node):
        return self.generic_visit(node)

    def visit_MatchMapping(self, node):
        return self.generic_visit(node)

    def visit_MatchClass(self, node):
        return self.generic_visit(node)

    def visit_MatchAs(self, node):
        return self.generic_visit(node)

    def visit_MatchOr(self, node):
        return self.generic_visit(node)

    def visit_Alias(self, node):
        return self.generic_visit(node)

def simplify_source_code(source_code):
    tree = ast.parse(source_code)
    simplifier = SimplifyAST()
    simplified_tree = simplifier.visit(tree)
    return simplified_tree

# Example usage:
if __name__ == "__main__":
    source_code = """
import find_funcs
import re

re.match("asd", "s")
str(1234)
"""
    simplified_tree = simplify_source_code(source_code)
    print()
    print(ast.dump(simplified_tree))
    print()
    print(ast.dump(ast.parse(source_code)))
