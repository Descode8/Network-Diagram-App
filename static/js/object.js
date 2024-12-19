let data = null; // Global variable to store fetched data

function fetchHierarchy(depth, activeNode) {
    let url = '/';
    if (depth || activeNode) {
        const params = new URLSearchParams();
        if (depth) params.set('depth', depth);
        if (activeNode) params.set('activeNode', activeNode);
        url += `?${params.toString()}`;
    }

    fetch(url, { headers: { 'Accept': 'application/json' }})
        .then(response => response.json())
        .then(fetchedData => {
            data = fetchedData; // Store in global variable

            // Update JSON Display
            document.getElementById('jsonDisplay').textContent = JSON.stringify(data, null, 2);

            // Update the hierarchy title
            const title = `${activeNode || 'OIT'} | ${depth || 2}`;
            document.getElementById('hierarchyTitle').innerHTML = title;

            console.log("Fetched Data:", data);
        })
        .catch(err => console.error("Error fetching data:", err));
}

// On Page Load: Fetch Initial Data
document.addEventListener('DOMContentLoaded', () => {
    fetchHierarchy();

    const updateForm = document.getElementById('updateForm');
    const activeNodeInput = document.getElementById('activeNodeInput');
    const depthInput = document.getElementById('depthInput');

    updateForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newActiveNode = activeNodeInput.value.trim() || null;
        const newDepth = depthInput.value ? parseInt(depthInput.value, 10) : null;
        fetchHierarchy(newDepth, newActiveNode);
    });

    const evaluateBtn = document.getElementById('evaluateBtn');
    const expressionInput = document.getElementById('expressionInput');
    const expressionResult = document.getElementById('expressionResult');

    evaluateBtn.addEventListener('click', () => {
        const expression = expressionInput.value.trim();
        if (!expression || !data) {
            expressionResult.textContent = "Invalid expression or data not loaded.";
            return;
        }

        try {
            const result = eval(expression);
            expressionResult.textContent = `${JSON.stringify(result, null, 2)}`;
        } catch (err) {
            expressionResult.textContent = `Error: ${err.message}`;
        }
    });
});
