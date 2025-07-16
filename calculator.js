// Global variable to store Chart.js instance
let chartInstance = null;

function calculate() {
    // Log to confirm function is called
    console.log('Calculate button clicked');

    // Destroy previous chart if it exists
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    // Retrieve and parse input values
    const initialPrice = parseFloat(document.getElementById('initial_price').value);
    const savingsAmount = parseFloat(document.getElementById('savings_amount').value);
    const frequency = document.getElementById('frequency').value;
    const growth = parseFloat(document.getElementById('growth').value) / 100;
    const startDate = new Date(document.getElementById('start_date').value);
    const endDate = new Date(document.getElementById('end_date').value);
    const purchaseDate = new Date(document.getElementById('purchase_date').value);
    const totalCost = parseFloat(document.getElementById('total_cost').value);
    const downPayment = parseFloat(document.getElementById('down_payment').value);
    const interestRate = parseFloat(document.getElementById('interest_rate').value) / 100;
    const loanTerm = parseInt(document.getElementById('loan_term').value);

    // Enhanced validation
    const resultDiv = document.getElementById('result');
    if (isNaN(initialPrice) || isNaN(savingsAmount) || isNaN(growth) || isNaN(totalCost) ||
        isNaN(downPayment) || isNaN(interestRate) || isNaN(loanTerm)) {
        resultDiv.innerHTML = '<p style="color: red;">Error: All numeric inputs must be valid numbers.</p>';
        console.error('Validation failed: Invalid numeric inputs');
        return;
    }
    if (initialPrice <= 0 || savingsAmount < 0 || totalCost <= 0 || downPayment < 0 || interestRate < 0 || loanTerm <= 0) {
        resultDiv.innerHTML = '<p style="color: red;">Error: Numeric inputs must be non-negative, and initial price/loan term must be positive.</p>';
        console.error('Validation failed: Negative or zero inputs');
        return;
    }
    if (endDate < startDate || purchaseDate < endDate) {
        resultDiv.innerHTML = '<p style="color: red;">Error: Ensure Savings End Date is after Start Date, and Purchase Date is after End Date.</p>';
        console.error('Validation failed: Invalid date order');
        return;
    }
    if (downPayment > totalCost) {
        resultDiv.innerHTML = '<p style="color: red;">Error: Down payment cannot exceed total cost.</p>';
        console.error('Validation failed: Down payment exceeds total cost');
        return;
    }

    // Calculate loan amount and monthly payment
    const loanAmount = totalCost - downPayment;
    const monthlyRate = interestRate / 12;
    let payment = 0;
    if (loanAmount > 0) {
        payment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, loanTerm)) /
                  (Math.pow(1 + monthlyRate, loanTerm) - 1);
        payment = Number(payment.toFixed(2));
    }

    // Calculate Bitcoin monthly growth rate
    const monthlyGrowthRate = Math.pow(1 + growth, 1 / 12) - 1;

    // Initialize simulation variables
    let btc = frequency === 'lump_sum' ? savingsAmount / initialPrice : 0;
    let bitcoinPrice = initialPrice;
    const dates = [];
    const btcValues = [];
    const usdValues = [];
    let shortfall = false;
    let shortfallDate = null;
    let btcAtStart = 0;
    let btcAtPurchase = 0;
    let btcAtEnd = 0;

    // Define simulation period (end at purchase date + loan term)
    const simulationEnd = new Date(purchaseDate);
    simulationEnd.setMonth(simulationEnd.getMonth() + loanTerm);

    // Generate monthly dates
    const monthlyDates = [];
    let currentDate = new Date(startDate);
    currentDate.setDate(1);
    while (currentDate <= simulationEnd) {
        monthlyDates.push(new Date(currentDate));
        currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Simulate each month
    for (let i = 0; i < monthlyDates.length; i++) {
        const date = monthlyDates[i];
        const dateStr = date.toLocaleDateString();

        // Record current state (only if no shortfall)
        if (!shortfall) {
            dates.push(dateStr);
            btcValues.push(Number(btc.toFixed(8)));
            usdValues.push(Number((btc * bitcoinPrice).toFixed(2)));
        }

        // Add savings if within savings period
        if (date >= startDate && date <= endDate && frequency !== 'lump_sum') {
            let savingsUsdThisMonth = 0;
            if (frequency === 'monthly') {
                savingsUsdThisMonth = savingsAmount;
            } else if (frequency === 'weekly') {
                const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
                const weeksInMonth = daysInMonth / 7;
                savingsUsdThisMonth = savingsAmount * weeksInMonth;
            } else if (frequency === 'daily') {
                const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
                savingsUsdThisMonth = savingsAmount * daysInMonth;
            }
            btc += savingsUsdThisMonth / bitcoinPrice;
            btc = Number(btc.toFixed(8));
        }

        // Record BTC at key events
        if (dateStr === startDate.toLocaleDateString()) {
            btcAtStart = btc;
        }
        if (dateStr === purchaseDate.toLocaleDateString()) {
            btcAtPurchase = btc;
            if (downPayment > 0) {
                const btcDownPayment = downPayment / bitcoinPrice;
                if (btc < btcDownPayment) {
                    shortfall = true;
                    shortfallDate = dateStr;
                    // Push shortfall state and stop
                    dates.push(dateStr);
                    btcValues.push(0);
                    usdValues.push(0);
                    btcAtEnd = 0;
                    break;
                }
                btc -= btcDownPayment;
                btc = Number(btc.toFixed(8));
            }
        }

        // Subtract loan payment if within loan period
        if (!shortfall && date >= purchaseDate && date <= simulationEnd && loanAmount > 0) {
            const btcPayment = payment / bitcoinPrice;
            if (btc < btcPayment) {
                shortfall = true;
                shortfallDate = dateStr;
                // Push shortfall state and stop
                dates.push(dateStr);
                btcValues.push(0);
                usdValues.push(0);
                btcAtEnd = 0;
                break;
            }
            btc -= btcPayment;
            btc = Number(btc.toFixed(8));
        }

        // Apply Bitcoin price growth
        bitcoinPrice *= (1 + monthlyGrowthRate);
        bitcoinPrice = Number(bitcoinPrice.toFixed(2));
    }

    // Record final state if no shortfall
    if (!shortfall && dates[dates.length - 1] !== simulationEnd.toLocaleDateString()) {
        btcAtEnd = btc;
        dates.push(simulationEnd.toLocaleDateString());
        btcValues.push(Number(btc.toFixed(8)));
        usdValues.push(Number((btc * bitcoinPrice).toFixed(2)));
    }

    // Display result
    if (shortfall) {
        resultDiv.innerHTML = `<p style="color: red;">Insufficient Bitcoin to cover down payment or loan payments. Shortfall detected on ${shortfallDate}.</p>` +
                             `<p>Monthly Loan Payment: $${payment.toFixed(2)}</p>`;
    } else {
        const finalUsdValue = btc * bitcoinPrice;
        resultDiv.innerHTML = `<p>Savings successfully covered down payment and all loan payments.</p>` +
                             `<p>Monthly Loan Payment: $${payment.toFixed(2)}</p>` +
                             `<p>Final Bitcoin holdings: ${btc.toFixed(6)} BTC, worth $${finalUsdValue.toFixed(2)} USD</p>`;
    }

    // Show CSV export button
    document.getElementById('export-csv').style.display = 'block';

    // Create Chart.js graph
    const ctx = document.getElementById('savingsChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'USD Value',
                    data: usdValues,
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    yAxisID: 'y-usd',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'BTC Value',
                    data: btcValues,
                    borderColor: '#f7931a',
                    backgroundColor: 'rgba(247, 147, 26, 0.1)',
                    yAxisID: 'y-btc',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: { display: true, text: 'Date' }
                },
                'y-usd': {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: 'USD Value' },
                    beginAtZero: true
                },
                'y-btc': {
                    type: 'linear',
                    position: 'right',
                    title: { display: true, text: 'BTC Value' },
                    beginAtZero: true,
                    grid: { drawOnChartArea: false }
                }
            },
            plugins: {
                annotation: {
                    annotations: [
                        {
                            type: 'line',
                            xMin: startDate.toLocaleDateString(),
                            xMax: startDate.toLocaleDateString(),
                            borderColor: 'green',
                            borderWidth: 2,
                            label: {
                                content: `Start Saving: ${btcAtStart.toFixed(6)} BTC`,
                                enabled: true,
                                position: 'top'
                            }
                        },
                        {
                            type: 'line',
                            xMin: purchaseDate.toLocaleDateString(),
                            xMax: purchaseDate.toLocaleDateString(),
                            borderColor: 'purple',
                            borderWidth: 2,
                            label: {
                                content: `Purchase: ${btcAtPurchase.toFixed(6)} BTC`,
                                enabled: true,
                                position: 'top'
                            }
                        },
                        shortfall ? {
                            type: 'line',
                            xMin: shortfallDate,
                            xMax: shortfallDate,
                            borderColor: 'red',
                            borderWidth: 2,
                            label: {
                                content: `Shortfall: 0.000000 BTC`,
                                enabled: true,
                                position: 'top'
                            }
                        } : {
                            type: 'line',
                            xMin: simulationEnd.toLocaleDateString(),
                            xMax: simulationEnd.toLocaleDateString(),
                            borderColor: 'black',
                            borderWidth: 2,
                            label: {
                                content: `Loan Paid Off: ${btcAtEnd.toFixed(6)} BTC`,
                                enabled: true,
                                position: 'top'
                            }
                        }
                    ]
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y;
                            return `${label}: ${label.includes('USD') ? '$' + value.toFixed(2) : value.toFixed(6) + ' BTC'}`;
                        }
                    }
                }
            }
        }
    });

    // Store data for CSV export
    console.log('Before setting chartData:', {
        dates: dates || 'undefined',
        btcValues: btcValues || 'undefined',
        usdValues: usdValues || 'undefined',
        datesLength: dates ? dates.length : 'undefined',
        btcValuesLength: btcValues ? btcValues.length : 'undefined',
        usdValuesLength: usdValues ? usdValues.length : 'undefined',
        sampleDates: dates ? dates.slice(0, 5) : 'undefined',
        sampleBtcValues: btcValues ? btcValues.slice(0, 5) : 'undefined',
        sampleUsdValues: usdValues ? usdValues.slice(0, 5) : 'undefined',
        lastDates: dates ? dates.slice(-5) : 'undefined',
        lastBtcValues: btcValues ? btcValues.slice(-5) : 'undefined',
        lastUsdValues: usdValues ? usdValues.slice(-5) : 'undefined'
    });
    window.chartData = { dates, btcValues, usdValues };
}

