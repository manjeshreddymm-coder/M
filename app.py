from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import google.generativeai as genai
import os
import datetime
# --- IMPORTS for password hashing ---
from werkzeug.security import generate_password_hash, check_password_hash

# --- App & Database Configuration ---
app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:@localhost/ai_finance_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- Configure Gemini API ---
API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    # --- FALLBACK KEY ---
    # IMPORTANT: Replace this with your actual key or set the environment variable
    API_KEY = "AIzaSyBC6kOovgY-LQJCcQPJbt6diuokz3Sfyx4" 

try:
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel('gemini-pro')
    print("✅ Gemini AI model configured.")
except Exception as e:
    print(f"⚠️ Error configuring Gemini: {e}. AI features will fail.")
    model = None

# ========== DATABASE MODELS ==========

# --- USER MODEL ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False) # Storing a hash, not the password

    def __repr__(self):
        return f'<User {self.username}>'

# --- TRANSACTION MODEL ---
class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Float, nullable=False)
    type = db.Column(db.String(10), nullable=False)  # 'income' or 'expense'
    description = db.Column(db.String(100), nullable=False)
    date = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def __repr__(self):
        return f'<Transaction {self.description} {self.amount}>'

# --- GOAL MODEL ---
class Goal(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    duration = db.Column(db.Integer, nullable=False) # Duration in months

    def __repr__(self):
        return f'<Goal {self.name} {self.amount}>'

# ========== API ROUTES ==========

# --- AUTHENTICATION ROUTES ---

@app.route('/api/register', methods=['POST'])
def register():
    """Registers a new user."""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({"error": "Username and password are required"}), 400

        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            return jsonify({"error": "Username already exists"}), 409 # 409 Conflict

        hashed_password = generate_password_hash(password)

        new_user = User(username=username, password_hash=hashed_password)
        db.session.add(new_user)
        db.session.commit()

        print(f"✅ New user registered: {username}")
        return jsonify({"message": "User created successfully"}), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error during registration: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    """Logs in an existing user."""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({"error": "Username and password are required"}), 400

        user = User.query.filter_by(username=username).first()

        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({"error": "Invalid username or password"}), 401 # 401 Unauthorized

        print(f"✅ User logged in: {username}")
        return jsonify({"message": "Login successful"}), 200

    except Exception as e:
        print(f"Error during login: {e}")
        return jsonify({"error": str(e)}), 500

# --- TRANSACTION ROUTES ---

@app.route('/api/transactions', methods=['POST'])
def add_transaction():
    """Adds a new transaction to the database."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data"}), 400

        amount = data.get('amount')
        tx_type = data.get('type')
        description = data.get('description')
        date_str = data.get('date') # <-- GET THE DATE STRING

        if not amount or not tx_type or not description or not date_str:
            return jsonify({"error": "Missing fields"}), 400

        # --- NEW: Convert date string (YYYY-MM-DD) to datetime object ---
        try:
            # The frontend sends a string like '2025-10-27'
            transaction_date = datetime.datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
        # --- END NEW ---

        new_transaction = Transaction(
            amount=float(amount),
            type=tx_type,
            description=description,
            date=transaction_date # <-- SAVE THE CORRECT DATE
        )
        db.session.add(new_transaction)
        db.session.commit()
        
        print(f"✅ New transaction added: {new_transaction}")
        return jsonify({"message": "Transaction added successfully"}), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error adding transaction: {e}")
        return jsonify({"error": str(e)}), 500

# --- GOAL ROUTES ---

@app.route('/api/goals', methods=['POST'])
def add_goal():
    """Adds a new goal to the database."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data"}), 400
        
        name = data.get('name')
        amount = data.get('amount')
        duration = data.get('duration')
        if not name or not amount or not duration:
            return jsonify({"error": "Missing fields"}), 400
        
        new_goal = Goal(
            name=name,
            amount=float(amount),
            duration=int(duration)
        )
        db.session.add(new_goal)
        db.session.commit()

        print(f"🎯 New goal added: {new_goal}")
        return jsonify({
            "message": "Goal added successfully",
            "goal": {
                "id": new_goal.id,
                "name": new_goal.name,
                "amount": new_goal.amount,
                "duration": new_goal.duration
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error adding goal: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/goals', methods=['GET'])
def get_goals():
    """Fetches all goals from the database."""
    try:
        goals = Goal.query.all()
        goals_list = [
            {
                "id": goal.id,
                "name": goal.name,
                "amount": goal.amount,
                "duration": goal.duration
            } for goal in goals
        ]
        return jsonify(goals_list), 200
    except Exception as e:
        print(f"Error fetching goals: {e}")
        return jsonify({"error": str(e)}), 500

# --- DASHBOARD & AI ROUTES ---

@app.route('/api/dashboard_data', methods=['GET'])
def get_dashboard_data():
    """Dynamically calculates chart data from saved transactions."""
    try:
        transactions = Transaction.query.order_by(Transaction.date).all()
        monthly_data = {} 
        
        for tx in transactions:
            month_key = tx.date.strftime('%Y-%m')
            
            if month_key not in monthly_data:
                monthly_data[month_key] = {'income': 0, 'expense': 0}
            
            if tx.type == 'income':
                monthly_data[month_key]['income'] += tx.amount
            elif tx.type == 'expense':
                monthly_data[month_key]['expense'] += tx.amount
        
        sorted_months = sorted(monthly_data.keys())
        
        labels = [datetime.datetime.strptime(month, '%Y-%m').strftime('%B %Y') for month in sorted_months]
        income_data = [monthly_data[month]['income'] for month in sorted_months]
        expense_data = [monthly_data[month]['expense'] for month in sorted_months]

        if not labels:
            return jsonify({
                "labels": ['Start'],
                "income": [0],
                "expenses": [0]
            })

        return jsonify({
            "labels": labels,
            "income": income_data,
            "expenses": expense_data
        })
    except Exception as e:
        print(f"Error fetching dashboard data: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/ai/suggestion', methods=['GET'])
def get_ai_suggestion():
    """Gets an AI suggestion based on data in the database."""
    if not model:
        return jsonify({"suggestion": "AI model is not configured. Please check API key."})
        
    suggestion = get_combined_ai_suggestion_from_db()
    return jsonify({"suggestion": suggestion})

# ========== AI LOGIC ==========

def get_combined_ai_suggestion_from_db():
    """Generate an AI-based financial suggestion by querying the database."""
    try:
        recent_transactions = Transaction.query.order_by(Transaction.date.desc()).limit(5).all()
        active_goals = Goal.query.all()

        if not recent_transactions and not active_goals:
            return "Add some transactions and set goals to receive personalized advice."

        transaction_summary = "Recent Transactions:\n"
        if recent_transactions:
            for tx in recent_transactions:
                transaction_summary += f"- {tx.type.capitalize()}: ₹{tx.amount} for {tx.description}\n"
        else:
            transaction_summary += "No transactions logged yet.\n"

        goals_summary = "\nFinancial Goals:\n"
        if active_goals:
            for g in active_goals:
                goals_summary += f"- {g.name}: Target ₹{g.amount} in {g.duration} months\n"
        else:
            goals_summary += "No active goals set.\n"

        prompt = f"""
        You are an expert financial advisor analyzing a user's current situation.
        Below are their recent transactions and financial goals.

        {transaction_summary}
        {goals_summary}

        Based on this, provide ONE detailed yet concise suggestion that:
        1. Acknowledges their current habits,
        2. Advises them on achieving goals faster,
        3. Points out 1 improvement area in spending.

        Keep the tone friendly and motivating (3-5 lines max).
        """

        response = model.generate_content(prompt)
        return getattr(response, "text", str(response))

    except Exception as e:
        print(f"⚠️ AI Error: {e}")
        return "Unable to generate AI suggestion right now. Try again later."


if __name__ == '__main__':
    app.run(debug=True, port=5000)