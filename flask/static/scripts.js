const chartSelectionContainer = document.getElementById('chartSelectionContainer');
const detailedChartsContainer = document.getElementById('detailedChartsContainer');
const setupContainer = document.getElementById('setupContainer');
const dataPointsInput = document.getElementById('dataPoints');
const scalePaddings = document.getElementById('scalePaddings');
let updateInterval; // Default interval of 5 seconds, can be adjusted by the user


let availableCharts = {};
let selectedCharts = [];
let chartInstances = {};
let originalPlaceholders = {};
let selectionGrid;
let detailedGrid; 
let previousColors = [];

const $metadata = {
    'input_meter': { 'friendly_name': 'Medidor de Entrada' },
    'q1_converter': { 'friendly_name': 'Conversor Q1' },
    'q2_converter': { 'friendly_name': 'Conversor Q2' },
    'q3_converter': { 'friendly_name': 'Conversor Q3' },
    'q4_converter': { 'friendly_name': 'Conversor Q4' },
    'pv_cell': { 'friendly_name': 'Célula Fotovoltaica' },
    'fields': {
        'voltage_per_phase': { 'friendly_name': 'Tensão (por fase)', 'unit': 'V', 'abbr': 'Vf' },
        'current_per_phase': { 'friendly_name': 'Corrente (por fase)', 'unit': 'A', 'abbr': 'If' },
        'active_power_per_phase': { 'friendly_name': 'Potência Ativa (por fase)', 'unit': 'W', 'abbr': 'Paf' },
        'reactive_power_per_phase': { 'friendly_name': 'Potência Reativa (por fase)', 'unit': 'VAR', 'abbr': 'Qrf' },
        'input_frequency': { 'friendly_name': 'Frequência de Entrada', 'unit': 'Hz', 'abbr': 'F' },
        'line_voltage': { 'friendly_name': 'Tensão de Linha', 'unit': 'V', 'abbr': 'Vl' },
        'line_current': { 'friendly_name': 'Corrente de Linha', 'unit': 'A', 'abbr': 'Il' },
        'line_power': { 'friendly_name': 'Potência de Linha', 'unit': 'W', 'abbr': 'Pl' },
        'supercap_voltage': { 'friendly_name': 'Tensão do Supercapacitor', 'unit': 'V', 'abbr': 'Vsc' },
        'supercap_current': { 'friendly_name': 'Corrente do Supercapacitor', 'unit': 'A', 'abbr': 'Isc' },
        'battery_voltage': { 'friendly_name': 'Tensão da Bateria', 'unit': 'V', 'abbr': 'Vbat' },
        'battery_current': { 'friendly_name': 'Corrente da Bateria', 'unit': 'A', 'abbr': 'Ibat' },
        'pv_voltage': { 'friendly_name': 'Tensão da Célula Fotovoltaica', 'unit': 'V', 'abbr': 'Vpv' },
        'pv_current': { 'friendly_name': 'Corrente da Célula Fotovoltaica', 'unit': 'A', 'abbr': 'Ipv' },
    },
    'phases': {
        'phase_1': { 'friendly_name': 'Fase 1' }, 
        'phase_2': { 'friendly_name': 'Fase 2' }, 
        'phase_3': { 'friendly_name': 'Fase 3' }, 
    }
};
function saveState() {  //broken
    const state = {
        // chartSelectionContainer: chartSelectionContainer.outerHTML,
        // detailedChartsContainer: detailedChartsContainer.outerHTML,
        availableCharts: availableCharts,
        selectedCharts: selectedCharts,
        chartInstances: chartInstances,
        originalPlaceholders: originalPlaceholders,
        selectionGrid: selectionGrid.save(true,false),
        detailedGrid: detailedGrid.save(true,false),
    }

    localStorage.setItem('npeeState', JSON.stringify(state));
    // console.log('State saved:', state);
}

function loadState() { //broken
    const state = JSON.parse(localStorage.getItem('npeeState'));
    if (state) {
        //code
        selectionGrid.removeAll(true);
        detailedGrid.removeAll(true);

        availableCharts = state.selectedCharts;
        selectedCharts = state.selectedCharts;
        chartInstances = state.chartInstances;
        originalPlaceholders = state.originalPlaceholders;
        // chartSelectionContainer.outerHTML = state.chartSelectionContainer;
        // detailedChartsContainer.outerHTML = state.detailedChartsContainer;
        selectionGrid.load(state.selectionGrid);
        detailedGrid.load(state.detailedGrid);
        
        // console.log('State loaded:', state);
    } else {
        console.error('No saved state found.');
    }
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
    // console.log('State reset.');
}

