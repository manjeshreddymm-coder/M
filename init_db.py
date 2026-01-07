from app import app, db

# This script is used to create the database tables for the first time.
# Run this *once* from your terminal: python init_db.py

with app.app_context():
    print("Creating database tables...")
    # This command reads your models (Transaction, Goal) from app.py
    # and creates the tables in 'finance.db'
    db.create_all()
    print("✅ Database 'finance.db' and tables created successfully!")