# flow-documentation

This extension will help you easily find code maintainers in your company and/or better understand the architecture of your microservice-based code.

Now available in the VSCode Marketplace: just search for the `flow-documentation` extension.

# Flow Documentation Feature

<img src="./vid/flow_documentation_demo.gif" />

# Maintainer Lookup Feature

<img src="./vid/maintainer_lookup_demo.gif" />

## Known Issues

The microservice architecture thingy is pretty fragile, so here are some improvements for future versions.

- refresh a graph window with same title instead of creating a new one? Or at least close existing ones
- the graph edges are hard to click
- remove assumption that function names are unique
- add support for python classes

## Improvement ideas:

- create simplified view of high-level -> which microservices are involved and how they communicate, no functions, one node for each microservice
- merge create graph and refresh graph in one button, where is refreshes only if the file in which the function is located was modified/moved/deleted
