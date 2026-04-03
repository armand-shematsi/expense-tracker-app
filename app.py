import os
from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
from datetime import datetime
from sqlalchemy import func, extract
from decimal import Decimal

# Load env variables (useful for local development)
load_dotenv()

app = Flask(__name__)
CORS(app)
app.secret_key = os.getenv("SECRET_KEY", "dev-secret")

# ── Smart Database Switching ──────────────────────────────────────────
database_url = os.environ.get('DATABASE_URL')

if database_url:
    # Fix for Railway's postgres:// URL (SQLAlchemy needs postgresql://)
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///expenses.db'

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# ── Database Model ───────────────────────────────────────────────────
class Expense(db.Model):
    __tablename__ = 'expenses'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    category = db.Column(db.String(100), nullable=False, default='Other')
    date = db.Column(db.Date, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "amount": float(self.amount),
            "category": self.category,
            "date": self.date.strftime('%Y-%m-%d'),
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

# ── Initialize DB ───────────────────────────────────────────────────
with app.app_context():
    db.create_all()


# ── Serve Frontend ───────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


# ── Expenses CRUD ────────────────────────────────────────────────────
@app.route("/api/expenses", methods=["GET"])
def list_expenses():
    category = request.args.get("category")
    
    query = Expense.query
    if category and category != "All":
        query = query.filter_by(category=category)
        
    # Order by date DESC, id DESC
    expenses = query.order_by(Expense.date.desc(), Expense.id.desc()).all()
    return jsonify([exp.to_dict() for exp in expenses])


@app.route("/api/expenses", methods=["POST"])
def create_expense():
    data = request.get_json()
    required = ("title", "amount", "category", "date")
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"'{field}' is required"}), 400

    try:
        new_exp = Expense(
            title=data["title"],
            amount=Decimal(str(data["amount"])),
            category=data["category"],
            date=datetime.strptime(data["date"], "%Y-%m-%d").date(),
            notes=data.get("notes", "")
        )
        db.session.add(new_exp)
        db.session.commit()
        return jsonify(new_exp.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/api/expenses/<int:expense_id>", methods=["PUT"])
def update_expense(expense_id):
    data = request.get_json()
    exp = Expense.query.get(expense_id)
    if not exp:
        return jsonify({"error": "Expense not found"}), 404

    try:
        exp.title = data["title"]
        exp.amount = Decimal(str(data["amount"]))
        exp.category = data["category"]
        exp.date = datetime.strptime(data["date"], "%Y-%m-%d").date()
        exp.notes = data.get("notes", "")
        
        db.session.commit()
        return jsonify(exp.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/api/expenses/<int:expense_id>", methods=["DELETE"])
def delete_expense(expense_id):
    exp = Expense.query.get(expense_id)
    if not exp:
        return jsonify({"error": "Expense not found"}), 404

    try:
        db.session.delete(exp)
        db.session.commit()
        return jsonify({"message": "Deleted successfully", "id": expense_id})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── Summary ──────────────────────────────────────────────────────────
@app.route("/api/expenses/summary", methods=["GET"])
def summary():
    try:
        # Total overall
        total = db.session.query(func.coalesce(func.sum(Expense.amount), 0)).scalar()

        # This month 
        current_year = datetime.utcnow().year
        current_month = datetime.utcnow().month
        monthly = db.session.query(func.coalesce(func.sum(Expense.amount), 0))\
                    .filter(extract('year', Expense.date) == current_year)\
                    .filter(extract('month', Expense.date) == current_month)\
                    .scalar()

        # By category
        by_category_raw = db.session.query(
            Expense.category,
            func.sum(Expense.amount).label('total')
        ).group_by(Expense.category).order_by(func.sum(Expense.amount).desc()).all()
        
        by_category = [
            {"category": row[0], "total": float(row[1])}
            for row in by_category_raw
        ]

        top_category = by_category[0]["category"] if by_category else "N/A"
        
        return jsonify({
            "total": float(total),
            "monthly": float(monthly),
            "top_category": top_category,
            "by_category": by_category
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Entry Point ───────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
