// @ts-nocheck

(function () {
  const vscode = acquireVsCodeApi();

  window.addEventListener("message", (event) => {
    console.log(event);
    const message = event.data;
    switch (message.command) {
      case "setGraphData": {
        console.log("setGraphData", message);
        document.graphData = message.graphData;
        doStuff(message.graphData, message.graphString, message.graphStyle, message.legendString, message.affectedFiles);
        break;
      }
      case "highlightCode": {
        console.log("highlightCode", message);
        highlightCode(document.graphData, message.filePath, message.selectedLineNumber);
        break;
      }
    }
  });

  function openFile(filePath, lineno) {
    console.log("openfile", filePath, lineno);
    vscode.postMessage({ command: "openFile", filePath, lineno });
  }
  function addBreakpoint(filePath, lineno) {
    console.log("addBreakpoint", filePath, lineno);
    vscode.postMessage({ command: "addBreakpoint", filePath, lineno });
  }
  function removeBreakpoint(filePath, lineno) {
    console.log("removeBreakpoint", filePath, lineno);
    vscode.postMessage({ command: "removeBreakpoint", filePath, lineno });
  }

  var i = document.getElementById("menu").style;
  function menu(x, y) {
    i.top = y + "px";
    i.left = x + "px";
    i.visibility = "visible";
    i.opacity = "1";
  }
  function unmenu() {
    i.opacity = "0";
    setTimeout(function () {
      i.visibility = "hidden";
    }, 501);
  }

  function highlightCode(graphData, filePath, selectedLineNumber) {
    const nodes = graphData.graph.nodes;
    let currentNode = { "funcName": null, "lineno": -1 };
    for (const nodeName in nodes) {
      if (nodes.hasOwnProperty(nodeName)) {
        const lineno = nodes[nodeName].lineno;
        if (nodes[nodeName].file === filePath && lineno > currentNode.lineno && lineno <= selectedLineNumber) {
          currentNode = { "funcName": nodeName, "lineno": nodes[nodeName].lineno };
        }
      }
    }

    // check if there is an edge in the graph which exactly matches the highlighted line,
    // in which case the endNode should be highlighted

    const edges = graphData.graph.edges;
    for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex++) {
      const edge = edges[edgeIndex];
      if (edge.start_node === currentNode.funcName && edge.call_lines.includes(selectedLineNumber)) {
        currentNode = { "funcName": edge.end_node, "lineno": nodes[edge.end_node].lineno };
        break;
      }
    }

    console.log(selectedLineNumber);
    console.log(currentNode);

    // highlight the selected node in the graph
    const uinodes = document.querySelectorAll(".node");
    uinodes.forEach((node) => {
      const nodeId = node.id;
      [_L, node_name, _EdgeNum] = nodeId.split("-");

      if (node_name !== currentNode.funcName) {
        return;
      }
      // add the highlight class to the node we want to highlight
      const rect = node.getElementsByTagName("rect")[0];
      rect.classList.add("highlightNode");

      // after 1 second, remove the class
      setTimeout(function () {
        rect.classList.remove("highlightNode");
      }, 1000);
    });
  }

  async function doStuff(graphData, graphString, graphStyle, legendString, affectedFiles) {
    const htmlCode = await mermaid.mermaidAPI.render(
      "mermaidChart",
      graphString
    );
    const nodeData = graphData.graph.nodes;
    const edgeData = graphData.graph.edges;

    document.getElementById("mermaidGraph").innerHTML = htmlCode.svg;

    // display legend
    document.querySelector(".legend").innerHTML = legendString;

    console.log("----------- nodes ------------");
    console.log(nodeData);
    updateNodes(nodeData, graphStyle);

    console.log("----------- edges ------------");
    console.log(edgeData);
    updateEdges(nodeData, edgeData, graphStyle);

    const affList = document.querySelector(".affected-files-list");
    while (affList.firstChild) {
      affList.removeChild(affList.firstChild);
    }

    for (const [file, funcs] of Object.entries(affectedFiles)) {
      console.log(file, funcs);
      let li = document.createElement("li");
      li.innerHTML = file + ": " + funcs.join(', ');
      affList.appendChild(li);
    }

    // hide menu
    document.addEventListener(
      "click",
      function (e) {
        i.opacity = "0";
        i.visibility = "hidden";
      },
      false
    );
  }

  function updateNodes(nodeData, graphStyle) {
    const nodes = document.querySelectorAll(".node");
    nodes.forEach((node) => {
      const nodeId = node.id;
      [_L, node_name, _EdgeNum] = nodeId.split("-");

      const nn = nodeData[node_name];
      node.onclick = () => {
        openFile(nn.file, nn.lineno + 1);
      };
      node.style.cursor = "pointer";
      const rect = node.getElementsByTagName("rect")[0];
      if (nn.is_route && nn.is_route === true) {
        rect.style.fill = nn.project_color;
        rect.style.strokeWidth = graphStyle.borderStrokeWidth;
        if (nn.project_color === "#ff0000") {
          node.style.cursor = "not-allowed";
          node.onclick = null;
        }
      }

      if (nn.project_color && nn.project_color === "#ff0000") {
        return;
      }

      if (nn.hasBreakpoint) {
        rect.style.stroke = "red";
        rect.style.strokeWidth = "5px";
      } else {
        rect.style.stroke = graphStyle.primaryBorderColor;
        rect.style.strokeWidth = graphStyle.borderStrokeWidth;
      }

      // add context menu
      node.addEventListener(
        "contextmenu",
        function (e) {
          // set menu links
          var openCall = document.getElementById("open-call");
          openCall.style.display = "none";
          openCall.onclick = null;

          var openFunc = document.getElementById("open-func");
          openFunc.style.display = "block";
          openFunc.onclick = function (e) {
            e.preventDefault();
            openFile(nn.file, nn.lineno + 1);
          };

          var addBrkCall = document.getElementById("add-brk-call");
          addBrkCall.style.display = "none";
          addBrkCall.onclick = null;

          var remBrkCall = document.getElementById("rem-brk-call");
          remBrkCall.style.display = "none";
          remBrkCall.onclick = null;

          if (nn.hasBreakpoint) {
            var addBrkFunc = document.getElementById("add-brk-func");
            addBrkFunc.style.display = "none";
            addBrkFunc.onclick = null;

            var remBrkFunc = document.getElementById("rem-brk-func");
            remBrkFunc.style.display = "block";
            remBrkFunc.onclick = function (e) {
              e.preventDefault();
              removeBreakpoint(nn.file, nn.lineno + 1);
              nn.hasBreakpoint = false;
              updateNodes(nodeData, graphStyle);
            };
          } else {
            var addBrkFunc = document.getElementById("add-brk-func");
            addBrkFunc.style.display = "block";
            addBrkFunc.onclick = function (e) {
              e.preventDefault();
              // +1 because the lineno points at the function header, not the function code
              addBreakpoint(nn.file, nn.lineno + 1);
              nn.hasBreakpoint = true;
              updateNodes(nodeData, graphStyle);
            };

            var remBrkFunc = document.getElementById("rem-brk-func");
            remBrkFunc.style.display = "none";
            remBrkFunc.onclick = null;
          }

          // display menu
          var posX = e.clientX;
          var posY = e.clientY;
          menu(posX, posY);
          e.preventDefault();
        },
        false
      );
    });
  }

  function updateEdges(nodeData, edgeData, graphStyle) {
    const edges = document.querySelectorAll(".flowchart-link");
    edges.forEach((edge) => {
      // reverse engineer node ids from edge name
      // TODO: find some other method
      const id = edge.id;
      console.log(id);

      [_L, start_node_name, end_node_name, _EdgeNum] = id.split("-");

      const sn = nodeData[start_node_name];
      const en = nodeData[end_node_name];

      const edggge = edgeData.filter(
        (x) => x.start_node === start_node_name && x.end_node === end_node_name
      )[0];

      if (edggge === undefined) {
        return;
      }
      const callLines = edggge.call_lines;

      if (edggge.hasBreakpoint) {
        edge.style.stroke = "red";
      } else {
        edge.style.stroke = graphStyle.primaryBorderColor;
      }

      // add context menu
      edge.addEventListener(
        "contextmenu",
        function (e) {
          // set menu links
          var openCall = document.getElementById("open-call");
          openCall.style.display = "block";
          openCall.onclick = function (e) {
            e.preventDefault();
            openFile(sn.file, callLines);
          };

          var openFunc = document.getElementById("open-func");
          openFunc.style.display = "none";
          openFunc.onclick = null;

          if (edggge.hasBreakpoint) {
            var addBrkCall = document.getElementById("add-brk-call");
            addBrkCall.style.display = "none";
            addBrkCall.onclick = null;

            var remBrkCall = document.getElementById("rem-brk-call");
            remBrkCall.style.display = "block";
            remBrkCall.onclick = function (e) {
              e.preventDefault();

              removeBreakpoint(sn.file, callLines.map(function (elem) { return elem - 1; }));
              edggge.hasBreakpoint = false;
              updateEdges(nodeData, edgeData, graphStyle);
            };
          } else {
            var addBrkCall = document.getElementById("add-brk-call");
            addBrkCall.style.display = "block";
            addBrkCall.onclick = function (e) {
              e.preventDefault();

              addBreakpoint(sn.file, callLines.map(function (elem) { return elem - 1; }));
              edggge.hasBreakpoint = true;
              updateEdges(nodeData, edgeData, graphStyle);
            };

            var remBrkCall = document.getElementById("rem-brk-call");
            remBrkCall.style.display = "none";
            remBrkCall.onclick = null;
          }

          var addBrkFunc = document.getElementById("add-brk-func");
          addBrkFunc.style.display = "none";
          addBrkFunc.onclick = null;

          var remBrkFunc = document.getElementById("rem-brk-func");
          remBrkFunc.style.display = "none";
          remBrkFunc.onclick = null;

          // display menu
          var posX = e.clientX;
          var posY = e.clientY;
          menu(posX, posY);
          e.preventDefault();
        },
        false
      );
    });
  }

  function ads() {
    mermaid.initialize({ startOnLoad: false });
    vscode.postMessage({ command: "fetchGraphData" });
  }
  ads();
})();