document.getElementById('saveState').addEventListener('click',saveState);
document.getElementById('loadState').addEventListener('click',loadState);
document.getElementById('resetState').addEventListener('click', resetState);
// Modify the document.addEventListener('DOMContentLoaded', function() {...}) to add im_disp element

// Function to calculate power factor
function calculatePowerFactor(activePower, apparentPower) {
    if (apparentPower === 0) return 0;
    return (activePower / apparentPower).toFixed(2);
}

// Function to parse and calculate data from input_meter
function parseInputMeterData(data) {
    const phaseVoltages = data.voltage_per_phase || [];
    const phaseCurrents = data.current_per_phase || [];
    const phaseActivePowers = data.active_power_per_phase || [];
    const phaseReactivePowers = data.reactive_power_per_phase || [];

    // Calculate average phase voltage
    const averagePhaseVoltage = phaseVoltages.reduce((sum, voltage) => sum + voltage, 0) / phaseVoltages.length;

    // Calculate line voltage (sqrt(3) * average phase voltage)
    const lineVoltage = Math.sqrt(3) * averagePhaseVoltage;

    // Calculate total current
    const totalCurrent = phaseCurrents.reduce((sum, current) => sum + Math.abs(current), 0);

    // Calculate total active power
    const totalActivePower = phaseActivePowers.reduce((sum, power) => sum + Math.abs(power), 0);

    // Calculate total reactive power
    const totalReactivePower = phaseReactivePowers.reduce((sum, power) => sum + Math.abs(power), 0);

    // Calculate apparent power
    const apparentPower = Math.sqrt(Math.pow(totalActivePower, 2) + Math.pow(totalReactivePower, 2));

    // Calculate power factor
    const powerFactor = calculatePowerFactor(totalActivePower, apparentPower);

    return {
        voltage: lineVoltage.toFixed(2),
        current: totalCurrent.toFixed(2),
        activePower: (totalActivePower / 1000).toFixed(2), // Convert to kW
        powerFactor: powerFactor,
        frequency: data.input_frequency.toFixed(2)
    };
}

// Function to update the im_disp element
function updateImDisp(data) {
    const parsedData = parseInputMeterData(data);

    const activePowerElement = document.querySelector('#im_disp #active-power');
    const powerFactorElement = document.querySelector('#im_disp #power-factor');
    const voltageElement = document.querySelector('#im_disp #voltage');
    const currentElement = document.querySelector('#im_disp #current');
    const frequencyElement = document.querySelector('#im_disp #frequency');
    const statusElement = document.querySelector('#im_disp #status');

    activePowerElement.textContent = parsedData.activePower;
    powerFactorElement.textContent = 'FP ' + parsedData.powerFactor;
    voltageElement.textContent = parsedData.voltage;
    currentElement.textContent = parsedData.current;
    frequencyElement.textContent = parsedData.frequency;

    const generation = data.pv_voltage * data.pv_current;
    const usage = parsedData.voltage * parsedData.current;

    if (usage < generation) {
        statusElement.textContent = 'Fornecendo à rede';
        statusElement.style.color = '#060';
    } else {
        statusElement.textContent = 'Consumindo da rede';
        statusElement.style.color = '#630';
    }
}

