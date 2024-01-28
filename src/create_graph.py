import ast
from collections import defaultdict

def is_same_function(f1, f2):
    return f1["module"] == f2["module"] and f1["func_name"] == f2["func_name"]

def is_same_node(f1, f2):
    return f1["module"] == f2["module"] and f1["func_name"] == f2["func_name"] and f1["file"] == f2["file"]

def get_func_id_by_name(name, listfs):
    return list(filter(lambda x: x["func_name"] == name, listfs))[0]["id"]

class GraphMaker(ast.NodeVisitor):
    def __init__(self, nodes, start_id, max_id):
        self.nodes = nodes
        self.current_node = start_id
        # set of edges
        self.graph = defaultdict(list) # {(start_id, end_id): [call_lineno]}
        self.max_id = max_id
        self.visited_nodes = set([start_id])

    def _get_attribute_chain(self, node):
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            return f"{self._get_attribute_chain(node.value)}.{node.attr}"
        return None

    def _node_exists(new_dict, list_of_dicts):
        for existing_dict in list_of_dicts:
            if len(new_dict) == len(existing_dict) and all(new_dict[key] == existing_dict[key] for key in new_dict):
                return True
        return False

    def visit_Call(self, node):
        if hasattr(node, 'is_route') and node.is_route:
            # TODO: actually import the route nodes and parse them instead of dummy nodes
            
            if hasattr(node, 'route') and node.route:
                for n in self.nodes:
                    if is_same_node(node.route, n):
                       self.graph[(self.current_node, n['id'])].append(node.lineno)
                       break 
                else:
                    # unvisited external node, create dummy with some info at least
                    self.nodes.append({'module': node.route["module"], 'file': node.route["file"], 'func_name': node.route["func_name"] , 'ast': None, 'id': self.max_id, 'is_route': True})
                    self.graph[(self.current_node, self.max_id)].append(node.lineno)
                    self.max_id += 1
            else:
                # the route is unknown / external
                self.nodes.append({'module': 'dummy', 'file': 'dummy', 'func_name': self._get_attribute_chain(node.func) , 'ast': None, 'id': self.max_id, 'is_route': True})
                self.graph[(self.current_node, self.max_id)].append(node.lineno)
                self.max_id += 1
            return
        if isinstance(node.func, ast.Name):
            # Handle simple function calls like "foo()"
            for n in self.nodes:
                if node.func.id == n["func_name"]:
                    self.graph[(self.current_node, n['id'])].append(node.lineno)
                    # avoid recursion, but still append it to the graph
                    if n['id'] not in self.visited_nodes:
                        self.visited_nodes.add(n['id'])
                        old_node = self.current_node
                        self.current_node = n['id']
                        self.visit(n["ast"])
                        self.current_node = old_node
                    break
            else:
                # The graph should not contain any unrecognized function calls
                raise
        elif isinstance(node.func, ast.Attribute):
            # Handle method calls like "obj.method()"
            y = self._get_attribute_chain(node.func)
            for n in self.nodes:
                if y.startswith(n['module']):
                    func_name = y[len(n['module'])+1:]
                    if n['func_name'].endswith(func_name):
                        self.graph[(self.current_node, n['id'])].append(node.lineno)
                        old_node = self.current_node
                        self.current_node = n['id']
                        self.visit(n["ast"])
                        self.current_node = old_node
                    break
            # else:
                # raise
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
        raise "No start node given"

    gm = GraphMaker(asts, start_node["id"], id)
    gm.visit(start_node["ast"])
    # print(gm.graph)
    # asts2 = dict()
    # for node in asts:
    #     asts2[node["id"]] = node
    # graph = ["graph TD"]
    # for (start_id, end_id) in gm.graph:
    #     graph.append(f"{asts2[start_id]['func_name']} --> {asts2[end_id]['func_name']}")
    nodes = dict()
    for ast in asts:
        nodes[ast["func_name"]] = {k: v for (k, v) in ast.items() if k != 'ast'}
    return {'nodes': nodes, 'edges': [{'start_node': asts[k[0]]["func_name"], 'end_node': asts[k[1]]["func_name"], 'call_lines': v} for (k, v) in gm.graph.items()]}
