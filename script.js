// ======== GLOBAL VARIABLES ========
const pages = document.querySelectorAll('.page');
const navItems = document.querySelectorAll('.nav-item');
let goals = []; // Changed from 'const' to 'let'
let aiGoalSuggestions = [];
let monthlyTransactions = [];
let myChart = null;

// ======== NAVIGATION ========
function showPage(pageId) {
    pages.forEach(page => page.classList.remove('active'));
    const newPage = document.getElementById(pageId);
    newPage.classList.add('active');

    navItems.forEach(item => {
        item.classList.remove('text-green-600', 'font-bold');
        item.classList.add('text-gray-700', 'font-medium');
    });
    const navItem = document.querySelector(`[onclick="showPage('${pageId}')"]`);
    if (navItem) {
        navItem.classList.add('text-green-600', 'font-bold');
        navItem.classList.remove('text-gray-700', 'font-medium');
    }

    if (pageId === 'dashboard') {
        fetchDashboardData();
        if (!myChart) {
            const ctx = document.getElementById('financialChart').getContext('2d');
            myChart = new Chart(ctx, chartConfig);
        }
        myChart.resize();
        renderChallenges();
        // Fetch goals, *then* calculate health score
        fetchGoals().then(() => {
            calculateFinancialHealth();
        });
    }

    if (pageId === 'goals') {
        fetchGoals(); // Fetches goals and *then* renders them
        renderNudges();
    }

    if (pageId === 'suggestions') {
        renderGoalSuggestions();
    }

    // --- NEW: Run setup for transaction page ---
    if (pageId === 'transactions') {
        setupTransactionPage(); // Sets the date input to today
    }
}

// --- NEW HELPER FUNCTION ---
// This function runs when the "Add Transactions" page is shown
function setupTransactionPage() {
    const dateInput = document.getElementById('tx_date');
    if (dateInput) {
        // Sets the default value of the date input to today
        dateInput.valueAsDate = new Date();
    }
}

// ======== LOGIN & REGISTER ========

// This function toggles the form between Login and Register mode
function toggleRegisterMode(event, isRegistering) {
    if (event) event.preventDefault();

    const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
    const loginButtons = document.getElementById('loginButtons');
    const registerButtons = document.getElementById('registerButtons');
    const statusMessage = document.getElementById('login-status-message');
    const subHeading = document.getElementById('login-subheading');
    const heading = document.getElementById('login-heading');

    statusMessage.textContent = ''; // Clear any old messages

    if (isRegistering) {
        // Show Register UI
        heading.textContent = 'Create Account';
        subHeading.textContent = 'Sign up to get started';
        confirmPasswordGroup.classList.remove('hidden');
        loginButtons.classList.add('hidden');
        registerButtons.classList.remove('hidden');
    } else {
        // Show Login UI
        heading.textContent = 'Secure Access';
        subHeading.textContent = 'Log in to your financial dashboard';
        confirmPasswordGroup.classList.add('hidden');
        loginButtons.classList.remove('hidden');
        registerButtons.classList.add('hidden');
    }
}

// This function handles the LOGIN button click
async function handleLoginSubmit(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const statusMessage = document.getElementById('login-status-message');

    if (!username || !password) {
        statusMessage.textContent = 'Please enter both username and password.';
        statusMessage.className = 'text-center font-semibold text-red-600';
        return;
    }

    try {
        const response = await fetch('http://127.0.0.1:5000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            statusMessage.textContent = data.message;
            statusMessage.className = 'text-center font-semibold text-green-600';
            // Wait 1 second to show success, then go to dashboard
            setTimeout(() => {
                showPage('dashboard');
                // Clear login form for security
                document.getElementById('username').value = '';
                document.getElementById('password').value = '';
                statusMessage.textContent = '';
                toggleRegisterMode(null, false); // Reset form to login mode
            }, 1000);
        } else {
            statusMessage.textContent = data.error || 'Login failed. Please try again.';
            statusMessage.className = 'text-center font-semibold text-red-600';
        }
    } catch (error) {
        console.error('Login error:', error);
        statusMessage.textContent = 'Server not reachable. Please check connection.';
        statusMessage.className = 'text-center font-semibold text-red-600';
    }
}