function addToDetailedGrid(item){
    previousColors = [];    //reset unique colors for each new chart.
    const placeholderContent = item.el.querySelector('.grid-stack-item-content');
    const chartId = placeholderContent.getAttribute('data-chart-id').trim(); // Trim to remove any whitespace

    if (!selectedCharts.includes(chartId)) {
        selectedCharts.push(chartId);
        const [collection, chartType, ...chartKeys] = chartId.split('__');
        const chartKey = chartKeys.join('__');
        const maxDataPoints = parseInt(dataPointsInput.value, 10) || 10; // Default to 10 data points if input is invalid

        fetch(`/api/data/${encodeURIComponent(collection)}/${maxDataPoints}`)
            .then(response => response.json())
            .then(data => {
                // Parse and sort the data by datetime in ascending order
                const sortedData = data.sort((a, b) => {
                    const dateA = new Date(a.datetime.$date);
                    const dateB = new Date(b.datetime.$date);
                    return dateA - dateB;
                });

                const labels = sortedData.map(item => new Date(item.datetime.$date).toLocaleTimeString('pt-BR'));
                const flattenedData = sortedData.map(item => flattenObject(item));

                const chartInstance = renderChart(labels, flattenedData, collection, placeholderContent, chartType, chartKey);
                if (chartInstance) {
                    // Store the chart instance
                    chartInstances[chartId] = chartInstance;
                    // console.log(`Chart instance stored for chartId: ${chartId}. Available chart instances:`, Object.keys(chartInstances));
                }
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
    } else {
        console.warn(`Chart ID already exists: ${chartId}`);
    }
    // console.log('Current chart instances:', chartInstances);
}

function removeFromDetailedGrid(item){
    const placeholderContent = item.el.querySelector('.grid-stack-item-content');
    const chartId = placeholderContent.getAttribute('data-chart-id').trim(); // Trim to remove any whitespace

    if (chartInstances[chartId]) {
        chartInstances[chartId].destroy();
        delete chartInstances[chartId];
    }

    const index = selectedCharts.indexOf(chartId);
    if (index !== -1) {
        selectedCharts.splice(index, 1);
    }
    const originalState = originalPlaceholders[chartId];
    if (originalState) {
        placeholderContent.innerHTML = originalState.innerHTML;
        // Restore all attributes
        Array.from(placeholderContent.attributes).forEach(attr => placeholderContent.removeAttribute(attr.name));
        for (const attrName in originalState.attributes) {
            placeholderContent.setAttribute(attrName, originalState.attributes[attrName]);
        }
        delete originalPlaceholders[chartId];
    }
    const gridItemEl = placeholderContent.closest('.grid-stack-item');
    selectionGrid.update(gridItemEl, {w: 1, h: 1});
    selectionGrid.compact('compact', true);    
}

// Modify the document.addEventListener('DOMContentLoaded', function() {...}) to add im_disp element
document.addEventListener('DOMContentLoaded', init);
function init() {
    const setupButton = document.getElementById('setup');
    setupButton.addEventListener('click', function() {
        if (setupContainer.classList.contains('show')) {
            setupContainer.classList.remove('show');
            setupButton.classList.remove('back');
            setupButton.textContent = 'Configurar';
        } else {  
            setupContainer.classList.add('show');
            setupButton.classList.add('back');
            setupButton.textContent = 'OK';
        }
    });
    selectionGrid = GridStack.init({
        cellHeight: 60,
        acceptWidgets: true,
        float: false,
        animate: true,
        removable: false,
        resizable: false,
        margin: '20px',
        draggable: {
            handle: '.grid-stack-item-content'
        },
        columnOpts: {
            breakpointForWindow: false,  // test window vs grid size
            breakpoints: [{w:600, c:2},{w:900, c:3},{w:1200, c:4},{w:1500, c:5},{w:1800, c:6},{w:2100, c:7},{w:2400, c:8}]
        },
    }, chartSelectionContainer);
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
            addToDetailedGrid(item);
        });
    });
    detailedGrid.on('removed', function(event, items) {
        items.forEach(item => {
            removeFromDetailedGrid(item);
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
                            addChartPlaceholder(collection, `Visão Geral`, chartId);
                        }
                        for (const phaseKey in charts.phase) {                          // All values of a single metric type for all phases charts (e.g. 3 voltages)
                            const chartId = `${collection}__phase__${phaseKey}`;
                            addChartPlaceholder(collection, `${phaseKey}`, chartId);
                        }
                        for (const dcKey in charts.dc) {                                // DC charts
                            const chartId = `${collection}__dc__${dcKey}`;
                            addChartPlaceholder(collection, `${dcKey}`, chartId);
                        }
                        for (const phaseOverviewKey in charts.phaseOverview) {           // Phase overview charts (voltage,current,power,etc of a single phase)
                            const chartId = `${collection}__phaseOverview__${phaseOverviewKey}`;
                            phaseName = $metadata.phases[phaseOverviewKey].friendly_name;
                            addChartPlaceholder(collection, `Visão Geral de ${phaseName}`, chartId);
                        }

                        // Add im_disp element if collection is input_meter
                        if (collection === 'input_meter') {
                            createImDispElement();
                        }
                    })
                    .catch(error => console.error(`Erro ao buscar dados da coleção ${collection}:`, error));
            });
        })
        .catch(error => console.error('Erro ao buscar coleções:', error));

    // Add an event listener to the updRate input
    document.getElementById('updRate').addEventListener('input', startUpdateInterval);

    // Add an event listener to the dataPoints input
    document.getElementById('dataPoints').addEventListener('input', function() {
        // Get the new dataPoints value
        const maxDataPoints = parseInt(this.value, 10) || 10;

        // Reset the chart data and labels for each chart instance
        for (const chartId in chartInstances) {
            const chart = chartInstances[chartId];
            resetChartData(chart, maxDataPoints);
        }
    });

    // Start the interval on page load
    startUpdateInterval();
}

