// Global variable to store Chart.js instance
let chartInstance = null;

function calculate() {
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

    // Basic validation
    if (endDate < startDate || purchaseDate < endDate) {
        document.getElementById('result').innerHTML = 'Error: Ensure Savings End Date is after Start Date, and Purchase Date is after End Date.';
        return;
    }
    if (downPayment > totalCost) {
        document.getElementById('result').innerHTML = 'Error: Down payment cannot exceed total cost.';
        return;
    }

    // Calculate loan amount (total cost minus down payment)
    const loanAmount = totalCost - downPayment;

    // Calculate monthly loan payment
    const monthlyRate = interestRate / 12;
    let payment = 0;
    if (loanAmount > 0) {
        payment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, loanTerm)) / 
                  (Math.pow(1 + monthlyRate, loanTerm) - 1);
        payment = Number(payment.toFixed(2)); // Round to 2 decimals
    }

    // Calculate Bitcoin monthly growth rate
    const monthlyGrowthRate = Math.pow(1 + growth, 1 / 12) - 1;

    // Initialize Bitcoin holdings and tracking arrays for chart
    let btc = 0;
    if (frequency === 'lump_sum') {
        btc = savingsAmount / initialPrice;
    }
    let bitcoinPrice = initialPrice;
    const dates = [];
    const btcValues = [];
    const usdValues = [];
    let shortfall = false;
    let shortfallDate = null;
    let btcAtStart = 0;
    let btcAtPurchase = 0;
    let btcAtEnd = 0;

    // Define simulation period
    const simulationEnd = new Date(purchaseDate);
    simulationEnd.setMonth(simulationEnd.getMonth() + loanTerm);

    // Generate monthly dates
    const monthlyDates = [];
    let currentDate = new Date(startDate);
    currentDate.setDate(1); // Start on the 1st of the month
    while (currentDate <= simulationEnd) {
        monthlyDates.push(new Date(currentDate));
        currentDate.setMonth(currentDate.getMonth() + 1);
    }
    // Debug log for number of months
    console.log('Number of months:', monthlyDates.length);

    // Simulate each month
    for (let i = 0; i < monthlyDates.length; i++) {
        const date = monthlyDates[i];
        const dateStr = date.toLocaleDateString();

        // Add savings if within savings period
        if (date >= startDate && date <= new Date('2026-12-31') && frequency !== 'lump_sum') {
            let savingsUsdThisMonth;
            if (frequency === 'monthly') {
                savingsUsdThisMonth = savingsAmount;
            } else if (frequency === 'weekly') {
                const weeksPerMonth = 4.33;
                savingsUsdThisMonth = savingsAmount * weeksPerMonth;
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
            // Apply down payment
            if (downPayment > 0) {
                const btcDownPayment = downPayment / bitcoinPrice;
                if (btc < btcDownPayment) {
                    shortfall = true;
                    shortfallDate = dateStr;
                    btc = 0;
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
        const loanStart = new Date('2027-01-01');
        if (!shortfall && date >= loanStart && date <= simulationEnd && loanAmount > 0) {
            const btcPayment = payment / bitcoinPrice;
            if (btc < btcPayment) {
                shortfall = true;
                shortfallDate = dateStr;
                btc = 0;
                dates.push(dateStr);
                btcValues.push(0);
                usdValues.push(0);
                btcAtEnd = 0;
                break;
            }
            btc -= btcPayment;
            btc = Number(btc.toFixed(8));
        }

        // Record current state for chart (after all transactions)
        if (!shortfall || i < monthlyDates.length - 1) {
            dates.push(dateStr);
            btcValues.push(btc);
            usdValues.push(btc * bitcoinPrice);
        }

        // Apply Bitcoin price growth for next iteration
        bitcoinPrice *= (1 + monthlyGrowthRate);
        bitcoinPrice = Number(bitcoinPrice.toFixed(2));
        // Debug log for intermediate values
        console.log(`Date: ${dateStr}, BTC: ${btc.toFixed(8)}, USD: ${(btc * bitcoinPrice).toFixed(2)}, Bitcoin Price: ${bitcoinPrice.toFixed(2)}`);
    }

    // Record final state if no shortfall
    if (!shortfall && dates[dates.length - 1] !== simulationEnd.toLocaleDateString()) {
        btcAtEnd = btc;
        dates.push(simulationEnd.toLocaleDateString());
        btcValues.push(btc);
        usdValues.push(btc * bitcoinPrice);
    }

    // Display result
    const resultDiv = document.getElementById('result');
    if (shortfall) {
        resultDiv.innerHTML = `Insufficient Bitcoin to cover down payment or loan payments. Shortfall detected on ${shortfallDate}.<br>` +
                              `Monthly Loan Payment: $${payment.toFixed(2)}`;
    } else {
        const finalUsdValue = btc * bitcoinPrice;
        resultDiv.innerHTML = `Savings successfully covered down payment and all loan payments.<br>` +
                              `Monthly Loan Payment: $${payment.toFixed(2)}<br>` +
                              `Final Bitcoin holdings: ${btc.toFixed(6)} BTC, worth $${finalUsdValue.toFixed(2)} USD`;
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
                    borderColor: 'blue',
                    yAxisID: 'y-usd',
                    fill: false
                },
                {
                    label: 'BTC Value',
                    data: btcValues,
                    borderColor: 'orange',
                    yAxisID: 'y-btc',
                    fill: false
                }
            ]
        },
        options: {
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
                }
            }
        }
    });

    // Store data for CSV export
    window.chartData = { dates, btcValues, usdValues };
}

function exportToCSV() {
    const { dates, btcValues, usdValues } = window.chartData;
    let csvContent = 'Date,BTC Value,USD Value\n';
    for (let i = 0; i < dates.length; i++) {
        csvContent += `${dates[i]},${btcValues[i].toFixed(6)},${usdValues[i].toFixed(2)}\n`;
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