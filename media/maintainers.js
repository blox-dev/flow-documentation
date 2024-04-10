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
        vscode.postMessage({ command: 'openFile', filePath, lineno });
    }

    function updateMaintainersTable(maintainerMapPath, filepath, maintainers) {
        let infoParagraph = document.querySelector('#info_help');
        infoParagraph.textContent = "";

        let maintainerCodePathDiv = document.querySelector('#maintainer-div');

        // recursively remove all existing maintainers
        // https://stackoverflow.com/a/32261977

        function clearInner(node) {
            while (node.hasChildNodes()) {
                clear(node.firstChild);
            }
        }
          
        function clear(node) {
            while (node.hasChildNodes()) {
                clear(node.firstChild);
            }
            node.parentNode.removeChild(node);
        }
          
        clearInner(maintainerCodePathDiv);


        let title = document.querySelector('#maintainer-title');

        let filepathSplit = filepath.split('\\');
        let filename = filepathSplit[filepathSplit.length - 1];
        title.textContent = "Maintainers of " + filename;

        let maintainerMapPathSplit = maintainerMapPath.split('\\');
        let maintainerMapFilename = maintainerMapPathSplit[maintainerMapPathSplit.length - 1];

        if (maintainers.length === 0) {
            // no maintainers, display help message
            let p = document.createElement("p");

            let a = document.createElement("a");
            a.innerText = maintainerMapFilename;
            a.title = maintainerMapFilename;
            a.href = '#';
            a.addEventListener('click', () => openFile(maintainerMapPath, 1));

            p.innerHTML = "No maintainers detected for this file. If you would like to maintain this file, then add/edit your entry in ";
            p.appendChild(a);
            maintainerCodePathDiv.appendChild(p);
            return;
        }

        // there is at least one maintainer, create accordion
        let maintainerAccordionDiv = document.createElement("div");
        maintainerAccordionDiv.classList.add("accordion");

        maintainers.forEach((maintainer) => {
            console.log(maintainer);

            let codeHeader = document.createElement("h2"); // <h3>addons/account</h3>
            codeHeader.innerText = maintainer.maintains.path + ((maintainer.maintains.regex && maintainer.maintains.regex === true) ? " (regex)" : "");

            let maintainerDiv = document.createElement("div"); // <div>
            maintainerDiv.classList.add("accordion");

            let maintainerHeader = document.createElement("h2"); // <h3>William</h3>
            maintainerHeader.innerHTML = maintainer.name;

            let maintainerContactDiv = document.createElement("div"); // <div>

            for (const [key, value] of Object.entries(maintainer)) {
                if (["name", "maintains"].includes(key)) {
                    continue;
                }
                if (!value || (key === "_old" && value.length === 0)) {
                    continue;
                }
                let p = document.createElement("p");
                p.innerText = "\t> " + key + ": " + value;

                maintainerContactDiv.appendChild(p);
            }
            // </div>

            maintainerDiv.appendChild(maintainerHeader);
            maintainerDiv.appendChild(maintainerContactDiv);

            // </div>

            maintainerAccordionDiv.appendChild(codeHeader);
            maintainerAccordionDiv.appendChild(maintainerDiv);
        });

        // attach and run accordion
        maintainerCodePathDiv.appendChild(maintainerAccordionDiv);

        $(".accordion").accordion({
            header: "> h2:not(.item)",
            heightStyle: "content",
            active: false,
            collapsible: true
        });
    }
}());
