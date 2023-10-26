// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";

function extractWordCounts(filePath: string): Record<string, Record<string, any>[]> {
  const content = fs.readFileSync(filePath, "utf8");

  const routePattern = /@app.route\((.+)\)/g; // Use a regular expression to find the word "count"
  const funcPattern = /def\s+(.+)\s*\(.*\)\s*:/g;
  const flowStartPattern = /#+\s*flow-start\((.+)\)/g;
  const flowEndPattern = /#+\s*flow-start\((.+)\)/g;

  var match;
  var matches: Record<string, Record<string, any>[]> = {};
  

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
        matches["routes"].push({ name: match[1], lineno: lineCountBeforeMatch, func: x[1]});
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
    matches["funcs"].push({ name: match[1], lineno: lineCountBeforeMatch });
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
        matches["flowStart"].push({ name: match[1], lineno: lineCountBeforeMatch, func: x[1]});
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
        matches["flowEnd"].push({ name: match[1], lineno: lineCountBeforeMatch, func: x[1]});
        break;
      }
    }
  }

  return matches;
}

function countWordsInFolders(context: vscode.ExtensionContext) {
  var folders: string[] = vscode.workspace.workspaceFolders
    ? vscode.workspace.workspaceFolders.map((x) => x.uri.fsPath)
    : [];

  const config = vscode.workspace.getConfiguration("wordCounter");
  folders.push(...config.get("extraFolders", []));
  const wordCounts: Record<string, any> = {};

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
    wordCounts[folderPathNorm] = subfolderCounts;
  });

  // if(Object.keys(wordCounts).length === 1) {
  //   return wordCounts[Object.keys(wordCounts)[0]];
  // }
  return wordCounts;
}

function countWordsInSubfolders(folderPath: string): Record<string, any> {
  const files = fs.readdirSync(folderPath, { withFileTypes: true });
  const subfolderCounts: Record<string, any> = {};

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

function runPythonProg(jsonArg: any) {
  const pythonScriptPath = path.join(__dirname, "/../src/simplify_ast.py"); // Update with your script's path
    const jsonArgString = JSON.stringify(jsonArg);

    // Run the Python script with the JSON argument
    const pythonProcess = child_process.spawn("python", [pythonScriptPath, jsonArgString]);

    pythonProcess.stdout.on("data", (data: any) => {
      console.log(`Python Script Output: ${data}`);
    });

    pythonProcess.stderr.on("data", (data: any) => {
      console.error(`Python Script Error: ${data}`);
    });

    pythonProcess.on("close", (code: any) => {
      console.log(`Python Script exited with code ${code}`);
    });
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

  const disposable2 = vscode.commands.registerCommand(
    "flow-documentation.countWords",
    () => {
      const endPoints = countWordsInFolders(context);
      runPythonProg(endPoints);
      context.globalState.update("endPointMap", endPoints);
      vscode.window.showInformationMessage(JSON.stringify(endPoints));
    }
  );

  context.subscriptions.push(disposable);
  context.subscriptions.push(disposable2);
}

// This method is called when your extension is deactivated
export function deactivate() {}
