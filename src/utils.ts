import * as path from "path";
import * as vscode from "vscode";

export function pathsAreEqual(path1: string, path2: string) {
    path1 = path.resolve(path1);
    path2 = path.resolve(path2);
    if (process.platform === "win32") {
      return path1.toLowerCase() === path2.toLowerCase();
    }
    return path1 === path2;
}

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
  
export function replaceAll(str: string, find: string, replace: string) {
    return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

export function openFile(filePath: string, lineno: number | undefined) {
    vscode.workspace.openTextDocument(vscode.Uri.file(filePath)).then((document) => {
        if (lineno) {
          vscode.window.showTextDocument(document, {}).then((editor) => {
              const range = new vscode.Range(lineno, 0, lineno, 0);
              const startPosition = new vscode.Position(lineno - 1, 0); // Line numbers start from 0
              const endPosition = new vscode.Position(lineno, 0);
              
              editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
              editor.selections = [new vscode.Selection(startPosition, endPosition)];
          });
        } else {
          vscode.window.showTextDocument(document);
        }
      });
}

export function addBreakpoint(message: any) {
    // TODO: no way to visually display to the user that there is a breakpoint in the actual file
    // can show in the graph though, but that's about it. With no support for launching the
    // functions from the graph, it's just confusing
    // Related: https://github.com/microsoft/vscode/issues/15178
    const linenos = typeof message.lineno === "number" ? [message.lineno] : message.lineno;
    const path = vscode.Uri.file(message.filePath);
    let breakPoints = [];

    for (let i=0 ; i < linenos.length ; ++i) {
      const range = new vscode.Range(linenos[i], 0, linenos[i], 0);
      const location = new vscode.Location(path, range);
      breakPoints.push(new vscode.SourceBreakpoint(location));
    }
    vscode.debug.addBreakpoints(breakPoints);
}
