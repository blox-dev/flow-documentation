// @ts-nocheck

(function () {
    const vscode = acquireVsCodeApi();

    let messageP = document.querySelector('.loading-message');

    document.querySelector('.fetch-flows-button').addEventListener('click', () => {
        vscode.postMessage({ command: 'fetchFlows' });
        if (messageP) {
            messageP.style.display = 'block';
        }
    });

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'updateFlows':
                {
                    console.log('updateFlows', message.flows);
                    if (messageP) {
                        messageP.style.display = 'none';
                    }
                    updateFlowsTable(message.flows);
                    break;
                }
        }
    });

    function openFile(filePath, lineno) {
        console.log("openFile", filePath, lineno);
        vscode.postMessage({ command: 'openFile', filePath, lineno });
    }

    function createGraph(flowName, refresh = false) {
        console.log("createGraph", flowName, refresh);
        vscode.postMessage({ command: 'createGraph', flowName, refresh });
    }

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

        if (flows.length === 0) {
            // no flows, display help message
            let tr = document.createElement("tr");
            let p = document.createElement("p");
            p.innerHTML = "No flows detected. Create a flow by choosing a function to debug then adding the comment <br/><br/><b># flow-start(&lt;flow name&gt;)</b><br/><br/> before the function header";
            tr.appendChild(p);
            table.appendChild(tr);
            return;
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
