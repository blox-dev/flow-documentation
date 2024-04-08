import * as vscode from 'vscode';
import { extractRFF, createGraph, LooseObject } from './extension';
import { openFile, replaceAll } from './utils';

export class FlowsViewProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = 'flow-documentation.flowsView';

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
				case 'fetchFlows':
					{
						this.fetchFlows();
						break;
					}
				case 'openFile':
					{
						openFile(data.filePath, data.lineno);
						break;
					}
				case 'createGraph':
					{
						createGraph(this._context, data.flowName, data.refresh);
						break;
					}
			}
		});
	}

	public fetchFlows() {
		const [_endP, flows, _funcs] = extractRFF(this._context);
		this._view?.webview.postMessage({command: 'updateFlows', flows: flows});
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'flows.js'));

		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'flows.css'));

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

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">

				<title>Flow Documentation</title>
			</head>
			<body>
                <button class="fetch-flows-button">Fetch flows</button>

				<table id="flow-table" class="flow-list"></table>

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
