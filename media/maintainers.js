// @ts-nocheck

(function () {
    const vscode = acquireVsCodeApi();

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'updateMaintainers':
                {
                    console.log('updateMaintainers', message);
                    updateMaintainersTable(message.maintainerMapPath, message.activeFilePath, message.maintainers);
                    break;
                }
        }
    });

    function openFile(filePath, lineno) {
        console.log("openFile", filePath, lineno);
        vscode.postMessage({ command: 'openFile', filePath, lineno});
    }

    function updateMaintainersTable(maintainerMapPath, filepath, maintainers) {
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

        let maintainerMapPathSplit = maintainerMapPath.split('\\');
        let maintainerMapFilename = maintainerMapPathSplit[maintainerMapPathSplit.length - 1];
        
        if (maintainers.length === 0) {
            // no maintainers, display help message
            let tr = document.createElement("tr");
            let p = document.createElement("p");

            let a = document.createElement("a");
            a.innerText = maintainerMapFilename;
            a.title = maintainerMapFilename;
            a.href = '#';
            a.addEventListener('click', () => openFile(maintainerMapPath, 1));

            p.innerHTML = "No maintainers detected for this file. If you would like to maintain this file, then add/edit your entry in ";
            p.appendChild(a);
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