// Modify updateCharts to include updates for im_disp
function updateCharts() {
    const activeCollections = new Set();

    // Identify active collections
    selectedCharts.forEach(chartId => {
        const [collection] = chartId.split('__');
        activeCollections.add(collection);
    });

    // Fetch latest data for each active collection
    activeCollections.forEach(collection => {
        fetch(`/api/data/${encodeURIComponent(collection)}/1`)
            .then(response => response.json())
            .then(data => {
                data = data[0]; // Extract the single data point

                // Prepare new label
                //const newLabel = new Date(parseInt(data.datetime.$date.$numberLong)).toLocaleTimeString('pt-BR');
                const newLabel = new Date(data.datetime.$date).toLocaleTimeString('pt-BR');
                // Update each chart associated with this collection
                selectedCharts.forEach(chartId => {
                    if (chartId.startsWith(`${collection}__`)) {
                        const chartInstance = chartInstances[chartId];
                        if (chartInstance) {
                            const chartType = chartId.split('__')[1];
                            const chartKey = chartId.split('__').slice(2).join('__');
                            let newData;

                            // Process data according to chart type using existing extraction functions
                            switch (chartType) {
                                case 'overview':
                                    newData = extractOverviewData([data], {
                                        voltage: 'y-axis-voltage',
                                        current: 'y-axis-current',
                                        power: 'y-axis-power',
                                        reactivePower: 'y-axis-reactivePower',
                                        frequency: 'y-axis-frequency'
                                    });
                                    break;
                                case 'phase':
                                    newData = extractPhaseData([data], chartKey, {
                                        voltage: 'y-axis-voltage',
                                        current: 'y-axis-current',
                                        power: 'y-axis-power',
                                        reactivePower: 'y-axis-reactivePower',
                                        frequency: 'y-axis-frequency'
                                    });
                                    break;
                                case 'dc':
                                    newData = extractDcData([data], chartKey, {
                                        voltage: 'y-axis-voltage',
                                        current: 'y-axis-current',
                                        power: 'y-axis-power',
                                        reactivePower: 'y-axis-reactivePower',
                                        frequency: 'y-axis-frequency'
                                    });
                                    break;
                                case 'phaseOverview':
                                    newData = extractPhaseOverviewData([data], chartKey, {
                                        voltage: 'y-axis-voltage',
                                        current: 'y-axis-current',
                                        power: 'y-axis-power',
                                        reactivePower: 'y-axis-reactivePower',
                                        frequency: 'y-axis-frequency'
                                    });
                                    break;
                                case 'im_disp':
                                    // No need to process for im_disp as it is not a chart
                                    break;
                                default:
                                    console.error(`Tipo de gráfico desconhecido: ${chartType}`);
                                    return;
                            }

                            // Extract the relevant data points based on the chartKey
                            if (newData) {
                                const relevantData = newData.map(dataset => dataset.data[0]);

                                // console.log(`Relevant data for ${chartId}:`, relevantData); // Debug statement

                                // Update the chart with new data
                                // console.log(`Updating chart ${chartId} with new data:`, newLabel, relevantData);
                                addData(chartInstance, newLabel, relevantData);
                            }
                        }
                    }
                });

                // Update im_disp element if collection is input_meter
                if (collection === 'input_meter') {
                    updateImDisp(data);
                }
            })
            .catch(error => console.error(`Erro ao buscar dados da coleção ${collection}:`, error));
    });
}
























