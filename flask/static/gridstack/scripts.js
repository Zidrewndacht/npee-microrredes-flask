const chartSelectionContainer = document.getElementById('chartSelectionContainer');
const detailedChartsContainer = document.getElementById('detailedChartsContainer');
const setupContainer = document.getElementById('setupContainer');

let availableCharts = {};
let selectedCharts = [];
let chartInstances = {};
let originalPlaceholders = {};
let selectionGrid;
let detailedGrid; 

function saveState() {  //broken
    // const state = {
    //     // chartSelectionContainer: chartSelectionContainer.outerHTML,
    //     // detailedChartsContainer: detailedChartsContainer.outerHTML,
    //     availableCharts: availableCharts,
    //     selectedCharts: selectedCharts,
    //     chartInstances: chartInstances,
    //     originalPlaceholders: originalPlaceholders,
    //     selectionGrid: selectionGrid.save(true,false),
    //     detailedGrid: detailedGrid.save(true,false),
    // }

    // localStorage.setItem('npeeState', JSON.stringify(state));
    // console.log('State saved:', state);
}

function loadState() { //broken
    // const state = JSON.parse(localStorage.getItem('npeeState'));
    // if (state) {
    //     //code
    //     selectionGrid.removeAll(true);
    //     detailedGrid.removeAll(true);

    //     availableCharts = state.selectedCharts;
    //     selectedCharts = state.selectedCharts;
    //     chartInstances = state.chartInstances;
    //     originalPlaceholders = state.originalPlaceholders;
    //     // chartSelectionContainer.outerHTML = state.chartSelectionContainer;
    //     // detailedChartsContainer.outerHTML = state.detailedChartsContainer;
    //     selectionGrid.load(state.selectionGrid);
    //     detailedGrid.load(state.detailedGrid);
        
    //     console.log('State loaded:', state);
    // } else {
    //     console.error('No saved state found.');
    // }
}

function resetState() {
    chartSelectionContainer.innerHTML = "";
    detailedChartsContainer.innerHTML = "";

    selectionGrid.destroy(false);
    detailedGrid.destroy(false);

    availableCharts = {};
    selectedCharts = [];
    chartInstances = {};
    originalPlaceholders = {};
    init();
    console.log('State reset.');
}

document.getElementById('saveState').addEventListener('click',saveState);
document.getElementById('loadState').addEventListener('click',loadState);
document.getElementById('resetState').addEventListener('click', resetState);

document.addEventListener('DOMContentLoaded', function() {
    const setupButton = document.getElementById('setup');

    setupButton.addEventListener('click', function() {
        if (setupContainer.classList.contains('show')) {            // Hide the chartSelection grid
            setupContainer.classList.remove('show');
            setupButton.textContent = 'Configurar';
        } else {                                                    // Show the chartSelection grid
            setupContainer.classList.add('show');
            setupButton.textContent = 'Voltar';
        }
    });

    init();
});

//This is used to populate the selection grid:
//collection may be used to set placeholder color later
function addChartPlaceholder(collection, title, chartId) {
    const placeholder = document.createElement('div');
    placeholder.className = 'grid-stack-item';
    placeholder.setAttribute('gs-w', '1');
    placeholder.setAttribute('gs-h', '1');

    const content = document.createElement('div');
    content.className = 'grid-stack-item-content';
    content.textContent = title;
    content.setAttribute('data-chart-id', chartId);

    placeholder.appendChild(content);
    selectionGrid.makeWidget(placeholder);
}

