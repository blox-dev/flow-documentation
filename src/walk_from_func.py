import ast
import importlib.util
import re
import sys
from collections import defaultdict
from create_graph import create_graph
from pathlib import Path
from ast2json import ast2json
import json

proj_path = ''

def get_module_file(name):
    try:
        module = importlib.util.find_spec(name)
        # module.origin can be  = 'built-in', in which case we should ignore for unnecessary imports
        return module.origin if module.origin != 'built-in' else False
    except Exception as e:
        # print(e)
        return False

def is_module_user_defined(name):
    try:
        module = importlib.util.find_spec(name)
        if module.origin is not None and not module.origin.startswith(sys.prefix) and module.origin.lower().startswith(proj_path.lower()):
            return True
        return False
    except Exception as e:
        # print(e)
        return False

class ImportVisitor(ast.NodeVisitor):
    def __init__(self, target_module, target_funcs, modules_to_import, already_visited, routes = dict()):
        self.current_module = target_module # str
        self.target_funcs = defaultdict(set, target_funcs) # {"mod1": {"func1", "func2"}, "mod2": {func1, func2}}
        self.already_visited = defaultdict(set, already_visited) # {"mod1": {func1", "func2"}, "mod2": {func1, func2}}
        self.modules_to_import = defaultdict(lambda: ("", set()), modules_to_import) # {"name": ("path", {"func1", "func2"})}
        self.imported_modules = set(already_visited.keys()) # {"name", "name2"}
        self.asts = defaultdict(lambda: defaultdict(set))
        self.references_per_module = defaultdict(lambda: defaultdict(set))
        self.routes = routes

    def visit_Import(self, node):
        for alias in node.names:
            x = get_module_file(alias.name)
            if x:
                self.references_per_module[self.current_module][alias.name] = set()
                self.modules_to_import[alias.name] = (x, set())
        return node

    def visit_ImportFrom(self, node):
        if node.module is not None:
            x = get_module_file(node.module)
            if x:
                self.references_per_module[self.current_module][node.module].update(set(map(lambda x: x.asname if x.asname else x.name, node.names)))
                self.modules_to_import[node.module] = (x, set(map(lambda x: x.asname if x.asname else x.name, node.names)))
        return node
    
    def visit_FunctionDef(self, node):
        self.references_per_module[self.current_module][self.current_module].add(node.name)
        if node.name not in self.target_funcs[self.current_module] or node.name in self.already_visited[self.current_module]:
            if not self.current_module in self.modules_to_import:
                x = get_module_file(self.current_module)
                self.modules_to_import[self.current_module] = (x, set())
            self.modules_to_import[self.current_module][1].add(node.name)
            return
        
        self.asts[self.current_module].update({node.name: node})

        fw = FunctionVisitor(self.current_module, node.name, self.modules_to_import, self.already_visited, self.routes)
        fw.visit(node)
        imps = fw.modules_to_import
        tfs = fw.function_references
        self.already_visited[self.current_module].add(node.name)
        for new_imp, (m_file, new_funcs) in imps.items():
            if new_imp in self.imported_modules:
                continue
            if new_imp not in self.modules_to_import:
                self.modules_to_import[new_imp] = (m_file, new_funcs)
            else:
                self.modules_to_import[new_imp][1].update(new_funcs)
            self.references_per_module[self.current_module][new_imp].update(new_funcs)
        for mod_name, funcs in tfs.items():
            self.references_per_module[self.current_module][mod_name].update(funcs)
            self.target_funcs[mod_name].update(funcs)

        for mod_name, funcs in self.target_funcs.items():
            if mod_name in self.imported_modules:
                continue
            (mod_file, _) = self.modules_to_import[mod_name]
            if not len(funcs):
                continue
            if not is_module_user_defined(mod_name):
                continue
            with open(mod_file, 'r') as f:
                text = f.read()
            tree = ast.parse(text)
            iv = ImportVisitor(mod_name, {mod_name: funcs}, self.modules_to_import, self.already_visited, self.routes)
            iv.visit(tree)
            for k in iv.references_per_module.keys():
                self.references_per_module[k].update(iv.references_per_module[k])
                # TODO: references from new module should be somehow added to the current module references
                # self.references_per_module[self.current_module].update(iv.references_per_module[k])
            for k, v in iv.modules_to_import.items():
                if k not in self.modules_to_import:
                    self.modules_to_import[k] = v
                else:
                    self.modules_to_import[k][1].update(v[1])
            self.imported_modules.add(mod_name)

            for mod_name, d in iv.asts.items():
                self.asts[mod_name].update(iv.asts[mod_name])
        return node

class ArgsVisitor(ast.NodeVisitor):
    def __init__(self):
        self.res_string = []
        self.res_pattern = ""
        self.first_string = False

    def visit_Name(self, node):
        if self.first_string:
            self.res_string.append('([^/]+)')
            self.res_pattern += 'v'
    
    def visit_Constant(self, node):
        self.first_string = True
        
        constant = node.value
        # normalize slashes
        constant = constant.replace('\\', '/')
        # remove initial slashes
        while len(constant) and constant[0] == '/':
            constant = constant[1:]
        # remove final slashes
        while len(constant) and constant[-1] == '/':
            constant = constant[:-1]
        self.res_string.append(constant)

        self.res_pattern += 'c' * len(constant.split('/'))

