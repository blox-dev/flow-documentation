import ast
from _ast import AST
import importlib.util
import sys

def is_module_user_defined(name):
    try:
        module = importlib.util.find_spec(name)
        if module.origin is not None and not module.origin.startswith(sys.prefix):
            return True
        return False
    except Exception as e:
        # print(e)
        return False

# Define a visitor class to simplify the AST
class SimplifyAST(ast.NodeTransformer):
    def __init__(self, funcs = dict()):
        self.function_references = funcs
        self.imports = set()
        self.track_funcs = dict()
        self.track_mod_name = ""

    def simplify_ast(self, astt, mod_name):
        if not isinstance(astt, AST):
            astt = ast.parse(astt)
        self.track_mod_name = mod_name
        # TODO: something is wrong with the function references here
        self.track_funcs = self.function_references["gpt"]
        # self.track_funcs = self.function_references[mod_name]
        simplified_tree = self.visit(astt)
        return simplified_tree

    def _ast_contains_func_call(self, node):
        if isinstance(node, list):
            return any([self._ast_contains_func_call(x) for x in node])
        for x in ast.walk(node):
            if isinstance(x, ast.Call):
                if isinstance(x.func, ast.Name):
                    # if is_module_user_defined
                    # Handle simple function calls like "foo()"
                    for k, v in self.track_funcs.items():
                        if x.func.id in v and is_module_user_defined(k):
                            return True
                elif isinstance(x.func, ast.Attribute):
                    # Handle method calls like "obj.method()"
                    y = self._get_attribute_chain(x.func)
                    for k in self.track_funcs.keys():
                        if y.startswith(k) and is_module_user_defined(k):
                            # func_name = y[len(k)+1:]
                            # if func_name in self.track_funcs[k]:
                            return True
        return False

    def _get_attribute_chain(self, node):
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            return f"{self._get_attribute_chain(node.value)}.{node.attr}"
        return None

    # def visit_Module(self, node):
    #     return self.generic_visit(node)
    
    def visit_FunctionType(self, node):
        return None
    
    def visit_Expr(self, node):
        if self._ast_contains_func_call(node):
            return self.generic_visit(node)
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
    
    # def visit_Assign(self, node):
    #     # TODO: check node.value to include node.targets in the functions we are looking for (only for this file)
    #     if self._ast_contains_func_call(node):
    #         return self.generic_visit(node)
    #     return None
    
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

    def _get_attribute_chain(self, node):
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            return f"{self._get_attribute_chain(node.value)}.{node.attr}"
        return None

    def visit_Call(self, node):
        if isinstance(node.func, ast.Name):
            # Handle simple function calls like "foo()"
            for v in self.track_funcs.values():
                if node.func.id in v:
                    return node
            return None
        elif isinstance(node.func, ast.Attribute):
            # Handle method calls like "obj.method()"
            y = self._get_attribute_chain(node.func)
            for k in self.track_funcs.keys():
                if y.startswith(k):
                    func_name = y[len(k)+1:]
                    if func_name in self.track_funcs[k]:
                        return node
                    return None
            # else:
                # assert False
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
