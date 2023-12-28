// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";
// import * as zlib from 'zlib';

interface LooseObject {
  [key: string]: any
}

function extractWordCounts(filePath: string): Record<string, LooseObject[]> {
  const content = fs.readFileSync(filePath, "utf8");
  const modName = path.basename(filePath, path.extname(filePath));

  const routePattern = /@app.route\([\'\"]([^\)\'\"]+)[\'\"][^\)]*\)/g; // Use a regular expression to find the word "count"
  const funcPattern = /def\s+(.+)\s*\(.*\)\s*:/g;
  const flowStartPattern = /#+\s*flow-start\((.+)\)/g;
  const flowEndPattern = /#+\s*flow-end\((.+)\)/g;

  var match;
  var matches: Record<string, LooseObject[]> = {};
  

  // match routes
  while ((match = routePattern.exec(content))) {
    if(matches["routes"] === undefined) {
      matches["routes"] = [];
    }

    const lineCountBeforeMatch = content
      .slice(0, match.index)
      .split("\n").length;
    const nextLines = content.slice(match.index).split("\n");
    for (let i = 0 ; i < nextLines.length ; ++i) {
      const x = funcPattern.exec(nextLines[i]);
      if (x) {
        matches["routes"].push({module: modName, name: match[1], lineno: lineCountBeforeMatch, func: x[1]});
        break;
      }
    }
  }

  // match user defined functions
  while ((match = funcPattern.exec(content))) {
    if(matches["funcs"] === undefined) {
      matches["funcs"] = [];
    }

    const lineCountBeforeMatch = content
      .slice(0, match.index)
      .split("\n").length;
    matches["funcs"].push({module: modName, name: match[1], lineno: lineCountBeforeMatch - 1});
  }

  // match flow-start(<flow-name>)
  while ((match = flowStartPattern.exec(content))) {
    if(matches["flowStart"] === undefined) {
      matches["flowStart"] = [];
    }

    const lineCountBeforeMatch = content
      .slice(0, match.index)
      .split("\n").length;
    const nextLines = content.slice(match.index).split("\n");
    for (let i = 0 ; i < nextLines.length ; ++i) {
      const x = funcPattern.exec(nextLines[i]);
      if (x) {
        matches["flowStart"].push({module: modName, name: match[1], lineno: lineCountBeforeMatch, func: x[1]});
        break;
      }
    }
  }

  // match flow-end(<flow-name>)
  while ((match = flowEndPattern.exec(content))) {
    if(matches["flowEnd"] === undefined) {
      matches["flowEnd"] = [];
    }

    const lineCountBeforeMatch = content
      .slice(0, match.index)
      .split("\n").length;
    const nextLines = content.slice(match.index).split("\n");
    for (let i = 0 ; i < nextLines.length ; ++i) {
      const x = funcPattern.exec(nextLines[i]);
      if (x) {
        matches["flowEnd"].push({module: modName, name: match[1], lineno: lineCountBeforeMatch, func: x[1]});
        break;
      }
    }
  }

  return matches;
}

function countWordsInFolders(context: vscode.ExtensionContext) {
  var monoRepos: string[] = vscode.workspace.workspaceFolders
    ? vscode.workspace.workspaceFolders.map((x) => x.uri.fsPath)
    : [];

  const config = vscode.workspace.getConfiguration("wordCounter");
  monoRepos.push(...config.get("extraFolders", []));
  const wordCounts: LooseObject = {};

  // List of some distinct colors for the different projects routes
  // TODO: extend the list for more project, or introduce algorithm to generate
  // 1 color per each folder (maximally distinct)
  // const colors = ["#228b22", "#00008b", "#b03060", "#ff4500", "#ffff00", "#deb887", "#00ff00", "#00ffff", "#ff00ff", "#6495ed"];
  const colors = ["#7f9f9f", "#72cb72", "#c05050", "#ffff50", "#50ff50", "#e450f3", "#50ffff", "#6ee0ff", "#fffefd", "#ffa9f4"];
  let colorIndex = 0;

  let routes: LooseObject[] = [];
  let flows: LooseObject[] = [];
  let funcs: LooseObject[] = [];

  monoRepos.forEach((monoRepo) => {
    // IMPORTANT: assumes monolithic architecture of the repository (folder),
    // where each subfolder represents a different project
    const files = fs.readdirSync(monoRepo, { withFileTypes: true });
    const folders = files.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
    if (files.length > folders.length) {
      vscode.window.showWarningMessage(`The repository ${monoRepo} might not have assumed structure`);
    }
    folders.forEach((folder) => {
      const folderPath = path.isAbsolute(folder)
        ? folder
        : vscode.workspace.workspaceFolders
        ? path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, folder)
        : null;
      if (folderPath === null) {
        return;
      }
      // normalize folderpath
      const folderPathNorm = path.resolve(folderPath).toLowerCase();
      if (wordCounts[folderPathNorm]) {
        return;
      }
      const subfolderCounts = countWordsInSubfolders(folderPath);

      // Add project info to each function and funcs
      let [projectRoutes, projectFlows, projectFuncs] = extractFlowsAndEnpoints(subfolderCounts);
      
      if (!(projectRoutes.length || projectFlows.length || projectFuncs.length)) {
        // empty project
        return;
      }
      let projectColor = colors[colorIndex++];
      
      for (let i = 0; i < projectRoutes.length; ++i) {
        projectRoutes[i].project_path = folderPathNorm;
        projectRoutes[i].project_color = projectColor;
      }
      for (let i = 0; i < projectFuncs.length; ++i) {
        projectFuncs[i].project_path = folderPathNorm;
        projectFuncs[i].project_color = projectColor;
      }

      routes.push(...projectRoutes);
      flows.push(...projectFlows);
      funcs.push(...projectFuncs);
    });

    // if(Object.keys(wordCounts).length === 1) {
    //   return wordCounts[Object.keys(wordCounts)[0]];
    // }
  });
  return [routes, flows, funcs];
}

function countWordsInSubfolders(folderPath: string): LooseObject {
  const files = fs.readdirSync(folderPath, { withFileTypes: true });
  const subfolderCounts: LooseObject = {};

  files.forEach((file) => {
    const filePath = path.join(folderPath, file.name);

    if (
      file.isFile() &&
      filePath.endsWith(".py") &&
      file.name.charAt(0) !== "."
    ) {
      const counts = extractWordCounts(filePath);
      if(Object.keys(counts).length) {
        subfolderCounts[filePath] = counts;
      }
    } else if (file.isDirectory() && file.name.charAt(0) !== ".") {
      // Recursively search for Python files in subdirectories
      const deeperCounts = countWordsInSubfolders(filePath);
      if ( Object.keys(deeperCounts).length) {
        subfolderCounts[filePath] = deeperCounts;
      }
    }
  });

  // flatten hierarchy attempt
  if(Object.keys(subfolderCounts).length === 1) {
    return subfolderCounts[Object.keys(subfolderCounts)[0]];
  }
  return subfolderCounts;
}

function extractFlowsAndEnpoints(endPoints: LooseObject): [LooseObject[], LooseObject[], LooseObject[]] {
  let routes: LooseObject[] = [];
  let flows: LooseObject[] = [];
  let funcs: LooseObject[] = [];
  let flat: Record<string, Object[]> = customFlattenObject(endPoints);
  for (const key of Object.keys(flat)) {
    const sp = key.split('.');
    if (sp[sp.length - 1] === 'routes') {
      for (let i = 0; i < flat[key].length ; ++i) {
        const newObject = { ...flat[key][i], file: sp.slice(0, sp.length - 1).join('.')};
        routes.push(newObject);
      }
    }
    else if (sp[sp.length - 1] === 'flowStart') {
      for (let i = 0; i < flat[key].length ; ++i) {
        const newObject = { ...flat[key][i], file: sp.slice(0, sp.length - 1).join('.')};
        flows.push(newObject);
      }
    }
    else if (sp[sp.length - 1] === 'flowEnd') {
      for (let i = 0; i < flat[key].length ; ++i) {
        const newObject = { ...flat[key][i], file: sp.slice(0, sp.length - 1).join('.')};
        flows.push(newObject);
      }
    }
    else if (sp[sp.length - 1] === 'funcs') {
      for (let i = 0; i < flat[key].length ; ++i) {
        const newObject = { ...flat[key][i], file: sp.slice(0, sp.length - 1).join('.')};
        funcs.push(newObject);
      }
    }
  }

  return [routes, flows, funcs];
}

function customFlattenObject(obj: LooseObject, parentKey: string = ''): Record<string, Object[]> {
  let flattened: Record<string, Object[]> = {};

  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      let newKey = parentKey ? `${parentKey}.${key}` : key;

      if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (['funcs', 'routes', 'flowStart', 'flowEnd', 'flowIgnore'].includes(key)) {
          flattened[newKey] = obj[key];
        } else {
          Object.assign(flattened, customFlattenObject(obj[key], key));
        }
      } else {
        flattened[newKey] = obj[key];
      }
    }
  }

  return flattened;
}

