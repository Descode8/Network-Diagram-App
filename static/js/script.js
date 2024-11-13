document.addEventListener("DOMContentLoaded", () => { // Remove the 'charge' force from the simulation **** simulation.force("charge", null);
    
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
    var textClr = rootStyles.getPropertyValue('--text-clr').trim();
    var lineClr = rootStyles.getPropertyValue('--bdr-clr').trim();

    const typeColorMap = new Map([
        ['Home', homeNodeClr],   
        ['Applications', appNodeClr], 
        ['People', pplNodeClr],           
        ['Technology', techNodeClr],  
        ['Data', dataNodeClr], 
        ['Procurements', procureNodeClr],
        ['Facilities', fcltyNodeClr] 
    ]);

    let activeNodeId;
    const svg = d3.select("svg");
    const rightContainer = d3.select(".right-pane");
    // const onScreenShot = document.getElementById("screenshot");
    const onSearchInput = document.getElementById('searchInput');
    const onSearchButton = document.getElementById('searchButton');
    const onHomeButton = document.getElementById('homeButton');
    const onRefreshButton = document.getElementById('refreshButton');
    const onDepthSlider = document.getElementById('depthSlider');
    const depthValueLabel = document.getElementById('depthValue');
    // const onNodeSizeSlider = document.getElementById("nodeSlider");
    // const nodeValueLabel = document.getElementById("nodeValue");
    const svgElement = svg.node();
    const width = svgElement.getBoundingClientRect().width;
    const height = svgElement.getBoundingClientRect().height;
    let centerX = width / 2;
    let centerY = height / 2;
    const graph = svg.append("g");
    const nodeColorMap = new Map();
    let currentDepth = 2;
    let simulation;
    let graphData;
    let nodeById;
    let visibleNodes = [];
    let visibleLinks = [];
    let centralNodes = [];
    let node;
    let link;
    let nodeWithMultiCI_Type = [];
    let graphLinkLength = 100;
    let graphFitted = false; // Add this at the top level
    let isNodeClicked = false;
    let maxLabelWidth = 0;
    let maxLabelHeight = 0;
    let nodeSize = 5; // Initial node size in pixels
    let initialFontSize = 12; // Initial font size in pixels
    let currentZoomScale = 1;
    let graphPadding = 75;
    let linkWidth = 0.5;
    let nodeStrokeWidth = 1;

    /*******************************
    * EVENT LISTENERS FOR CONTROLS *
    ********************************/    
    var zoom = d3.zoom()
        .scaleExtent([0.5, 1])
        .on('zoom', (event) => {
            currentZoomScale = event.transform.k;
            graph.attr('transform', event.transform);

            // Adjust node sizes inversely proportional to zoom scale
            node.select('circle').attr('r', nodeSize / currentZoomScale);
            node.select('text').attr('font-size', (initialFontSize / currentZoomScale) + 'px');

            // Adjust stroke-width inversely proportional to zoom scale using .attr()
            link.attr('stroke-width', linkWidth / currentZoomScale);
            node.select('circle').attr('stroke-width', nodeStrokeWidth / currentZoomScale); // Adjusted stroke-width
        });
    svg.call(zoom);

    /*****************************************************
     * INITIALIZING AND FETCHING GRAPH DATA ON PAGE LOAD *
     *****************************************************/
    // Ensure the SVG element is fully loaded before starting
    window.onload = function() {
        ////console.log(`(${++call}) window.onload`);
        fetchGraphData().then(() => {
            // Set initial link distance
            // Set activeNodeId to initial node
            activeNodeId = graphData.nodes[0].id;
            renderActiveNodeGraph(2, activeNodeId);  // Set initial depth to 2
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

        if(depth < 2) {
            setGraphForces();
        }

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
    onSearchButton.addEventListener('click', () => {
        var searchTerm = onSearchInput.value.trim();
        if (searchTerm) {
            searchNode(searchTerm);
        }
    });

    // Add event listener for 'Enter' key press on the input field
    onSearchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            var searchTerm = onSearchInput.value.trim();
            if (searchTerm) {
                searchNode(searchTerm);
            }
        }
    });

    /**********************************
     * FETCHING DATA FROM THE BACKEND *
     **********************************/
    async function fetchGraphData() {
        //Check if `graphData` is already in localStorage
        const storedData = localStorage.getItem('graphData');
        
        if (storedData) {
            // Parse and use stored graphData from localStorage
            graphData = JSON.parse(storedData);
            console.log("Loaded graph data from localStorage:", graphData);
        } else {
            //If not in localStorage, fetch it from the backend
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
                //console.log("Graph data fetched successfully from backend:", graphData);

                // Store the fetched data in localStorage for future use
                localStorage.setItem('graphData', JSON.stringify(graphData));
            } catch (error) {
                //console.error("Error fetching graph data:", error);
            }
        }

        centralNodes = graphData.center_nodes;
        //console.log("Central Nodes:", centralNodes);

        graphData.nodes.forEach(node => {
            if (node.is_multi_dependent === true) {
                nodeWithMultiCI_Type.push(node.id);  // Push only the ID if the condition is true
            }
        });

        //console.log("Nodes with Multi CI Type:", nodeWithMultiCI_Type);

        assignColors(graphData);
        initializeGraph(graphData);
    }

    /*************************************************
     * ASSIGNING COLORS TO NODES BASED ON THEIR TYPE *
     *************************************************/
    function assignColors(data) {
        ////console.log(`(${++call}) assignColors`);
        // Iterate through each node in the dataset
        data.nodes.forEach(node => {
            // Get the color associated with the node's type from the type-color mapping
            var color = typeColorMap.get(node.type);
            if (color) {
                // If a color exists for this type, use it
                nodeColorMap.set(node.id, color);
            } else {
                // If no color is defined for this type, use gray as default
                nodeColorMap.set(node.id, 'yellow');
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
            .attr("stroke", lineClr)                  // Set initial stroke color for links
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
            .attr("r", nodeSize)                 // Set initial radius for nodes
            .attr("fill", d => nodeColorMap.get(d.id))
            .attr("stroke", textClr)             // Set stroke color
            .attr("stroke-width", nodeStrokeWidth) // Increased stroke width
            .on("click", handleNodeClicked);
        
        // Append text to each node
        node.append("text")
            .text(d => d.id)
            .attr("font-size", initialFontSize + 'px') // Set initial font size
            .attr("dy", ".35em")                       // Vertically center the text
            .attr("text-anchor", "middle");            // Horizontally center the text
        
        // Initialize the force simulation with visible nodes
        simulation = d3.forceSimulation(visibleNodes)
            .on("tick", ticked);                    // Event listener for each tick
        
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
        expandNodeByDepth(nodeObj, depth);
    
        // Reset the graphFitted flag
        graphFitted = false;
    
        // Update force settings based on the depth value
        if (depth > 2) {
            setTreeForces();
        } else {
            setGraphForces();
        }
    
        updateNodePositions();
        renderGraph();
        updateRightContainer();
    }
    
    /******************************
    * EXPAND ACTIVE NODE BY DEPTH *
    *******************************/
    function expandNodeByDepth(node, depth, currentDepth = 1) {
        if (currentDepth > depth) return;  // Stop recursion when the target depth is reached

        if (!visibleNodes.includes(node)) {
            visibleNodes.push(node);  // Add the current node to the visible list
        }

        // If the current depth is the maximum, stop expanding further
        if (currentDepth === depth) return;

        // Find only the immediate children of the current node
        var childLinks = graphData.links.filter(link => 
            link.source.id === node.id || link.target.id === node.id
        );

        childLinks.forEach(link => {
            if (!visibleLinks.includes(link)) {
                visibleLinks.push(link);  // Add the link to visible links

                // Get the connected node (either source or target of the link)
                var childNode = link.source.id === node.id ? link.target : link.source;

                // Recursively expand the graph if the connected node isn't already visible
                if (!visibleNodes.includes(childNode)) {
                    expandNodeByDepth(childNode, depth, currentDepth + 1);
                }
            }
        });
    } 

    /****************************************************
    * SETTING UP FORCES BASED ON GRAPH LAYOUT (TREE) *
    ****************************************************/
    function setTreeForces() {
        let minDistance;
        let repulsionStrength;
    
        // Clear any existing 'tick' event handlers to prevent multiple handlers from stacking.
        simulation.on("tick", null);
    
        // Define a custom repulsion force function to keep central nodes apart.
        function centralNodesRepulsion() {
            // Remove the 'charge' force
            simulation.force("charge", null);
    
            // Only apply the repulsion if the active node is a central node.
            if (!centralNodes.includes(activeNodeId)) {
                return;
            }
    
            // Iterate over each node in the visibleNodes array.
            for (let i = 0; i < visibleNodes.length; i++) {
                let nodeA = visibleNodes[i];
    
                // Skip if nodeA is in nodeWithMultiCI_Type
                if (nodeWithMultiCI_Type.includes(nodeA.id)) continue;
    
                // Continue only if nodeA is a central node.
                if (!centralNodes.includes(nodeA.id)) continue;
                
                for (let j = i + 1; j < visibleNodes.length; j++) {
                    let nodeB = visibleNodes[j];
    
                    // Skip if nodeB is in nodeWithMultiCI_Type
                    if (nodeWithMultiCI_Type.includes(nodeB.id)) continue;
    
                    // Continue only if nodeB is a central node.
                    if (!centralNodes.includes(nodeB.id)) continue;
    
                    // Compute the differences in x and y positions between nodeA and nodeB.
                    let dx = nodeB.x - nodeA.x;
                    let dy = nodeB.y - nodeA.y;
    
                    // Calculate the Euclidean distance between nodeA and nodeB.
                    let distance = Math.sqrt(dx * dx + dy * dy);
    
                    // Define the minimum desired distance between central nodes.
                    minDistance = 250;
                    repulsionStrength = (minDistance - distance) / distance;
    
                    // Apply the repulsion only if nodes are closer than the minimum distance.
                    if (distance < minDistance) {
                        // Calculate the force components along the x and y axes.
                        let fx = dx * repulsionStrength;
                        let fy = dy * repulsionStrength;
    
                        // Adjust the velocities of nodeA and nodeB to push them apart.
                        nodeA.vx -= fx;
                        nodeA.vy -= fy;
                        nodeB.vx += fx;
                        nodeB.vy += fy;
                    }
                }
            }
        }
    
        // Apply the custom centralNodesRepulsion force only when the depth is greater than 2.
        if (currentDepth > 2) {
            simulation.on("tick", () => {
                centralNodesRepulsion(); // Apply the custom repulsion force between central nodes.
                ticked();                // Update positions and redraw the graph elements.
            });
        } else {
            // If depth is <= 2, revert to regular forces
            setGraphForces();
        }
    
        // Apply the treeClusteringForce
        simulation.force("cluster", treeClusteringForce());
    }
    
    /****************************************************
     * SETTING UP FORCES BASED ON GRAPH LAYOUT (GRAPH) *
     * **************************************************/
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

        simulation.alpha(0.3).restart();
    } 

    /**************************************
    * UPDATE THE GRAPH AFTER NODE CHANGES *
    ***************************************/
    function renderGraph() {
        // Update links
        link = graph.select(".links")
            .selectAll("line")
            .data(visibleLinks, d => `${d.source.id}-${d.target.id}`);
        
        link.exit().remove();
        
        var linkEnter = link.enter().append("line")
            .attr("stroke-width", linkWidth)          // Set initial stroke-width for new links
            .attr("stroke", lineClr);           // Set initial stroke color for new links
        
        // Merge the new links with existing ones
        link = linkEnter.merge(link);
        
        // Update nodes
        node = graph.select(".nodes").selectAll("g")
            .data(visibleNodes, d => d.id);
        
        node.exit().remove();
        
        var nodeEnter = node.enter().append("g")
            .call(drag(simulation)); // Apply the drag behavior here using the drag function
        
        // Append circles with radius based on nodeSize
        nodeEnter.append("circle")
            .attr("r", nodeSize)                 // Set initial radius for new nodes
            .attr("fill", d => nodeColorMap.get(d.id))
            .attr("stroke", textClr)             // Set stroke color
            .attr("stroke-width", nodeStrokeWidth) // Increased stroke width
            .on("click", handleNodeClicked);
        
        // Append text element for labels
        nodeEnter.append("text")
            .attr("dy", "-.85em") // Vertically center the text
            .text(d => d.id)
            .attr("font-size", initialFontSize + 'px'); // Set initial font size
        // Set initial font size
        
        // Merge newly created nodes with existing ones
        node = nodeEnter.merge(node);
        
        // **Explicitly update the radius of all circles in the selection to match nodeSize**
        node.select("circle")
            .attr("r", nodeSize);
        
        // Ensure labels maintain their styles
        node.select("text")
            .attr("stroke-width", 0)
            .attr("font-size", ".5em");
    
        link.attr('stroke-width', linkWidth)        // Initial stroke-width for links
            .attr('stroke', lineClr);          // Initial stroke color for links
        
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
        if (currentDepth > 2) {
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
                if ((currentDepth < 3 || d.id === activeNodeId) || !nodeWithMultiCI_Type) {
                    var cluster = clusterCenters[d.type];
                    if (cluster) {
                        var clusterStrength = .1;
                        d.vx -= clusterStrength * (d.x - cluster.x) * alpha;
                        d.vy -= clusterStrength * (d.y - cluster.y) * alpha;
                    }
                }
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
                    .radius(d => nodeWithMultiCI_Type.includes(d.id) ? 7 : 3) // Smaller radius for multi-CI nodes
                    .strength(0.1) // Weaker collision force to allow tighter clustering
                );
        
                // Skip nodes that are in nodeWithMultiCI_Type
                if (nodeWithMultiCI_Type.includes(d.id) && centralNodes.includes(activeNodeId)) {
                    return; // Exit early for nodes with multiple CI types, exempting them from clustering forces
                }
        
                // Skip the active (central) node from being affected by clustering forces
                if (d.id === activeNodeId) {
                    return; // Exit for the central node to keep it stationary
                }
        
                // Apply clustering force to group nodes of the same type together
                var cluster = clusterCenters[d.type];
                if (cluster) {
                    // Calculate the clustering force for nodes to move towards their type's cluster center
                    var clusterStrength = 0.01; // Adjust clustering strength
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
        const description = activeNode.description || 'No description available';
        rightContainer.append("h3").attr("class", "description-header").html("Description");
        rightContainer.append("p").html(description);
    
        // Dependencies header
        rightContainer.append("h3").attr("class", "dependencies-header").html("Dependencies");
    
        // Get and group the types of the active node's immediate children
        const immediateChildren = visibleNodes.filter(n =>
            visibleLinks.some(link =>
                (link.source.id === activeNodeId && link.target.id === n.id) ||
                (link.target.id === activeNodeId && link.source.id === n.id)
            )
        );
        const types = d3.group(immediateChildren, d => d.type);
    
        // Sort types with predefined ordering for specific types
        const orderedTypes = Array.from(types.entries()).sort(sortTypes);
    
        // Add sorted types and nodes to the right container
        orderedTypes.forEach(([type, nodes]) => createTypeSection(type, nodes));
    }
    
    // Helper function to sort types based on predefined order
    const predefinedOrder = ['Home', 'People', 'Technology'];
    function sortTypes([typeA], [typeB]) {
        const indexA = predefinedOrder.indexOf(typeA);
        const indexB = predefinedOrder.indexOf(typeB);
    
        // Sort predefined types first, in specified order
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return 0;
    }
    
    // Helper function to create a type section
    function createTypeSection(type, nodes) {
        rightContainer.append("p")
            .style("background-color", typeColorMap.get(type) || '#000')
            .attr("class", "dependency-type")
            .html(type);
    
        // Sort nodes alphabetically and create elements for each
        nodes.sort((a, b) => a.id.localeCompare(b.id)).forEach(createNodeElement);
    }
    
    // Helper function to create a node element
    function createNodeElement(node) {
        rightContainer.append("p")
            .attr("class", "dependency-node")
            .html(node.id)
            .style("cursor", "pointer")
            .on("click", (event) => handleNodeClicked(event, node));
    }
    
    /*******************************************************
    * NODE CLICK EVENT HANDLERS FOR ACTIVE NODE MANAGEMENT *
    ********************************************************/
    function handleNodeClicked(event, d) {
        isNodeClicked = true;
        if (d.id === activeNodeId) return;  // Do nothing if the clicked node is already active
    
        activeNodeId = d.id;  // Update active node ID
    
        var depth = parseInt(onDepthSlider.value);  // Get current depth from slider
        visibleNodes = [];  // Clear visible nodes
        visibleLinks = [];  // Clear visible links
    
        // Expand nodes based on new active node and depth
        expandNodeByDepth(d, depth);
    
        // Apply the appropriate clustering force
        if (currentDepth > 2) {
            simulation.force("cluster", treeClusteringForce());
        } else {
            simulation.force("cluster", graphClusteringForce());
        }
    
        // Center the active node
        updateNodePositions();
        renderGraph();
        updateRightContainer();  // Update info pane
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
            alert("Node not found!");
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
    
            // Calculate maximum allowed positions
            var maxX = width - nodeSize - maxLabelWidth / 2;
            var maxY = height - nodeSize - maxLabelHeight / 2;
    
            // Keep nodes within bounds
            d.x = Math.max(nodeSize + maxLabelWidth / 2, Math.min(maxX, d.x));
            d.y = Math.max(nodeSize + maxLabelHeight / 2, Math.min(maxY, d.y));
    
            return `translate(${d.x},${d.y})`;
        });
    
        // Check if the simulation has cooled down or if a node was clicked
        if ((!graphFitted && simulation.alpha() < 0.05) || isNodeClicked) {
            fitGraphToContainer();
            graphFitted = true;
            
            // Make the graph visible after fitting
            graph.style("visibility", "visible");
        }
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
    
        // Compute the scaling factor to fit the nodes into the container
        const scale = Math.min(
            (containerWidth - 2 * graphPadding) / nodesWidth,
            (containerHeight - 2 * graphPadding) / nodesHeight
        );
    
        // Compute the translation to center the nodes
        const translateX = (containerWidth - nodesWidth * scale) / 2 - nodesBBox.xMin * scale;
        const translateY = (containerHeight - nodesHeight * scale) / 2 - nodesBBox.yMin * scale;
    
        // Apply the transform to the graph using the zoom behavior without transition
        svg.call(
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