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
            case 'updateMostActiveMaintainers':
                {
                    console.log('updateMostActiveMaintainers', message);
                    updateMostActiveMaintainersTable(message.map);
                    break;
                }
        }
    });

    function openFile(filePath, lineno) {
        console.log("openFile", filePath, lineno);
        vscode.postMessage({ command: 'openFile', filePath, lineno });
    }

    // recursively remove all inner nodes
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

    function updateMostActiveMaintainersTable(maintainerMap) {
        let infoParagraph = document.querySelector('#info_help');
        infoParagraph.textContent += "Here are the most active maintainers of this repository";

        let mostActiveMaintainerDiv = document.querySelector('#most-active-maintainer-div');
        clearInner(mostActiveMaintainerDiv);
        
        let topAccordionDiv = document.createElement("div");
        topAccordionDiv.classList.add("accordion");

        for (let maintainerIndex = 0 ; maintainerIndex < maintainerMap.length ; maintainerIndex ++) {
            let maintainer = maintainerMap[maintainerIndex];

            let maintainerHeader = document.createElement("h2"); // <h2>William (12 maintained)</h2>
            maintainerHeader.innerText = maintainer.contact.name + " (" + maintainer.maintains.length + " maintained)";

            let maintainerAccordionDiv = document.createElement("div");
            maintainerAccordionDiv.classList.add("accordion");

            let maintainsHeader = document.createElement("h2"); // <h2>Maintained Code</h2>
            maintainsHeader.innerText = "Maintained Code";

            let maintainsDiv = document.createElement("div");

            for (let codeIndex = 0 ; codeIndex < maintainer.maintains.length ; codeIndex ++) {
                let code = maintainer.maintains[codeIndex];
                
                let p = document.createElement("p");
                p.innerText = "> " + code.path + ((code.regex && code.regex === true) ? " (regex)" : "");
                
                maintainsDiv.appendChild(p);
            }

            let contactHeader = document.createElement("h2"); // <h2>Contact</h2>
            contactHeader.innerText = "Contact";

            let contactDiv = document.createElement("div");

            // add contact information
            for (const [key, value] of Object.entries(maintainer.contact)) {
                if (["name", "maintains"].includes(key)) {
                    continue;
                }
                if (!value || (key === "_old" && value.length === 0)) {
                    continue;
                }
                let p = document.createElement("p");
                p.innerText = "\t> " + key + ": " + value;

                contactDiv.appendChild(p);
            }

            maintainerAccordionDiv.appendChild(maintainsHeader);
            maintainerAccordionDiv.appendChild(maintainsDiv);

            maintainerAccordionDiv.appendChild(contactHeader);
            maintainerAccordionDiv.appendChild(contactDiv);

            topAccordionDiv.appendChild(maintainerHeader);
            topAccordionDiv.appendChild(maintainerAccordionDiv);
        }

        mostActiveMaintainerDiv.appendChild(topAccordionDiv);

        $(".accordion").accordion({
            header: "> h2:not(.item)",
            heightStyle: "content",
            active: false,
            collapsible: true
        });
    }

    function updateMaintainersTable(maintainerMapPath, filepath, maintainers) {
        let infoParagraph = document.querySelector('#info_help');
        infoParagraph.textContent = "";

        let mostActiveMaintainerDiv = document.querySelector('#most-active-maintainer-div');
        clearInner(mostActiveMaintainerDiv);

        let maintainerCodePathDiv = document.querySelector('#maintainer-div');
        clearInner(maintainerCodePathDiv);


        let title = document.querySelector('#maintainer-title');

        let filepathSplit = filepath.split('\\');
        let filename = filepathSplit[filepathSplit.length - 1];
        title.textContent = "Maintainers of " + filename;

        let maintainerMapPathSplit = maintainerMapPath.split('\\');
        let maintainerMapFilename = maintainerMapPathSplit[maintainerMapPathSplit.length - 1];

        if (Object.keys(maintainers).length === 0) {
            // no maintainers, display help message
            let h3 = document.createElement("h3");

            let a = document.createElement("a");
            a.innerText = maintainerMapFilename;
            a.title = maintainerMapFilename;
            a.href = '#';
            a.addEventListener('click', () => openFile(maintainerMapPath, 1));

            h3.innerHTML = "No maintainers detected for this file. If you would like to maintain this file, then add/edit your entry in ";
            h3.appendChild(a);
            maintainerCodePathDiv.appendChild(h3);
            return;
        }

        // there is at least one maintainer, create accordion
        let maintainerAccordionDiv = document.createElement("div");
        maintainerAccordionDiv.classList.add("accordion");

        // order paths by most to least specific (longest string to shortest)
        let codePaths = Object.keys(maintainers);
        codePaths.sort((a, b) => b.length - a.length);

        for (let codeIndex = 0; codeIndex < codePaths.length ; codeIndex ++) {
            let codePath = codePaths[codeIndex];
            let code = maintainers[codePath].code;
            let maintainerList = maintainers[codePath].maintainer;
            // order maintainers by number of paths they manage, the least busy should appear first
            // as we assume that they are the most specialized in this issue
            maintainerList.sort((a, b) => a.maintainedCount - b.maintainedCount);

            let codeHeader = document.createElement("h2"); // <h2>addons/account</h2>
            codeHeader.innerText = codePath + ((code.regex && code.regex === true) ? " (regex)" : "");

            let maintainerDiv = document.createElement("div"); // <div>
            maintainerDiv.classList.add("accordion");

            for (let i = 0 ; i < maintainerList.length ; ++i) {
                const maintainer = maintainerList[i];
                
                let maintainerHeader = document.createElement("h2"); // <h2>William</h2>
                maintainerHeader.innerHTML = maintainer.name;
    
                let maintainerContactDiv = document.createElement("div"); // <div>
    
                for (const [key, value] of Object.entries(maintainer)) {
                    if (["name", "maintains", "maintainedCount"].includes(key)) {
                        continue;
                    }
                    if (!value || (key === "_old" && value.length === 0)) {
                        continue;
                    }
                    let p = document.createElement("p");
                    p.innerText = "\t> " + key + ": " + value;
    
                    maintainerContactDiv.appendChild(p);
                }
                maintainerDiv.appendChild(maintainerHeader);
                maintainerDiv.appendChild(maintainerContactDiv);
            }

            // </div>

            maintainerAccordionDiv.appendChild(codeHeader);
            maintainerAccordionDiv.appendChild(maintainerDiv);
        };

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
