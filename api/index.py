import os
import sys
import shutil
from pathlib import Path

# Add backend directory to Python sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / 'backend'
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Ensure SQLite database is copied to writable /tmp on Vercel
if os.getenv('VERCEL'):
    tmp_db = Path('/tmp/db.sqlite3')
    orig_db = BACKEND_DIR / 'db.sqlite3'
    if not tmp_db.exists() and orig_db.exists():
        try:
            shutil.copyfile(orig_db, tmp_db)
        except Exception as e:
            print(f"Warning copying db to /tmp: {e}")

from django.core.wsgi import get_wsgi_application
app = get_wsgi_application()
handler = app
application = app
