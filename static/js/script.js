document.addEventListener("DOMContentLoaded", () => { 
    
    /*******************************************
     * VARIABLE DECLARATIONS AND INITIAL SETUP *
     *******************************************/
    var rootStyles = getComputedStyle(document.documentElement);
    var homeNodeClr = rootStyles.getPropertyValue('--home-nde-clr').trim();
    var appNodeClr = rootStyles.getPropertyValue('--app-nde-clr').trim();
    var pplNodeClr = rootStyles.getPropertyValue('--ppl-nde-clr').trim();
    var techNodeClr = rootStyles.getPropertyValue('--tech-nde-clr').trim();
    var dataNodeClr = rootStyles.getPropertyValue('--data-nde-clr').trim();
    var procureNodeClr = rootStyles.getPropertyValue('--procure-nde-clr').trim();
    var fcltyNodeClr = rootStyles.getPropertyValue('--fclty-nde-clr').trim();
    var sverNodeClr = rootStyles.getPropertyValue('--sver-nde-clr').trim();

    var textClr = rootStyles.getPropertyValue('--text-clr').trim();
    var linkClr = rootStyles.getPropertyValue('--link-clr').trim();

    const typeColorMap = new Map([
        ['Organization', homeNodeClr],   
        ['Applications', appNodeClr], 
        ['People', pplNodeClr],           
        ['Technology', techNodeClr],  
        ['Data', dataNodeClr], 
        ['Procurements', procureNodeClr],
        ['Facilities', fcltyNodeClr],
        ['Server', sverNodeClr],
    ]);

    let rootNode, activeNodeId, simulation, graphData, nodeById, node, link;
    let visibleNodes = [], visibleLinks = []; //, nodeWithMultiCI_Type = []; //centralNodes = [], 
    let graphFitted = false, isNodeClicked = false;
    let currentDepth = 2;
    let graphLinkLength = 50;
    let nodeSize = 5; 
    let activeNodeSize = 6.5; 
    let initialFontSize = 12; 
    let currentZoomScale = 1;
    let graphPadding = 100;
    let linkWidth = 0.3;
    let nodeStrokeWidth = 1;
    const svg = d3.select("svg");
    const rightContainer = d3.select(".right-pane");
    const onSearchInput = document.getElementById('searchInput');
    const autocompleteSuggestions = document.getElementById('autocompleteSuggestions');
    const onSearchButton = document.getElementById('searchButton');
    const onClearButton = document.getElementById('clearButton'); 
    const onHomeButton = document.getElementById('homeButton');
    const onRefreshButton = document.getElementById('refreshButton');
    const onDepthSlider = document.getElementById('depthSlider');
    const depthValueLabel = document.getElementById('depthValue');
    const failedSearch = document.querySelector('.failed-search');
    const svgElement = svg.node();
    const width = svgElement.getBoundingClientRect().width;
    const height = svgElement.getBoundingClientRect().height;
    let centerX = svgElement.getBoundingClientRect().width / 2;
    let centerY = svgElement.getBoundingClientRect().height / 2;
    const graph = svg.append("g").style("visibility", "hidden");
    const nodeColorMap = new Map();

    // Variables for switches
    const typeNodesSwitch = document.getElementById("typeNodesSwitch");
    const labelNodesSwitch = document.getElementById("labelNodesSwitch");

    // Initial states for switches
    let showTypeNodes = typeNodesSwitch.checked = true;
    let showLabelNodes = labelNodesSwitch.checked = true;

    // Event listeners
    typeNodesSwitch.addEventListener("change", () => {
        showTypeNodes = typeNodesSwitch.checked;
    
        // Update the visibility of text elements based on the toggle state
        node.select("text").style("visibility", d => {
            if (showTypeNodes && typeColorMap.has(d.id)) {
                return "hidden";
            }
            return "visible";
        });
    
        renderActiveNodeGraph(currentDepth, activeNodeId);
    });       

    labelNodesSwitch.addEventListener("change", () => {
        showLabelNodes = labelNodesSwitch.checked;
        renderActiveNodeGraph(currentDepth, activeNodeId);
    });

    /*******************************
    * EVENT LISTENERS FOR CONTROLS *
    ********************************/    
    var zoom = d3.zoom()
        .scaleExtent([0.5, 10])
        .on('zoom', (event) => {
            currentZoomScale = event.transform.k;
            graph.attr('transform', event.transform);

            // Adjust node sizes inversely proportional to zoom scale
            node.select('circle').attr('r', d => d.id === activeNodeId ? activeNodeSize / currentZoomScale : nodeSize / currentZoomScale);
            node.select('text').attr('font-size', (initialFontSize / currentZoomScale) + 'px');

            // Adjust stroke-width inversely proportional to zoom scale using .attr()
            link.attr('stroke-width', linkWidth / currentZoomScale);
            node.select('circle').attr('stroke-width', nodeStrokeWidth / currentZoomScale); // Adjusted stroke-width
    });
    svg.call(zoom);

    /*****************************************************
     * INITIALIZING AND FETCHING GRAPH DATA ON PAGE LOAD *
     *****************************************************/
    window.onload = function () {
        fetchGraphData().then(() => {
            // Set activeNodeId to the initial node
            rootNode = activeNodeId = graphData.nodes[0].id;
            console.log("Root Node:", rootNode);

            // Render the graph with the initial depth
            renderActiveNodeGraph(2, activeNodeId);

            // Ensure the simulation runs with sufficient alpha for stabilization
            simulation.alpha(1).restart(); // Increase alpha for initial load stabilization

            // Use a timeout to let the graph settle before displaying
            setTimeout(() => {
                graphFitted = false; // Reset the graphFitted flag to ensure proper centering
                fitGraphToContainer(); // Refit the graph to the container
            }, 100); // Allow 100ms for forces to stabilize
        });
    };
    
    window.addEventListener('resize', () => {
        fitGraphToContainer();
    });
    
    // Function to update the gradient and the displayed value
    function updateDepthSlider() {
        var value = (onDepthSlider.value - onDepthSlider.min) / (onDepthSlider.max - onDepthSlider.min) * 100;
        onDepthSlider.style.setProperty('--value', `${value}%`);
        depthValue.textContent = onDepthSlider.value; // Update the displayed value
    }
    
    // Initialize the slider with the default value on page load
    updateDepthSlider();
    
    // Update the slider whenever its value changes
    onDepthSlider.addEventListener('input', updateDepthSlider);
    
    // Add event listener for the depth slider
    onDepthSlider.addEventListener('input', () => {
        var depth = parseInt(onDepthSlider.value);
    
        // if (depth < 2) {
        //     setGraphForces();
        // }
    
        depthValueLabel.textContent = depth;
        renderActiveNodeGraph(depth, activeNodeId);
    });
    
    // Modify the home button event listener to use the current slider depth
    onHomeButton.addEventListener('click', () => {
        location.reload();
    });

    onRefreshButton.addEventListener('click', () => {
        // Clear fixed positions of all nodes
        resetNodeForces();
    });

    // Add event listener for the search button
   // Add event listener for the search button
    onSearchButton.addEventListener('click', () => {
        var searchTerm = onSearchInput.value.trim();
        if (searchTerm) {
            searchNode(searchTerm);
            toggleClearButton(); // Show the clear button after search button click
            autocompleteSuggestions.style.display = 'none'; // Hide dropdown suggestions after clicking search
        }
    });

    // Add event listener for 'Enter' key press on the input field
    onSearchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            var searchTerm = onSearchInput.value.trim();
            if (searchTerm) {
                searchNode(searchTerm);
                toggleClearButton(); // Show the clear button after pressing Enter
                autocompleteSuggestions.style.display = 'none'; // Hide dropdown suggestions after pressing Enter
            }
        }
    });

    // Show the clear button only under specific conditions
    function toggleClearButton() {
        onClearButton.style.display = onSearchInput.value.trim() ? 'flex' : 'none';
    }

    // Show the clear button if the user clicks a suggestion
    autocompleteSuggestions.addEventListener('click', (event) => {
        if (event.target && event.target.matches('.autocomplete-suggestions')) {
            toggleClearButton(); // Show the clear button when an option is clicked
            autocompleteSuggestions.style.display = 'none'; // Hide dropdown suggestions when a suggestion is clicked
        }
    });

    // Clear input and reload the page when clear button is clicked
    onClearButton.addEventListener('click', () => {
        onSearchInput.value = ''; // Clear input field
        onClearButton.style.display = 'none'; // Hide clear button
        location.reload(); // Reload page
    });

    /**********************************
     * FETCHING DATA FROM THE BACKEND *
     **********************************/
    async function fetchGraphData() {
        const storedData = localStorage.getItem('graphData');
        const lastFetchedTime = localStorage.getItem('lastFetchedTime');
        const expirationTime = 10 * 60 * 1000; // Set expiration time in milliseconds (e.g., 10 minutes)

        if (storedData && lastFetchedTime && (Date.now() - lastFetchedTime < expirationTime)) {
            // Use cached data if it's within the expiration period
            graphData = JSON.parse(storedData);
            console.log("Loaded graph data from localStorage:", graphData);
        } else {
            // Fetch data from the backend and store it
            try {
                const response = await fetch("/", {
                    headers: { "Accept": "application/json" }
                });

                if (!response.ok) {
                    console.error("Failed to fetch graph data:", response.statusText);
                    return;
                }

                // Parse the fetched data
                graphData = await response.json();

                // Store fetched data and timestamp in localStorage
                localStorage.setItem('graphData', JSON.stringify(graphData));
                localStorage.setItem('lastFetchedTime', Date.now());
                console.log("Graph data fetched and stored successfully:", graphData);


                // Listen for input events to trigger suggestions
                onSearchInput.addEventListener("input", () => {
                    const searchTerm = onSearchInput.value.toLowerCase();
                    if (searchTerm) {
                        const suggestions = graphData.nodes.filter(node =>
                            node.id.toLowerCase().includes(searchTerm)
                        );

                        // Clear previous suggestions
                        autocompleteSuggestions.innerHTML = '';
                        autocompleteSuggestions.style.display = suggestions.length ? 'block' : 'none';

                        // Append suggestions
                        suggestions.forEach(suggestion => {
                            const suggestionItem = document.createElement('div');
                            suggestionItem.classList.add('autocomplete-suggestions');
                            suggestionItem.textContent = suggestion.id;
                            suggestionItem.onclick = () => {
                                onSearchInput.value = suggestion.id;
                                autocompleteSuggestions.style.display = 'none'; // Hide dropdown after selecting a suggestion
                                searchNode(suggestion.id); // Call your search function with the selected suggestion
                            };
                            autocompleteSuggestions.appendChild(suggestionItem);
                        });
                    } else {
                        autocompleteSuggestions.style.display = 'none';
                    }
                });

                // Hide suggestions when clicking outside the input or suggestions
                document.addEventListener('click', (event) => {
                    if (!onSearchInput.contains(event.target) && !autocompleteSuggestions.contains(event.target)) {
                        autocompleteSuggestions.style.display = 'none';
                    }
                });
            } catch (error) {
                console.error("Error fetching graph data:", error);
            }
        }
        
            // Process graph data
            // centralNodes = graphData.center_nodes;
            // console.log("Central Nodes:", centralNodes);
            // graphData.nodes.forEach(node => {
            //     if (node.is_multi_dependent === true) {
            //         nodeWithMultiCI_Type.push(node.id);
            //     }
            // });
            // console.log("Nodes with multiple CI types:", nodeWithMultiCI_Type);
        
            assignColors(graphData);
            initializeGraph(graphData);
    }
    
    // Clear localStorage on tab close
    window.addEventListener("beforeunload", () => {
        localStorage.removeItem('graphData');
        localStorage.removeItem('lastFetchedTime');
    });    

    /*************************************************
     * ASSIGNING COLORS TO NODES BASED ON THEIR TYPE *
     *************************************************/
    function assignColors(data) {
        // Iterate through each node in the dataset
        data.nodes.forEach(node => {
            // Get the color associated with the node's type from the type-color mapping
            var color = typeColorMap.get(node.type);
            if (color) {
                // If a color exists for this type, use it
                nodeColorMap.set(node.id, color);
            } else {
                // If no color is defined for this type, use white as default
                nodeColorMap.set(node.id, 'white');
            }
        });
    }

    /*************************************
     * RENDERING THE GRAPH VISUALIZATION *
    *************************************/
    function initializeGraph(data) {
        // Create a map for quick node lookups by ID
        nodeById = new Map(data.nodes.map(node => [node.id, node]));
        
        // Convert string IDs to actual node objects in the links array.
        data.links.forEach(link => {
            if (typeof link.source === 'string') {
                link.source = nodeById.get(link.source);
            }
            if (typeof link.target === 'string') {
                link.target = nodeById.get(link.target);
            }
        });
        
        // Track visible nodes and links
        visibleNodes = [];
        visibleLinks = [];
        
        // Create link elements
        link = graph.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(visibleLinks, d => `${d.source.id}-${d.target.id}`);
        
        // Append initial links with styles
        link.enter().append("line")
            .attr("stroke-width", linkWidth)          // Set initial stroke-width for links
            .attr("stroke", linkClr)                  // Set initial stroke color for links
            .merge(link);
        
        // Create node elements
        node = graph.append("g")
            .attr("class", "nodes")
            .attr("text-anchor", "middle")     // Centers text inside nodes
            .selectAll("g")
            .data(visibleNodes, d => d.id)
            .enter()
            .append("g")
            .call(drag(simulation));            // Apply drag behavior here
        
        // Append circles to each node with increased stroke-width
        node.append("circle")
            .attr("r", d => d.id === activeNodeId ? activeNodeSize : nodeSize) // Conditional radius
            .attr("fill", d => nodeColorMap.get(d.id))
            .attr("stroke", textClr)
            .attr("stroke-width", nodeStrokeWidth)
            .on("click", handleNodeClicked);
        
        // Append text to each node
        node.append("text")
            .text(d => d.id)
            .attr("font-size", initialFontSize + 'px') // Set initial font size
            .attr("dy", ".35em")                       // Vertically center the text
            .attr("text-anchor", "middle")            // Horizontally center the text
            .style("visibility", showTypeNodes ? "hidden" : "visible");
        
        // Initialize the force simulation with visible nodes
        simulation = d3.forceSimulation(visibleNodes)
            .alpha(0.3) // Start with alpha = 1 for faster initial movement
            .alphaDecay(0.05) // Increase alpha decay to speed up convergence (default is ~0.0228)
            .on("tick", ticked); // Event listener for each tick
        
        // Apply graphClusteringForce during initialization
        simulation.force("cluster", graphClusteringForce());
    }
    

    /****************************************
    * Unified logic for resetting the graph *
    *****************************************/
    function renderActiveNodeGraph(depth = parseInt(onDepthSlider.value), nodeId = activeNodeId) {
        currentDepth = depth;
        activeNodeId = nodeId;
    
        visibleNodes = [];
        visibleLinks = [];
    
        var nodeObj = nodeById.get(nodeId);
        expandNodeByDepth(nodeObj, depth); // Determine visibleNodes & visibleLinks using 'without_type' edges
    
        if (showTypeNodes) {
            insertTypeNodesBetweenActiveAndDependencies();
        }
    
        // Reset the graphFitted flag
        graphFitted = false;
    
        // Update force settings based on the depth value
        setTreeForces();
        //setGraphForces();
    
        // Center the active node
        centerActiveNode();
        renderGraph();
        updateRightContainer();
    }
    
    function insertTypeNodesBetweenActiveAndDependencies() {
        const activeNodeObj = nodeById.get(activeNodeId);
        const newVisibleLinks = [];
        const processedLinks = new Set();
        const typeNodesAdded = new Set(); // To avoid adding the same type node multiple times
    
        // Loop through each visibleLink
        visibleLinks.forEach(link => {
            // Check if this link is a direct dependency from the activeNode to another node
            const isActiveSource = (link.source.id === activeNodeId);
            const isActiveTarget = (link.target.id === activeNodeId);
            const isWithoutType = (link.edge_type === 'without_type');
    
            // If it's not connected directly to the active node or not a 'without_type' edge, keep as is
            if (!isWithoutType || (!isActiveSource && !isActiveTarget)) {
                if (!processedLinks.has(JSON.stringify(link))) {
                    newVisibleLinks.push(link); // Keep original link
                    processedLinks.add(JSON.stringify(link));
                }
                return;
            }
    
            // Identify the dependency node (the one that's not active)
            const dependencyNode = isActiveSource ? link.target : link.source;
    
            // Skip adding a type node if the dependencyNode or activeNode is the rootNode
            if (dependencyNode.id === rootNode.id || activeNodeObj.id === rootNode.id) {
                if (!processedLinks.has(JSON.stringify(link))) {
                    newVisibleLinks.push(link); // Keep original link
                    processedLinks.add(JSON.stringify(link));
                }
                return;
            }
    
            // Find or create the type node for this dependency
            const dependencyType = dependencyNode.type;
            let typeNodeObj = nodeById.get(dependencyType);
    
            // If no type node found in the original data (unlikely but check)
            if (!typeNodeObj) {
                // Create a pseudo type node if it doesn't exist in nodeById.
                // This assumes type nodes are part of the dataset. If not, add logic to create a node object.
                typeNodeObj = { id: dependencyType, type: dependencyType, description: "Type Node", is_dependency_name: false };
                nodeById.set(dependencyType, typeNodeObj);
            }
    
            // Add the type node to visibleNodes if not already present
            if (!typeNodesAdded.has(typeNodeObj.id)) {
                visibleNodes.push(typeNodeObj);
                typeNodesAdded.add(typeNodeObj.id);
            }
    
            // Create unique links and add them to newVisibleLinks
            const activeToTypeLink = {
                source: activeNodeObj,
                target: typeNodeObj,
                edge_type: 'with_type'
            };
    
            const typeToDependencyLink = {
                source: typeNodeObj,
                target: dependencyNode,
                edge_type: 'with_type'
            };
    
            // Add unique links (check by stringifying for uniqueness)
            if (!processedLinks.has(JSON.stringify(activeToTypeLink))) {
                newVisibleLinks.push(activeToTypeLink);
                processedLinks.add(JSON.stringify(activeToTypeLink));
            }
            if (!processedLinks.has(JSON.stringify(typeToDependencyLink))) {
                newVisibleLinks.push(typeToDependencyLink);
                processedLinks.add(JSON.stringify(typeToDependencyLink));
            }
        });
    
        // Update visibleLinks with the transformed set
        visibleLinks = newVisibleLinks;
    }
    
    // Center the active node by fixing it at the center
    function centerActiveNode() {
        // Set the active node's coordinates to the center of the SVG container
        visibleNodes.forEach(n => {
            if (n.id === activeNodeId) {
                n.fx = centerX;
                n.fy = centerY;
            } else {
                n.fx = null;
                n.fy = null;
            }
        });
        simulation.alpha(0.3).restart();
    }
    
    /******************************
    * EXPAND ACTIVE NODE BY DEPTH *
    *******************************/
    function expandNodeByDepth(node, depth, currentDepth = 1) {
        if (currentDepth > depth) return; // Stop recursion when the target depth is reached
    
        if (!visibleNodes.includes(node)) {
            visibleNodes.push(node); // Add the current node to the visible list
        }
    
        // If the current depth is the maximum, stop expanding further
        if (currentDepth === depth) return;
    
        // Always expand depth using 'without_type' edges only
        var childLinks = graphData.links.filter(link => {
            return (
                (link.source.id === node.id || link.target.id === node.id) &&
                link.edge_type === 'without_type'
            );
        });
    
        childLinks.forEach(link => {
            if (!visibleLinks.includes(link)) {
                visibleLinks.push(link); // Add the link to visible links
    
                // Get the connected node (either source or target of the link)
                var childNode = link.source.id === node.id ? link.target : link.source;
    
                // Recursively expand the graph if the connected node isn't already visible
                if (!visibleNodes.includes(childNode)) {
                    expandNodeByDepth(childNode, depth, currentDepth + 1);
                }
            }
        });
    }
    
    function addTypeNodesForDisplay() {
        if (!showTypeNodes) return; // Only add type nodes if showTypeNodes is true
    
        // Find all 'with_type' links that connect currently visible nodes
        // These links represent the type nodes that should be displayed in-between
        var typeLinks = graphData.links.filter(link => {
            return link.edge_type === 'with_type' &&
                ((visibleNodes.includes(link.source) && visibleNodes.includes(link.target)) ||
                (visibleNodes.includes(link.source) && typeColorMap.has(link.target.id)) ||
                (visibleNodes.includes(link.target) && typeColorMap.has(link.source.id)));
        });
    
        typeLinks.forEach(link => {
            // Add link if it's not already visible
            if (!visibleLinks.includes(link)) {
                visibleLinks.push(link);
            }
    
            // Add type node if not already visible
            [link.source, link.target].forEach(n => {
                if (!visibleNodes.includes(n) && typeColorMap.has(n.id)) {
                    visibleNodes.push(n);
                }
            });
        });
    }
    

    /****************************************************
    * SETTING UP FORCES BASED ON GRAPH LAYOUT (TREE) *
    ****************************************************/
    function setTreeForces() {
        // Clear existing 'tick' event handlers
        simulation.on("tick", null);
    
        // Remove the 'charge' force as it's no longer needed
        simulation.force("charge", null);
    
        const minDistance = 200; // Minimum desired distance between central nodes
    
        // Custom repulsion force for central nodes
        function applyCentralRepulsion() {
            // Only apply repulsion if the active node is a central node
            // if (!centralNodes.includes(activeNodeId)) return;
    
            visibleNodes.forEach((nodeA, i) => {
                // Skip if nodeA is not a central node or is in nodeWithMultiCI_Type
                // if (!centralNodes.includes(nodeA.id) || nodeWithMultiCI_Type.includes(nodeA.id)) return;
    
                // Compare with subsequent nodes to avoid duplicate calculations
                visibleNodes.slice(i + 1).forEach(nodeB => {
                    // Skip if nodeB is not a central node or is in nodeWithMultiCI_Type
                    // if (!centralNodes.includes(nodeB.id) || nodeWithMultiCI_Type.includes(nodeB.id)) return;
    
                    const dx = nodeB.x - nodeA.x;
                    const dy = nodeB.y - nodeA.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
    
                    // Only apply repulsion if nodes are closer than minDistance
                    if (distance < minDistance && distance > 0) { // Added distance > 0 to avoid division by zero
                        const repulsionStrength = (minDistance - distance) / distance;
                        const fx = dx * repulsionStrength;
                        const fy = dy * repulsionStrength;
    
                        // Adjust velocities to push nodes apart
                        nodeA.vx -= fx;
                        nodeA.vy -= fy;
                        nodeB.vx += fx;
                        nodeB.vy += fy;
                    }
                });
            });
        }
    
        // if (currentDepth > 3) {
        //     // Apply custom repulsion on each tick and then update the graph
        //     simulation.on("tick", () => {
        //         applyCentralRepulsion();
        //         ticked();
        //     });
        // } else {
            // Use the default graph forces for depths <= 2
            setGraphForces();
        // }
    
        // Apply the tree clustering force
        simulation.force("cluster", treeClusteringForce());
    }    
    
    /***************************************************
     * SETTING UP FORCES BASED ON GRAPH LAYOUT (GRAPH) *
     * *************************************************/
    function setGraphForces() {
        simulation.on("tick", ticked); // Update positions and redraw the graph elements
        
        simulation
        .force("link", d3.forceLink(visibleLinks)
            .id(d => d.id)
            .distance(graphLinkLength)
            .strength(1))

            .force("charge", d3.forceManyBody()
                .strength(d => d.id === activeNodeId ? -50 : -50) // Stronger repulsion for the active node
            )
            .force("center", d3.forceCenter(centerX, centerY))
            .force("collide", d3.forceCollide() // Prevent node overlap
                .radius(25) // Minimum distance between nodes
                .strength(1)); // Increase strength for stronger collision enforcement
    }

    /*********************************************
    * UPDATE NODE POSITIONS BASED ON ACTIVE NODE *
    **********************************************/
    function updateNodePositions() {
        // Fix the active node at the center
        visibleNodes.forEach(n => {
            if (n.id === activeNodeId) {
                n.fx = centerX;
                n.fy = centerY;
            } else {
                n.fx = null;
                n.fy = null;
            }
        });
    
        simulation.alpha(0.3).restart(); // Restart the simulation to reflect changes
    }    
    
    /**************************************
    * UPDATE THE GRAPH AFTER NODE CHANGES *
    ***************************************/
    function renderGraph() {
        // console.log("Root Node:", rootNode);
        // Update links
        link = graph.select(".links")
            .selectAll("line")
            .data(visibleLinks, d => `${d.source.id}-${d.target.id}`);
        
        link.exit().remove();
        
        var linkEnter = link.enter().append("line")
            .attr("stroke-width", linkWidth)
            .attr("stroke", linkClr);
        
        // Merge the new links with existing ones
        link = linkEnter.merge(link);
        
        // Update nodes
        node = graph.select(".nodes").selectAll("g")
            .data(visibleNodes, d => d.id);
        
        node.exit().remove();
        
        var nodeEnter = node.enter().append("g")
            .call(drag(simulation))
            .on("click", handleNodeClicked); // Attach click event to the group
        
        // Conditionally append circles to nodes
        nodeEnter.each(function(d) {
            var nodeGroup = d3.select(this);
            var hasLabelNode = !(d.is_dependency_name && !showLabelNodes);
            if (hasLabelNode) {
                nodeGroup.append("circle")
                    .attr("r", d.id === activeNodeId ? activeNodeSize : nodeSize)
                    .attr("fill", nodeColorMap.get(d.id))
                    .attr("stroke", textClr)
                    .attr("stroke-width", nodeStrokeWidth);
            }
        });
        
        // Append text to each node
        nodeEnter.append("text")
        .text(d => d.id)
        .attr("font-size", initialFontSize + 'px') // Set initial font size
        .attr("dy", ".35em")                       // Vertically center the text
        .attr("text-anchor", "middle")            // Horizontally center the text
        .style("visibility", d => {
            // Hide labels for Type Nodes when showTypeNodes is true
            if (showTypeNodes && typeColorMap.has(d.id)) {
                return "hidden";
            }
            return "visible";
        });

        // Merge newly created nodes with existing ones
        node = nodeEnter.merge(node);
    
        // Update existing nodes to add or remove circles based on the switch
        node.each(function(d) {
            var nodeGroup = d3.select(this);
            var circle = nodeGroup.select('circle');
            var hasLabelNode = !(d.is_dependency_name && !showLabelNodes);
            if (hasLabelNode && circle.empty()) {
                // Append circle
                nodeGroup.insert("circle", ":first-child")
                    .attr("r", d.id === activeNodeId ? activeNodeSize : nodeSize)
                    .attr("fill", nodeColorMap.get(d.id))
                    .attr("stroke", textClr)
                    .attr("stroke-width", nodeStrokeWidth);
            } else if (!hasLabelNode && !circle.empty()) {
                // Remove circle
                circle.remove();
            } else if (hasLabelNode && !circle.empty()) {
                // Update circle attributes
                circle
                    .attr("r", d.id === activeNodeId ? activeNodeSize : nodeSize)
                    .attr("fill", nodeColorMap.get(d.id))
                    .attr("stroke", textClr)
                    .attr("stroke-width", nodeStrokeWidth);
            }
        });
    
        // Update labels to adjust position based on circle presence
        node.select("text")
            .attr("dy", function(d) {
                var hasLabelNode = !(d.is_dependency_name && !showLabelNodes);
                return hasLabelNode ? "-.85em" : "0em";
            })
            .attr("font-size", initialFontSize + 'px');
    
        // Update link styles
        link.attr('stroke-width', linkWidth)
            .attr('stroke', linkClr);
        
        // Update force simulation
        simulation.nodes(visibleNodes);
        simulation.force("link", d3.forceLink(visibleLinks)
            .id(d => d.id)
            .distance(graphLinkLength)
            .strength(1)
        );
        simulation.force("center", null);
        
        // Remove positional forces
        simulation.force("x", null);
        simulation.force("y", null);
        
        // Apply the appropriate clustering force based on depth
        if (currentDepth > 3) {
            simulation.force("cluster", treeClusteringForce());
        } else {
            simulation.force("cluster", graphClusteringForce());
        }
        
        // Restart simulation to apply changes
        simulation.alpha(0.3).restart();
    }    

    /*****************************************************************************************
    * CLUSTERING FORCE GRAPH TTHAT WILL GROUP NODES BASED ON TYPES AROUND THEIR CENTRAL NODE *
    ******************************************************************************************/
    function graphClusteringForce() {
        //console.log(`(${++call}) clusteringForce`);
        // Create an array of unique node types, excluding the active node type
        var types = [...new Set(graphData.nodes
            .filter(node => node.id !== activeNodeId)
            .map(node => node.type))];

        // Set up the structure for positioning cluster centers
        var clusterCenters = {};
        var numTypes = types.length;
        var clusterRadius = Math.min(width, height);

        // Calculate position for each cluster type's center
        types.forEach((type, index) => {
            if (type === nodeById.get(activeNodeId)) {
                return;
            }

            var angle = (index / numTypes) * 2 * Math.PI;
            clusterCenters[type] = {
                x: centerX + clusterRadius * Math.cos(angle),
                y: centerY + clusterRadius * Math.sin(angle)
            };
        });

        // Return the force function
        return function(alpha) {
            visibleNodes.forEach(function(d) {
                // Include 'nodeWithMultiCI_Type' nodes when depth < 3 or if the node is the active node
                // if ((currentDepth < 3 || d.id === activeNodeId)) {
                    var cluster = clusterCenters[d.type];
                    if (cluster) {
                        var clusterStrength = .1;
                        d.vx -= clusterStrength * (d.x - cluster.x) * alpha;
                        d.vy -= clusterStrength * (d.y - cluster.y) * alpha;
                    }
                // }
            });
        };
    }

    /*************************************************************************************************
    * CLUSTERING FORCE FOR TREE GRAPH THAT WILL GROUP NODES BASED ON TYPES AROUND THEIR CENTRAL NODE *
    **************************************************************************************************/
    function treeClusteringForce() {
        // Create an array of unique node types, excluding the active node type
        var types = [...new Set(graphData.nodes
            .filter(node => node.id !== activeNodeId)
            .map(node => node.type))];
    
        // Set up the structure for positioning cluster centers
        var clusterCenters = {};
        var numTypes = types.length;
        var clusterRadius = Math.min(width, height);
    
        // Calculate position for each cluster type's center
        types.forEach((type, index) => {
            if (type === nodeById.get(activeNodeId).type) {
                return;
            }
    
            var angle = (index / numTypes) * 2 * Math.PI;
            clusterCenters[type] = {
                x: centerX + clusterRadius * Math.cos(angle),
                y: centerY + clusterRadius * Math.sin(angle)
            };
        });
    
        // Return the force function
        return function(alpha) {
            visibleNodes.forEach(function(d) {
                // Apply link force to control distances between connected nodes
                simulation.force("link", d3.forceLink(visibleLinks)
                    .id(d => d.id)
                );
                // For greater depth or presence of nodeWithMultiCI_Type, use a tighter collision radius
                // to allow nodes to cluster more closely together.
                simulation
                    .force("collide", d3.forceCollide()
                    // .radius(60) // Smaller radius for multi-CI nodes
                    .strength(1) // Weaker collision force to allow tighter clustering
                );
        
                // Skip nodes that are in nodeWithMultiCI_Type
                // if (nodeWithMultiCI_Type.includes(d.id) && centralNodes.includes(activeNodeId)) {
                //     return; // Exit early for nodes with multiple CI types, exempting them from clustering forces
                // }
        
                // Skip the active (central) node from being affected by clustering forces
                if (d.id === activeNodeId) {
                    return; // Exit for the central node to keep it stationary
                }
        
                // Apply clustering force to group nodes of the same type together
                var cluster = clusterCenters[d.type];
                if (cluster) {
                    // Calculate the clustering force for nodes to move towards their type's cluster center
                    var clusterStrength = 1; // Adjust clustering strength
                    d.vx -= clusterStrength * (d.x - cluster.x) * alpha; // Move node horizontally towards the cluster center
                    d.vy -= clusterStrength * (d.y - cluster.y) * alpha; // Move node vertically towards the cluster center
                }
            });
        };        
    }
    
    /*****************************************
    * UPDATE right-pane WITH NODE ATTRIBUTES *
    ******************************************/
    function updateRightContainer() {
        // Clear the existing content
        rightContainer.html("");
    
        // Get the active node object
        const activeNode = nodeById.get(activeNodeId);
    
        // Display the active node's ID at the top
        rightContainer.append("h2")
            .style("background-color", typeColorMap.get(activeNode.type) || '#000')
            .html(`${activeNode.id}`);
    
        // Display the active node's type
        rightContainer.append("p").html(`<strong>Type: </strong>${activeNode.type}`);
    
        // Display the active node's description
        const description = (activeNode.description || 'No description available').replace(/\n/g, '<br>');
        rightContainer.append("h3").attr("class", "description-header").html("Description");
        rightContainer.append("p").html(description);
    
        // Dependencies header
        rightContainer.append("h3").attr("class", "dependencies-header").html("Dependencies");
    
        // Get all visible nodes excluding the active node
        const visibleNodesExcludingActive = visibleNodes.filter(n => n.id !== activeNodeId);
    
        // Group the visible nodes by their type
        const nodesByType = d3.group(visibleNodesExcludingActive, d => d.type);
    
        // Define the desired order for types
        const desiredOrder = ["Organization", "People", "Technology"];
    
        // Sort types according to the desired order
        const orderedTypes = Array.from(nodesByType.keys()).sort((a, b) => {
            const indexA = desiredOrder.indexOf(a);
            const indexB = desiredOrder.indexOf(b);
    
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
    
        // Add sorted types and nodes to the right container
        orderedTypes.forEach(type => {
            const nodes = nodesByType.get(type);
            createTypeSection(type, nodes);
        });
    }    

    // Helper function to create a type section
    function createTypeSection(type, nodes) {
        // Retrieve the type node to get its description
        const typeNode = nodeById.get(type);
    
        // Create a container for the type section
        const typeSection = rightContainer.append("div")
            .attr("class", "type-section");
    
        // Append the type name and make it clickable if the type node exists
        typeSection.append("p")
            .style("background-color", typeColorMap.get(type) || '#000')
            .attr("class", "dependency-type")
            .html(`<strong>${type}</strong>`)
            .style("cursor", typeNode ? "pointer" : "default")
            .style("text-align", "center")
            .on("click", (event) => {
                if (typeNode) {
                    handleNodeClicked(event, typeNode);
                }
            });
    
        // Filter out nodes where node.id === type to avoid redundancy
        const filteredNodes = nodes.filter(node => node.id !== type);
    
        // Sort nodes alphabetically and create elements for each node
        filteredNodes.sort((a, b) => a.id.localeCompare(b.id))
            .forEach(node => createNodeElement(typeSection, node));
    }

    // Helper function to create a node element
    function createNodeElement(parentContainer, node) {
        // Skip creating the node element if node.id === node.type
        if (node.id === node.type) return;
    
        // Create a container for the node
        const nodeContainer = parentContainer.append("div")
            .attr("class", "dependency-node-container");
    
        // Append the node name
        nodeContainer.append("p")
            .attr("class", "dependency-node")
            .html(`<strong>${node.id}</strong>`)
            .style("cursor", "pointer")
            .on("click", (event) => handleNodeClicked(event, node));
    
        // Append the hover box
        nodeContainer.append("div")
            .attr("class", "hover-box")
            .html(node.description ? node.description.replace(/\n/g, '<br>') : 'No description available');
    }    
    
    /*******************************************************
    * NODE CLICK EVENT HANDLERS FOR ACTIVE NODE MANAGEMENT *
    ********************************************************/
    function handleNodeClicked(event, d) {
        isNodeClicked = true;
        if (d.id === activeNodeId) return;  // Do nothing if the clicked node is already active
    
        activeNodeId = d.id;  // Update the active node ID
        console.log("Active Node ID:", activeNodeId);
    
        // Use the current slider depth to render the graph 
        // so that if depth == 2, the surrounding nodes are displayed.
        var depth = parseInt(onDepthSlider.value);
        renderActiveNodeGraph(depth, activeNodeId);
    }

    /*************************
    * FUNCTIONS FOR CONTROLS *
    **************************/
    function searchNode(nodeId) {
        call = 0;
        ////console.log(`(${++call}) searchNode`);
        if (nodeById.has(nodeId)) {
            var node = nodeById.get(nodeId); // Get the node object
            handleNodeClicked(null, node); // Trigger the same logic as a click
        } else {
            failedSearch.style.display = 'inline-block'; // Show the failed search message
            failedSearch.innerHTML = `${nodeId} does not exist`;
            timeout = setTimeout(() => {
                failedSearch.style.display = 'none'; // Hide the message after 3 seconds
            }, 3000);
        }
    }

    /************************************************
     * RESET NODE FORCES AND RESTART THE SIMULATION *
     ************************************************/
    function resetNodeForces() {    
        graphData.nodes.forEach(node => {
            node.fx = null;
            node.fy = null;
        });

        // Reset positions of visible nodes to their initial positions
        visibleNodes.forEach(d => {
            if (d.initialX !== undefined && d.initialY !== undefined) {
                d.x = d.initialX;
                d.y = d.initialY;
                d.fx = null;
                d.fy = null;
            }
        });

        // Restart the simulation
        simulation.alpha(0.3).restart();

        // Reset the graph to the initial state
        renderActiveNodeGraph(parseInt(onDepthSlider.value), activeNodeId);
    }

    /****************************************************************
    * SIMULATION TICK FUNCTION: UPDATE POSITIONS OF NODES AND LINKS *
    *****************************************************************/
    function ticked() {
        link.attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
    
        node.attr("transform", d => {
            if (isNaN(d.x) || isNaN(d.y)) {
                d.x = centerX;
                d.y = centerY;
            }
            return `translate(${d.x},${d.y})`;
        });
    
        // Check if the simulation has cooled down or if a node was clicked
        if ((!graphFitted && simulation.alpha() < 0.05) || isNodeClicked) {
            fitGraphToContainer();
            graphFitted = true;
    
            // Make the graph visible after fitting
            graph.style("visibility", "visible");
        }
        fitGraphToContainer();
    }       
    
    function fitGraphToContainer() {
        const containerWidth = window.innerWidth * 0.7;
        const containerHeight = window.innerHeight;
    
        // Compute the bounding box of the nodes
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
            scale = 1; // Default scale
            translateX = (containerWidth / 2) - nodesBBox.xMin;
            translateY = (containerHeight / 2) - nodesBBox.yMin;
        } else {
            // Compute the scaling factor to fit the nodes into the container
            scale = Math.min(
                (containerWidth - 2 * graphPadding) / nodesWidth,
                (containerHeight - 2 * graphPadding) / nodesHeight
            );
    
            // Compute the translation to center the nodes
            translateX = (containerWidth - nodesWidth * scale) / 2 - nodesBBox.xMin * scale;
            translateY = (containerHeight - nodesHeight * scale) / 2 - nodesBBox.yMin * scale;
        }
    
        // Apply the transform to the graph using the zoom behavior without transition
        svg.transition().duration(0).call(
            zoom.transform,
            d3.zoomIdentity.translate(translateX, translateY).scale(scale)
        );
    }       

    /*****************************************************
    * DRAG FUNCTIONS TO ENABLE INTERACTIVE NODE MOVEMENT *
    ******************************************************/
    const drag = simulation => {
        function dragstarted(event, d) {
            // Fix positions of all other nodes except the dragged node
            visibleNodes.forEach(node => {
                if (node !== d) {
                    node.fx = node.x;
                    node.fy = node.y;
                }
            });
            
            // Prevent initial jump by setting the dragged node's position to its current coordinates
            d.fx = d.x;
            d.fy = d.y;
    
            // Restart the simulation with reduced alpha for smooth dragging
            simulation.alphaTarget(0.1).restart();
        }
    
        function dragged(event, d) {
            // Update the position of the dragged node
            d.fx = event.x;
            d.fy = event.y;
        }
    
        function dragended(event, d) {
            // Keep the dragged node fixed at its final position
            d.fx = event.x;
            d.fy = event.y;
    
            // Stop the simulation's influence
            simulation.alphaTarget(0);
        }
    
        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    };  
});