import sqlite3

def clear_db():
    conn = sqlite3.connect('prisma/dev.db')
    cursor = conn.cursor()
    
    # 1. Delete purchases (foreign key constraints)
    cursor.execute('DELETE FROM "Purchase"')
    print("Purchases cleared.")
    
    # 2. Delete all leads
    cursor.execute('DELETE FROM "Lead"')
    print(f"Leads cleared: {cursor.rowcount} rows deleted.")
    
    conn.commit()
    conn.close()

if __name__ == '__main__':
    clear_db()
