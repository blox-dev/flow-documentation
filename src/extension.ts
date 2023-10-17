// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

function extractWordCounts(filePath: string): object[] {
  const content = fs.readFileSync(filePath, "utf8");

  const wordPattern = /@app.route\((.+)\)/g; // Use a regular expression to find the word "count"
  // const res = wordPattern.test(content);
  var match;
  var matches = [];
  while ((match = wordPattern.exec(content))) {
    const lineCountBeforeMatch = content
      .slice(0, match.index)
      .split("\n").length;
    matches.push({ route: match[1], lineno: lineCountBeforeMatch });
  }
  return matches;
}

function countWordsInFolders(context: vscode.ExtensionContext) {
  var folders: string[] = vscode.workspace.workspaceFolders
    ? vscode.workspace.workspaceFolders.map((x) => x.uri.fsPath)
    : [];

  const config = vscode.workspace.getConfiguration("wordCounter");
  folders.push(...config.get("extraFolders", []));
  const wordCounts: Record<string, object[]> = {};

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

  return wordCounts;
}

function countWordsInSubfolders(folderPath: string): object[] {
  const files = fs.readdirSync(folderPath, { withFileTypes: true });
  const subfolderCounts: object[] = [];

  files.forEach((file) => {
    const filePath = path.join(folderPath, file.name);

    if (
      file.isFile() &&
      filePath.endsWith(".py") &&
      file.name.charAt(0) !== "."
    ) {
      const counts = extractWordCounts(filePath);
      subfolderCounts.push(...counts);
    } else if (file.isDirectory() && file.name.charAt(0) !== ".") {
      // Recursively search for Python files in subdirectories
      const deeperCounts = countWordsInSubfolders(filePath);
      subfolderCounts.push(...deeperCounts);
    }
  });

  return subfolderCounts;
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
      context.globalState.update("endPointMap", endPoints);
      vscode.window.showInformationMessage(JSON.stringify(endPoints));
    }
  );

  context.subscriptions.push(disposable);
  context.subscriptions.push(disposable2);
}

// This method is called when your extension is deactivated
export function deactivate() {}