// This function handles the REGISTER button click
async function handleRegisterSubmit(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const statusMessage = document.getElementById('login-status-message');

    if (!username || !password || !confirmPassword) {
        statusMessage.textContent = 'Please fill out all fields.';
        statusMessage.className = 'text-center font-semibold text-red-600';
        return;
    }

    if (password !== confirmPassword) {
        statusMessage.textContent = 'Passwords do not match.';
        statusMessage.className = 'text-center font-semibold text-red-600';
        return;
    }

    try {
        const response = await fetch('http://127.0.0.1:5000/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            statusMessage.textContent = data.message + '. Please log in.';
            statusMessage.className = 'text-center font-semibold text-green-600';
            // Wait 2 seconds, then toggle back to login mode
            setTimeout(() => {
                toggleRegisterMode(null, false);
                document.getElementById('password').value = '';
                document.getElementById('confirmPassword').value = '';
            }, 2000);
        } else {
            statusMessage.textContent = data.error || 'Registration failed.';
            statusMessage.className = 'text-center font-semibold text-red-600';
        }
    } catch (error) {
        console.error('Registration error:', error);
        statusMessage.textContent = 'Server not reachable. Please check connection.';
        statusMessage.className = 'text-center font-semibold text-red-600';
    }
}


// =============================================
// UPDATED GRAPH COLORS & STYLE
// =============================================
const chartData = {
    labels: [],
    datasets: [
        { 
            label: 'Income', 
            data: [], 
            borderColor: 'rgb(34, 197, 94)', 
            tension: 0, // Makes lines straight
            borderWidth: 5, // Makes line thick
            borderDash: [15, 5], // Creates the dashed effect
            pointRadius: 7, // Makes dots larger
            pointBackgroundColor: 'rgb(34, 197, 94)' // Fills dots with line color
        },
        { 
            label: 'Expenses', 
            data: [], 
            borderColor: 'rgb(255, 99, 132)', 
            tension: 0, // Makes lines straight
            borderWidth: 5, // Makes line thick
            borderDash: [15, 5], // Creates the dashed effect
            pointRadius: 7, // Makes dots larger
            pointBackgroundColor: 'rgb(255, 99, 132)' // Fills dots with line color
        }
    ]
};
const chartConfig = { type: 'line', data: chartData, options: { responsive: true, maintainAspectRatio: false } };
// =============================================
// END OF UPDATED SECTION
// =============================================


// ======== BACKEND CONNECTIONS ========

// Fetch dashboard data
async function fetchDashboardData() {
    try {
        const res = await fetch('http://127.0.0.1:5000/api/dashboard_data');
        const data = await res.json();
        chartData.labels = data.labels;
        chartData.datasets[0].data = data.income;
        chartData.datasets[1].data = data.expenses;
        if (myChart) myChart.update();
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
    }
}

// --- UPDATED: Add transaction to backend (now sends date) ---
async function handleTransactionSubmit(event) {
    event.preventDefault();
    const amount = document.getElementById('amount').value;
    const type = document.getElementById('type').value;
    const description = document.getElementById('description').value;
    const date = document.getElementById('tx_date').value; // <-- GET THE DATE
    const statusMessage = document.getElementById('form-status-message');

    // Check if date is selected
    if (!date) {
        statusMessage.textContent = 'Please select a date.';
        statusMessage.className = 'text-center font-semibold text-red-600';
        return;
    }

    try {
        const response = await fetch('http://127.0.0.1:5000/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // SEND THE DATE IN THE BODY
            body: JSON.stringify({ amount, type, description, date }) 
        });

        if (response.ok) {
            statusMessage.textContent = 'Transaction successfully logged!';
            statusMessage.className = 'text-center font-semibold text-green-600';
            event.target.reset();
            setupTransactionPage(); // Reset the date back to today after success
        } else {
            const error = await response.json();
            statusMessage.textContent = error.error || 'Failed to log transaction.';
            statusMessage.className = 'text-center font-semibold text-red-600';
        }
    } catch {
        statusMessage.textContent = 'Server not reachable!';
        statusMessage.className = 'text-center font-semibold text-red-600';
    }
    setTimeout(() => { statusMessage.textContent = ''; }, 2500);
}

// Get AI Suggestion from backend
async function getAISuggestion() {
    const suggestionEl = document.getElementById('aiSuggestion');
    suggestionEl.textContent = "Fetching AI suggestion...";
    try {
        const res = await fetch('http://127.0.0.1:5000/api/ai/suggestion');
        const data = await res.json();
        suggestionEl.textContent = data.suggestion;
    } catch {
        suggestionEl.textContent = "Failed to get suggestion. Check server.";
    }
}

// Fetch all goals from the backend
async function fetchGoals() {
    try {
        const res = await fetch('http://127.0.0.1:5000/api/goals');
        if (!res.ok) throw new Error('Failed to fetch goals');
        
        const fetchedGoals = await res.json();
        
        // Re-process goals to include advice
        goals = fetchedGoals.map(goal => {
            const monthlySavings = (goal.amount / goal.duration).toFixed(2);
            return {
                ...goal,
                monthlySavings: monthlySavings,
                advice: generateGoalAdvice(parseFloat(monthlySavings))
            };
        });
        
        renderGoals(); // Re-render the goals list with the new data
        generateGoalSuggestionsFromAllGoals(); // Re-generate AI suggestions
    } catch (error) {
        console.error('Error fetching goals:', error);
    }
}