function init(){
    // Initialize GridStack for chart selection
    selectionGrid = GridStack.init({
        cellHeight: 50,
        acceptWidgets: true,
        float: false,
        animate: true,
        removable: false,
        resizable: false,
        column: 4,
        margin: '20px',
        draggable: {
            handle: '.grid-stack-item-content'
        }
    }, chartSelectionContainer);

    // Ensure all items in selectionGrid are not resizable or floatable
    selectionGrid.on('added', function(event, items) {
        items.forEach(item => {
            const gridItemEl = item.el;
            selectionGrid.resizable(gridItemEl, false);
            selectionGrid.float(gridItemEl, false);
            selectionGrid.compact('compact', doSort = true);
        });
    });

    selectionGrid.on('removed', function(event, items) {
        items.forEach(item => {
            selectionGrid.compact('compact', doSort = true);
        });
    });

    // Initialize GridStack for detailed charts
    detailedGrid = GridStack.init({
        cellHeight: '25%',
        minRow: 4,
        maxRow: 4,
        column: 8,
        margin: '20px',
        acceptWidgets: true, // Accept widgets from other grids
        float: true,
        animate: true,
        removable: false,
        resizable: false,
        resizable: {
            handles: 'se' // Enable resizing from the bottom-right corner
        }
    }, detailedChartsContainer);

    detailedGrid.on('added', function(event, items) {
        items.forEach(item => {
            const placeholderContent = item.el.querySelector('.grid-stack-item-content');
            const chartId = placeholderContent.getAttribute('data-chart-id').trim(); // Trim to remove any whitespace

            if (!selectedCharts.includes(chartId)) {
                selectedCharts.push(chartId);
                const [collection, chartType, ...chartKeys] = chartId.split('__');
                const chartKey = chartKeys.join('__');

                fetch(`/api/data/${encodeURIComponent(collection)}/10`) // Fetch 10 data points for rendering
                    .then(response => response.json())
                    .then(data => {
                        // Parse and sort the data by datetime in ascending order
                        const sortedData = data.sort((a, b) => {
                            const dateA = new Date(parseInt(a.datetime.$date.$numberLong));
                            const dateB = new Date(parseInt(b.datetime.$date.$numberLong));
                            return dateA - dateB;
                        });

                        const labels = sortedData.map(item => new Date(parseInt(item.datetime.$date.$numberLong)).toLocaleTimeString('pt-BR'));
                        const flattenedData = sortedData.map(item => flattenObject(item));

                        let chartInstance;
                        switch (chartType) {
                            case 'overview':
                                chartInstance = renderOverviewChart(labels, flattenedData, collection, placeholderContent);
                                break;
                            case 'phase':
                                chartInstance = renderPhaseChart(labels, flattenedData, chartKey, collection, placeholderContent);
                                break;
                            case 'dc':
                                chartInstance = renderDcChart(labels, flattenedData, chartKey, collection, placeholderContent);
                                break;
                            case 'phaseOverview':
                                chartInstance = renderPhaseOverviewChart(labels, flattenedData, chartKey, collection, placeholderContent);
                                break;
                            default:
                                console.error(`Tipo de gráfico desconhecido: ${chartType}`);
                        }
                        // Store the chart instance
                        chartInstances[chartId] = chartInstance;
                        console.log(`Chart instance stored for chartId: ${chartId}. Available chart instances:`, Object.keys(chartInstances));
                    })
                    .catch(error => console.error(`Erro ao buscar dados da coleção ${collection}:`, error));

                // Store the original placeholder innerHTML and attributes
                originalPlaceholders[chartId] = {
                    innerHTML: placeholderContent.innerHTML,
                    attributes: Array.from(placeholderContent.attributes).reduce((acc, attr) => {
                        acc[attr.name] = attr.value;
                        return acc;
                    }, {})
                };

                // Set the new size for the grid item
                const gridItemEl = placeholderContent.closest('.grid-stack-item');
                detailedGrid.update(gridItemEl, {w: 4, h: 2});
                detailedGrid.resizable(gridItemEl, true);
                detailedGrid.float(gridItemEl, true);
            }
        });
    });

    // Add event listener for when items are removed from detailedGrid
    detailedGrid.on('removed', function(event, items) {
        items.forEach(item => {
            const placeholderContent = item.el.querySelector('.grid-stack-item-content');
            const chartId = placeholderContent.getAttribute('data-chart-id').trim(); // Trim to remove any whitespace

            // Remove the chart instance from the store
            if (chartInstances[chartId]) {
                chartInstances[chartId].destroy();
                delete chartInstances[chartId];
            }

            // Remove the chartId from selectedCharts
            const index = selectedCharts.indexOf(chartId);
            if (index !== -1) {
                selectedCharts.splice(index, 1);
            }

            // Revert the element to its original placeholder state
            const originalState = originalPlaceholders[chartId];
            if (originalState) {
                placeholderContent.innerHTML = originalState.innerHTML;
                // Restore all attributes
                Array.from(placeholderContent.attributes).forEach(attr => placeholderContent.removeAttribute(attr.name));
                for (const attrName in originalState.attributes) {
                    placeholderContent.setAttribute(attrName, originalState.attributes[attrName]);
                }
                // Remove the original state from the store
                delete originalPlaceholders[chartId];
            }

            // Set the size back to the original placeholder size
            const gridItemEl = placeholderContent.closest('.grid-stack-item');
            selectionGrid.update(gridItemEl, {w: 1, h: 1});
            selectionGrid.compact('compact', true);
        });
    });

    fetch('/api/collections')   //used to fetch a single datapoint from every collection to parse the schema:
        .then(response => response.json())
        .then(collections => {
            selectionGrid.removeAll(true);
            collections.forEach(collection => {
                fetch(`/api/data/${encodeURIComponent(collection)}/1`)
                    .then(response => response.json())
                    .then(data => {
                        const charts = {
                            overview: [],
                            phase: {},
                            dc: {},
                            phaseOverview: {}
                        };

                        //Determine available charts based on fetched data schema:
                        for (const key in data[0]) {
                            if (key !== '_id' && key !== 'datetime') {
                                if (Array.isArray(data[0][key])) { // Handle arrays by creating a dataset for each phase
                                    data[0][key].forEach((_, phaseIndex) => {
                                        const phaseKey = `${key}_phase_${phaseIndex + 1}`;
                                        if (!charts.phase[key]) {
                                            charts.phase[key] = [];
                                        }
                                        charts.phase[key].push(phaseKey);

                                        // Group phase data for phase overview charts
                                        const phaseOverviewKey = `phase_${phaseIndex + 1}`;
                                        if (!charts.phaseOverview[phaseOverviewKey]) {
                                            charts.phaseOverview[phaseOverviewKey] = {};
                                        }
                                        charts.phaseOverview[phaseOverviewKey][key] = true;
                                    });
                                } else { // Handle non-array fields
                                    const parts = key.split('.');
                                    if (parts.length > 1 && parts[0].startsWith('dc')) {
                                        const dcKey = parts[0];
                                        if (!charts.dc[dcKey]) {
                                            charts.dc[dcKey] = [];
                                        }
                                        charts.dc[dcKey].push(key);
                                    } else {
                                        charts.overview.push(key);
                                    }
                                }
                            }
                        }

                        //Create placeholders / chart selection grid elements:
                        if (charts.overview.length > 0) {                               // Overview charts
                            const chartId = `${collection}__overview`;
                            addChartPlaceholder(collection, `Visão Geral (${collection})`, chartId);
                        }
                        for (const phaseKey in charts.phase) {                          // All values of a single metric type for all phases charts (e.g. 3 voltages)
                            const chartId = `${collection}__phase__${phaseKey}`;
                            addChartPlaceholder(collection, `${phaseKey} (${collection})`, chartId);
                        }
                        for (const dcKey in charts.dc) {                                // DC charts
                            const chartId = `${collection}__dc__${dcKey}`;
                            addChartPlaceholder(collection, `${dcKey} (${collection})`, chartId);
                        }
                        for (const phaseOverviewKey in charts.phaseOverview) {           // Phase overview charts (voltage,current,power,etc of a single phase)
                            const chartId = `${collection}__phaseOverview__${phaseOverviewKey}`;
                            addChartPlaceholder(collection, `Visão Geral de ${phaseOverviewKey} (${collection})`, chartId);
                        }
                    })
                    .catch(error => console.error(`Erro ao buscar dados da coleção ${collection}:`, error));
            });
        })
        .catch(error => console.error('Erro ao buscar coleções:', error));
}