// Function to create the im_disp element
function createImDispElement() {
    const imDisp = document.createElement('div');
    imDisp.className = 'grid-stack-item';
    imDisp.setAttribute('gs-w', '1');
    imDisp.setAttribute('gs-h', '1');

    const content = document.createElement('div');
    content.className = 'grid-stack-item-content';
    content.innerHTML = `
        <div id="im_disp">
            <div id="im_W_disp">
                <span id="active-power">...</span> kW  <span class="slash">-</span> <span id="power-factor">FP ...</span>
            </div>
            <div id="im_data_disp">
                <span id="voltage">...</span> V <span class="slash">/</span> <span id="current">...</span> A <span class="slash">/</span> <span id="frequency">...</span> Hz
            </div>
            <div id="status_message">
                <span id="status">...</span>
            </div>
        </div>
    `;
    content.setAttribute('data-chart-id', 'input_meter__im_disp');

    imDisp.appendChild(content);
    selectionGrid.addWidget(imDisp);
}

// Modifique a função addChartPlaceholder para usar os nomes amigáveis
function addChartPlaceholder(collection, title, chartId) {
    const friendlyCollectionName = $metadata[collection]?.friendly_name || collection;
    const placeholder = document.createElement('div');
    placeholder.className = 'grid-stack-item';
    placeholder.setAttribute('gs-w', '1');
    placeholder.setAttribute('gs-h', '1');
    title = $metadata.fields[title]?.friendly_name || title;

    const content = document.createElement('div');
    content.className = 'grid-stack-item-content';
    content.innerHTML = `<div class="placeholder-wrapper"><div class="placeholder-collection-name">${friendlyCollectionName}</div><div class="placeholder-chart-name">${title}</div></div>`;
    content.setAttribute('data-chart-id', chartId);

    placeholder.appendChild(content);
    selectionGrid.addWidget(placeholder);
}

// Function to get the scale type based on the key
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

// Function to flatten an object
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
    let hue, saturation, lightness, r, g, b;
    let color;
    let isUnique = false;
    let attempts = 0;
    const initialThreshold = 300; // Initial threshold for color similarity
    const thresholdStep = 30; // Step to reduce the threshold if no unique color is found
    let threshold = initialThreshold;
    const maxAttempts = 100; // Maximum number of attempts to find a unique color

    while (!isUnique && attempts < maxAttempts) {
        hue = Math.floor(Math.random() * 360); // Random hue value between 0 and 360
        saturation = Math.floor(Math.random() * 40) + 60;
        lightness = Math.floor(Math.random() * 45);

        // Convert HSL to Hex
        color = hslToHex(hue, saturation, lightness);

        // Check if the color is unique enough
        isUnique = previousColors.every(prevColor => {
            const [r1, g1, b1] = hexToRgb(prevColor);
            const [r2, g2, b2] = hexToRgb(color);

            // Calculate the Euclidean distance between the two colors
            const distance = Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);

            return distance >= threshold; // Use the current threshold for comparison
        });

        attempts++;

        // If no unique color is found after a certain number of attempts, reduce the threshold
        if (attempts % 10 === 0 && !isUnique) {
            threshold -= thresholdStep;
            console.warn("Unique color threshold reduced to ",threshold);
        }
        if (attempts == 99) console.warn("No unique colors available anymore.");
    }

    // If no unique color is found after maxAttempts, return a random color with the final threshold
    if (!isUnique) {
        hue = Math.floor(Math.random() * 360);
        saturation = Math.floor(Math.random() * 20) + 80;
        lightness = Math.floor(Math.random() * 60);

        // Convert HSL to Hex
        color = hslToHex(hue, saturation, lightness);
    }

    // Add the new color to the list of previous colors
    previousColors.push(color);

    // Limit the number of stored colors to avoid excessive memory usage
    if (previousColors.length > 100) {
        previousColors.shift();
    }

    return color;
}

function hexToRgb(hex) {
    let bigint = parseInt(hex.slice(1), 16);
    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;
    return [r, g, b];
}