// ======== FINANCIAL HEALTH SCORE ========
function calculateFinancialHealth() {
    const scoreDisplay = document.getElementById('healthScoreDisplay');
    const scoreMessage = document.getElementById('healthScoreMessage');
    const totalIncome = chartData.datasets[0].data.reduce((a, b) => a + b, 0);
    const totalExpenses = chartData.datasets[1].data.reduce((a, b) => a + b, 0);

    if (totalIncome === 0) {
        scoreDisplay.innerText = "--";
        scoreMessage.innerText = "Log income and expenses to see your score.";
        return;
    }
    const savingsRate = (totalIncome - totalExpenses) / totalIncome;
    const savingsScore = Math.min(50, Math.max(0, savingsRate * 150));
    const expenseRatio = totalExpenses / totalIncome;
    const expenseScore = Math.max(0, 30 * (1 - expenseRatio));
    const goalProgressScore = goals.length > 0 ? 20 : 5; 
    const finalScore = Math.round(savingsScore + expenseScore + goalProgressScore);

    scoreDisplay.innerText = finalScore;
    if (finalScore >= 80) scoreMessage.innerText = "Excellent! You're in great financial shape. 👍";
    else if (finalScore >= 60) scoreMessage.innerText = "Good job! You're on the right track. ✅";
    else scoreMessage.innerText = "There's room for improvement. Let's work on a plan! 🤔";
}

// ======== GOAL MANAGEMENT (UPDATED) ========
async function addGoal() {
    const name = document.getElementById('goalName').value;
    const amount = parseFloat(document.getElementById('goalAmount').value);
    const duration = parseInt(document.getElementById('goalDuration').value);

    if (name && amount > 0 && duration > 0) {
        try {
            // Send the new goal to the backend
            const response = await fetch('http://127.0.0.1:5000/api/goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, amount, duration })
            });

            if (response.ok) {
                // Clear the form
                document.getElementById('goalName').value = '';
                document.getElementById('goalAmount').value = '';
                document.getElementById('goalDuration').value = '';
                
                // Fetch the *updated* list of goals from the server
                await fetchGoals();
            } else {
                alert('Failed to save goal. Please try again.');
            }
        } catch (error) {
            console.error('Error adding goal:', error);
            alert('Server not reachable.');
        }
    } else {
        alert('Please fill out all goal fields correctly.');
    }
}

function generateGoalAdvice(monthlySavings) {
    if (monthlySavings > 20000) return "Excellent target! Consider a mix of FDs and mutual funds.";
    if (monthlySavings > 5000) return "Solid target. A consistent SIP in a mutual fund could be a great strategy.";
    return "Great start! A high-yield savings account or an FD can build your initial corpus.";
}

function renderGoals() {
    const goalsContainer = document.getElementById('goalCardsContainer');
    const goalSelector = document.getElementById('goalSelector');
    if (!goalsContainer || !goalSelector) return;
    goalsContainer.innerHTML = '';
    goalSelector.innerHTML = '';

    if (goals.length === 0) {
        goalsContainer.innerHTML = `<p class="text-center text-gray-500">No active goals yet. Add one to get started!</p>`;
        goalSelector.innerHTML = '<option>No goals set yet</option>';
        document.getElementById('shieldResult').classList.add('hidden');
    } else {
        goals.forEach(goal => {
            const goalCard = document.createElement('div');
            goalCard.className = 'bg-white p-6 rounded-2xl shadow-lg border border-blue-200';
            goalCard.innerHTML = `<h4 class="text-xl font-bold text-blue-700 mb-2">${goal.name}</h4>
                <p><strong>Target Amount:</strong> ₹${goal.amount.toLocaleString()}</p>
                <p><strong>Monthly Savings Needed:</strong> ₹${goal.monthlySavings}</p>
                <div class="mt-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                    <p class="text-sm italic text-blue-800"><strong>AI Coach Tip:</strong> ${goal.advice}</p>
                </div>`;
            goalsContainer.appendChild(goalCard);
            const option = document.createElement('option');
            option.value = goal.name;
            option.innerText = goal.name;
            goalSelector.appendChild(option);
        });
        runInflationShield();
    }
    renderNudges();
}

