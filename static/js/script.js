document.addEventListener('DOMContentLoaded', () => {
    let width = $('.graph-container')[0].clientWidth;
    let height = $('.graph-container')[0].clientHeight;
    let rootNode = null;
    const svg = d3.select('.graph-container svg');
    const activeNodeSize = 6;
    const groupNodeSize = 4;
    const nodeSize = 3;
    const linkWidth = 0.6;
    const linkColor = 'var(--link-clr)';
    const nodeBorderColor = 'var(--nde-bdr-clr)';

    let currentActiveNodeName = null;
    let nodesDisplayed = [];
    let visibleGroups = {};

    const depthSlider = $('#depthSlider')[0]; 
    const depthValueLabel = document.getElementById('depthValue');
    const searchInput = document.getElementById('searchInput');
    const clearButton = document.getElementById('clearButton');
    const searchButton = document.getElementById('searchButton');
    const failedSearch = document.querySelector('.failed-search'); // For displaying invalid search
    const rightContainer = d3.select('.right-pane');

    const labelNodesSwitch = document.getElementById('labelNodesSwitch');
    const groupNodeSwitch = document.getElementById('groupNodeSwitch');
    const switchesContainer = document.querySelector('.switches-container');

    const onHomeButton = document.getElementById('homeButton');
    const onRefreshButton = document.getElementById('refreshButton');

    const dropdown = document.createElement('div');
    dropdown.className = 'search-menu'; // Matches your CSS class
    searchInput.parentNode.appendChild(dropdown);

    let allNodes = []; // Holds all node names and group types

    // Show the clear button and dropdown when input has text
    searchInput.addEventListener('input', () => {
        var input = searchInput.value.trim();
        var dropdown = document.getElementById('autocompleteSuggestions');
        
        if (input) {
            clearButton.style.display = 'flex'; // Show clear button
            dropdown.style.display = 'block'; // Show dropdown
        } else {
            clearButton.style.display = 'none'; // Hide clear button
            dropdown.style.display = 'none'; // Hide dropdown
            dropdown.innerHTML = ''; // Clear dropdown content
        }
    });

    clearButton.addEventListener('click', (event) => {
        event.preventDefault();
        searchInput.value = ''; // Clear input field
        clearButton.style.display = 'none'; // Hide clear button
        var dropdown = document.getElementById('autocompleteSuggestions');
        dropdown.style.display = 'none'; // Temporarily hide dropdown
        dropdown.innerHTML = ''; // Clear dropdown content
    });

    // Function to show the "Invalid Search" message
    function showInvalidSearchMessage(input) {
        failedSearch.style.display = 'block'; // Show the message

        if(!input) {
            failedSearch.textContent = 'Please enter a search term'; // Set message content
            return;
        }

        failedSearch.textContent = `${input} does not exist`; // Set message content

        // Hide the message after 3 seconds
        setTimeout(() => {
            failedSearch.style.display = 'none'; // Hide the message
            failedSearch.textContent = ''; // Clear the message content
        }, 3000);
    }

    // Initialize nodes for dropdown matching
    function populateNodeList(data) {
        function traverse(node) {
            if (node.name) allNodes.push(node.name);
            if (node.groupType) allNodes.push(node.groupType);
            if (node.children) node.children.forEach(traverse);
        }
        traverse(data);
        allNodes = [...new Set(allNodes)]; // Remove duplicates
    }

    // Search function
    function searchNode() {
        var input = searchInput.value.trim();
        if (input) {
            var matchingNode = allNodes.find(node => node.toLowerCase() === input.toLowerCase());
            if (matchingNode) {
                fetchAndRenderGraph(depthSlider.value, input); // Valid search, proceed with rendering
            } else {
                showInvalidSearchMessage(input); // Invalid search, show message
            }
        } else {
            showInvalidSearchMessage(input); // Empty search, show message
        }
    }

    // Add event listener for Enter key
    searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            searchNode();
            dropdown.innerHTML = ''; // Clear the dropdown
        }
    });

    // Add event listener for the search button
    searchButton.addEventListener('click', () => {
        searchNode();
        dropdown.innerHTML = ''; // Clear the dropdown
    });

    // Dynamic dropdown functionality
    searchInput.addEventListener('input', () => {
        var input = searchInput.value.toLowerCase();

        if (!input) {
            dropdown.style.display = 'none'; // Hide the dropdown when input is empty
            dropdown.innerHTML = ''; // Clear any previous suggestions
            return;
        }
        
        var dropdown = document.getElementById('autocompleteSuggestions');
        dropdown.innerHTML = ''; // Clear previous suggestions
    
        if (!input) {
            dropdown.style.border = 'none'; // Hide the border if the input is empty
            return;
        }
    
        // Filter and display matching nodes
        var matches = allNodes.filter(name => name.toLowerCase().includes(input));
        matches.forEach(match => {
            var item = document.createElement('div');
            item.className = 'autocomplete-suggestions';
            item.textContent = match;
            item.addEventListener('click', () => {
                searchInput.value = match; // Set the selected value
                searchNode();
                dropdown.innerHTML = ''; // Clear the dropdown
                dropdown.style.border = 'none'; // Hide the border after selection
            });
            dropdown.appendChild(item);
        });
    
        // Handle case where no matches are found
        if (matches.length === 0) {
            var noMatch = document.createElement('div');
            noMatch.className = 'autocomplete-suggestions';
            noMatch.textContent = 'No matches found';
            dropdown.appendChild(noMatch);
        }
    });

    // Global references for zoom updates
    let currentZoomScale = 1; 
    let nodeSelectionGlobal, linkSelectionGlobal, labelsSelectionGlobal;

    labelNodesSwitch.addEventListener('change', () => {
        fetchAndRenderGraph(depthSlider.value, searchInput.value.trim());
    });

    groupNodeSwitch.addEventListener('change', () => {
        resetSimulationForForces();    
        fetchAndRenderGraph(depthSlider.value, searchInput.value.trim());
    });    

    // Define zoom behavior similar to old code
    const zoom = d3.zoom()
        .scaleExtent([0.5, 10])
        .on('zoom', (event) => {
            var transform = event.transform;
            currentZoomScale = transform.k;

            // Apply transform
            graphGroup.attr('transform', transform);

            // Adjust node, link, label sizes based on zoom
            if (nodeSelectionGlobal) {
                nodeSelectionGlobal
                    .attr('r', d => {
                        if (d.data.name === currentActiveNodeName) {
                            return activeNodeSize / currentZoomScale; // Active node size scales with zoom
                        } else if (d.data.groupType) {
                            return groupNodeSize / currentZoomScale; // Group node size scales with zoom
                        } else {
                            return nodeSize / currentZoomScale; // Default node size scales with zoom
                        }
                    })
                    .attr('stroke-width', 1 / currentZoomScale); // Scale stroke width with zoom
            }            

            if (linkSelectionGlobal) {
                linkSelectionGlobal.attr('stroke-width', linkWidth / currentZoomScale);
            }

            if (labelsSelectionGlobal) {
                labelsSelectionGlobal.attr('font-size', `${12 / currentZoomScale}px`);
            }
        });

    svg.call(zoom);

    function nodeColor(node) {
        var nodes = node.data.groupType || node.data.type;

        switch (nodes) {
            case 'Organization': return 'var(--org-nde-clr)';
            case 'Applications': return 'var(--app-nde-clr)';
            case 'People': return 'var(--ppl-nde-clr)';
            case 'Technology': return 'var(--tech-nde-clr)';
            case 'Data': return 'var(--data-nde-clr)';
            case 'Procurements': return 'var(--procure-nde-clr)';
            case 'Facilities': return 'var(--fclty-nde-clr)';
            default: return 'yellow';
        }
    }

    svg.attr('width', width).attr('height', height);

    const graphGroup = svg.append('g'); // Container for links, nodes, labels

    const simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-50))
        .force('center', d3.forceCenter(width / 2, height / 2));

    onHomeButton.addEventListener('click', () => {
        location.reload();
    });

    onRefreshButton.addEventListener('click', () => {
        resetNodeForces();
        showGroupToggles(); // Ensure toggles are visible on refresh
    });

    function resetNodeForces() {
        nodesDisplayed.forEach(d => {
            d.fx = null;
            d.fy = null;
        });
        simulation
            .alphaDecay(0.009)     // Speed the graph settles    
            .alpha(1)
            .restart();
    }

    function fetchAndRenderGraph(depth = depthSlider.value, activeNodeParam = searchInput.value.trim()) {
        var url = `/?depth=${depth}&activeNode=${encodeURIComponent(activeNodeParam)}`;

        fetch(url, { headers: { 'Accept': 'application/json' } })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // console.log('Raw data from server:', data);
                if(!rootNode) {
                    rootNode = data;
                }
                
                mergeSameGroupNodes(data);
                populateNodeList(data); 
                initializeGroupToggles(data);
                renderGraph(data);
            })
            .catch(error => {
                console.error('Error fetching graph data:', error);
            });
    }

    function getUniqueGroups(node, groups = new Set()) {
        if (!node) return groups;
        if (node.groupType || node.type) {
            groups.add(node.groupType || node.type);
        }
        if (node.children) {
            node.children.forEach(child => getUniqueGroups(child, groups));
        }
        return groups;
    }

    function flattenMatchingGroupTypes(node) {
        if (!node.children) return node;
    
        // First do a DFS to flatten deeper
        node.children.forEach(child => flattenMatchingGroupTypes(child));

        // Then if child's groupType == node.type, merge child's children into node
        let flattenedChildren = [];
        for (const child of node.children) {
            if (child.groupType && child.groupType === node.type) {
                // Merge child's children into parent's children
                flattenedChildren.push(...(child.children || []));
            } else {
                flattenedChildren.push(child);
            }
        }
        node.children = flattenedChildren;
        return node;
    }  

    function initializeGroupToggles(data) {
        // 1) Gather every group from all descendants
        let allGroups = Array.from(getUniqueGroups(data));
    
        // 2) If we have never set `visibleGroups`, then turn them all on
        if (Object.keys(visibleGroups).length === 0) {
            allGroups.forEach(group => {
            visibleGroups[group] = true;
            });
        }
    
        // 3) Create or clear the toggles container
        let dynamicTogglesContainer = switchesContainer.querySelector('.dynamic-group-toggles');
        if (!dynamicTogglesContainer) {
            dynamicTogglesContainer = document.createElement('div');
            dynamicTogglesContainer.className = 'dynamic-group-toggles';
            switchesContainer.appendChild(dynamicTogglesContainer);
        } else {
            dynamicTogglesContainer.innerHTML = '';
        }
    
        // 4) Build a checkbox for each group we found
        allGroups.forEach(group => {
            var label = document.createElement('label');
            label.className = 'switch';
        
            var input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = visibleGroups[group] ?? true;
        
            var span = document.createElement('span');
            span.className = 'slider round';
            span.style.backgroundColor = nodeColor({ data: { groupType: group } })
            span.title = `Toggle ${group} Nodes ON/OFF`;
        
            var checkSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            checkSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            checkSvg.setAttribute("height", "10px");
            checkSvg.setAttribute("width", "10px");
            checkSvg.setAttribute("viewBox", "0 -960 960 960");
            checkSvg.setAttribute("class", "checkmark"); // Use setAttribute to set the class

            var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", "M382-200 113-469l97-97 172 173 369-369 97 96-466 466Z");
            path.setAttribute("fill", nodeColor({ data: { groupType: group } })); // Dynamic color matching the toggle

            checkSvg.appendChild(path);
            span.appendChild(checkSvg);
    
            label.appendChild(input);
            label.appendChild(span);
            label.append(`${group}`);
    
            dynamicTogglesContainer.appendChild(label);

        input.addEventListener('change', () => {
            visibleGroups[group] = input.checked;
            fetchAndRenderGraph(depthSlider.value, searchInput.value.trim());
            });
        });
    }      

    function resetSimulationForForces() {
        // Stop the simulation before clearing
        simulation.stop();
    
        // Remove all forces
        simulation.force('charge', null);
        simulation.force('center', null);
        simulation.force('collide', null);
        simulation.force('radial', null);
        simulation.force('circularChildren', null);
    }
    
    function renderGraph(data) {
        graphGroup.selectAll('g.links').remove();
        graphGroup.selectAll('g.nodes').remove();
        graphGroup.selectAll('g.labels').remove();

        currentActiveNodeName = data.name;
        // 1) Decide how to display group vs. asset nodes
        var displayGroupNodes = groupNodeSwitch.checked;
        var displayAssetNodes = labelNodesSwitch.checked;
    
        // 2) Transform data per your existing logic
        hideGroupNodes(data, displayGroupNodes);
        filterDataByVisibleGroups(data);
    
        // 3) Build hierarchy
        var root = d3.hierarchy(data);
        var links = root.links();
        var nodes = root.descendants();
    
        nodesDisplayed = nodes; // for fitGraphToContainer
    
        // 4) Set up simulation with new nodes
        simulation
            .nodes(nodes)
            .force("charge", d3.forceManyBody().strength(-450))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius(25))
            .force("radial", d3.forceRadial(150, width / 2, height / 2))
            .alphaDecay(0.01)
            .alpha(1)
            .restart();
    
        // -------------------------------------------------------
        // Custom force that arranges each parent’s children
        // evenly spaced in a circle of radius X (e.g. 200)
        // -------------------------------------------------------
        function forceCircularChildren(radius) {
            let nodesByParent = {};
            let allNodes = [];
    
            function force(alpha) {
                // For each parent, place its children in a circle
                Object.values(nodesByParent).forEach(childArr => {
                    if (!childArr.length) return;
                    var parent = childArr[0].parentNode;
                    if (!parent) return;
    
                    var n = childArr.length;
                    childArr.forEach((child, i) => {
                        var angle = (2 * Math.PI / n) * i;
                        var targetX = parent.x + radius * Math.cos(angle);
                        var targetY = parent.y + radius * Math.sin(angle);
    
                        // The factor (e.g. 0.1 * alpha) controls how strongly
                        // the child is pulled toward its circular target
                        child.vx += (targetX - child.x) * 0.5 * alpha;
                        child.vy += (targetY - child.y) * 0.5 * alpha;
                    });
                });
            }
    
            force.initialize = function(ns) {
                allNodes = ns;
                nodesByParent = {};
    
                // Group each node by its parent
                ns.forEach(node => {
                    var pName = node.data.parent;  // depends on your data
                    if (!pName) return; // no parent => likely the root node
                    if (!nodesByParent[pName]) {
                        nodesByParent[pName] = [];
                    }
                    nodesByParent[pName].push(node);
    
                    // Find the actual parent node object and store it
                    node.parentNode = ns.find(n => n.data.name === pName);
                });
            };
    
            return force;
        }
        // -------------------------------------------------------
    
        // Define dynamic distance for links based on active node
        if (displayGroupNodes) {
            // =====================================
            // If group nodes are displayed
            // =====================================
            simulation
                .force("link", d3.forceLink(links)
                    .id(d => d.data.name)
                    .distance(link => {
                        var source = link.source.data.name;
                        if (source === currentActiveNodeName) {
                            // Longer links for direct children
                            return 100;
                        }
                        // Default for others
                        return 25;
                    })
                )
                .force("center", d3.forceCenter(width / 2, height / 2));
    
        } else {
            // =====================================
            // If group nodes are NOT displayed
            // => Place children evenly around parent
            // =====================================
            simulation
                .force("link", d3.forceLink(links)
                .id(d => d.data.name)
                .distance(link => {
                    var source = link.source.data.name;
                    if (source === currentActiveNodeName) {
                        // Longer links for direct children
                        return 100;
                    }
                    // Default for others
                    return 0;
                })
            )
                // Pull children in a circle around parent
                .force("circularChildren", forceCircularChildren(200))
                .force("center", d3.forceCenter(width / 2, height / 2));
        }
    
        // Update the link force with link data
        simulation.force("link").links(links);
    
        // 5) Utility function: do we draw a circle for this node?
        var activeNodeName = data.name;
        function shouldHaveCircle(d) {
            if (d.data.name === activeNodeName) return true;
            if (d.data.groupType) return true;
            return displayAssetNodes;
        }
    
        // ----------------------------------------------------------------------------
        // 6) Create or select dedicated <g> elements for links, nodes, labels
        // ----------------------------------------------------------------------------
        let linkGroup = graphGroup.select('g.links');
        if (linkGroup.empty()) {
            linkGroup = graphGroup.append('g').attr('class', 'links');
        }
        let nodeGroup = graphGroup.select('g.nodes');
        if (nodeGroup.empty()) {
            nodeGroup = graphGroup.append('g').attr('class', 'nodes');
        }
        let labelGroup = graphGroup.select('g.labels');
        if (labelGroup.empty()) {
            labelGroup = graphGroup.append('g').attr('class', 'labels');
        }
    
        // ----------------------------------------------------------------------------
        // 7) Update pattern for LINKS
        // ----------------------------------------------------------------------------
        let linkSelection = linkGroup
            .selectAll('line.link')
            .data(links, d => d.source.data.name + '->' + d.target.data.name);
    
        linkSelection.exit().remove();
    
        let linkEnter = linkSelection.enter()
            .append('line')
            .attr('class', 'link')
            .attr('stroke', linkColor)
            .attr('stroke-width', linkWidth);
    
        linkSelection = linkEnter.merge(linkSelection);
        linkSelectionGlobal = linkSelection;  // optional global reference
    
        // ----------------------------------------------------------------------------
        // 8) Update pattern for NODES
        // ----------------------------------------------------------------------------
        let nodeSelection = nodeGroup
            .selectAll('circle.node')
            .data(nodes.filter(shouldHaveCircle), d => d.data.name);
    
        nodeSelection.exit().remove();
    
        let nodeEnter = nodeSelection.enter()
            .append('circle')
            .attr('class', 'node')
            .attr('r', d => {
                if (d.data.name === activeNodeName) {
                    return activeNodeSize; // Active node size
                } else if (d.data.groupType) {
                    return groupNodeSize; // Group node size
                } else {
                    return nodeSize; // Default node size
                }
            })
            .attr('fill', d => nodeColor(d))
            .attr('stroke', nodeBorderColor)
            .on('click', (event, d) => handleNodeClicked(d.data))
            .call(drag(simulation));
    
        nodeSelection = nodeEnter.merge(nodeSelection);
        nodeSelectionGlobal = nodeSelection;
    
        // ----------------------------------------------------------------------------
        // 9) Update pattern for LABELS
        // ----------------------------------------------------------------------------
        let labelSelection = labelGroup
            .selectAll('text.label')
            .data(nodes, d => d.data.name);
    
        labelSelection.exit().remove();
    
        let labelEnter = labelSelection.enter()
            .append('text')
            .attr('class', 'label')
            .attr('text-anchor', 'middle')
            .attr('dy', d => shouldHaveCircle(d) ? 5 : 0)
            .attr('fill', 'black')
            .style('cursor', 'pointer')
            .text(d => d.data.name)
            .on('click', (event, d) => handleNodeClicked(d.data))
            .call(drag(simulation))
            .style("cursor", "pointer");
    
        labelSelection = labelEnter.merge(labelSelection);
        labelsSelectionGlobal = labelSelection;
    
        // ----------------------------------------------------------------------------
        // 10) Optionally pin the active node at center                               
        // ----------------------------------------------------------------------------
        let foundActiveNode = nodes.find(d => d.data.name === data.name);
        if (foundActiveNode) {
            simulation.alpha(1).restart();
            foundActiveNode.fx = width / 2;
            foundActiveNode.fy = height / 2;
        } else {
            simulation.alpha(1).restart();
        }
    
        // ----------------------------------------------------------------------------
        // 11) TICK: position links & nodes, then fit to container
        // ----------------------------------------------------------------------------
        simulation.on('tick', () => {
            linkSelection
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
    
            nodeSelection
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);
    
            labelSelection
                .attr('x', d => d.x)
                .attr('y', d => {
                var r = getCircleScreenRadius(d);
                if (d.data.name === currentActiveNodeName) {
                    return d.y - (r + 10);
                }
                if(!displayAssetNodes) {
                    return d.y - (r + 3);
                }
                return d.y - (r + 10);
            });
    
            // Once alpha is sufficiently low, stop & fit to container
            if (simulation.alpha() < 0.05) {
                simulation.stop();
                fitGraphToContainer();
            }
        });
    
        // Update the right-side container
        updateRightContainer(data);
    }
    
    function getCircleScreenRadius(d) {
        if (d.data.name === currentActiveNodeName) {
            return activeNodeSize / currentZoomScale;
        } else if (d.data.groupType) {
            return groupNodeSize / currentZoomScale;
        } else {
            return nodeSize / currentZoomScale;
        }
    }

    function hideGroupNodes(node, displayGroupNodes) {
        if (!node.children || node.children.length === 0) {
            return node;
        }

        let flattenedChildren = [];

        node.children.forEach(child => {
            if (child.groupType && !displayGroupNodes) {
                if (child.children && child.children.length > 0) {
                    child.children.forEach(grandChild => {
                        hideGroupNodes(grandChild, displayGroupNodes);
                    });
                    flattenedChildren.push(...child.children);
                }
            } else {
                hideGroupNodes(child, displayGroupNodes);
                flattenedChildren.push(child);
            }
        });

        node.children = flattenedChildren;
        return node;
    }

    function filterDataByVisibleGroups(node) {
        if (!node.children) return;
        node.children = node.children.filter(child => {
            var key = child.groupType || child.type;
            if (key && visibleGroups.hasOwnProperty(key)) {
                if (!visibleGroups[key]) {
                    return false; // Filter out if the group is not visible
                }
            }
            filterDataByVisibleGroups(child); // Recursively filter children
            return true;
        });
    }    

    function handleNodeClicked(nodeData) {
        var clickedName = nodeData.name || nodeData.groupType;
        if (!clickedName) {
            console.error('Clicked node has neither name nor groupNode:', nodeData);
            return;
        }

        // // Determine if the clicked node is a groupType node
        // var isGroupTypeNode = !!nodeData.groupType;

        // if (isGroupTypeNode) {
        //     hideGroupToggles();
        // } else {
        //     showGroupToggles();
        // }

        if (clickedName === currentActiveNodeName) {
            return;
        }

        searchInput.value = clickedName;
        isNodeClicked = true;
        fetchAndRenderGraph(depthSlider.value, clickedName);
    }

    const drag = simulation => {
        function dragstarted(event, d) {
            nodesDisplayed.forEach(node => {
                if (node !== d) {
                    node.fx = node.x;
                    node.fy = node.y;
                }
            });
            d.fx = d.x;
            d.fy = d.y;
            simulation.alphaTarget(0.1).restart();
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            d.fx = event.x;
            d.fy = event.y;
            simulation.alphaTarget(0);
        }

        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    };

    function mergeSameGroupNodes(node) {
        if (!node.children || node.children.length === 0) return node;
    
        // Recurse first
        node.children.forEach(child => mergeSameGroupNodes(child));
    
        // We'll track group nodes in a Map by `groupType`.
        var groupNodesMap = new Map(); 
        var newChildren = [];
    
        for (const child of node.children) {
            if (child.groupType) {
                if (!groupNodesMap.has(child.groupType)) {
                    groupNodesMap.set(child.groupType, child);
                } else {
                    let existing = groupNodesMap.get(child.groupType);
                    // Merge the child’s children
                    existing.children = existing.children.concat(child.children || []);
                }
            } else {
                newChildren.push(child);
            }
        }
    
        // Now re‐add the unique group nodes
        for (const [, groupNode] of groupNodesMap) {
            newChildren.push(groupNode);
        }
    
        node.children = newChildren;
        return node;
    }
    

    function fitGraphToContainer(noTransition = false) {
        var containerWidth = document.querySelector('.graph-container').clientWidth;
        var containerHeight = document.querySelector('.graph-container').clientHeight;
    
        // Filter out group nodes
        var nonGroupNodes = nodesDisplayed.filter(node => !node.isGroup);
    
        var nodesBBox = {
            xMin: d3.min(nonGroupNodes, d => d.x),
            xMax: d3.max(nonGroupNodes, d => d.x),
            yMin: d3.min(nonGroupNodes, d => d.y),
            yMax: d3.max(nonGroupNodes, d => d.y)
        };
    
        var nodesWidth = nodesBBox.xMax - nodesBBox.xMin;
        var nodesHeight = nodesBBox.yMax - nodesBBox.yMin;
    
        let scale, translateX, translateY;
    
        // Adjust graphPadding based on the number of non-group nodes
        let graphPadding = 100; // Default padding
        if (nonGroupNodes.length < 20) {
            graphPadding = 250;
        } else if (nonGroupNodes.length < 5) {
            graphPadding = 500;
        }
    
        if (nodesWidth === 0 && nodesHeight === 0) {
            // Only one node present
            scale = 1;
            translateX = (containerWidth / 2) - nodesBBox.xMin;
            translateY = (containerHeight / 2) - nodesBBox.yMin;
        } else {
            scale = Math.min(
                (containerWidth - 2 * graphPadding) / nodesWidth,
                (containerHeight - 2 * graphPadding) / nodesHeight
            );
    
            translateX = (containerWidth - nodesWidth * scale) / 2 - nodesBBox.xMin * scale;
            translateY = (containerHeight - nodesHeight * scale) / 2 - nodesBBox.yMin * scale;
        }
    
        // Optionally remove or shorten the transition if you dislike the flicker
        if (noTransition) {
            svg.call(
                zoom.transform,
                d3.zoomIdentity.translate(translateX, translateY).scale(scale)
            );
        } else {
            svg.transition().duration(0).call(
                zoom.transform,
                d3.zoomIdentity.translate(translateX, translateY).scale(scale)
            );
        }
    }
    

    function updateDepthSlider() {
        var value = (depthSlider.value - depthSlider.min) / (depthSlider.max - depthSlider.min) * 100;
        depthSlider.style.setProperty('--value', `${value}%`);
        depthValueLabel.textContent = depthSlider.value;
    }

    updateDepthSlider();

    depthSlider.addEventListener('input', () => {
        updateDepthSlider();
        fetchAndRenderGraph();
    });

    searchButton.addEventListener('click', () => {
        fetchAndRenderGraph();
    });

    window.addEventListener('resize', () => {
        fitGraphToContainer(/* noTransition = false */);
    });

    // Initial fetch and ensure toggles are visible
    fetchAndRenderGraph();
    showGroupToggles(); // Make sure toggles are visible on initial load

    function updateRightContainer(data) {
        rightContainer.html("");

        rightContainer.append("h2")
            .style("background-color", nodeColor({data: {type: data.type}}))
            .html(`${data.name}`);

        rightContainer.append("p")
            .html(`<strong>Type: </strong>${data.type || 'Unknown'}`);

        var description = (data.description || 'No description available').replace(/\n/g, '<br>');
        rightContainer.append("h3").attr("class", "description-header").html("Description");
        rightContainer.append("p").html(description);

        rightContainer.append("h3").attr("class", "dependencies-header").html("Relationships");

        var displayGroupNodes = groupNodeSwitch.checked;

        if (displayGroupNodes) {
            // Original logic: grouping by groupType
            var groupNodes = (data.children || []).filter(d => d.groupType);

            var desiredOrder = ["Organization", "People", "Technology", "Data", "Applications", "Procurements", "Facilities"];
            groupNodes.sort((a, b) => {
                var indexA = desiredOrder.indexOf(a.groupType);
                var indexB = desiredOrder.indexOf(b.groupType);
                if (indexA === -1 && indexB === -1) {
                    return a.groupType.localeCompare(b.groupType);
                } else if (indexA === -1) {
                    return 1;
                } else if (indexB === -1) {
                    return -1;
                } else {
                    return indexA - indexB;
                }
            });

            groupNodes.forEach(typeNode => {
                createGroupTypeSection(typeNode);
            });

            function createGroupTypeSection(typeNode) {
                var typeSection = rightContainer.append("div")
                    .attr("class", "type-section");

                typeSection.append("p")
                    .style("background-color", nodeColor({data: {type: typeNode.groupType}}))
                    .attr("class", "dependency-type")
                    .html(`${typeNode.groupType}`)
                    .style("cursor", "pointer")
                    .on("click", (event) => {
                        var pseudoNodeData = {
                            name: typeNode.groupType,
                            type: typeNode.groupType,
                            description: typeNode.groupType + " Group Node",
                            children: typeNode.children || []
                        };
                        handleNodeClicked(pseudoNodeData);
                    });

                var sortedChildren = (typeNode.children || []).slice().sort((a, b) => a.name.localeCompare(b.name));

                sortedChildren.forEach(childNode => {
                    createNodeElement(typeSection, childNode);
                });
            }

        } else {
            // DisplayGroups is off, so group by 'type' directly
            var flatNodes = (data.children || []);
            // Group the nodes by their type
            var nodesByType = d3.group(flatNodes, d => d.type);

            // Desired order for types
            var desiredOrder = ["Organization", "People", "Technology", "Data", "Applications", "Procurements", "Facilities"];
            // Sort the group keys by desired order
            var orderedTypes = Array.from(nodesByType.keys()).sort((a, b) => {
                var indexA = desiredOrder.indexOf(a);
                var indexB = desiredOrder.indexOf(b);

                if (indexA === -1 && indexB === -1) {
                    return a.localeCompare(b);
                } else if (indexA === -1) {
                    return 1;
                } else if (indexB === -1) {
                    return -1;
                } else {
                    return indexA - indexB;
                }
            });

            orderedTypes.forEach(type => {
                var nodes = nodesByType.get(type);
                createTypeSection(type, nodes);
            });

            function createTypeSection(type, nodes) {
                var typeSection = rightContainer.append("div")
                    .attr("class", "type-section");

                typeSection.append("p")
                    .style("background-color", nodeColor({data: {type: type}}))
                    .attr("class", "dependency-type")
                    .html(`<strong>${type}</strong>`)
                    .style("cursor", "pointer")
                    .on("click", (event) => {
                        var pseudoNodeData = {
                            name: type,
                            type: type,
                            description: type + " Group Node",
                            children: nodes
                        };
                        handleNodeClicked(pseudoNodeData);
                    });

                var sortedChildren = nodes.slice().sort((a, b) => a.name.localeCompare(b.name));
                sortedChildren.forEach(childNode => {
                    createNodeElement(typeSection, childNode);
                });
            }
        }

        function createNodeElement(parentContainer, node) {
            var nodeContainer = parentContainer.append("div")
                .attr("class", "dependency-node-container");

            nodeContainer.append("p")
                .attr("class", "dependency-node")
                .html(`${node.name}`)
                .on("click", (event) => handleNodeClicked(node));

            nodeContainer.append("div")
                .attr("class", "hover-box")
                .html(node.description ? node.description.replace(/\n/g, '<br>') : 'No description available');
        }
    }
    // Function to show all group toggles
    function showGroupToggles() {
        var dynamicTogglesContainer = switchesContainer.querySelector('.dynamic-group-toggles');
        
        if (dynamicTogglesContainer) {
            dynamicTogglesContainer.style.display = 'block';
        }
    }
});