function runPythonProg(flow: LooseObject, endPoints: Object[]): Promise<Record<string, string[]>> {
  return new Promise((resolve, reject) => {
    const pythonScriptPath = path.join(__dirname, "/../src/walk_from_func.py"); // Update with your script's path
    const endP = JSON.stringify(endPoints);
    
    // // Consider if argument size gets too large
    // console.log(endP.length);
    // const comp = zlib.gzipSync(endP).toString('base64');
    // console.log(comp.length);
    var output: string[] = [];
    var errors: string[] = [];
    // Run the Python script with the JSON argument
    const pythonProcess = child_process.spawn("python", [pythonScriptPath, flow.file, flow.func, endP]);
    // const pythonProcess = child_process.spawn("python", [pythonScriptPath]);
    
    pythonProcess.stdout.on("data", (data: any) => {
      console.log(data);
      output.push(data);
    });

    pythonProcess.stderr.on("error", (data: any) => {
      console.error(`Python Script Error: ${data}`);
      errors.push(data);
    });

    pythonProcess.on("close", (code: any) => {
      if (code === 0) {
        resolve({ outputs: output, errors: errors });
      } else {
        reject(`Python script exited with code ${code}`);
      }
    });
  });
}

function pathsAreEqual(path1: string, path2: string) {
  path1 = path.resolve(path1);
  path2 = path.resolve(path2);
  if (process.platform === "win32") {
    return path1.toLowerCase() === path2.toLowerCase();
  }
  return path1 === path2;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "flow-documentation" is now active!'
  );

  var endPointMap = context.globalState.get("endPointMap") || [];
  var graphs = context.globalState.get("graphs") || [];
  console.log(endPointMap);

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "flow-documentation.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage("Hello VS Code");
    }
  );

  function showGraph(data: JSON) {
    const panel = vscode.window.createWebviewPanel(
      'graph',
      'Workspace Graph',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    // Load an HTML file or generate HTML content with the graph here
    panel.webview.html = getWebviewContent(panel, data, context);

    //vscode.debug.addBreakpoints();
    
    // In your WebView
    // panel.webview.postMessage({ command: 'openFile', filePath: 'path/to/your/file' });
    // In your extension
    panel.webview.onDidReceiveMessage((message) => {
      if (message.command === 'openFile' && message.filePath) {
          vscode.workspace.openTextDocument(vscode.Uri.file(message.filePath)).then((document) => {
            if (message.lineno) {
              vscode.window.showTextDocument(document).then((editor) => {
                editor.selections = [new vscode.Selection(message.lineno, 0, message.lineno, 0)];
                var range = new vscode.Range(message.lineno, 0, message.lineno, 0);
                editor.revealRange(range);
              });
            }
            else {
              vscode.window.showTextDocument(document);
            }
          });
      }
    });
  };

  const disposable2 = vscode.commands.registerCommand(
    "flow-documentation.countWords",
    () => {
      const [endP, flows, funcs] = countWordsInFolders(context);
      for(let i = 0 ; i< flows.length ; ++i) {
        runPythonProg(flows[i], endP).then((result) => {
          if (result.errors.length) {
            result.errors.forEach(err => console.error(err));
            throw new Error();
          }
          if (result.outputs.length !== 1) {
            throw new Error("too much python output");
          }
          const data = JSON.parse(result.outputs[0]);
          // match graph funcs with extracted funcs
          for (let i = 0 ; i< data.graph.nodes.length ; i++) {
            let node = data.graph.nodes[i];

            // Node is a http call
            let unknownNode = false;

            if (node.is_route) {
              const route = endP.filter((endPoint) => pathsAreEqual(endPoint.file, node.file) && endPoint.func === node.func_name);
              if (route.length) {
                node.lineno = route[0].lineno;
                node.project_path = route[0].project_path;
                node.project_color = route[0].project_color;
              }
              else {
                unknownNode = true;
              }
            }
            // Node is a function call
            else {
              const func = funcs.filter((func) => pathsAreEqual(func.file, node.file) && func.name === node.func_name);
              // TODO: remove if condition, dummy check
              if (func.length) {
                node.lineno = func[0].lineno;
                node.project_path = func[0].project_path;
                node.project_color = func[0].project_color;
              }
              else {
                unknownNode = true;
              }
            }
            if (unknownNode) {
              node.lineno = 0;
              node.project_path = "dummy";
              node.project_color = "#ff0000"; // red
            }
          }

          showGraph(data);
        })
        .catch((error) => {
          console.error('Error:', error);
        });
      }

      // context.globalState.update("endPointMap", endPoints);
      // vscode.window.showInformationMessage(JSON.stringify(endPoints));
    }
  );

  context.subscriptions.push(disposable);
  context.subscriptions.push(disposable2);
}