# NodeTransformer instead of NodeVisitor to mark nodes which reference a route
class FunctionVisitor(ast.NodeTransformer):
    def __init__(self, target_module, tracked_function, modules_to_import, already_visited, routes):
        self.current_module = target_module # str
        self.tracked_function = tracked_function
        self.already_visited = already_visited # {"mod1": {"func1", "func2"}, "mod2": {func1, func2}}
        self.modules_to_import = defaultdict(lambda: ("", set()), modules_to_import) # {"name": ("path", {"func1", "func2"})}
        self.function_references = defaultdict(set)
        self.routes = routes

        # set current file path if not present
        if self.current_module not in self.modules_to_import:
            x = get_module_file(self.current_module)
            assert x
            self.modules_to_import[self.current_module] = (x, set())


    def visit_Import(self, node):
        for alias in node.names:
            x = get_module_file(alias.name)
            if x:
                self.modules_to_import[alias.name] = (x, set())
        return node

    def visit_ImportFrom(self, node):
        if node.module is not None:
            x = get_module_file(node.module)
            if x:
                self.modules_to_import[node.module] = (x, set(map(lambda x: x.asname if x.asname else x.name, node.names)))
        return node

    def visit_FunctionDef(self, node):
        if node.name != self.tracked_function:
            self.modules_to_import[self.current_module][1].add(node.name)
        return self.generic_visit(node)

    def visit_Call(self, node):
        if isinstance(node.func, ast.Name):
            # Handle simple function calls like "foo()"
            for k, v in self.modules_to_import.items():
                if node.func.id in v[1]:
                    self.function_references[k].add(node.func.id)
            else:
                # Only add if defined here
                if node.func.id in self.modules_to_import[self.current_module][1]:
                    self.function_references[self.current_module].add(node.func.id)
        elif isinstance(node.func, ast.Attribute):
            # Handle method calls like "obj.method()"
            y = self._get_attribute_chain(node.func)
            # handle requests.get/post/delete/put/head(...)
            unp = ast.unparse(node)
            route_types = [("requests." + pat) in unp for pat in ["get", "post", "delete", "put", "head"]]
            if any(route_types):
                av = ArgsVisitor()
                if len(node.args):
                    # url is always first argument
                    av.visit(node.args[0])
                else:
                   for named_arg in node.keywords:
                       if named_arg.arg == 'url':
                           av.visit(named_arg.value)
                           break
                endpoint = '/' + '/'.join(av.res_string) + '/'
                route_type_dict = {
                    0: "GET",
                    1: "POST",
                    2: "DELETE",
                    3: "PUT",
                    4: "HEAD"
                }
                rt = "GET"
                index = 0
                for route_type in route_types:
                    if route_type == True:
                        rt = route_type_dict[index]
                        break
                    index += 1
                for route in self.routes:
                    if re.match(endpoint, route.get('name','')) and \
                        av.res_pattern == route.get('route_pattern', '') and \
                        rt in route.get('methods', []):
                        # add endpoint as information to the node
                        node.is_route = True
                        node.route = route
                        break
                else:
                    # Unknown/exterior route, show add dummy node in graph
                    node.is_route = True

            for k in self.modules_to_import.keys():
                if y.startswith(k):
                    func_name = y[len(k)+1:]
                    self.modules_to_import[k][1].add(func_name)
                    self.function_references[k].add(func_name)
                    break
            # else:
                # assert False
        return self.generic_visit(node)

    def _get_attribute_chain(self, node):
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            return f"{self._get_attribute_chain(node.value)}.{node.attr}"
        return None


def parse_routes(routes):
    for route in routes:
        if "name" not in route:
            continue
        stripped = route["name"].strip(' /\\')
        route["name"] = '/' + stripped + '/' if len(stripped) else '/'
    return routes

def lets_go(filepath, target_func, routes=[]):
    routes = parse_routes(routes)
    path = Path(filepath)
    current_filename = path.stem
    
    # TODO: maybe include more up the filepath
    include_path = path.parent.absolute()
    global proj_path
    proj_path = str(include_path)
    sys.path.append(str(include_path))
    
    with open(filepath, 'r') as f:
        code = f.read()
    tree = ast.parse(code)
    walker = ImportVisitor(current_filename, {current_filename: {target_func}}, dict(), dict(), routes)
    walker.visit(tree)
    asts = walker.asts
    modules = walker.modules_to_import
    output = {}
    interm = {"asts": []}
    for mod_name, func_dict in asts.items():
        for func_name, func_ast in func_dict.items():
            interm_func = {"module": mod_name, "file": modules[mod_name][0], "func_name": func_name, "ast": func_ast}
            interm["asts"].append(interm_func)
    graph = create_graph(current_filename, target_func, interm["asts"])
    output["graph"] = graph
    print(json.dumps(output), file=sys.stdout, flush=True)

sample_routes = [] # insert sample_routes json object to debug manually
try:
    argc = len(sys.argv)
    # print(sys.argv, argc)
    if argc < 3:
        filepath = "" # insert sample filepath to debug manually
        func_name = "" # insert sample function_name to debug manually
        # lets_go(filepath, func_name, routes=sample_routes) # uncomment
    else:
        filepath = sys.argv[1]
        func_name = sys.argv[2]
        routes = []
        if argc == 4:
            routes = json.loads(sys.argv[3])
        else:
            routes = sample_routes
        lets_go(filepath, func_name, routes=routes)
except Exception as e:
    print(e, file=sys.stderr, flush=True)
    raise(e)
