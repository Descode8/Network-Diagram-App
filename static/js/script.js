$(document).ready(function() {
    let width = $('.graph-container')[0].clientWidth;
    let height = $('.graph-container')[0].clientHeight;

    let rootNode = null;
    let activeNode = null;
    let graphData = null;
    let currentActiveNodeName = null;
    let allGroups = [];
    let allChildren = [];
    let nodesDisplayed = [];
    let visibleGroups = {};

    const svg = d3.select('.graph-container svg');
    const activeNodeSize = 5;
    const groupNodeSize = 4;
    const nodeSize = 4;
    const linkWidth = 1;
    let indirectLinkWidth = 1;

    const labelColor = 'var(--label-clr)';
    const linkColor = 'var(--link-clr)';
    const nodeBorderColor = 'var(--nde-bdr-clr)';

    const collapseLeftPane = $('.expand-collapse-buttonLeft');
    let leftPaneIsVisible = true;
    let rightPaneIsVisible = true;
    const collapseRightPane = $('.expand-collapse-buttonRight');

    const depthSlider = $('#depthSlider')[0]; 
    const depthValueLabel = $('#depthValue');

    const searchInput = document.getElementById('searchInput');
    const clearButton = document.getElementById('clearButton');
    const searchButton = document.getElementById('searchButton');
    const failedSearch = document.querySelector('.failed-search'); 
    const rightContainer = d3.select('.right-pane');

    const switchesContainer = document.querySelector('.switches-container');
    const assetNodesSwitch = document.getElementById('assetNodesSwitch');
    const groupNodeSwitch = document.getElementById('groupNodeSwitch');
    const indirectRelationshipNodeSwitch = document.getElementById('indirectRelationshipNodeSwitch');

    const onHomeButton = document.getElementById('homeButton');
    const onRefreshButton = document.getElementById('refreshButton');

    const dropdown = document.createElement('div');
    dropdown.className = 'search-menu';
    searchInput.parentNode.appendChild(dropdown);

    let allNodes = []; // Holds all node names and group types

    // -----------------------------------------------------
    // Left/Right Pane Toggle
    // -----------------------------------------------------
    collapseLeftPane.click(function() {
        if ($('.left-pane').is(':visible')) {
            $('.left-pane').css('display', 'none');
            leftPaneIsVisible = false;
            $('.expand-collapse-buttonLeft').css('transform', 'rotate(180deg)');
            $('.graph-container').css('width', '85vw');
            $('.expand-collapse-buttonLeft').attr('title', 'Expand Left Pane');
        } else {
            if(!rightPaneIsVisible) {
                $('.left-pane').css({'display': 'flex', 'width': '17vw'});
                $('.expand-collapse-buttonLeft').css('transform', 'rotate(0deg)');
                $('.graph-container').css('width', '85vw');
            } else {
                $('.left-pane').css({'display': 'flex', 'width': '17vw'});
                $('.expand-collapse-buttonLeft').css('transform', 'rotate(0deg)');
                $('.graph-container').css('width', '68vw');
                leftPaneIsVisible = true;
            }
            $('.expand-collapse-buttonLeft').attr('title', 'Collapse Left Pane');
        }
        checkBothPanesVisibility(); 
        fitGraphToContainer();
    });

    const rightPane = document.querySelector('.right-pane');
    rightPane.addEventListener('scroll', () => {
        const scrollY = rightPane.scrollTop;
        const offsetValue = -scrollY + 'px';
        document.documentElement.style.setProperty('--scroll-offset', offsetValue);
    });
    
    collapseRightPane.click(function() {
        if ($('.right-pane').is(':visible')) {
            $('.right-pane').css('display', 'none');
            rightPaneIsVisible = false;
            $('.expand-collapse-buttonRight').css('transform', 'rotate(180deg)');
            $('.graph-container').css('width', '83vw');
            $('.expand-collapse-buttonRight').attr('title', 'Expand Right Pane');
        } else {
            if (!leftPaneIsVisible) {
                $('.right-pane').css({'display': 'flex','width': '17vw'});
                $('.expand-collapse-buttonRight').css('transform', 'rotate(0deg)');
                $('.graph-container').css('width', '83vw');
            } else {
                $('.right-pane').css({'display': 'flex','width': '17vw'});
                $('.expand-collapse-buttonRight').css('transform', 'rotate(0deg)');
                $('.graph-container').css('width', '66vw');
                rightPaneIsVisible = true;
            }
            $('.expand-collapse-buttonRight').attr('title', 'Collapse Right Pane');
        }
        checkBothPanesVisibility(); 
        fitGraphToContainer();
    });
    
    function checkBothPanesVisibility() {
        if (!leftPaneIsVisible && !rightPaneIsVisible) {
            $('.graph-container').css('width', '100vw');
        }
    }
    
    // -----------------------------------------------------
    // Search and Clear Buttons
    // -----------------------------------------------------
    searchInput.addEventListener('input', () => {
        var input = searchInput.value.trim();
        var dropdown = document.getElementById('autocompleteSuggestions');
        
        if (input) {
            clearButton.style.display = 'flex'; 
            dropdown.style.display = 'block';
        } else {
            clearButton.style.display = 'none'; 
            dropdown.style.display = 'none';
            dropdown.innerHTML = '';
        }
    });

    clearButton.addEventListener('click', (event) => {
        event.preventDefault();
        searchInput.value = ''; 
        clearButton.style.display = 'none'; 
        var dropdown = document.getElementById('autocompleteSuggestions');
        dropdown.style.display = 'none'; 
        dropdown.innerHTML = ''; 
    });

    function showInvalidSearchMessage(input) {
        failedSearch.style.display = 'block'; 
        if(!input) {
            failedSearch.textContent = 'Please enter a search term';
            return;
        }
        failedSearch.textContent = `${input} does not exist.\nPlease search again.`;
        setTimeout(() => {
            failedSearch.style.display = 'none'; 
            failedSearch.textContent = '';
        }, 3000);
    }

    // -----------------------------------------------------
    // Only push strings into allNodes
    // -----------------------------------------------------
    function populateNodeList(data) {
        function traverse(node) {
            if (typeof node.name === 'string') {
                allNodes.push(node.name);
            }
            if (typeof node.groupType === 'string') {
                allNodes.push(node.groupType);
            }
            if (node.children) {
                node.children.forEach(traverse);
            }
        }
        traverse(data);
        allNodes = [...new Set(allNodes)]; // Remove duplicates
    }

    function searchNode() {
        var input = searchInput.value.trim().toLowerCase();
        if (input) {
            var matchingNode = allNodes.find(node => 
                typeof node === 'string' && node.toLowerCase() === input
            );
            if (matchingNode) {
                fetchAndRenderGraph(depthSlider.value, matchingNode);
            } else {
                showInvalidSearchMessage(searchInput.value);  
            }
        } else {
            showInvalidSearchMessage(searchInput.value);
        }
    }
    
    searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            searchNode();
            dropdown.innerHTML = '';
        }
    });

    searchButton.addEventListener('click', () => {
        searchNode();
        dropdown.innerHTML = '';
    });

    // -----------------------------------------------------
    // Autocomplete
    // -----------------------------------------------------
    searchInput.addEventListener('input', () => {
        var input = searchInput.value.toLowerCase();
        var dropdown = document.getElementById('autocompleteSuggestions');
        dropdown.innerHTML = '';

        if (!input) {
            dropdown.style.display = 'none';
            return;
        }

        var matches = allNodes.filter(item => 
            typeof item === 'string' && item.toLowerCase().includes(input)
        );

        if (matches.length === 0) {
            var noMatch = document.createElement('div');
            noMatch.className = 'autocomplete-suggestions';
            noMatch.textContent = 'No matches found';
            dropdown.appendChild(noMatch);
        } else {
            matches.forEach(match => {
                var item = document.createElement('div');
                item.className = 'autocomplete-suggestions';
                item.textContent = match;
                item.addEventListener('click', () => {
                    searchInput.value = match;
                    searchNode();
                    dropdown.innerHTML = '';
                    dropdown.style.border = 'none';
                });
                dropdown.appendChild(item);
            });
        }
        dropdown.style.display = 'block';
    });

    // Global references
    let currentZoomScale = 1; 
    let nodeSelectionGlobal, linkSelectionGlobal, labelsSelectionGlobal;

    groupNodeSwitch.addEventListener('change', () => {
        resetSimulationForForces();    
        fetchAndRenderGraph(depthSlider.value, searchInput.value.trim());
    });

    assetNodesSwitch.addEventListener('change', () => {
        resetSimulationForForces();
        fetchAndRenderGraph(depthSlider.value, searchInput.value.trim());
    });

    indirectRelationshipNodeSwitch.addEventListener('change', () => {
        resetSimulationForForces();
        fetchAndRenderGraph(depthSlider.value, searchInput.value.trim());
    });

    // -----------------------------------------------------
    // Zoom Behavior
    // -----------------------------------------------------
    const zoom = d3.zoom()
        .scaleExtent([0.5, 10])
        .on('zoom', (event) => {
            var transform = event.transform;
            currentZoomScale = transform.k;

            graphGroup.attr('transform', transform);

            if (nodeSelectionGlobal) {
                nodeSelectionGlobal
                    .attr('r', d => {
                        if (d.data.name === currentActiveNodeName) {
                            return activeNodeSize / currentZoomScale;
                        } else if (d.data.groupType) {
                            return groupNodeSize / currentZoomScale;
                        } else {
                            return nodeSize / currentZoomScale;
                        }
                    })
                    .attr('stroke-width', 1 / currentZoomScale);
            }

            if (linkSelectionGlobal) {
                linkSelectionGlobal
                    .attr('stroke-width', linkWidth / currentZoomScale);
            }

            if (labelsSelectionGlobal) {
                labelsSelectionGlobal
                    .attr('font-size', `${12 / currentZoomScale}px`);
            }
        });

    svg.call(zoom);

    // -----------------------------------------------------
    // Color function
    // -----------------------------------------------------
    function nodeColor(node) {
        let nodes = node.data.groupType || node.data.type;
        switch (nodes) {
            case 'Organization':
                return 'var(--org-nde-clr)' || 'blue';
            case 'Applications':
                return 'var(--app-nde-clr)' || 'purple';
            case 'People':
                return 'var(--ppl-nde-clr)' || 'orange';
            case 'Technology':
                return 'var(--tech-nde-clr)' || 'green';
            case 'Data':
                return 'var(--data-nde-clr)' || 'teal';
            case 'Procurements':
                return 'var(--procure-nde-clr)' || 'pink';
            case 'Facilities':
                return 'var(--fclty-nde-clr)' || 'brown';
            default:
                return 'yellow';
        }
    }

    svg.attr('width', width).attr('height', height);
    const graphGroup = svg.append('g');
    const simulation = d3.forceSimulation();

    onHomeButton.addEventListener('click', () => {
        location.reload();
    });

    onRefreshButton.addEventListener('click', () => {
        shuffleNodeForces();
    });

    function shuffleNodeForces() {
        nodesDisplayed.forEach(d => {
            d.fx = null;
            d.fy = null;
        });
        // Slightly higher alphaDecay => see them re-run the forces
        simulation.alphaDecay(0.01).alpha(1).restart();
    }

    // -----------------------------------------------------
    // Indirect Relationship Handling
    // -----------------------------------------------------
    function findNodeByName(obj, name) {
        if (!obj) return null;
        if (obj.name === name) {
            return obj;
        }
        if (Array.isArray(obj.children)) {
            for (const child of obj.children) {
                const found = findNodeByName(child, name);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    // Whenever we see an indirect relationship referencing a node that isn't present,
    // we create & attach it to the data so the BFS won't skip it.
    function ensureIndirectNodesVisible(data) {
        if (!indirectRelationshipNodeSwitch.checked) return;

        const indirectNodes = getIndirectRelationshipNodes(data);
        indirectNodes.forEach(sourceItem => {
            const sourceNode = findNodeByName(data, sourceItem.name);
            if (!sourceNode) return;

            sourceItem.indirectRelationships.forEach(targetObj => {
                const { name: targetName, type: targetType } = targetObj;
                const targetExists = findNodeByName(data, targetName);

                if (!targetExists) {
                    // Add this new node directly under 'sourceNode'
                    const newIndirectNode = {
                        name: targetName,
                        type: targetType || 'Unknown',
                        description: "Automatically added via indirect relationship",
                        children: []
                    };
                    if (!sourceNode.children) {
                        sourceNode.children = [];
                    }
                    sourceNode.children.push(newIndirectNode);
                }
            });
        });
    }

    // -----------------------------------------------------
    // Fetch & Render
    // -----------------------------------------------------
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
                if (!rootNode) {
                    rootNode = data;
                }
                graphData = data;
    
                // Check if indirect relationships exist
                const hasIndirectRelationships = containsIndirectRelationships(data);
    
                // Show or hide the toggle for indirect relationships
                const indirectSwitch = document.querySelector('.indirectRelationshipSwitch');
                if (hasIndirectRelationships) {
                    indirectSwitch.style.display = 'block';
                } else {
                    indirectSwitch.style.display = 'none';
                }
    
                getAllChildren(data);
                showGroupToggles();
    
                // Process indirect nodes if needed
                if (hasIndirectRelationships) {
                    ensureIndirectNodesVisible(data);
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

    function getAllChildren(data) {
        if (data.children) {
            data.children.forEach(child => {
                allChildren.push(child);
            });
        } else {
            allChildren.push('No Children');
        }
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

    function initializeGroupToggles(data) {
        allGroups = Array.from(getUniqueGroups(data));
        allGroups.sort((a, b) => a.localeCompare(b));
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
            // Skip if group is the same as the active node
            if (group === data.type) {
                return;
            }

            var label = document.createElement('label');
            label.className = 'switch span';
        
            var input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = visibleGroups[group] ?? true;
        
            var span = document.createElement('span');
            span.className = 'slider round';
            span.style.backgroundColor = nodeColor({ data: { groupType: group } });
            span.title = `Toggle ${group} Nodes`;
        
            var checkSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            checkSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            checkSvg.setAttribute("height", "10px");
            checkSvg.setAttribute("width", "10px");
            checkSvg.setAttribute("viewBox", "0 -960 960 960");
            checkSvg.setAttribute("class", "checkmark");

            var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", "M382-200 113-469l97-97 172 173 369-369 97 96-466 466Z");
            path.setAttribute("fill", nodeColor({ data: { groupType: group } }));

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
        simulation.stop();
        simulation.force('charge', null);
        simulation.force('center', null);
        simulation.force('collide', null);
        simulation.force('radial', null);
        simulation.force('circularChildren', null);
    }

    function containsIndirectRelationships(obj) {
        if (obj && typeof obj === 'object') {
            if ('indirectRelationships' in obj) {
                return true;
            }
            for (let key in obj) {
                if (obj.hasOwnProperty(key)) {
                    if (containsIndirectRelationships(obj[key])) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function getIndirectRelationshipNodes(obj, result = []) {
        if (Array.isArray(obj)) {
            obj.forEach(element => getIndirectRelationshipNodes(element, result));
        } else if (obj && typeof obj === 'object') {
            if (obj.hasOwnProperty('indirectRelationships') && Array.isArray(obj.indirectRelationships)) {
                result.push({
                    name: obj.name,
                    indirectRelationships: obj.indirectRelationships
                });
            }
            for (let key in obj) {
                if (obj.hasOwnProperty(key)) {
                    getIndirectRelationshipNodes(obj[key], result);
                }
            }
        }
        return result;
    }

    // -----------------------------------------------------
    // renderGraph
    // -----------------------------------------------------
    function renderGraph(data) {
        graphGroup.selectAll('g.links').remove();
        graphGroup.selectAll('g.nodes').remove();
        graphGroup.selectAll('g.labels').remove();
        graphGroup.selectAll('g.indirectLinks').remove();
    
        currentActiveNodeName = data.name;
    
        var displayGroupNodes = groupNodeSwitch.checked;
        var displayAssetNodes = assetNodesSwitch.checked;
        var displayIndirectRelationship = indirectRelationshipNodeSwitch.checked;
        var hasIndirectRelationships = containsIndirectRelationships(data);

        const isActiveNodeAGroup = (
            (data.groupType && data.groupType === data.name) ||
            (data.type && data.type === data.name)
        );
    
        if (isActiveNodeAGroup && depthSlider.value < 3) { 
            displayGroupNodes = false; 
        } else {
            resetSimulationForForces();
        }
    
        hideGroupNodes(data, displayGroupNodes);
        filterDataByVisibleGroups(data);
    
        const root = d3.hierarchy(data);
        const links = root.links();
        let nodes = root.descendants();
    
        // Filter out the root "group" node if it's literally named the same as the current node
        nodes = nodes.filter(node => {
            return node.data.name !== currentActiveNodeName || !node.data.groupType;
        });
    
        nodesDisplayed = nodes;
    
        const centerX = width / 2;
        const centerY = height / 2;
        nodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / nodes.length;
            const radius = 100;
            node.x = centerX + radius * Math.cos(angle);
            node.y = centerY + radius * Math.sin(angle);
            
            if (node.data.name === data.name) {
                node.x = centerX;
                node.y = centerY;
                node.fx = centerX;
                node.fy = centerY;
            }
        });
    
        simulation
            .nodes(nodes)
            .alpha(0)
            .alphaDecay(0.005)
            .velocityDecay(0.5)
            .force("charge", d3.forceManyBody()
                .strength(-1000)
                .distanceMin(150))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius(50));

        function forceCircularChildren(radius) {
            let nodesByParent = {};
            function force(alpha) {
                Object.values(nodesByParent).forEach(childArr => {
                    if (!childArr.length) return;
                    const parent = childArr[0].parentNode;
                    if (!parent) return;
    
                    const n = childArr.length;
                    childArr.forEach((child, i) => {
                        const angle = (2 * Math.PI / n) * i;
                        const targetX = parent.x + radius * Math.cos(angle);
                        const targetY = parent.y + radius * Math.sin(angle);
                        child.vx += (targetX - child.x) * 0.9 * alpha;
                        child.vy += (targetY - child.y) * 0.9 * alpha;
                    });
                });
            }
            force.initialize = function(ns) {
                nodesByParent = {};
                ns.forEach(node => {
                    const pName = node.data.parent;
                    if (!pName) return;
                    if (!nodesByParent[pName]) {
                        nodesByParent[pName] = [];
                    }
                    nodesByParent[pName].push(node);
                    node.parentNode = ns.find(n => n.data.name === pName);
                });
            };
            return force;
        }
    
        if (displayGroupNodes) {
            simulation
                .force("radial", d3.forceRadial(50, width / 2, height / 2))
                .force("link", d3.forceLink(links)
                    .id(d => d.data.name)
                    .distance(link => {
                        const source = link.source.data.name;
                        if (source === currentActiveNodeName) {
                            return 120;
                        } else if (source !== currentActiveNodeName && depthSlider.value > 2) {
                            return 100;
                        } else {
                            return 50;
                        }
                    })
                );
        } else {
            simulation
                .alpha(0)
                .alphaDecay(0.01)
                .velocityDecay(0.5)
                .force("link", d3.forceLink(links).strength(1)
                    .id(d => d.data.name)
                    .distance(link => {
                        const source = link.source.data.name;
                        return (source === currentActiveNodeName) ? 10 : 0;
                    })
                )
                .force("circularChildren", forceCircularChildren(50))
                .force("collide", d3.forceCollide().radius(15));
        }
    
        if (currentActiveNodeName !== rootNode.name && depthSlider.value == 2) {
            simulation
                .force("radial", null)
                .force("charge", d3.forceManyBody().strength(-1000));
        }
    
        const totalNodes = data.totalNodesDisplayed;
        if (totalNodes >= 2 && totalNodes <= 6) {
            resetSimulationForForces();
            simulation
                .force("radial", null)
                .force("charge", d3.forceManyBody().strength(-1000))
                .force("link", d3.forceLink(links)
                    .id(d => d.data.name)
                    .distance(75)
                );
        }
    
        simulation.force("link").links(links);
    
        const activeNodeName = data.name;
        function shouldHaveCircle(d) {
            if (d.data.name === activeNodeName) return true;
            if (d.data.groupType) return true;
            return displayAssetNodes;
        }
    
        let indirectLinkGroup = graphGroup.select('g.indirectLinks');
        if (indirectLinkGroup.empty()) {
            indirectLinkGroup = graphGroup.append('g').attr('class', 'indirectLinks');
        }
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
    
        let indirectLinks = [];
        if (hasIndirectRelationships && displayIndirectRelationship) {
            const indirectNodes = getIndirectRelationshipNodes(data);
            console.log(indirectNodes);
            indirectNodes.forEach(sourceNode => {
                const source = nodes.find(n => n.data.name === sourceNode.name);
                if (source) {
                    sourceNode.indirectRelationships.forEach(targetObj => {
                        // targetObj has shape { name: 'PO 1', type: 'Procurements' }, for example
                        const found = nodes.find(n => n.data.name === targetObj.name);
                        if (found) {
                            indirectLinks.push({
                                source: source,
                                target: found
                            });
                        }
                    });
                }
            });
        }
    
        let indirectLinkSelection = indirectLinkGroup
            .selectAll('line.indirect-link')
            .data(indirectLinks, d => d.source.data.name + '->' + d.target.data.name);
    
        indirectLinkSelection.exit().remove();
        let indirectLinkEnter = null;
        
        if (groupNodeSwitch.checked) {
            indirectLinkEnter = indirectLinkSelection.enter()
                .append('line')
                .attr('class', 'indirect-link')
                .attr('stroke', 'var(--indirect-link-clr)')
                .attr('stroke-width', indirectLinkWidth)
                .attr('stroke-dasharray', `${indirectLinkWidth}, ${indirectLinkWidth * 5}`);
        } else {
            var linkWidthThin = indirectLinkWidth / 3;
            indirectLinkEnter = indirectLinkSelection.enter()
                .append('line')
                .attr('class', 'indirect-link')
                .attr('stroke', 'var(--indirect-link-clr)')
                .attr('stroke-width', linkWidthThin)
                .attr('stroke-dasharray', `${linkWidthThin}, ${linkWidthThin * 5}`);
        }
    
        indirectLinkSelection = indirectLinkEnter.merge(indirectLinkSelection);
    
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
        linkSelectionGlobal = linkSelection;
    
        let nodeSelection = nodeGroup
            .selectAll('circle.node')
            .data(nodes.filter(shouldHaveCircle), d => d.data.name);
    
        nodeSelection.exit().remove();
    
        let nodeEnter = nodeSelection.enter()
            .append('circle')
            .attr('class', 'node')
            .attr('r', d => {
                if (d.data.name === activeNodeName) {
                    return activeNodeSize;
                } else if (d.data.groupType) {
                    return groupNodeSize;
                } else {
                    return nodeSize;
                }
            })
            .attr('fill', d => nodeColor(d))
            .attr('stroke', nodeBorderColor)
            .on('click', (event, d) => handleNodeClicked(d.data))
            .call(drag(simulation));
    
        nodeSelection = nodeEnter.merge(nodeSelection);
        nodeSelectionGlobal = nodeSelection;
    
        let labelSelection = labelGroup
            .selectAll('text.label')
            .data(nodes, d => d.data.name);
    
        labelSelection.exit().remove();
    
        let labelEnter = labelSelection.enter()
            .append('text')
            .attr('class', 'label')
            .attr('text-anchor', 'middle')
            .attr('fill', labelColor)
            .style('cursor', 'pointer')
            .text(d => d.data.name)
            .on('click', (event, d) => handleNodeClicked(d.data))
            .call(drag(simulation));

        labelSelection = labelEnter.merge(labelSelection);
        labelsSelectionGlobal = labelSelection;
    
        simulation.on('tick', () => {
            indirectLinkSelection
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
    
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
                    const r = getCircleScreenRadius(d);
                    if (d.data.name === currentActiveNodeName) {
                        return d.y - (r + 3);
                    }
                    if (!displayAssetNodes) {
                        return d.y;
                    }
                    return d.y - (r + 3);
                });
    
            if (simulation.alpha() < 0.3) {
                fitGraphToContainer(true);
            }
    
            if (simulation.alpha() < 0.05) {
                simulation.stop();
                fitGraphToContainer();
            }
        });

        // If you want them to spread out again once newly added nodes appear,
        // re‐enable this shuffle if you like:
        // if (displayGroupNodes) {
        //     shuffleNodeForces();
        // }
    
        fitGraphToContainer(true);
        simulation.alpha(0.3).restart();
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
                if (child.name === currentActiveNodeName) {
                    hideGroupNodes(child, displayGroupNodes);
                    flattenedChildren.push(child);
                } else {
                    if (child.children && child.children.length > 0) {
                        child.children.forEach(grandChild => {
                            hideGroupNodes(grandChild, displayGroupNodes);
                        });
                        flattenedChildren.push(...child.children);
                    }
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
            return;
        }
        if (clickedName === currentActiveNodeName) {
            return;
        }
        searchInput.value = clickedName;
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
        node.children.forEach(child => mergeSameGroupNodes(child));
    
        var groupNodesMap = new Map(); 
        var newChildren = [];
    
        for (const child of node.children) {
            if (child.groupType) {
                if (!groupNodesMap.has(child.groupType)) {
                    groupNodesMap.set(child.groupType, child);
                } else {
                    let existing = groupNodesMap.get(child.groupType);
                    existing.children = existing.children.concat(child.children || []);
                }
            } else {
                newChildren.push(child);
            }
        }
        for (const [, groupNode] of groupNodesMap) {
            newChildren.push(groupNode);
        }
        node.children = newChildren;
        return node;
    }

    function fitGraphToContainer(noTransition = false) {
        var containerWidth = document.querySelector('.graph-container').clientWidth;
        var containerHeight = document.querySelector('.graph-container').clientHeight;
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
        let graphPadding;

        if (groupNodeSwitch.checked) {
            if (nonGroupNodes.length > 50) {
                graphPadding = 75;
            } else if (nonGroupNodes.length > 20) {
                graphPadding = 100;
            } else if (nonGroupNodes.length > 5) {
                graphPadding = 225;
            } else if (nonGroupNodes.length <= 5 && nonGroupNodes.length > 3) {
                graphPadding = 275;
            } else if (nonGroupNodes.length <= 3 ) {
                graphPadding = 300;
            } else if (nonGroupNodes.length === 2 ) {
                graphPadding = 400;
            } else {
                graphPadding = 50;
            }
        } else {
            if (nonGroupNodes.length > 50) {
                graphPadding = 75;
            } else if (nonGroupNodes.length > 20) {
                graphPadding = 120;
            } else if (nonGroupNodes.length > 5) {
                graphPadding = 225;
            } else if (nonGroupNodes.length <= 5 && nonGroupNodes.length > 3) {
                graphPadding = 275;
            } else if (nonGroupNodes.length <= 3 ) {
                graphPadding = 300;
            } else if (nonGroupNodes.length === 2 ) {
                graphPadding = 400;
            } else {
                graphPadding = 50;
            }
        }

        if (nodesWidth === 0 && nodesHeight === 0) {
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
        $(depthSlider).css('--value', `${value}%`);
        $(depthValueLabel).text(depthSlider.value);
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
    
    function updateRightContainer(data) {
        rightContainer.html("");
    
        rightContainer
            .append("h2")
            .style("background-color", nodeColor({ data: { type: data.type } }))
            .html(`${data.name}`);
    
        rightContainer
            .append("p")
            .html(`<strong>Type: </strong>${data.type || 'Unknown'}`);
    
        const description = (data.description || 'No description available').replace(/\n/g, '<br>');
        rightContainer
            .append("h3")
            .attr("class", "description-header")
            .html("Description");
        rightContainer
            .append("p")
            .style("text-align", "left")
            .html(description);
    
        rightContainer
            .append("h3")
            .attr("class", "dependencies-header")
            .html("Dependencies");
    
        const displayGroupNodes = groupNodeSwitch.checked;
        const dependencies = data.children || [];
        const desiredOrder = ["Organization", "People", "Technology", "Data"];
    
        if (dependencies.length > 0) {
            if (displayGroupNodes) {
                const groupNodes = dependencies.filter(d => d.groupType);
                const nonGroupNodes = dependencies.filter(d => !d.groupType);
    
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
    
                groupNodes.forEach(groupNode => {
                    createGroupTypeSection(groupNode);
                });
    
                nonGroupNodes.forEach(nonGroupNode => {
                    createNodeElement(rightContainer, nonGroupNode);
                });
    
            } else {
                const dependenciesByType = d3.group(dependencies, d => d.type || "Unknown");
    
                const orderedTypes = Array.from(dependenciesByType.keys()).sort((a, b) => {
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
    
                orderedTypes.forEach(type => {
                    const nodes = dependenciesByType.get(type);
                    rightContainer
                        .append("p")
                        .attr("class", "dependency-type-header")
                        .style("background-color", nodeColor({ data: { type: type } }))
                        .html(type)
                        .style("cursor", "pointer")
                        .on("click", () => {
                            const pseudoNodeData = {
                                name: type,
                                type: type,
                                description: `${type}`,
                                children: nodes
                            };
                            handleNodeClicked(pseudoNodeData);
                        });
    
                    nodes.forEach(node => {
                        createNodeElement(rightContainer, node);
                    });
                });
            }
        } else {
            rightContainer.append("p")
                .attr("class", "no-dependencies")
                .html("No dependencies available.");
        }
    
        function createGroupTypeSection(groupNode) {
            const groupContainer = rightContainer.append("div")
                .attr("class", "type-section");
    
            groupContainer
                .append("p")
                .style("background-color", nodeColor({ data: { type: groupNode.groupType } }))
                .attr("class", "dependency-type-header")
                .html(groupNode.groupType)
                .style("cursor", "pointer")
                .on("click", () => {
                    const pseudoNodeData = {
                        name: groupNode.groupType,
                        type: groupNode.groupType,
                        description: `${groupNode.groupType}`,
                        children: groupNode.children || []
                    };
                    handleNodeClicked(pseudoNodeData);
                });
    
            const sortedChildren = (groupNode.children || []).slice().sort((a, b) => a.name.localeCompare(b.name));
            sortedChildren.forEach(childNode => {
                createNodeElement(groupContainer, childNode);
            });
        }
    
        function createNodeElement(parentContainer, node) {
            const nodeContainer = parentContainer.append("div")
                .attr("class", "dependency-node-container");
    
            nodeContainer.append("p")
                .attr("class", "dependency-node")
                .html(`${node.name}`)
                .style("cursor", "pointer")
                .on("click", () => handleNodeClicked(node));
    
            nodeContainer
                .append("div")
                .attr("class", "tool-tip")
                .html(node.description ? node.description.replace(/\n/g, '<br>') : 'No description available');
        }
    }

    function showGroupToggles() {
        var dynamicTogglesContainer = switchesContainer.querySelector('.dynamic-group-toggles');
        if (dynamicTogglesContainer) {
            dynamicTogglesContainer.style.display = 'block';
        }
    }

    // Kick it off
    fetchAndRenderGraph();
});
