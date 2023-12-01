import ast

def is_same_function(f1, f2):
    return f1["module"] == f2["module"] and f1["func_name"] == f2["func_name"]

def get_func_id_by_name(name, listfs):
    return list(filter(lambda x: x["func_name"] == name, listfs))[0]["id"]

class GraphMaker(ast.NodeVisitor):
    def __init__(self, nodes, start_id):
        self.nodes = nodes
        self.current_node = start_id
        self.graph = []

    def _get_attribute_chain(self, node):
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            return f"{self._get_attribute_chain(node.value)}.{node.attr}"
        return None

    def visit_Call(self, node):
        if isinstance(node.func, ast.Name):
            # Handle simple function calls like "foo()"
            for n in self.nodes:
                if node.func.id == n["func_name"]:
                    self.graph.append([self.current_node, n['id']])
                    old_node = self.current_node
                    self.current_node = n['id']
                    self.visit(n["ast"])
                    self.current_node = old_node
                    break
            else:
                # Only add if defined here
                raise
        elif isinstance(node.func, ast.Attribute):
            # Handle method calls like "obj.method()"
            y = self._get_attribute_chain(node.func)
            for n in self.nodes:
                if y.startswith(n['module']):
                    func_name = y[len(n['module'])+1:]
                    if n['func_name'].endswith(func_name):
                        self.graph.append([self.current_node, n['id']])
                        old_node = self.current_node
                        self.current_node = n['id']
                        self.visit(n["ast"])
                        self.current_node = old_node
                    break
            # else:
                # assert False
        # self.generic_visit(node)

def create_graph(module, target_func, asts):
    id = 0
    start_node = None
    for x in asts:
        if x["module"] == module and x["func_name"] == target_func:
            start_node = x
        x["id"] = id
        id += 1

    if start_node == None:
        assert False

    gm = GraphMaker(asts, start_node["id"])
    gm.visit(start_node["ast"])
    # print(gm.graph)
    # asts2 = dict()
    # for node in asts:
    #     asts2[node["id"]] = node
    # graph = ["graph TD"]
    # for (start_id, end_id) in gm.graph:
    #     graph.append(f"{asts2[start_id]['func_name']} --> {asts2[end_id]['func_name']}")
    return {'nodes': [{k:v for k,v in ast.items() if k != 'ast'} for ast in asts], 'edges': gm.graph}