// ======== INFLATION SHIELD ========
function runInflationShield() {
    const selector = document.getElementById('goalSelector');
    const resultContainer = document.getElementById('shieldResult');
    const resultText = document.getElementById('shieldResultText');
    const strategyText = document.getElementById('shieldStrategyText');
    const goal = goals.find(g => g.name === selector.value);

    if (!goal) {
        resultContainer.classList.add('hidden');
        return;
    }
    const inflationRate = 0.06;
    const years = goal.duration / 12;
    const futureValue = goal.amount * Math.pow((1 + inflationRate), years);
    resultText.innerHTML = `To have the same purchasing power, your goal of <strong>₹${goal.amount.toLocaleString()}</strong> will actually cost <strong class="text-2xl">₹${Math.round(futureValue).toLocaleString()}</strong> in ${years.toFixed(1)} years.`;

    let strategy = "";
    if (years > 10) strategy = "For long-term goals, consider equity mutual funds to beat inflation.";
    else if (years > 3) strategy = "For medium-term goals, a mix of FDs and equity is safe.";
    else strategy = "For short-term goals, stick to savings or debt funds.";
    strategyText.innerText = strategy;
    resultContainer.classList.remove('hidden');
}

// ======== AI GOAL SUGGESTIONS ========
// Re-generates all suggestions based on the current goals array
function generateGoalSuggestionsFromAllGoals() {
    aiGoalSuggestions = []; // Clear old suggestions
    goals.forEach(goal => {
        const monthlySavings = parseFloat(goal.monthlySavings);
        const years = goal.duration / 12;
        
        let suggestions = [];
        suggestions.push(`To achieve your '${goal.name}' goal, try saving ₹${(monthlySavings / 4).toFixed(2)} per week.`);
        if (years > 5) suggestions.push(`Since '${goal.name}' is long-term, try an SIP in equity mutual funds.`);
        if (monthlySavings > 5000) suggestions.push(`Automate your ₹${goal.monthlySavings} monthly saving via auto-debit.`);
        
        suggestions.forEach(suggestionText => aiGoalSuggestions.push({ goalName: goal.name, text: suggestionText }));
    });
}

function renderGoalSuggestions() {
    const container = document.getElementById('goalSuggestionsContainer');
    if (!container) return;
    container.innerHTML = '';
    if (aiGoalSuggestions.length > 0) {
        container.innerHTML = `<h3 class="text-xl font-semibold text-green-700 mb-4 flex items-center"><i class="ph-bold ph-brain text-2xl mr-2"></i> Your AI Goal Assistant</h3>`;
        const list = document.createElement('ul');
        list.className = "list-disc pl-5 space-y-3 bg-white p-6 rounded-2xl shadow-lg border border-green-200";
        aiGoalSuggestions.forEach(suggestion => {
            const listItem = document.createElement('li');
            listItem.className = "text-gray-700";
            listItem.innerText = suggestion.text;
            list.appendChild(listItem);
        });
        container.appendChild(list);
    }
}

// ======== CHALLENGES & NUDGES ========
const challenges = [
    { id: 'no-spend-weekend', title: 'No-Spend Weekend 🚫', description: 'Spend nothing on non-essentials this weekend.', reward: 'No-Spend Master Badge', status: 'incomplete' },
    { id: 'save-1000', title: 'Save ₹1,000 this Week 💰', description: 'Reduce expenses by ₹1,000 this week.', reward: 'Budget Champ Badge', status: 'incomplete' }
];

function renderChallenges() {
    const container = document.getElementById('challengesContainer');
    if (!container) return;
    container.innerHTML = '';
    challenges.forEach(challenge => {
        const card = document.createElement('div');
        card.className = `bg-white p-6 rounded-2xl shadow-lg ${challenge.status === 'completed' ? 'border-4 border-green-500' : 'border'}`;
        card.innerHTML = `<h3 class="text-xl font-bold mb-2">${challenge.title}</h3><p class="text-gray-600 mb-4">${challenge.description}</p>`;
        container.appendChild(card);
    });
}

function renderNudges() {
    const container = document.getElementById('nudgesContainer');
    if (!container) return;
    container.innerHTML = '<h3 class="text-2xl font-semibold text-green-800 mb-4">AI Coach Nudges</h3>';
    addNudge("You've saved more than your average this month. Great job!");
}

function addNudge(message) {
    const container = document.getElementById('nudgesContainer');
    const nudgeElement = document.createElement('div');
    nudgeElement.className = 'bg-white p-4 rounded-xl shadow-md border-l-4 border-yellow-400';
    nudgeElement.innerHTML = message;
    container.appendChild(nudgeElement);
}

// ======== INITIALIZE ========
document.addEventListener('DOMContentLoaded', () => {
    showPage('welcome');
});