// @ts-nocheck

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.command) {
            case 'updateMaintainers':
                {
                    console.log('updateMaintainers', message.maintainers);
                    updateMaintainersTable(message.maintainers);
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

    function updateMaintainersTable(maintainers) {
        let infoParagraph = document.querySelector('#info_help');
        infoParagraph.textContent = "";

        let table = document.querySelector('#maintainer-table');

        // remove all existing maintainers
        while (table.firstChild) {
            table.removeChild(table.firstChild);
        }
        
        if (maintainers.length === 0) {
            // no maintainers, display help message
            let tr = document.createElement("tr");
            let p = document.createElement("p");
            p.innerHTML = "No maintainers detected for this file. If you would like to maintain this file, then add/edit your entry in codeMaintainerMap.json";
            tr.appendChild(p);
            table.appendChild(tr);
            return;
        }

        let title = document.querySelector('#maintainer-title');
        title.textContent = "Maintainers of <file_name>";

        maintainers.forEach((maintainer) => {
            let tr = document.createElement("tr");
            tr.className = "maintainer-entry";
            let td = document.createElement("td");
            td.className = "maintainer-input";

            let a = document.createElement("p");
            a.innerText = maintainer.name + " / " + maintainer.email + " / " + maintainer.phone;

            td.appendChild(a);
            tr.appendChild(td);
            table.appendChild(tr);
		});
    }
}());