function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    let a = s * Math.min(l, 1 - l);
    let f = (n, k = (n + h / 30) % 12) => l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    let r = Math.round(255 * f(0));
    let g = Math.round(255 * f(8));
    let b = Math.round(255 * f(4));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
function extractOverviewData(data, scaleIds) {
    const datasets = [];
    const firstItem = data[0];
    const hasMultiplePoints = data.length > 1; // Check if there are multiple data points

    for (const key in firstItem) {
        if (key !== '_id' && key !== 'datetime' && key !== '_id.$oid' && key !== 'datetime.$date') {
            const scaleType = getScaleType(key);
            let scaleId = scaleIds[scaleType];

            // Handle power and reactive power by dividing by 1000 and using the same scale ID
            if (scaleType === 'power' || scaleType === 'reactivePower') {
                scaleId = 'y-axis-power-reactivePower';
            }

            let color = hasMultiplePoints ? getRandomColor() : null; // Assign color only if there are multiple points

            if (Array.isArray(firstItem[key])) {
                // Calculate average for each array field
                const averageData = data.map(item => {
                    const sum = item[key].reduce((acc, val) => acc + val, 0);
                    return sum / item[key].length;
                });
                const dataset = {
                    label: $metadata.fields[key]?.friendly_name || key + ` Média`,  //não funciona com Q1, mas é o que tem pra hoje. Q1 não funciona com muita coisa mesmo.
                    data: averageData.map(value => (scaleType === 'power' || scaleType === 'reactivePower') ? value / 1000 : value),
                    borderColor: color,
                    backgroundColor: color ? color + "16" : null,
                    fill: ((scaleType === 'power' || scaleType === 'reactivePower') ? true : false),
                    yAxisID: scaleId,
                    tension: 0.5,
                    pointRadius: 2,
                    pointBackgroundColor: color ? color + "80" : null
                };
                datasets.push(dataset);
            } else {
                const dataset = {
                    label: key,
                    data: data.map(item => (scaleType === 'power' || scaleType === 'reactivePower') ? item[key] / 1000 : item[key]),
                    borderColor: color,
                    backgroundColor: color ? color + "0a" : null,
                    fill: ((scaleType === 'power' || scaleType === 'reactivePower') ? true : false),
                    yAxisID: scaleId,
                    tension: 0.5,
                    pointRadius: 2,
                    pointBackgroundColor: color ? color + "80" : null
                };
                datasets.push(dataset);
            }
        }
    }
    // console.log('extractOverviewData:', datasets); // Debug statement
    return datasets;
}


function extractPhaseData(data, phaseKey, scaleIds) {
    const datasets = [];
    const firstItem = data[0];
    const hasMultiplePoints = data.length > 1; // Check if there are multiple data points

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
                        let color = hasMultiplePoints ? getRandomColor() : null; // Assign color only if there are multiple points
                        const dataset = {
                            label: phase,
                            data: data.map(item => (scaleType === 'power' || scaleType === 'reactivePower') ? item[key][phaseIndex] / 1000 : item[key][phaseIndex]),
                            borderColor: color,
                            backgroundColor: color + "16",
                            fill: ((scaleType === 'power' || scaleType === 'reactivePower') ? true : false),
                            yAxisID: scaleId,
                            tension: 0.5,
                            pointRadius: 2,
                            pointBackgroundColor: color +"80"
                        };
                        datasets.push(dataset);
                    });
                }
            }
        }
    }
    // console.log('extractPhaseData:', datasets); // Debug statement
    return datasets;
}

function extractDcData(data, dcKey, scaleIds) {
    const datasets = [];
    const firstItem = data[0];
    const hasMultiplePoints = data.length > 1; // Check if there are multiple data points
    for (const key in firstItem) {
        if (key !== '_id' && key !== 'datetime' && key !== '_id.$oid' && key !== 'datetime.$date.$numberLong') {
            const parts = key.split('.');
            if (parts.length > 1 && parts[0].startsWith('dc')) {
                const dcPart = parts[0];
                if (dcPart === dcKey) {
                    let color = hasMultiplePoints ? getRandomColor() : null; // Assign color only if there are multiple points
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
                        backgroundColor: color + "16",
                        fill: ((scaleType === 'power' || scaleType === 'reactivePower') ? true : false),
                        yAxisID: scaleId,
                        tension: 0.5,
                        pointRadius: 2,
                        pointBackgroundColor: color +"80"
                    };
                    datasets.push(dataset);
                }
            }
        }
    }
    // console.log('extractDcData:', datasets); // Debug statement
    return datasets;
}