//This is called by the render*Chart() functions:
function createChart(container, labels, datasets, options = {}, scales = {}) {
    const chartCanvas = document.createElement('canvas');
    container.innerHTML = ''; // Clear previous content
    container.appendChild(chartCanvas);

    // Collect all data values for each scale type
    const scaleData = {};
    datasets.forEach(dataset => {
        const scaleId = dataset.yAxisID;
        if (!scaleData[scaleId]) {
            scaleData[scaleId] = [];
        }
        scaleData[scaleId] = scaleData[scaleId].concat(dataset.data.map(Number));
    });

    // Determine global min and max for each scale type
    const globalScales = {};
    for (const scaleId in scaleData) {
        const dataValues = scaleData[scaleId];
        const min = Math.min(...dataValues);
        const max = Math.max(...dataValues);

        const padding = (max - min) * 0.1;
        const suggestedMin = min >= 0 ? 0 : min - padding;
        const suggestedMax = max + padding;

        // Abbreviate scale unit legends - this works but scale location is still broken.
        let scaleTitle = '';
        if (scaleId.includes('voltage')) {
            scaleTitle = 'V';
        } else if (scaleId.includes('current')) {
            scaleTitle = 'A';
        } else if (scaleId.includes('power')) {
            scaleTitle = 'kW/kVAr';
        } else if (scaleId.includes('reactivePower')) {
            scaleTitle = 'kW/kVAr';
        } else if (scaleId.includes('frequency')) {
            scaleTitle = 'Hz';
        }

        globalScales[scaleId] = {
            type: 'linear',
            position: scaleId.includes('voltage') || scaleId.includes('current') ? 'left' : 'right',
            min: suggestedMin,
            max: suggestedMax,
            title: {
                display: false, // Disable default title display
                text: scaleTitle
            },
            ticks: {
                beginAtZero: min >= 0
            },
            grid: { drawOnChartArea: scaleId.includes('voltage') }
        };
    }

    // Filter out scales that do not have any datasets associated with them
    // currently this only works on chart creation, not later changes:
    const filteredScales = {};
    for (const scaleId in globalScales) {
        if (scaleData[scaleId] && scaleData[scaleId].length > 0) {
            filteredScales[scaleId] = globalScales[scaleId];
        }
    }
    return new Chart(chartCanvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true, // Use the point style for the legend
                        boxWidth: 10,
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle'                     
                    }
                },
                title: {
                    display: true,
                    text: options.title || ''
                }
            },
            scales: filteredScales, // Use the filtered scales
            elements: {
                line: {
                    tension: 0.33,
                    pointRadius: 1,
                }
            }
        }
    });
}

