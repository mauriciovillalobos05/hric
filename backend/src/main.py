import os
import sys
# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from dotenv import load_dotenv
from flask import Flask, send_from_directory
from flask_cors import CORS
from src.models.user import db
from src.routes.user import user_bp
from src.routes.auth import auth_bp
from src.routes.investor import investor_bp
from src.routes.enterprise import enterprise_bp
from src.routes.matching import matching_bp
from src.routes.events import events_bp
from src.routes.documents import documents_bp
from src.routes.messaging import messaging_bp
from src.routes.analytics import analytics_bp

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
app.config['SECRET_KEY'] = 'hric-platform-secret-key-2025'

# Enable CORS for all routes
CORS(app, origins="*")

# Load environment variables from .env
load_dotenv()

# Register all blueprints
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(investor_bp, url_prefix='/api/investors')
app.register_blueprint(enterprise_bp, url_prefix='/api/enterprise')
app.register_blueprint(matching_bp, url_prefix='/api/matching')
app.register_blueprint(events_bp, url_prefix='/api/events')
app.register_blueprint(documents_bp, url_prefix='/api/documents')
app.register_blueprint(messaging_bp, url_prefix='/api/messaging')
app.register_blueprint(analytics_bp, url_prefix='/api/analytics')

# PostgreSQL DB from Supabase
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
if not app.config['SQLALCHEMY_DATABASE_URI']:
    raise RuntimeError("DATABASE_URL not found in environment variables.")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Create upload directory if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

db.init_app(app)
with app.app_context():
    db.create_all()

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
        return "Static folder not configured", 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return "index.html not found", 404

@app.route('/api/health')
def health_check():
    return {'status': 'healthy', 'service': 'HRIC Platform API'}, 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=6543, debug=True)