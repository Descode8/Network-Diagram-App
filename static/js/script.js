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
    let nodeSize = 5;
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
    // let treeGraphCentralNodeLinkLength = 5;
    // let treeGraphNodeLinkLength = 50;

    /*******************************
    * EVENT LISTENERS FOR CONTROLS *
    ********************************/    
    var zoom = d3.zoom()
        .scaleExtent([0.5, 2.5])
        .on('zoom', (event) => {
            graph.attr('transform', event.transform);
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

    // onScreenShot.addEventListener("click", () => {
    //     html2canvas(document.querySelector(".screenshot-container")).then(canvas => {
    //         const dataUrl = canvas.toDataURL("image/png");
    
    //         // Get the current date
    //         const date = new Date();
    //         const day = String(date.getDate()).padStart(2, '0'); // Day with leading zero
    //         const month = String(date.getMonth() + 1).padStart(2, '0'); // Month with leading zero
    //         const year = String(date.getFullYear()); // Last two digits of the year
    
    //         // Construct the filename
    //         const filename = `network_diagram_${year}-${month}-${day}.png`;
    
    //         // Create a link to download the image
    //         const downloadLink = document.createElement("a");
    //         downloadLink.href = dataUrl;
    //         downloadLink.download = filename;
    //         downloadLink.click();
    //     }).catch(error => {
    //         console.error("Screenshot failed:", error);
    //     });
    // });    

       // Function to update the gradient and the displayed value
    function updateDepthSlider() {
        var value = (onDepthSlider.value - onDepthSlider.min) / (onDepthSlider.max - onDepthSlider.min) * 100;
        onDepthSlider.style.setProperty('--value', `${value}%`);
        depthValue.textContent = onDepthSlider.value; // Update the displayed value
    }

    // Function to update the gradient and the displayed value
    // function updateNodeSizeSlider() {
    //     var value = (onNodeSizeSlider.value - onNodeSizeSlider.min) / (onNodeSizeSlider.max - onNodeSizeSlider.min) * 100;
    //     onNodeSizeSlider.style.setProperty('--value', `${value}%`);
    //     nodeValue.textContent = onNodeSizeSlider.value; // Update the displayed value
    // }

    // Initialize the slider with the default value on page load
    updateDepthSlider();
    // Update the slider whenever its value changes
    onDepthSlider.addEventListener('input', updateDepthSlider);

    // Initialize the slider with the default value on page load
    // updateNodeSizeSlider();
    // // Update the slider whenever its value changes
    // onNodeSizeSlider.addEventListener('input', updateNodeSizeSlider);

    // Add event listener for the depth slider
    onDepthSlider.addEventListener('input', () => {
        var depth = parseInt(onDepthSlider.value);

        if(depth < 2) {
            setGraphForces();
        }

        depthValueLabel.textContent = depth;
        renderActiveNodeGraph(depth, activeNodeId);
    });

    
    // onNodeSizeSlider.addEventListener('input', () => {
    //     nodeSize = parseInt(onNodeSizeSlider.value);
    //     console.log(nodeSize);
    //     nodeValueLabel.textContent = nodeSize;
    //     renderGraph();
    // });

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
        // Check if `graphData` is already in localStorage
        // const storedData = localStorage.getItem('graphData');
        
        // if (storedData) {
        //     // Parse and use stored graphData from localStorage
        //     graphData = JSON.parse(storedData);
        //     console.log("Loaded graph data from localStorage:", graphData);
        // } else {
            // If not in localStorage, fetch it from the backend
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
                console.log("Graph data fetched successfully from backend:", graphData);

                // Store the fetched data in localStorage for future use
                localStorage.setItem('graphData', JSON.stringify(graphData));
            } catch (error) {
                console.error("Error fetching graph data:", error);
            }
        // }

        centralNodes = graphData.center_nodes;
        console.log("Central Nodes:", centralNodes);

        graphData.nodes.forEach(node => {
            if (node.is_multi_dependent === true) {
                nodeWithMultiCI_Type.push(node.id);  // Push only the ID if the condition is true
            }
        });

        console.log("Nodes with Multi CI Type:", nodeWithMultiCI_Type);

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
        // Create a map for quick node lookups by ID, enabling faster access to nodes by their ID.
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
    
        // Create node elements
        node = graph.append("g")
            .attr("class", "nodes")
            .style("stroke", textClr)           // Outline color for nodes
            .style("stroke-width", 1.2)           // Outline thickness for nodes
            .style("text-anchor", "middle")     // Centers text inside nodes
            .selectAll("g")
            .data(visibleNodes, d => d.id)
            .enter()
            .append("g")
            .call(drag(simulation));            // Apply drag behavior here
    
        // Append circles to each node
        node.append("circle")
            .attr("fill", d => nodeColorMap.get(d.id))
            .on("click", handleNodeClicked);
    
        // Append text to each node
        node.append("text")
            .text(d => d.id);
    
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
            console.log('Central Nodes Repulsion');
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
                    minDistance = 400;
                    repulsionStrength = (minDistance - distance) / distance * 1;
    
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
    
        // Set the link force with shorter distance
        simulation.force("link", d3.forceLink(visibleLinks)
            .id(d => d.id)
            .distance(function(d) {
                // Set shorter distance for links connected to the central node
                if (d.source.id === activeNodeId || d.target.id === activeNodeId) {
                    return 10; // Shorter distance for central node links
                } else {
                    return 50; // Longer distance for other links
                }
            })
            .strength(1)
        );
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
        console.log("RenderGraph", nodeSize);
        
        // Update links
        link = graph.select(".links")
            .selectAll("line")
            .data(visibleLinks, d => `${d.source.id}-${d.target.id}`);
        
        link.exit().remove();
        
        var linkEnter = link.enter().append("line")
            .attr("stroke-width", 1)
            .attr("stroke", lineClr);
        
        link = linkEnter.merge(link);
        
        // Update nodes
        node = graph.select(".nodes").selectAll("g")
            .data(visibleNodes, d => d.id);
        
        node.exit().remove();
        
        var nodeEnter = node.enter().append("g")
            .call(drag(simulation)); // Apply the drag behavior here using the drag function
        
        // Append circles with radius based on nodeSize
        nodeEnter.append("circle")
            .attr("r", nodeSize) // Set initial radius for new nodes
            .attr("fill", d => nodeColorMap.get(d.id))
            .on("click", handleNodeClicked);
        
        // Append text element for labels
        nodeEnter.append("text")
            .attr("dx", "0ex")
            .attr("dy", "-1.5ex")
            .text(d => d.id);
    
        // Merge newly created nodes with existing ones
        node = nodeEnter.merge(node);
    
        // **Explicitly update the radius of all circles in the selection to match nodeSize**
        node.select("circle")
            .attr("r", nodeSize);
    
        // Ensure labels maintain their styles
        node.select("text")
            .attr("stroke-width", 0)
            .attr("font-size", ".8em");
    
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
                    .distance(function(d) {
                        // If the link is connected to the central node (activeNodeId)
                        // and not part of `nodeWithMultiCI_Type`, set a shorter distance.
                        if (d.source.id === activeNodeId || d.target.id === activeNodeId && !nodeWithMultiCI_Type.includes(d.id)) {
                            return 10; // Short distance for links connected to the central node
                        } else {
                            return 0; // Longer distance for links not connected to the central node
                        }
                    })
                    .strength(1) // Set strength of link force
                );
        
                // Apply collision force to manage how closely nodes can get to each other
                if (currentDepth <= 2 || !nodeWithMultiCI_Type || nodeWithMultiCI_Type.length === 0) {
                    // If the depth is low or there are no specific node types with multiple CI,
                    // apply a stronger collision force with a larger radius (25) to keep nodes further apart.
                    simulation
                        .force("collide", d3.forceCollide()
                        .radius(25) // Larger radius to maintain distance
                        .strength(1) // Stronger collision force
                    );
                } else {
                    // For greater depth or presence of `nodeWithMultiCI_Type`, use a tighter collision radius
                    // to allow nodes to cluster more closely together.
                    simulation
                        .force("collide", d3.forceCollide()
                        .radius(d => nodeWithMultiCI_Type.includes(d.id) ? 15 : 20) // Smaller radius for multi-CI nodes
                        .strength(0.1) // Weaker collision force to allow tighter clustering
                    );
                }
        
                // Skip nodes that are in `nodeWithMultiCI_Type`
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
                    var clusterStrength = 0.1; // Adjust clustering strength
                    d.vx -= clusterStrength * (d.x - cluster.x) * alpha; // Move node horizontally towards the cluster center
                    d.vy -= clusterStrength * (d.y - cluster.y) * alpha; // Move node vertically towards the cluster center
                }
            });
        };        
    }
    
    /**********************************************
    * UPDATE right-pane WITH NODE ATTRIBUTES *
    ***********************************************/
    function updateRightContainer() {
        // Clear the existing content
        rightContainer.html("");
    
        // Get the active node object
        var activeNode = nodeById.get(activeNodeId);
    
        // Display the active node's ID at the top
        rightContainer.append("h2")
            .style("background-color", typeColorMap.get(activeNode.type) || '#000')
            .html(`${activeNode.id}`);
    
        // Display the active node's type
        rightContainer.append("p").html(`<strong>Type: </strong>${activeNode.type}`);
    
        // Display the active node's description
        var description = activeNode.description ? activeNode.description : 'No description available';
        // Add the Description header with a specific class
        rightContainer.append("h3")
            .attr("class", "description-header")
            .html(`Description`);
    
        // Add the description text
        rightContainer.append("p").html(`${description}`);
    
        // Add the Dependencies header with a different class
        rightContainer.append("h3")
            .attr("class", "dependencies-header")
            .html("Dependencies");
    
        // Get the types of the active node's immediate children
        var immediateChildren = visibleNodes.filter(n => {
            return visibleLinks.some(link =>
                (link.source.id === activeNodeId && link.target.id === n.id) ||
                (link.target.id === activeNodeId && link.source.id === n.id)
            );
        });
    
        // Group children by type
        var types = d3.group(immediateChildren, d => d.type);
    
        // Convert types map to an array, sort alphabetically by type, and then iterate
        Array.from(types.entries())
        .sort(([typeA], [typeB]) => typeA.localeCompare(typeB)) // Sort alphabetically by type
        .forEach(([type, nodes]) => {
            rightContainer.append("p")
                .style("background-color", typeColorMap.get(type) || '#000')
                .attr("class", "dependency-type")
                .html(`${type}`);
    
            nodes.forEach(node => {
                var nodeName = node.id;
                rightContainer.append("p")
                    .attr("class", "dependency-node")
                    .html(`${nodeName}`)
                    .style("cursor", "pointer")
                    .on("click", function(event) {
                        handleNodeClicked(event, node);
                    });
            });
        });
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
            // Include 'nodeWithMultiCI_Type' nodes when depth < 3 or if the node is the active node
            if ((currentDepth < 3 || d.id === activeNodeId) || !nodeWithMultiCI_Type) {
                d.x = Math.max(0, Math.min(width, d.x));
                d.y = Math.max(0, Math.min(height, d.y));
            }
            return `translate(${d.x},${d.y})`;
        });
    }

    /*******************************************************
    * NODE CLICK EVENT HANDLERS FOR ACTIVE NODE MANAGEMENT *
    ********************************************************/
    function handleNodeClicked(event, d) {
        nodeClicked = true;
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
     * **********************************************/
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
                } else {
                    node.fx = null; // Allow the dragged node to move freely
                    node.fy = null;
                }
            });
            // Restart the simulation with reduced alpha to allow smooth dragging
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