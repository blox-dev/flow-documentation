// @ts-nocheck

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    document.querySelector('.fetch-flows-button').addEventListener('click', () => {
        vscode.postMessage({ command: 'fetchFlows'});
    });

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.command) {
            case 'updateFlows':
                {
                    console.log('updateFlows', message.flows);
                    updateFlowsTable(message.flows);
                    break;
                }
        }
    });

    function openFile(filePath, lineno) {
        console.log("openFile", filePath, lineno);
        vscode.postMessage({ command: 'openFile', filePath, lineno});
    }

    function createGraph(flowName, refresh = false) {
        console.log("createGraph", flowName, refresh);
        vscode.postMessage({ command: 'createGraph', flowName, refresh});
    }

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }
      
    function replaceAll(str, find, replace) {
        return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
    }

    function updateFlowsTable(flows) {
        let table = document.querySelector('#flow-table');

        // remove all existing flows
        while (table.firstChild) {
            table.removeChild(table.firstChild);
        }
        
        flows.forEach((flow) => {
			const flowFile = replaceAll(flow.file, '\\', '/');
			const flowName = replaceAll(flow.name, '\\', '/');
            let tr = document.createElement("tr");
            tr.className = "flow-entry";
            let td = document.createElement("td");
            td.className = "flow-input";
            let a = document.createElement("a");

            a.innerText = flowName;
            a.style.paddingRight = '10px';
            a.title = flowName;
            a.href = '#';
            a.addEventListener('click', () => openFile(flowFile, flow.lineno));

            let cg = document.createElement("a");
            cg.innerText = "Create graph";
            cg.style.paddingRight = '10px';
            cg.title = flowName;
            cg.href = "#";
            cg.addEventListener('click', () => createGraph(flowName, false));

            let rg = document.createElement("a");
            rg.innerText = "Refresh graph";
            rg.title = flowName;
            rg.href = "#";
            rg.addEventListener('click', () => createGraph(flowName, true));

            td.appendChild(a);
            td.appendChild(cg);
            td.appendChild(rg);

            tr.appendChild(td);
            table.appendChild(tr);
		});
    }
}());