function getScaleType(key) {
    if (key.includes('voltage')) {
        return 'voltage';
    } else if (key.includes('current')) {
        return 'current';
    } else if (key.includes('power')) {
        return 'power';
    } else if (key.includes('reactive_power')) {
        return 'reactivePower';
    } else if (key.includes('frequency')) {
        return 'frequency';
    }
    return 'default';
}
function renderOverviewChart(labels, data, collection, container) {
    const datasets = [];
    const scales = {};
    const scaleIds = {
        voltage: 'y-axis-voltage',
        current: 'y-axis-current',
        power: 'y-axis-power',
        reactivePower: 'y-axis-reactivePower',
        frequency: 'y-axis-frequency'
    };

    const firstItem = data[0];
    for (const key in firstItem) {
        if (key !== '_id' && key !== 'datetime' && key !== '_id.$oid' && key !== 'datetime.$date.$numberLong') {
            const scaleType = getScaleType(key);
            let scaleId = scaleIds[scaleType];

            // Handle power and reactive power by dividing by 1000 and using the same scale ID
            if (scaleType === 'power' || scaleType === 'reactivePower') {
                scaleId = 'y-axis-power-reactivePower';
            }

            const color = getRandomColor();
            if (Array.isArray(firstItem[key])) {
                // Calculate average for each array field
                const averageData = data.map(item => {
                    const sum = item[key].reduce((acc, val) => acc + val, 0);
                    return sum / item[key].length;
                });
                const dataset = {
                    label: `${key} Média`,
                    data: averageData.map(value => (scaleType === 'power' || scaleType === 'reactivePower') ? value / 1000 : value),
                    borderColor: color,
                    backgroundColor: color,
                    fill: false,
                    yAxisID: scaleId,
                    tension: 0.33
                };
                datasets.push(dataset);
            } else {
                const dataset = {
                    label: key,
                    data: data.map(item => (scaleType === 'power' || scaleType === 'reactivePower') ? item[key] / 1000 : item[key]),
                    borderColor: color,
                    backgroundColor: color,
                    fill: false,
                    yAxisID: scaleId,
                    tension: 0.33
                };
                datasets.push(dataset);
            }
        }
    }

    // Ensure scales are dynamically created based on datasets
    const scaleData = {};
    datasets.forEach(dataset => {
        const scaleId = dataset.yAxisID;
        if (!scaleData[scaleId]) {
            scaleData[scaleId] = [];
        }
        scaleData[scaleId] = scaleData[scaleId].concat(dataset.data.map(Number));
    });

    // Determine global min and max for each scale type
    const globalScales = {};
    for (const scaleId in scaleData) {
        const dataValues = scaleData[scaleId];
        const min = Math.min(...dataValues);
        const max = Math.max(...dataValues);

        const padding = (max - min) * 0.1;
        const suggestedMin = min >= 0 ? 0 : min - padding;
        const suggestedMax = max + padding;

        // Abbreviate scale unit legends
        let scaleTitle = '';
        if (scaleId.includes('voltage')) {
            scaleTitle = 'V';
        } else if (scaleId.includes('current')) {
            scaleTitle = 'A';
        } else if (scaleId.includes('power')) {
            scaleTitle = 'kW/kVAr';
        } else if (scaleId.includes('reactivePower')) {
            scaleTitle = 'kW/kVAr';
        } else if (scaleId.includes('frequency')) {
            scaleTitle = 'Hz';
        }

        globalScales[scaleId] = {
            type: 'linear',
            position: scaleId.includes('voltage') || scaleId.includes('current') ? 'left' : 'right',
            min: suggestedMin,
            max: suggestedMax,
            title: {
                display: true,
                text: scaleTitle
            },
            ticks: {
                beginAtZero: min >= 0
            },
            grid: { drawOnChartArea: scaleId.includes('voltage') }
        };
    }

    // Filter out scales that do not have any datasets associated with them
    const filteredScales = {};
    for (const scaleId in globalScales) {
        if (scaleData[scaleId] && scaleData[scaleId].length > 0) {
            filteredScales[scaleId] = globalScales[scaleId];
        }
    }

    createChart(container, labels, datasets, {
        title: `Visão Geral (${collection})`
    }, filteredScales);
}
function renderPhaseChart(labels, data, phaseKey, collection, container) {
    const datasets = [];
    const scales = {};
    const scaleIds = {
        voltage: 'y-axis-voltage',
        current: 'y-axis-current',
        power: 'y-axis-power',
        reactivePower: 'y-axis-reactivePower',
        frequency: 'y-axis-frequency'
    };

    const firstItem = data[0];
    for (const key in firstItem) {
        if (key !== '_id' && key !== 'datetime' && key !== '_id.$oid' && key !== 'datetime.$date.$numberLong') {
            if (Array.isArray(firstItem[key])) {
                const phaseData = firstItem[key].map((value, index) => `${key}_phase_${index + 1}`);
                if (phaseData.includes(`${phaseKey}_phase_1`)) {
                    phaseData.forEach((phase, phaseIndex) => {
                        const scaleType = getScaleType(phase);
                        let scaleId = scaleIds[scaleType];

                        // Handle power and reactive power by dividing by 1000 and using the same scale ID
                        if (scaleType === 'power' || scaleType === 'reactivePower') {
                            scaleId = 'y-axis-power-reactivePower';
                        }
                        const color = getRandomColor();
                        const dataset = {
                            label: phase,
                            data: data.map(item => (scaleType === 'power' || scaleType === 'reactivePower') ? item[key][phaseIndex] / 1000 : item[key][phaseIndex]),
                            borderColor: color,
                            backgroundColor: color,
                            fill: false,
                            yAxisID: scaleId,
                            tension: 0.33
                        };
                        datasets.push(dataset);
                    });
                }
            }
        }
    }

    // Ensure scales are dynamically created based on datasets
    const scaleData = {};
    datasets.forEach(dataset => {
        const scaleId = dataset.yAxisID;
        if (!scaleData[scaleId]) {
            scaleData[scaleId] = [];
        }
        scaleData[scaleId] = scaleData[scaleId].concat(dataset.data.map(Number));
    });

    // Determine global min and max for each scale type
    const globalScales = {};
    for (const scaleId in scaleData) {
        const dataValues = scaleData[scaleId];
        const min = Math.min(...dataValues);
        const max = Math.max(...dataValues);

        const padding = (max - min) * 0.1;
        const suggestedMin = min >= 0 ? 0 : min - padding;
        const suggestedMax = max + padding;

        // Abbreviate scale unit legends
        let scaleTitle = '';
        if (scaleId.includes('voltage')) {
            scaleTitle = 'V';
        } else if (scaleId.includes('current')) {
            scaleTitle = 'A';
        } else if (scaleId.includes('power')) {
            scaleTitle = 'kW/kVAr';
        } else if (scaleId.includes('reactivePower')) {
            scaleTitle = 'kW/kVAr';
        } else if (scaleId.includes('frequency')) {
            scaleTitle = 'Hz';
        }

        globalScales[scaleId] = {
            type: 'linear',
            position: scaleId.includes('voltage') || scaleId.includes('current') ? 'left' : 'right',
            min: suggestedMin,
            max: suggestedMax,
            title: {
                display: true,
                text: scaleTitle
            },
            ticks: {
                beginAtZero: min >= 0
            },
            grid: { drawOnChartArea: scaleId.includes('voltage') }
        };
    }

    // Filter out scales that do not have any datasets associated with them
    const filteredScales = {};
    for (const scaleId in globalScales) {
        if (scaleData[scaleId] && scaleData[scaleId].length > 0) {
            filteredScales[scaleId] = globalScales[scaleId];
        }
    }

    createChart(container, labels, datasets, {
        title: `${phaseKey} (${collection})`
    }, filteredScales);
}
function renderDcChart(labels, data, dcKey, collection, container) {
    const datasets = [];
    const scales = {};
    const scaleIds = {
        voltage: 'y-axis-voltage',
        current: 'y-axis-current',
        power: 'y-axis-power',
        reactivePower: 'y-axis-reactivePower',
        frequency: 'y-axis-frequency'
    };

    const firstItem = data[0];
    for (const key in firstItem) {
        if (key !== '_id' && key !== 'datetime' && key !== '_id.$oid' && key !== 'datetime.$date.$numberLong') {
            const parts = key.split('.');
            if (parts.length > 1 && parts[0].startsWith('dc')) {
                const dcPart = parts[0];
                if (dcPart === dcKey) {
                    const color = getRandomColor();
                    const scaleType = getScaleType(key);
                    let scaleId = scaleIds[scaleType];

                    // Handle power and reactive power by dividing by 1000 and using the same scale ID
                    if (scaleType === 'power' || scaleType === 'reactivePower') {
                        scaleId = 'y-axis-power-reactivePower';
                    }

                    const dataset = {
                        label: key,
                        data: data.map(item => (scaleType === 'power' || scaleType === 'reactivePower') ? item[key] / 1000 : item[key]),
                        borderColor: color,
                        backgroundColor: color,
                        fill: false,
                        yAxisID: scaleId,
                        tension: 0.33
                    };
                    datasets.push(dataset);
                }
            }
        }
    }

    // Ensure scales are dynamically created based on datasets
    const scaleData = {};
    datasets.forEach(dataset => {
        const scaleId = dataset.yAxisID;
        if (!scaleData[scaleId]) {
            scaleData[scaleId] = [];
        }
        scaleData[scaleId] = scaleData[scaleId].concat(dataset.data.map(Number));
    });

    // Determine global min and max for each scale type
    const globalScales = {};
    for (const scaleId in scaleData) {
        const dataValues = scaleData[scaleId];
        const min = Math.min(...dataValues);
        const max = Math.max(...dataValues);

        const padding = (max - min) * 0.1;
        const suggestedMin = min >= 0 ? 0 : min - padding;
        const suggestedMax = max + padding;

        // Abbreviate scale unit legends
        let scaleTitle = '';
        if (scaleId.includes('voltage')) {
            scaleTitle = 'V';
        } else if (scaleId.includes('current')) {
            scaleTitle = 'A';
        } else if (scaleId.includes('power')) {
            scaleTitle = 'kW/kVAr';
        } else if (scaleId.includes('reactivePower')) {
            scaleTitle = 'kW/kVAr';
        } else if (scaleId.includes('frequency')) {
            scaleTitle = 'Hz';
        }

        globalScales[scaleId] = {
            type: 'linear',
            position: scaleId.includes('voltage') || scaleId.includes('current') ? 'left' : 'right',
            min: suggestedMin,
            max: suggestedMax,
            title: {
                display: true,
                text: scaleTitle
            },
            ticks: {
                beginAtZero: min >= 0
            },
            grid: { drawOnChartArea: scaleId.includes('voltage') }
        };
    }

    // Filter out scales that do not have any datasets associated with them
    const filteredScales = {};
    for (const scaleId in globalScales) {
        if (scaleData[scaleId] && scaleData[scaleId].length > 0) {
            filteredScales[scaleId] = globalScales[scaleId];
        }
    }

    createChart(container, labels, datasets, {
        title: `Componente DC (${collection}) - ${dcKey}`
    }, filteredScales);
}
function renderPhaseOverviewChart(labels, data, phaseKey, collection, container) {
    const datasets = [];
    const scales = {};
    const scaleIds = {
        voltage: 'y-axis-voltage',
        current: 'y-axis-current',
        power: 'y-axis-power',
        reactivePower: 'y-axis-reactivePower',
        frequency: 'y-axis-frequency'
    };

    const firstItem = data[0];
    for (const key in firstItem) {
        if (key !== '_id' && key !== 'datetime' && key !== '_id.$oid' && key !== 'datetime.$date.$numberLong') {
            if (Array.isArray(firstItem[key])) {
                const phaseIndex = phaseKey.split('_').pop() - 1;

                const scaleType = getScaleType(key);
                let scaleId = scaleIds[scaleType];

                // Handle power and reactive power by dividing by 1000 and using the same scale ID
                if (scaleType === 'power' || scaleType === 'reactivePower') {
                    scaleId = 'y-axis-power-reactivePower';
                }
                const color = getRandomColor();
                const dataset = {
                    label: `${key}_phase_${phaseIndex + 1}`,
                    data: data.map(item => (scaleType === 'power' || scaleType === 'reactivePower') ? item[key][phaseIndex] / 1000 : item[key][phaseIndex]),
                    borderColor: color,
                    backgroundColor: color,
                    fill: false,
                    yAxisID: scaleId,
                    tension: 0.33
                };
                datasets.push(dataset);
            }
        }
    }

    // Ensure scales are dynamically created based on datasets
    const scaleData = {};
    datasets.forEach(dataset => {
        const scaleId = dataset.yAxisID;
        if (!scaleData[scaleId]) {
            scaleData[scaleId] = [];
        }
        scaleData[scaleId] = scaleData[scaleId].concat(dataset.data.map(Number));
    });

    // Determine global min and max for each scale type
    const globalScales = {};
    for (const scaleId in scaleData) {
        const dataValues = scaleData[scaleId];
        const min = Math.min(...dataValues);
        const max = Math.max(...dataValues);

        const padding = (max - min) * 0.1;
        const suggestedMin = min >= 0 ? 0 : min - padding;
        const suggestedMax = max + padding;

        // Abbreviate scale unit legends
        let scaleTitle = '';
        if (scaleId.includes('voltage')) {
            scaleTitle = 'V';
        } else if (scaleId.includes('current')) {
            scaleTitle = 'A';
        } else if (scaleId.includes('power')) {
            scaleTitle = 'kW/kVAr';
        } else if (scaleId.includes('reactivePower')) {
            scaleTitle = 'kW/kVAr';
        } else if (scaleId.includes('frequency')) {
            scaleTitle = 'Hz';
        }

        globalScales[scaleId] = {
            type: 'linear',
            position: scaleId.includes('voltage') || scaleId.includes('current') ? 'left' : 'right',
            min: suggestedMin,
            max: suggestedMax,
            title: {
                display: true,
                text: scaleTitle
            },
            ticks: {
                beginAtZero: min >= 0
            },
            grid: { drawOnChartArea: scaleId.includes('voltage') }
        };
    }

    // Filter out scales that do not have any datasets associated with them
    const filteredScales = {};
    for (const scaleId in globalScales) {
        if (scaleData[scaleId] && scaleData[scaleId].length > 0) {
            filteredScales[scaleId] = globalScales[scaleId];
        }
    }

    createChart(container, labels, datasets, {
        title: `Visão Geral de (${collection}) - ${phaseKey}`
    }, filteredScales);
}
// Function to flatten nested objects
function flattenObject(obj, parentKey = '', result = {}) {
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const newKey = parentKey ? `${parentKey}.${key}` : key;
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                flattenObject(obj[key], newKey, result);
            } else {
                result[newKey] = obj[key];
            }
        }
    }
    return result;
}
function getRandomColor() {
    let hue = Math.floor(Math.random() * 360); // Random hue value between 0 and 360
    let saturation = Math.floor(Math.random() * 30) + 70;
    let lightness = Math.floor(Math.random() * 50);

    // Convert HSL to RGB
    let r, g, b;
    saturation /= 100;
    lightness /= 100;
    let a = saturation * Math.min(lightness, 1 - lightness);
    let f = (n, k = (n + hue / 30) % 12) => lightness - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    r = 255 * f(0);
    g = 255 * f(8);
    b = 255 * f(4);

    // Convert RGB to Hex
    const toHex = (component) => {
        const hex = Math.round(component).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    let color = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    return color;
}