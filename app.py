import os
from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
from dotenv import load_dotenv
from db import get_connection, init_db

load_dotenv()

app = Flask(__name__)
CORS(app)
app.secret_key = os.getenv("SECRET_KEY", "dev-secret")


# ── Serve Frontend ──────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


# ── Expenses CRUD ────────────────────────────────────────────────────────────

@app.route("/api/expenses", methods=["GET"])
def list_expenses():
    category = request.args.get("category")
    conn = get_connection()
    try:
        cur = conn.cursor()
        if category and category != "All":
            cur.execute(
                "SELECT * FROM expenses WHERE category = ? ORDER BY date DESC, id DESC",
                (category,)
            )
        else:
            cur.execute("SELECT * FROM expenses ORDER BY date DESC, id DESC")
        rows = cur.fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@app.route("/api/expenses", methods=["POST"])
def create_expense():
    data = request.get_json()
    required = ("title", "amount", "category", "date")
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"'{field}' is required"}), 400

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO expenses (title, amount, category, date, notes)
            VALUES (?, ?, ?, ?, ?)
            RETURNING *
            """,
            (data["title"], float(data["amount"]), data["category"],
             data["date"], data.get("notes", ""))
        )
        row = cur.fetchone()
        conn.commit()
        return jsonify(dict(row)), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/expenses/<int:expense_id>", methods=["PUT"])
def update_expense(expense_id):
    data = request.get_json()
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE expenses
            SET title = ?, amount = ?, category = ?, date = ?, notes = ?
            WHERE id = ?
            RETURNING *
            """,
            (data["title"], float(data["amount"]), data["category"],
             data["date"], data.get("notes", ""), expense_id)
        )
        row = cur.fetchone()
        conn.commit()
        if not row:
            return jsonify({"error": "Expense not found"}), 404
        return jsonify(dict(row))
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/expenses/<int:expense_id>", methods=["DELETE"])
def delete_expense(expense_id):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM expenses WHERE id = ? RETURNING id", (expense_id,)
        )
        row = cur.fetchone()
        conn.commit()
        if not row:
            return jsonify({"error": "Expense not found"}), 404
        return jsonify({"message": "Deleted successfully", "id": expense_id})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# ── Summary ──────────────────────────────────────────────────────────────────

@app.route("/api/expenses/summary", methods=["GET"])
def summary():
    conn = get_connection()
    try:
        cur = conn.cursor()
        # Total overall
        cur.execute("SELECT COALESCE(SUM(amount), 0) AS total FROM expenses")
        total = float(cur.fetchone()["total"])

        # This month
        cur.execute(
            """
            SELECT COALESCE(SUM(amount), 0) AS monthly
            FROM expenses
            WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
            """
        )
        monthly = float(cur.fetchone()["monthly"])

        # By category
        cur.execute(
            """
            SELECT category, SUM(amount) AS total
            FROM expenses
            GROUP BY category
            ORDER BY total DESC
            """
        )
        by_category = [
            {"category": r["category"], "total": float(r["total"])}
            for r in cur.fetchall()
        ]

        top_category = by_category[0]["category"] if by_category else "N/A"
        return jsonify({
            "total": total,
            "monthly": monthly,
            "top_category": top_category,
            "by_category": by_category
        })
    finally:
        conn.close()


# ── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
