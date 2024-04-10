import * as vscode from 'vscode';
import { LooseObject } from './extension';
import { openFile } from './utils';

export class MaintainersViewProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = 'flow-documentation.maintainersView';

	private _view?: vscode.WebviewView;

	private _extensionUri: vscode.Uri;

	constructor(
		private _context: vscode.ExtensionContext,
	) {
		this._extensionUri = _context.extensionUri;
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this._context.extensionUri
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.command) {
				case 'openFile':
					{
						openFile(data.filePath, data.lineno);
						break;
					}
			}
		});
	}

	public displayMaintainers(maintainerMapPath: string, activeFilePath: string, maintainers: LooseObject) {
		this._view?.webview.postMessage({ command: 'updateMaintainers', maintainers: maintainers, activeFilePath: activeFilePath, maintainerMapPath: maintainerMapPath });
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'maintainers.js'));
		const jquerySrc = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "lib", "jquery.min.js"));
		const jqueryUISrc = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "lib", "jquery-ui.min.js"));

		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'maintainers.css'));
		const stylejqueryUI = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "lib", "jquery-ui.min.css"));

		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading styles from our extension directory,
					and only allow scripts that have a specific nonce.
					(See the 'webview-sample' extension sample for img-src content security policy examples)
				-->
				
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				
				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<script nonce="${nonce}" src="${jquerySrc}"></script>
				<script nonce="${nonce}" src="${jqueryUISrc}"></script>
				<link href="${stylejqueryUI}" rel="stylesheet">

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">

				<title>Flow Documentation</title>
			</head>
			<body>
				<p id="info_help">
					Right click on a file or folder and select <b>Show Maintainer</b> to open the list of active maintainers.
				</p>

				<h1 id="maintainer-title"></h1>

				<div id="maintainer-div"></div>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
