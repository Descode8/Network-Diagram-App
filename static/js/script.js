document.addEventListener('DOMContentLoaded', () => {
    let width = document.querySelector('.graph-container').clientWidth;
    let height = document.querySelector('.graph-container').clientHeight;
    let rootNode = null;
    const svg = d3.select('.graph-container svg');
    const activeNodeSize = 6.5;
    const nodeSize = 5;
    const linkWidth = 0.75;
    const linkColor = 'var(--link-clr)';
    const nodeBorderColor = 'var(--nde-bdr-clr)';

    let currentActiveNodeName = null;
    let graphPadding = 75;
    let visibleNodes = [];
    let visibleGroups = {};
    let isNodeClicked = false;

    const depthSlider = document.getElementById('depthSlider');
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
        const input = searchInput.value.trim();
        const dropdown = document.getElementById('autocompleteSuggestions');
        
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
        const dropdown = document.getElementById('autocompleteSuggestions');
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
        const input = searchInput.value.trim();
        if (input) {
            const matchingNode = allNodes.find(node => node.toLowerCase() === input.toLowerCase());
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
        const input = searchInput.value.toLowerCase();

        if (!input) {
            dropdown.style.display = 'none'; // Hide the dropdown when input is empty
            dropdown.innerHTML = ''; // Clear any previous suggestions
            return;
        }
        
        const dropdown = document.getElementById('autocompleteSuggestions');
        dropdown.innerHTML = ''; // Clear previous suggestions
    
        if (!input) {
            dropdown.style.border = 'none'; // Hide the border if the input is empty
            return;
        }
    
        // Filter and display matching nodes
        const matches = allNodes.filter(name => name.toLowerCase().includes(input));
        matches.forEach(match => {
            const item = document.createElement('div');
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
            const noMatch = document.createElement('div');
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
        fetchAndRenderGraph(depthSlider.value, searchInput.value.trim());
    });

    // Define zoom behavior similar to old code
    const zoom = d3.zoom()
        .scaleExtent([0.5, 10])
        .on('zoom', (event) => {
            const transform = event.transform;
            currentZoomScale = transform.k;

            // Apply transform
            graphGroup.attr('transform', transform);

            // Adjust node, link, label sizes based on zoom
            if (nodeSelectionGlobal) {
                nodeSelectionGlobal
                    .attr('r', d => d.data.name === currentActiveNodeName ? (activeNodeSize / currentZoomScale) : (nodeSize / currentZoomScale))
                    .attr('stroke-width', (1 / currentZoomScale));
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
            case 'Applications': return 'var(--app-nde-clr)';
            case 'People': return 'var(--ppl-nde-clr)';
            case 'Technology': return 'var(--tech-nde-clr)';
            case 'Data': return 'var(--data-nde-clr)';
            case 'Procurements': return 'var(--procure-nde-clr)';
            case 'Facilities': return 'var(--fclty-nde-clr)';
            default: return 'var(--home-nde-clr)';
        }
    }

    svg.attr('width', width).attr('height', height);

    const graphGroup = svg.append('g'); 

    const simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2));

    onHomeButton.addEventListener('click', () => {
        location.reload();
        // Optional: show toggles if not reloading
        // showGroupToggles();
    });

    onRefreshButton.addEventListener('click', () => {
        resetNodeForces();
        showGroupToggles(); // Ensure toggles are visible on refresh
    });

    function resetNodeForces() {
        visibleNodes.forEach(d => {
            d.fx = null;
            d.fy = null;
        });
        simulation.alpha(2).restart();
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
                if(!rootNode) {
                    rootNode = data;
                }
                mergeSameGroupNodes(data);
                populateNodeList(data); // Refresh node list for dropdown
                initializeGroupToggles(data);
                renderGraph(data);
                fitGraphToContainer();
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
        var allGroups = Array.from(getUniqueGroups(data));
    
        // Filter out groups that don't have children in the active node
        allGroups = allGroups.filter(group => {
            const childrenOfType = (data.children || []).some(child => (child.groupType || child.type) === group);
            return childrenOfType;
        });
    
        if (Object.keys(visibleGroups).length === 0) {
            allGroups.forEach(group => {
                visibleGroups[group] = true;
            });
        }
    
        let dynamicTogglesContainer = switchesContainer.querySelector('.dynamic-group-toggles');
    
        if (!dynamicTogglesContainer) {
            dynamicTogglesContainer = document.createElement('div');
            dynamicTogglesContainer.className = 'dynamic-group-toggles';
            switchesContainer.appendChild(dynamicTogglesContainer);
        } else {
            dynamicTogglesContainer.innerHTML = '';
        }
    
        allGroups.forEach(group => {
            var label = document.createElement('label');
            label.className = 'switch';
    
            var input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = visibleGroups[group] ?? true;
    
            var span = document.createElement('span');
            span.className = 'slider round';
    
            // Use nodeColor to get the color dynamically for the group
            span.style.backgroundColor = nodeColor({ data: { groupType: group } });
    
            var checkImg = document.createElement('img');
            checkImg.src = "/static/images/check.svg";
            checkImg.className = "checkmark";
            checkImg.alt = "Checkmark";
    
            span.appendChild(checkImg);
    
            label.appendChild(input);
            label.appendChild(span);
            label.append(` ${group}`);
    
            dynamicTogglesContainer.appendChild(label);
    
            input.addEventListener('change', () => {
                if (group === data.groupType && !input.checked) {
                    // Prevent hiding the active node
                    input.checked = true;
                    return;
                }
                visibleGroups[group] = input.checked;
                fetchAndRenderGraph(depthSlider.value, searchInput.value.trim());
            });
        });
    }
    
    function renderGraph(data) {
        graphGroup.selectAll('*').remove();
    
        var displayGroupNodes = groupNodeSwitch.checked;
        var displayAssetNodes = labelNodesSwitch.checked;
    
        hideGroupNodes(data, displayGroupNodes);
        filterDataByVisibleGroups(data);
    
        var root = d3.hierarchy(data);
        var links = root.links();
        var nodes = root.descendants();
    
        visibleNodes = nodes;
    
        simulation.nodes(nodes)
            .force("link", d3.forceLink(links).id(d => d.data.name).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2));
    
        simulation.force("link").links(links);
    
        var link = graphGroup.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('stroke', linkColor)
            .attr('stroke-width', linkWidth);
    
        // Store link selection globally
        linkSelectionGlobal = link;
    
        var activeNodeName = data.name;
    
        function shouldHaveCircle(d) {
            if (d.data.name === activeNodeName) return true;
            if (d.data.groupType) return true;
            if (displayAssetNodes) return true;
            return false;
        }
    
        let nodeSelection = graphGroup.append('g')
            .attr('class', 'nodes')
            .selectAll('circle')
            .data(nodes);
    
        nodeSelection = nodeSelection.enter()
            .filter(d => shouldHaveCircle(d))
            .append('circle')
            .attr('r', d => d.data.name === activeNodeName ? activeNodeSize : nodeSize)
            .attr('fill', d => nodeColor(d))
            .attr('stroke', nodeBorderColor)
            .call(drag(simulation));
    
        nodeSelection.on('click', (event, d) => handleNodeClicked(d.data));
    
        // Store node selection globally
        nodeSelectionGlobal = nodeSelection;
    
        var labels = graphGroup.append('g')
            .attr('class', 'labels')
            .selectAll('text')
            .data(nodes)
            .enter().append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', d => shouldHaveCircle(d) ? 5 : 0)
            .attr('fill', 'black')
            .text(d => d.data.name)
            .on('click', (event, d) => handleNodeClicked(d.data)); // Enable label click handling
    
        // Store labels selection globally
        labelsSelectionGlobal = labels;
    
        currentActiveNodeName = data.name;
    
        var foundActiveNode = nodes.find(node => node.data.name === data.name);
        if (foundActiveNode) {
            simulation.alpha(1).restart();
            foundActiveNode.fx = width / 2;
            foundActiveNode.fy = height / 2;
        }
    
        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
    
            nodeSelection
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
                // Alternatively, if using 'transform':
                // .attr("transform", d => `translate(${d.x},${d.y})`);
    
            labels
                .attr('x', d => d.x)
                .attr('y', d => shouldHaveCircle(d) ? d.y - 15 : d.y);
    
            if (simulation.alpha() < 0.05) {
                fitGraphToContainer();
                simulation.stop();
            }
        });
    
        fitGraphToContainer();
        updateRightContainer(data);
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
                    return false;
                }
            }
            filterDataByVisibleGroups(child);
            return true;
        });
    }

    function handleNodeClicked(nodeData) {
        var clickedName = nodeData.name || nodeData.groupType;
        if (!clickedName) {
            console.error('Clicked node has neither name nor groupNode:', nodeData);
            return;
        }

        // Determine if the clicked node is a groupType node
        var isGroupTypeNode = !!nodeData.groupType;

        if (isGroupTypeNode) {
            hideGroupToggles();
        } else {
            showGroupToggles();
        }

        if (clickedName === currentActiveNodeName) {
            return;
        }

        searchInput.value = clickedName;
        isNodeClicked = true;
        fetchAndRenderGraph(depthSlider.value, clickedName);
    }

    const drag = simulation => {
        function dragstarted(event, d) {
            visibleNodes.forEach(node => {
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
        if (!node.children || node.children.length === 0) {
            return node;
        }

        // First, recurse on each child to merge deeper duplicates.
        node.children.forEach(child => mergeSameGroupNodes(child));

        // We'll track group nodes in a Map by `groupType`, 
        // plus track non-group children separately.
        const groupNodesMap = new Map(); 
        const newChildren = [];
    
        for (const child of node.children) {
            if (child.groupType) {
                // If we've not seen this groupType yet, store it.
                if (!groupNodesMap.has(child.groupType)) {
                groupNodesMap.set(child.groupType, child);
                } else {
                // Already have a node for this groupType -> merge child’s children
                let existing = groupNodesMap.get(child.groupType);
        
                // Combine children arrays (avoid duplicates if needed)
                existing.children = existing.children.concat(child.children || []);
                // Optionally deduplicate `existing.children` by name if desired.
                }
            } else {
                // Normal (non-group) child, just keep as-is
                newChildren.push(child);
            }
        }
    
        // Now add the unique group nodes from the map into `newChildren`
        for (const [, groupNode] of groupNodesMap) {
            newChildren.push(groupNode);
        }
    
        node.children = newChildren;
        return node;
    }

    function fitGraphToContainer() {
        const containerWidth = document.querySelector('.graph-container').clientWidth;
        const containerHeight = document.querySelector('.graph-container').clientHeight;
    
        const nodesBBox = {
            xMin: d3.min(visibleNodes, d => d.x),
            xMax: d3.max(visibleNodes, d => d.x),
            yMin: d3.min(visibleNodes, d => d.y),
            yMax: d3.max(visibleNodes, d => d.y)
        };
    
        const nodesWidth = nodesBBox.xMax - nodesBBox.xMin;
        const nodesHeight = nodesBBox.yMax - nodesBBox.yMin;
    
        let scale, translateX, translateY;
    
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
    
        svg.transition().duration(500).call(
            zoom.transform,
            d3.zoomIdentity.translate(translateX, translateY).scale(scale)
        );
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
        fitGraphToContainer();
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

        rightContainer.append("h3").attr("class", "dependencies-header").html("Dependencies");

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
                    .html(`<strong>${typeNode.groupType}</strong>`)
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

    // Function to hide all group toggles except labelNodesSwitch
    function hideGroupToggles() {
        var dynamicTogglesContainer = switchesContainer.querySelector('.dynamic-group-toggles');
        
        if (dynamicTogglesContainer) {
            dynamicTogglesContainer.style.display = 'none';
            groupNodeSwitch.parentElement.style.display = 'none';
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
