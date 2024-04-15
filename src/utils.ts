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

export function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function escapeBackSlashRegExp(string: string) {
  return string.replace(/[\\]/g, '\\$&');
}

export function replaceAll(str: string, find: string, replace: string) {
  return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

export function openFile(filePath: string, lineno: number | number[]) {
  vscode.workspace.openTextDocument(vscode.Uri.file(filePath)).then((document) => {
    vscode.window.showTextDocument(document, {}).then((editor) => {
      const linenos = typeof lineno === "number" ? [lineno] : lineno;
      let selections = [];
      for (let i = 0; i < linenos.length; ++i) {
        const range = new vscode.Range(linenos[i], 0, linenos[i], 0);
        const startPosition = new vscode.Position(linenos[i] - 1, 0); // Line numbers start from 0
        const endPosition = new vscode.Position(linenos[i], 0);
        selections.push(new vscode.Selection(startPosition, endPosition));
      }
      // scroll to first appearance
      const range = new vscode.Range(linenos[0], 0, linenos[0], 0);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

      editor.selections = selections;
    });
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

  for (let i = 0; i < linenos.length; ++i) {
    const range = new vscode.Range(linenos[i], 0, linenos[i], 0);
    const location = new vscode.Location(path, range);
    breakPoints.push(new vscode.SourceBreakpoint(location));
  }
  vscode.debug.addBreakpoints(breakPoints);
}
