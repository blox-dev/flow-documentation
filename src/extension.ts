/* eslint-disable @typescript-eslint/naming-convention */
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";
import { FlowsViewProvider } from "./flowsView";
import { MaintainersViewProvider } from "./maintainersview";
import { pathsAreEqual } from "./utils";
import { GraphView } from "./graphview";
// import * as zlib from 'zlib';

export interface LooseObject {
  [key: string]: any
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "flow-documentation" is now active!'
  );

  const flowsViewProvider = new FlowsViewProvider(context);
  context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(FlowsViewProvider.viewType, flowsViewProvider)
  );

  const maintainersViewProvider = new MaintainersViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(MaintainersViewProvider.viewType, maintainersViewProvider)
  )

  console.log(context.globalState.get("routes"));
  console.log(context.globalState.get("flows"));
  console.log(context.globalState.get("funcs"));
  console.log(context.globalState.get("graphs"));

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    "flow-documentation.createGraphs",
    () => {
      // update flow webview
      flowsViewProvider.fetchFlows();
      
      // create the graphs
      createGraph(context);
    }
  );
  const disposable2 = vscode.commands.registerCommand(
    "flow-documentation.showMaintainer",
    (thisFilePath) => {
      fs.readFile(vscode.Uri.joinPath(context.extensionUri, "src", "codeMaintainerMap.json").fsPath, readFileCallback);
      function readFileCallback(err: any, data: any) {
        if (err) {
          vscode.window.showErrorMessage(err.message);
          return;
        }
        let codeMaintainerMap: LooseObject = {};
        
        try {
          codeMaintainerMap = JSON.parse(data.toString());
        } catch {
          console.log("Invalid json config")
        }
        var activeFilePath = thisFilePath?.fsPath || "";
        const maintainers: LooseObject[] = findMaintainers(activeFilePath, codeMaintainerMap);
        
        maintainersViewProvider.displayMaintainers(activeFilePath, maintainers);

        vscode.window.showInformationMessage("Hello");
      }
    }
  );

  context.subscriptions.push(disposable);
  context.subscriptions.push(disposable2);
}

function findMaintainers (activeFilePath: string, codeMaintainerMap: LooseObject): LooseObject[] {

  var maintainers: LooseObject[] = [];

  for (var i=0 ; i < codeMaintainerMap.length ; ++i) {
    const code = codeMaintainerMap[i].maintains;
    for (var j=0 ; j < code.length ; ++j) {
      const index = path.normalize(activeFilePath).indexOf(path.normalize(code[j].path))
      if (index === -1) {
        continue;
      }
      console.log(codeMaintainerMap[i].contact);
      maintainers.push(codeMaintainerMap[i].contact);
      break;
    }
  }
  return maintainers;
}

// This method is called when your extension is deactivated
export function deactivate() {}