function extractPhaseOverviewData(data, phaseKey, scaleIds) {   //nomes amigáveis alterados aqui em vez de em render, sem tempo para ajustar:
    const datasets = [];
    const firstItem = data[0];
    const hasMultiplePoints = data.length > 1; // Check if there are multiple data points
    for (const key in firstItem) {
        if (key !== '_id' && key !== 'datetime' && key !== '_id.$oid' && key !== 'datetime.$date.$numberLong') {
            if (Array.isArray(firstItem[key])) {
                const phaseIndex = phaseKey.split('_').pop() - 1;

                const scaleType = getScaleType(key);
                let scaleId = scaleIds[scaleType];

                if (scaleType === 'power' || scaleType === 'reactivePower') {
                    scaleId = 'y-axis-power-reactivePower';
                }
                let color = hasMultiplePoints ? getRandomColor() : null; // Assign color only if there are multiple points
                const dataset = {
                    label: $metadata.fields[key]?.friendly_name || key,
                    data: data.map(item => (scaleType === 'power' || scaleType === 'reactivePower') ? item[key][phaseIndex] / 1000 : item[key][phaseIndex]),
                    borderColor: color,
                    backgroundColor: color + "16",
                    fill: ((scaleType === 'power' || scaleType === 'reactivePower') ? true : false),
                    yAxisID: scaleId,
                    tension: 0.5,
                    pointRadius: 2,
                    pointBackgroundColor: color +"80"
                };
                datasets.push(dataset);
            }
        }
    }
    return datasets;
}

