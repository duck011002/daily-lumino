import os
import sys

import pymysql

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings


def create_database():
    try:
        # Connect to MySQL server without specifying a database
        conn = pymysql.connect(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
            charset="utf8mb4",
        )
        cursor = conn.cursor()
        cursor.execute(
            f"CREATE DATABASE IF NOT EXISTS {settings.DB_NAME} "
            f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        )
        print(f"Database '{settings.DB_NAME}' created or already exists.")
        conn.close()
    except Exception as e:
        print(f"Error creating database: {e}")
        sys.exit(1)


if __name__ == "__main__":
    create_database()
