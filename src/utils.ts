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
              var range = new vscode.Range(lineno, 0, lineno, 0);
              editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
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

    // +1 because the lineno points at the function header, not the function code
    const range = new vscode.Range(message.lineno + 1, 0, message.lineno + 1, 0);
    const location = new vscode.Location(vscode.Uri.file(message.filePath), range);
    const brk = new vscode.SourceBreakpoint(location);
    vscode.debug.addBreakpoints([brk]);
}