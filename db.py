import sqlite3
import os

DB_PATH = "expense_tracker.db"

def get_connection():
    """Return a new sqlite3 connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Create tables if they don't exist."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                amount REAL NOT NULL,
                category TEXT NOT NULL DEFAULT 'Other',
                date TEXT NOT NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()
        print("[DB] Tables initialized successfully.")
    except Exception as e:
        conn.rollback()
        print(f"[DB] Error initializing tables: {e}")
        raise
    finally:
        conn.close()