// This method is called when your extension is deactivated
export function deactivate() {}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function replaceAll(str: string, find: string, replace: string) {
  return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

function vscodePath(pp: string) {
  return replaceAll(path.normalize(pp), '\\', '/');
}

// Inside the getWebviewContent function
function getWebviewContent(panel: vscode.WebviewPanel, data: LooseObject, context: vscode.ExtensionContext ) {
  const workspacePath = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : ''; // Assumes you have a workspace open

  if (!workspacePath) {
      return '<p>No workspace open.</p>';
  }

  
  const filesInWorkspace = [
      // { name: 'File 1', path: 'F:/Facultate/Master2/Thesis/code/extensions/flow-documentation/src/ast2json.py' },
      { name: 'File 1', path:  vscodePath(path.join(context.extensionPath, 'src/ast2json.py')) },
      // Add more files as needed
  ];

  const tableRows = filesInWorkspace.map((file) => {
      return `<tr><td><a href="#" onclick="openFile('${file.path}')">${file.name}</a></td></tr>`;
  });

  const mermaidPath = vscode.Uri.file(path.join(context.extensionPath, 'lib', 'mermaid.min.js'));
  const jqueryPath = vscode.Uri.file(path.join(context.extensionPath, 'lib', 'jquery.min.js'));

  let graph: String[] = ["graph TD"];
  for (let i = 0 ; i < data.graph.edges.length; ++i) {
    const [startId, endId] = data.graph.edges[i];
    graph.push(`${data.graph.nodes[startId]['func_name']} --> ${data.graph.nodes[endId]['func_name']}`);
  }
  let graphString: String = graph.join('\\n');
  // const mermaidSrc = panel.webview.asWebviewUri(mermaidPath);


  let xd = `<!DOCTYPE html>
<html>
    <head>
      <script src="${panel.webview.asWebviewUri(mermaidPath)}"></script>
      <script src="${panel.webview.asWebviewUri(jqueryPath)}"></script>
    </head>
  <body>
    <table>
      ${tableRows}
    </table>
    <div style="color:white;">
      <div id="here">hello</div>
    </div>
    <script>
      const vscode = acquireVsCodeApi();
      function openFile(filePath, lineno) {
        console.log(document);
        vscode.postMessage({ command: 'openFile', filePath, lineno});
      }
    </script>
    <script>
    async function ads () {
      mermaid.initialize({ startOnLoad: false });
      const htmlCode = await mermaid.mermaidAPI.render('mermaidChart', "${graphString}");
      const nodeData = JSON.parse('${replaceAll(JSON.stringify(data.graph.nodes), '\\', '/')}');
      console.log(htmlCode);
      console.log(nodeData);
      document.getElementById('here').innerHTML = htmlCode.svg;
      const nodes = document.querySelectorAll('.node');
        nodes.forEach(node => {
            const textContent = node.textContent;
            const nn = nodeData.filter((x) => x.func_name == textContent)[0];
            console.log(textContent, node, nn);
            node.onclick = () => {openFile(nn["file"], nn["lineno"])};
            node.style.cursor = "pointer";
            if (nn.is_route && nn.is_route == true) {
              const rect = node.getElementsByTagName('rect')[0];
              console.log(rect);
              console.log(nn);
              rect.style.fill = nn.project_color;
              rect.style.stroke = nn.project_color;
              if (nn.project_color === '#ff0000') {
                node.style.cursor = "not-allowed";
              }
            }
        });
    }
      ads();
    </script>
  </body>
</html>`;
  return xd;
}
