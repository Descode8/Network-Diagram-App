document.addEventListener('DOMContentLoaded', () => {  
    let width = document.querySelector('.graph-container').clientWidth;
    let height = document.querySelector('.graph-container').clientHeight;
    const svg = d3.select('.graph-container svg');
    const activeNodeSize = 7;
    const nodeSize = 5;
    const linkWidth = 1;
    const linkColor = '#85929E';
    const nodeBorderColor = 'black';

    let currentActiveNodeName = null; 
    let graphPadding = 75;  
    let visibleNodes = [];
    let isNodeClicked = false;

    const depthSlider = document.getElementById('depthSlider');
    const depthValueLabel = document.getElementById('depthValue');
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const rightContainer = d3.select('.right-pane');

    const labelNodesSwitch = document.getElementById('labelNodesSwitch');
    const groupNodeSwitch = document.getElementById('groupNodeSwitch');

    // Home and Refresh buttons
    const onHomeButton = document.getElementById('homeButton');
    const onRefreshButton = document.getElementById('refreshButton');

    // We'll keep track of visible groups here.
    // Initially, we don't know the groups. We'll populate them after we fetch data.
    let visibleGroups = {};

    // Add event listener for labelNodesSwitch to re-render graph
    labelNodesSwitch.addEventListener('change', () => {
        fetchAndRenderGraph(depthSlider.value, searchInput.value.trim());
    });

    // Add event listener for groupNodeSwitch to re-render graph
    groupNodeSwitch.addEventListener('change', () => {
        fetchAndRenderGraph(depthSlider.value, searchInput.value.trim());
    });

    // Define zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.5, 5])
        .on('zoom', (event) => {
            graphGroup.attr('transform', event.transform);
        });

    svg.call(zoom);

    function nodeColor(node) {
        const nodes = node.data.groupType || node.data.type; 
        switch (nodes) {
            case 'Applications': return 'var(--app-nde-clr, #3498DB)';
            case 'People': return 'var(--ppl-nde-clr, #229954)';
            case 'Technology': return 'var(--tech-nde-clr, #C0504D)';
            case 'Data': return 'var(--data-nde-clr, #A5A5A5)';
            case 'Procurements': return 'var(--procure-nde-clr, #F79646)';
            case 'Facilities': return 'var(--fclty-nde-clr, #8064A2)';
            default: return 'var(--home-nde-clr, #2E4053)';
        }
    }    

    svg.attr('width', width).attr('height', height);

    const graphGroup = svg.append('g'); 

    const simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2));

    // Home button: reload the page
    onHomeButton.addEventListener('click', () => {
        location.reload();
    });

    // Refresh button: reset node forces
    onRefreshButton.addEventListener('click', () => {
        resetNodeForces();
    });

    function resetNodeForces() {
        visibleNodes.forEach(d => {
            d.fx = null;
            d.fy = null;
        });
        simulation.alpha(1).restart();
    }

    function fetchAndRenderGraph(depth = depthSlider.value, activeNodeParam = searchInput.value.trim()) {
        const url = `/?depth=${depth}&activeNode=${encodeURIComponent(activeNodeParam)}`;
    
        fetch(url, { headers: { 'Accept': 'application/json' } })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    console.error('Backend error:', data.error);
                    return;
                }
                // Identify groups and create toggles if not done yet
                initializeGroupToggles(data);
                renderGraph(data);
            })
            .catch(error => {
                console.error('Error fetching graph data:', error);
            });
    }

    // Identify unique group types from the hierarchy
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

    function initializeGroupToggles(data) {
        const allGroups = Array.from(getUniqueGroups(data));
    
        // If visibleGroups is empty, initialize it
        if (Object.keys(visibleGroups).length === 0) {
            allGroups.forEach(group => {
                visibleGroups[group] = true; // default all groups to visible
            });
        }
    
        // Select .switches-container
        const switchesContainer = document.querySelector('.switches-container');
        let dynamicTogglesContainer = switchesContainer.querySelector('.dynamic-group-toggles');
    
        if (!dynamicTogglesContainer) {
            dynamicTogglesContainer = document.createElement('div');
            dynamicTogglesContainer.className = 'dynamic-group-toggles';
            switchesContainer.appendChild(dynamicTogglesContainer);
        } else {
            // Clear old toggles if any
            dynamicTogglesContainer.innerHTML = '';
        }
    
        allGroups.forEach(group => {
            const label = document.createElement('label');
            label.className = 'switch';
            
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = visibleGroups[group];
    
            const span = document.createElement('span');
            span.className = 'slider round';
    
            // Create the checkmark image
            const checkImg = document.createElement('img');
            checkImg.src = "/static/images/check.svg";
            checkImg.className = "checkmark";
            checkImg.alt = "Checkmark";
    
            span.appendChild(checkImg);
            
            label.appendChild(input);
            label.appendChild(span);
            label.append(` ${group}`);
    
            dynamicTogglesContainer.appendChild(label);
    
            input.addEventListener('change', () => {
                visibleGroups[group] = input.checked;
                fetchAndRenderGraph(depthSlider.value, searchInput.value.trim());
            });
        });
    }    

    function renderGraph(data) {
        graphGroup.selectAll('*').remove();

        const displayGroupNodes = groupNodeSwitch.checked;
        const displayAssetNodes = labelNodesSwitch.checked;

        // First hide group nodes if necessary
        hideGroupNodes(data, displayGroupNodes);

        // Filter out groups that are toggled off
        filterDataByVisibleGroups(data);

        const root = d3.hierarchy(data);
        const links = root.links();
        const nodes = root.descendants();

        visibleNodes = nodes;

        simulation.nodes(nodes)
            .force("link", d3.forceLink(links).id(d => d.data.name).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2));

        simulation.force("link").links(links);

        const link = graphGroup.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('stroke', linkColor)
            .attr('stroke-width', linkWidth);

        // Identify the active node name
        const activeNodeName = data.name;

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

        const labels = graphGroup.append('g')
            .attr('class', 'labels')
            .selectAll('text')
            .data(nodes)
            .enter().append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', d => shouldHaveCircle(d) ? 5 : 0)
            .attr('fill', 'black')
            .text(d => d.data.name);

        currentActiveNodeName = data.name;

        const foundActiveNode = nodes.find(node => node.data.name === data.name);
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

            graphGroup.selectAll('circle')
                .attr("transform", d => `translate(${d.x},${d.y})`);

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
            // Determine the key used in visibleGroups - could be groupType or type
            const key = child.groupType || child.type;
            if (key && visibleGroups.hasOwnProperty(key)) {
                // If the group/type is toggled off, exclude this node
                if (!visibleGroups[key]) {
                    return false;
                }
            }
            // Recursively filter children
            filterDataByVisibleGroups(child);
            return true;
        });
    }    

    function handleNodeClicked(nodeData) {
        const clickedName = nodeData.name || nodeData.groupType;
        if (!clickedName) {
            console.error('Clicked node has neither name nor groupNode:', nodeData);
            return;
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

    function fitGraphToContainer() {
        width = document.querySelector('.graph-container').clientWidth;
        height = document.querySelector('.graph-container').clientHeight;

        const containerWidth = width;
        const containerHeight = height;

        const nodesBBox = {
            xMin: d3.min(visibleNodes, d => d.x),
            xMax: d3.max(visibleNodes, d => d.x),
            yMin: d3.min(visibleNodes, d => d.y),
            yMax: d3.max(visibleNodes, d => d.y)
        };

        const nodesWidth = nodesBBox.xMax - nodesBBox.xMin;
        const nodesHeight = nodesBBox.yMax - nodesBBox.yMin;

        const scale = Math.min(
            (containerWidth - 2 * graphPadding) / nodesWidth,
            (containerHeight - 2 * graphPadding) / nodesHeight
        );

        const translateX = (containerWidth - nodesWidth * scale) / 2 - nodesBBox.xMin * scale;
        const translateY = (containerHeight - nodesHeight * scale) / 2 - nodesBBox.yMin * scale;

        svg.call(
            zoom.transform,
            d3.zoomIdentity.translate(translateX, translateY).scale(scale)
        );
    }

    function updateDepthSlider() {
        const value = (depthSlider.value - depthSlider.min) / (depthSlider.max - depthSlider.min) * 100;
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

    // Initial fetch
    fetchAndRenderGraph();

    function updateRightContainer(data) {
        rightContainer.html("");

        rightContainer.append("h2")
            .style("background-color", nodeColor({data: {type: data.type}}))
            .html(`${data.name}`);

        rightContainer.append("p")
            .html(`<strong>Type: </strong>${data.type || 'Unknown'}`);

        const description = (data.description || 'No description available').replace(/\n/g, '<br>');
        rightContainer.append("h3").attr("class", "description-header").html("Description");
        rightContainer.append("p").html(description);

        rightContainer.append("h3").attr("class", "dependencies-header").html("Dependencies");

        const groupNodes = (data.children || []).filter(d => d.groupType);

        const desiredOrder = ["Organization", "People", "Technology", "Data", "Applications", "Procurements", "Facilities"];
        groupNodes.sort((a, b) => {
            const indexA = desiredOrder.indexOf(a.groupType);
            const indexB = desiredOrder.indexOf(b.groupType);
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
            createTypeSection(typeNode);
        });

        function createTypeSection(typeNode) {
            const typeSection = rightContainer.append("div")
                .attr("class", "type-section");

            typeSection.append("p")
                .style("background-color", nodeColor({data: {type: typeNode.groupType}}))
                .attr("class", "dependency-type")
                .html(`<strong>${typeNode.groupType}</strong>`)
                .style("cursor", "pointer")
                .on("click", (event) => {
                    const pseudoNodeData = {
                        name: typeNode.groupType,
                        type: typeNode.groupType,
                        description: typeNode.groupType + " Group Node",
                        children: typeNode.children || []
                    };
                    handleNodeClicked(pseudoNodeData);
                });

            const sortedChildren = (typeNode.children || []).slice().sort((a, b) => a.name.localeCompare(b.name));

            sortedChildren.forEach(childNode => {
                createNodeElement(typeSection, childNode);
            });
        }

        function createNodeElement(parentContainer, node) {
            const nodeContainer = parentContainer.append("div")
                .attr("class", "dependency-node-container");

            nodeContainer.append("p")
                .attr("class", "dependency-node")
                .html(`<strong>${node.name}</strong>`)
                .style("cursor", "pointer")
                .on("click", (event) => handleNodeClicked(node));

            nodeContainer.append("div")
                .attr("class", "hover-box")
                .html(node.description ? node.description.replace(/\n/g, '<br>') : 'No description available');
        }
    }
});