function renderChart(labels, data, collection, container, chartType, chartKey) {
    const scaleIds = {
        voltage: 'y-axis-voltage',
        current: 'y-axis-current',
        power: 'y-axis-power',
        reactivePower: 'y-axis-reactivePower',
        frequency: 'y-axis-frequency'
    };

    let datasets;
    let title;
    switch (chartType) {
        case 'overview':
            datasets = extractOverviewData(data, scaleIds);
            title = `Visão Geral (${$metadata[collection]?.friendly_name || collection})`;
            // maybe change to abbr for legends
            datasets.forEach(dataset => {
                dataset.label = $metadata.fields[dataset.label]?.friendly_name || dataset.label;
            });
            break;
        case 'phase':
            datasets = extractPhaseData(data, chartKey, scaleIds);
            title = `${$metadata.fields[chartKey]?.friendly_name || chartKey} (${$metadata[collection]?.friendly_name || collection})`;
            // Use "Fase X" for labels
            datasets.forEach((dataset, index) => {
                dataset.label = `Fase ${index + 1}`;
            });
            break;
        case 'dc':
            datasets = extractDcData(data, chartKey, scaleIds);
            title = `Componente DC (${$metadata[collection]?.friendly_name || collection}) - ${chartKey}`;
            break;
        case 'phaseOverview':
            datasets = extractPhaseOverviewData(data, chartKey, scaleIds);
            title = `Visão Geral de (${$metadata[collection]?.friendly_name || collection}) - ${chartKey}`;
            // Use friendly names for labels
            datasets.forEach(dataset => {
                dataset.label = $metadata.fields[dataset.label]?.friendly_name || dataset.label;
            });
            break;
        default:
            console.error(`Tipo de gráfico desconhecido: ${chartType}`);
            title = '';
            return null;
    }


    const scaleData = {};
    datasets.forEach(dataset => {
        const scaleId = dataset.yAxisID;
        if (!scaleData[scaleId]) {
            scaleData[scaleId] = [];
        }
        scaleData[scaleId] = scaleData[scaleId].concat(dataset.data.map(Number));
    });

    const globalScales = {};

    const chartCanvas = document.createElement('canvas');
    container.innerHTML = ''; // Clear previous content
    container.appendChild(chartCanvas);

    // Collect all data values for each scale type
    datasets.forEach(dataset => {
        const scaleId = dataset.yAxisID;
        if (!scaleData[scaleId]) {
            scaleData[scaleId] = [];
        }
        scaleData[scaleId] = scaleData[scaleId].concat(dataset.data.map(Number));
    });

    // Determine global min and max for each scale type
    for (const scaleId in scaleData) {
        const dataValues = scaleData[scaleId];
        const min = Math.min(...dataValues);
        const max = Math.max(...dataValues);

        const padding = (max - min) * scalePaddings.value;
        const suggestedMin = min >= 0 ? 0 : min - padding;
        const suggestedMax = (scaleId.includes('frequency'))?75:(max + padding);

        // Abbreviate scale unit legends - this works but scale location is still broken.
        let scaleTitle = '';
        if (scaleId.includes('voltage')) {
            scaleTitle = 'Tensão (V)';
        } else if (scaleId.includes('current')) {
            scaleTitle = 'Corrente (A)';
        } else if (scaleId.includes('power')) {
            scaleTitle = 'Potência (ativa ou reativa) (kW/kVAr)';
        } else if (scaleId.includes('reactivePower')) {
            scaleTitle = 'Potência (ativa ou reativa) (kW/kVAr)';
        } else if (scaleId.includes('frequency')) {
            scaleTitle = 'Frequência (Hz)';
        }

        globalScales[scaleId] = {
            type: 'linear',
            position: scaleId.includes('voltage') || scaleId.includes('current') ? 'left' : 'right',
            min: suggestedMin,
            max: suggestedMax,
            title: {
                display: true, // Disable default title display
                text: scaleTitle, 
                font: {
                    size: 13,
                    weight: '300',
                    family: '"Inter Tight", "Arial", system-ui, sans-serif',
                }
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
                        padding: 10,
                        usePointStyle: true,
                        pointStyle: 'circle'                     
                    }
                },
                title: {
                    display: true,
                    text: title || '',
                    font: {
                        size: 15,
                        weight: 'normal',
                        family: '"Inter Tight", "Arial", system-ui, sans-serif',
                    }
                }
            },
            scales: filteredScales, // Use the filtered scales
            elements: {
                line: {
                    tension: 0.5,
                    pointRadius: 2,
                    // pointBackgroundColor: color +"80"
                }
            }
        }
    });
}
// Function to add data to the chart
function addData(chart, label, newData) {
    // console.log(`Adding data to chart:`, label, newData);

    const maxDataPoints = parseInt(dataPointsInput.value, 10) || 10; // Default to 10 data points if input is invalid

    // Add new label if it's not already the last label in the chart's labels array
    if (chart.data.labels.length === 0 || chart.data.labels[chart.data.labels.length - 1] !== label) {
        chart.data.labels.push(label);
    }

    // Ensure the number of labels matches the number of data points in each dataset
    if (chart.data.labels.length > maxDataPoints) {
        chart.data.labels.shift(); // Remove the oldest label
    }

    // Update each dataset
    newData.forEach((dataPoint, index) => {
        if (chart.data.datasets[index]) {
            // Ensure the number of data points in the dataset matches the number of labels
            if (chart.data.datasets[index].data.length >= maxDataPoints) {
                chart.data.datasets[index].data.shift(); // Remove the oldest data point
            }

            chart.data.datasets[index].data.push(dataPoint);
        }
    });

    chart.update();
}

// Function to reset the chart data and labels based on the new dataPoints value
function resetChartData(chart, maxDataPoints) {
    // Keep only the last `maxDataPoints` labels
    chart.data.labels = chart.data.labels.slice(-maxDataPoints);

    // Keep only the last `maxDataPoints` data points in each dataset
    chart.data.datasets.forEach(dataset => {
        dataset.data = dataset.data.slice(-maxDataPoints);
    });

    chart.update("none");
}

// Function to start or restart the interval
function startUpdateInterval() {
    const updRateInput = document.getElementById('updRate');
    const rate = parseFloat(updRateInput.value) || 5; // Default to 5 seconds if input is invalid

    // Clear the previous interval if it exists
    if (updateInterval) {
        clearInterval(updateInterval);
    }

    // Set a new interval
    updateInterval = setInterval(updateCharts, rate * 1000);
}

//converter para https://nagix.github.io/chartjs-plugin-streaming/master/samples/charts/line-horizontal.html posteriormente.
//exibir