function extractPatterns(filePath: string): Record<string, LooseObject[]> {
  const content = fs.readFileSync(filePath, "utf8");
  const modName = path.basename(filePath, path.extname(filePath));

  const routePattern = /@app.route\([\'\"]([^\)\'\"]+)[\'\"][^\)]*\)/g;
  const funcPattern = /def\s+(.+)\s*\(.*\)\s*:/g;
  const flowStartPattern = /#+\s*flow-start\((.+)\)/g;
  const flowEndPattern = /#+\s*flow-end\((.+)\)/g;

  var match;
  var matches: Record<string, LooseObject[]> = {routes: [], funcs: [], flowStart: [], flowEnd: []};
  

  // match routes
  while ((match = routePattern.exec(content))) {
    const lineCountBeforeMatch = content
      .slice(0, match.index)
      .split("\n").length;
    const nextLines = content.slice(match.index).split("\n");
    for (let i = 0 ; i < nextLines.length ; ++i) {
      const x = funcPattern.exec(nextLines[i]);
      if (x) {
        matches.routes.push({module: modName, name: match[1], lineno: lineCountBeforeMatch, func_name: x[1]});
        break;
      }
    }
  }

  // match user defined functions
  while ((match = funcPattern.exec(content))) {
    const lineCountBeforeMatch = content
      .slice(0, match.index)
      .split("\n").length;
    matches.funcs.push({module: modName, name: match[1], lineno: lineCountBeforeMatch - 1});
  }

  // match flow-start(<flow-name>)
  while ((match = flowStartPattern.exec(content))) {
    const lineCountBeforeMatch = content
      .slice(0, match.index)
      .split("\n").length;
    const nextLines = content.slice(match.index).split("\n");
    for (let i = 0 ; i < nextLines.length ; ++i) {
      const x = funcPattern.exec(nextLines[i]);
      if (x) {
        matches.flowStart.push({module: modName, name: match[1], lineno: lineCountBeforeMatch, func: x[1]});
        break;
      }
    }
  }

  // match flow-end(<flow-name>)
  while ((match = flowEndPattern.exec(content))) {
    const lineCountBeforeMatch = content
      .slice(0, match.index)
      .split("\n").length;
    const nextLines = content.slice(match.index).split("\n");
    for (let i = 0 ; i < nextLines.length ; ++i) {
      const x = funcPattern.exec(nextLines[i]);
      if (x) {
        matches.flowEnd.push({module: modName, name: match[1], lineno: lineCountBeforeMatch, func: x[1]});
        break;
      }
    }
  }

  return matches;
}

export function extractRFF(context: vscode.ExtensionContext) {
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

    // TODO: make a list of ignored files or folders or something like that
    // instead of always ignoring folders starting with .
    const files = fs.readdirSync(monoRepo, { withFileTypes: true }).filter(dirent => !dirent.name.startsWith('.'));
    const folders = files.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
    if (files.length > folders.length) {
    vscode.window.showWarningMessage(`The color-coding of ${monoRepo} might appear wrong.`);
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
      const subfolderCounts = extractPatternInSubfolders(folderPath);

      // Add project info to each function and funcs
      let [projectRoutes, projectFlows, projectFuncs] = flattenRFF(subfolderCounts);
      
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
  context.globalState.update("routes", routes);
  context.globalState.update("flows", flows);
  context.globalState.update("funcs", funcs);

  fs.readFile(vscode.Uri.joinPath(context.extensionUri, "src", "endPointMap.json").fsPath, function (err, data) {
    if (err) {
      console.log(err);
      return;
    }
    let endP: LooseObject = {};
    
    try {
      endP = JSON.parse(data.toString());
    } catch {
      console.log("Invalid json config")
    }
    for (let i=0 ; i< routes.length ; ++i) {
      const route = routes[i];
      
      // TODO: unique id for each route
      const routeId = route.func_name;
      
      endP[routeId] = {
        "contact": {},
        "route_expr": route.name,
        "module": route.module,
        "func_name": route.func_name,
        "route_file": route.file, 
      }
    }
    const routeStr = JSON.stringify(endP, null, 4);
    fs.writeFile(vscode.Uri.joinPath(context.extensionUri, "src", "endPointMap.json").fsPath, routeStr, 'utf8', function () {}); 
  })

  let tmp = new Set();
  flows.forEach((f) => {
    if (tmp.has(f.name)) {
      vscode.window.showWarningMessage(`Duplicate flow '${f.name}' might cause issues. Consider making flow names unique.`);
      return;
    }
    tmp.add(f.name);
  });

  return [routes, flows, funcs];
}

function extractPatternInSubfolders(folderPath: string): LooseObject {
  const files = fs.readdirSync(folderPath, { withFileTypes: true });
  const subfolderCounts: LooseObject = {};

  files.forEach((file) => {
    const filePath = path.join(folderPath, file.name);

    if (
      file.isFile() &&
      file.name.endsWith(".py") &&
      !file.name.startsWith(".")
    ) {
      const counts = extractPatterns(filePath);
      if(Object.keys(counts).length) {
        subfolderCounts[filePath] = counts;
      }
    } else if (file.isDirectory() && !file.name.startsWith(".")) {
      // Recursively search for Python files in subdirectories
      const deeperCounts = extractPatternInSubfolders(filePath);
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

function flattenRFF(endPoints: LooseObject): [LooseObject[], LooseObject[], LooseObject[]] {
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

function findNearestVirtualEnv(pathToCheck: string): string {
  let currentPath = path.resolve(pathToCheck);
  // failsafe
  let maxIter = 50;

  while (currentPath !== path.parse(currentPath).root && maxIter > 0) {
      const pythonBinPath = process.platform === 'win32'
      ? path.join(currentPath, '.venv', 'Scripts', 'python.exe')
      : path.join(currentPath, 'venv', 'bin', 'python');

      if (fs.existsSync(pythonBinPath)) {
          return pythonBinPath;
      }

      currentPath = path.dirname(currentPath);
      maxIter -= 1;
  }

  // If no virtual environment found, set pythonBinPath to the global python interpreter
  return process.platform === 'win32' ? 'python' : 'python3';
}

function isPythonInstalled(): boolean {
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  const result = child_process.spawnSync(pythonPath, ['--version'], { stdio: 'ignore' });
  return result.error === undefined && result.status === 0;
}

function runPythonProg(extensionUri: vscode.Uri, flow: LooseObject, endPoints: LooseObject[]): Promise<Record<string, string[]>> {
  return new Promise((resolve, reject) => {

    if (isPythonInstalled() === false) {
      reject(`Python is not installed.`);
      return;
    }

    var workspacePath: string = vscode.workspace.workspaceFolders
    ? vscode.workspace.workspaceFolders[0].uri.fsPath
    : "";

    let pythonPath = "";

    if (workspacePath === "") {
      pythonPath = process.platform === 'win32' ? 'python' : 'python3';
    } else {
      pythonPath = findNearestVirtualEnv(workspacePath);
    }

    const pythonScriptPath = vscode.Uri.joinPath(extensionUri, "src", "walk_from_func.py"); // Update with your script's path
    const endP = JSON.stringify(endPoints);
    
    // // Consider if argument size gets too large
    // console.log(endP.length);
    // const comp = zlib.gzipSync(endP).toString('base64');
    // console.log(comp.length);
    var output: string[] = [];
    var errors: string[] = [];

    // Run the Python script with the JSON argument
    const pythonProcess = child_process.spawn(pythonPath, [pythonScriptPath.fsPath, flow.file, flow.func, endP]);
    
    pythonProcess.stdout.on("data", (data: any) => {
      console.log(data.toString());
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

export function createGraph(context: vscode.ExtensionContext, flowName: string | undefined = undefined, refresh: boolean = false) {
    let allFlows: LooseObject[] = context.globalState.get("flows") || [];
    let routes:  LooseObject[] = context.globalState.get("routes") || [];
    let funcs: LooseObject[] = context.globalState.get("funcs") || [];
    let graphs: LooseObject = context.globalState.get("graphs") || {};

    if (refresh) {
      [routes, allFlows, funcs] = extractRFF(context);
    }

    if (allFlows.length === 0) {
      throw new Error("how");
    }

    let flows: LooseObject[] = [];

    if (flowName !== undefined) {
      let flow = allFlows.find((el) => el.name === flowName);

      if (flow === undefined) {
        throw new Error("how");
      }

      // generate this graph
      flows = [flow];
    }
    else {
      // generate all graphs
      flows = allFlows;
    }


    for(let i = 0 ; i< flows.length ; ++i) {
      const graphView = new GraphView(context);
      const flowName = flows[i].name;

      // check if graph is in memory
      if (!refresh && graphs[flowName]) {
        const data = graphs[flowName];
        graphView.showGraph(data, flowName);
        continue;
      }
      
      runPythonProg(context.extensionUri, flows[i], routes).then((result) => {
        if (result.errors.length) {
          result.errors.forEach(err => console.error(err));
          vscode.window.showErrorMessage(`Graph generation for flow '${flowName}' failed`);
          throw new Error();
        }
        if (result.outputs.length !== 1) {
          throw new Error("too much python output");
        }
        const data = JSON.parse(result.outputs[0]);
        // match graph funcs with extracted funcs
        for (let id in data.graph.nodes) {
          let node = data.graph.nodes[id];

          // Node is a http call
          let unknownNode = false;

          if (node.is_route) {
            const route = routes.filter((endPoint) => pathsAreEqual(endPoint.file, node.file) && endPoint.func_name === node.func_name);
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

        if (refresh || !graphs[flowName]) {
          graphs[flowName] = data;
          context.globalState.update("graphs", graphs);
        }
        graphView.showGraph(data, flowName);
      })
      .catch((error) => {
        vscode.window.showErrorMessage(`Graph generation failed: ${error}`);
        console.error('Error:', error);
      });
    }
}
