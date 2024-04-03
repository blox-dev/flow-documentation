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
                    console.log('updateMaintainers', message);
                    updateMaintainersTable(message.activeFilePath, message.maintainers);
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

    function updateMaintainersTable(filepath, maintainers) {
        let infoParagraph = document.querySelector('#info_help');
        infoParagraph.textContent = "";

        let table = document.querySelector('#maintainer-table');

        // remove all existing maintainers
        while (table.firstChild) {
            table.removeChild(table.firstChild);
        }

        let title = document.querySelector('#maintainer-title');

        let filepathSplit = filepath.split('\\');
        let filename = filepathSplit[filepathSplit.length - 1];
        title.textContent = "Maintainers of " + filename;
        
        if (maintainers.length === 0) {
            // no maintainers, display help message
            let tr = document.createElement("tr");
            let p = document.createElement("p");
            p.innerHTML = "No maintainers detected for this file. If you would like to maintain this file, then add/edit your entry in codeMaintainerMap.json";
            tr.appendChild(p);
            table.appendChild(tr);
            return;
        }

        maintainers.forEach((maintainer) => {
            let tr = document.createElement("tr");
            tr.className = "maintainer-entry";

            let p = document.createElement("p");
            p.innerText = maintainer.name + " / " + maintainer.email + " / " + maintainer.phone;

            tr.appendChild(p);
            table.appendChild(tr);

            for (const [key, value] of Object.entries(maintainer)) {
                if (key === "name") {
                    continue;
                }
                let tr = document.createElement("tr");
                tr.className = "maintainer-entry";
                
                let p = document.createElement("p");
                p.innerText = "\t> " + key + ": " + value;

                tr.appendChild(p);
                table.appendChild(tr);
            }
		});
    }
}());