function exportToCSV() {
    if (!window.chartData || !window.chartData.dates || !window.chartData.btcValues || !window.chartData.usdValues) {
        console.error('exportToCSV: chartData is missing or incomplete', window.chartData);
        alert('Error: Please run a valid calculation first by clicking "Calculate".');
        return;
    }
    const { dates, btcValues, usdValues } = window.chartData;
    if (dates.length === 0 || btcValues.length === 0 || usdValues.length === 0) {
        console.error('exportToCSV: One or more arrays are empty', {
            datesLength: dates.length,
            btcValuesLength: btcValues.length,
            usdValuesLength: usdValues.length
        });
        alert('Error: No data available to export.');
        return;
    }
    let csvContent = 'Date,BTC Value,USD Value\n';
    for (let i = 0; i < dates.length; i++) {
        if (typeof btcValues[i] === 'undefined' || typeof usdValues[i] === 'undefined') {
            console.error(`Invalid data at index ${i}:`, {
                date: dates[i],
                btc: btcValues[i] === undefined ? 'undefined' : btcValues[i],
                usd: usdValues[i] === undefined ? 'undefined' : usdValues[i]
            });
            continue;
        }
        csvContent += `${dates[i]},${btcValues[i].toFixed(6)},${usdValues[i].toFixed(2)}\n`;
    }
    if (csvContent === 'Date,BTC Value,USD Value\n') {
        console.error('exportToCSV: No valid data to export');
        alert('Error: No valid data to export.');
        return;
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'bitcoin_savings.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}