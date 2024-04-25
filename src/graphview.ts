import * as vscode from "vscode";
import { LooseObject } from "./extension";
import { openFile, addBreakpoint, pathsAreEqual } from "./utils";

export class GraphView {

  private _view?: vscode.Webview;

  private _extensionUri: vscode.Uri;

  constructor(private _context: vscode.ExtensionContext) {
    this._extensionUri = _context.extensionUri;
  }

  public showGraph(data: LooseObject, flowName: string) {
    const panel = vscode.window.createWebviewPanel(
      "graph",
      `${flowName} Graph`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );
    this._view = panel.webview;

    panel.webview.html = this._getHtmlForWebview(panel.webview);

    panel.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "fetchGraphData": {
          let breakPoints = vscode.debug.breakpoints as vscode.SourceBreakpoint[];

          let graph: String[] = ["graph TD"];

          // add all nodes to the graph before checking the edges
          // so that isolated noted will still be displayed

          for (const node of Object.values(data.graph.nodes as LooseObject)) {
            graph.push(`${node.func_name}[${node.func_name}]`);
          }

          for (let i = 0; i < data.graph.edges.length; ++i) {
            const edge = data.graph.edges[i];

            // match all breakpoints
            const startNode = data.graph.nodes[edge.start_node];
            const endNode = data.graph.nodes[edge.end_node];

            let breakP = breakPoints.filter((bp) => {
              return pathsAreEqual(vscode.Uri.file(bp.location?.uri.path).fsPath, startNode.file) &&
                edge.call_lines.includes(bp.location?.range.start.line + 1);
            });

            edge.hasBreakpoint = breakP.length === edge.call_lines.length;

            graph.push(
              `${startNode.func_name}[${startNode.func_name}] ==> ${endNode.func_name}[${endNode.func_name}]`
            );
          }

          if ("dotted_edges" in data.graph) {
            for (let i = 0; i < data.graph.dotted_edges.length; ++i) {
              const edge = data.graph.dotted_edges[i];

              const startNode = data.graph.nodes[edge.start_node];
              const endNode = data.graph.nodes[edge.end_node];

              graph.push(
                `${startNode.func_name}[${startNode.func_name}] -.- ${endNode.func_name}[${endNode.func_name}]`
              );
            }
          }

          let graphString: String = graph.join("\n");

          let legend = new Map();
          let affectedFiles = new Map();

          for (const id in data.graph.nodes) {
            let node = data.graph.nodes[id];
            const x = node.project_path.split("\\");
            legend.set(node.project_color, x[x.length - 1]);

            // match possible breakpoint
            let breakP = breakPoints.filter((bp) => {
              return pathsAreEqual(vscode.Uri.file(bp.location?.uri.path).fsPath, node.file) &&
                node.lineno === bp.location?.range.start.line - 1;
            });

            node.hasBreakpoint = breakP.length !== 0 ? true : false;

            if (affectedFiles.has(node.file)) {
              let arr = affectedFiles.get(node.file);
              arr.push(node.func_name);
              affectedFiles.set(node.file, arr);
            } else {
              affectedFiles.set(node.file, [node.func_name]);
            }
          }

          let legendHtml = [];
          for (let [color, projName] of legend.entries()) {
            if (projName === "dummy") {
              projName = "External API call";
            }
            legendHtml.push(
              `<div class="legend-item"><span class="color-box" style="background-color: ${color};"></span> ${projName}</div>`
            );
          }
          let legendString =
            '<div class="legend-title">Projects</div>' + legendHtml.join("");

          // affected files

          this._view?.postMessage({
            command: "setGraphData",
            graphData: data,
            graphString: graphString,
            legendString: legendString,
            affectedFiles: Object.fromEntries(affectedFiles.entries()),
          });
          break;
        }
        case "openFile": {
          openFile(message.filePath, message.lineno);
          break;
        }
        case "addBreakpoint": {
          addBreakpoint(message);
          break;
        }
        case "removeBreakpoint": {
          const linenos = typeof message.lineno === "number" ? [message.lineno] : message.lineno;
          const brkp = vscode.debug.breakpoints as vscode.SourceBreakpoint[];
          const toRemove = brkp.filter((bp) => {
            return pathsAreEqual(vscode.Uri.file(bp.location?.uri.path).fsPath, message.filePath) &&
              linenos.includes(bp.location?.range.start.line);
          });
          vscode.debug.removeBreakpoints(toRemove);
          break;
        }
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const mermaidSrc = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "lib", "mermaid.min.js"));
    const jquerySrc = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "lib", "jquery.min.js"));
    const graphStyleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "graph.css"));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "graph.js"));

    const nonce = getNonce();

    let xd = `<!DOCTYPE html>
      <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <script nonce="${nonce}" src="${mermaidSrc}"></script>
            <script nonce="${nonce}" src="${jquerySrc}"></script>
            <link href="${graphStyleUri}" rel="stylesheet">
        </head>
        <body>
          
          <div id="mermaidDiv">
            <div id="mermaidGraph">
              Loading...
            </div>
      
            <div class="legend">
            </div>
          </div>

          <div class="affected-files-div">
            <h4>Affected files</h4>
            <ul class="affected-files-list">
              <li>hi</li>
            </ul>
          </div>
      
          <div id="menu">
            <a id="open-call">
              Open function call
            </a>
            <a id="open-func">
                Open function definition
            </a>
            <a id="add-brk-call">
              Add breakpoint to function call
            </a>
            <a id="rem-brk-call">
              Remove breakpoint from function call
            </a>
            <a id="add-brk-func">
              Add breakpoint to function definition
            </a>
            <a id="rem-brk-func">
              Remove breakpoint from function definition
            </a>
          </div>

          <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>`;
    return xd;
  }
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
