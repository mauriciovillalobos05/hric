import os
import sys

# Set sys.path to allow importing from src
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_migrate import Migrate

from src.models.user import db
from src.routes.user import users_bp
from src.routes.auth import auth_bp
from src.routes.investor import investor_bp
from src.routes.enterprise import enterprise_bp
from src.routes.matching import matching_bp
from src.routes.events import events_bp
from src.routes.documents import documents_bp
from src.routes.messaging import messages_bp
from src.routes.analytics import analytics_bp
from src.routes.subscriptions import subscriptions_bp
from src.socketio import socketio
from src.websockets import messages_ws  # Assuming you use this in socketio setup

# Create Flask app
app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
app.config['SECRET_KEY'] = 'hric-platform-secret-key-2025'

# Enable CORS
CORS(app, origins="*")

# Load environment variables
load_dotenv()

# Database config
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
if not app.config['SQLALCHEMY_DATABASE_URI']:
    raise RuntimeError("DATABASE_URL not found in environment variables.")

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize extensions
db.init_app(app)
migrate = Migrate(app, db)
socketio.init_app(app)

# Register Blueprints
app.register_blueprint(users_bp, url_prefix='/api')
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(investor_bp, url_prefix='/api/investors')
app.register_blueprint(enterprise_bp, url_prefix='/api/enterprise')
app.register_blueprint(matching_bp, url_prefix='/api/matching')
app.register_blueprint(events_bp, url_prefix='/api/events')
app.register_blueprint(documents_bp, url_prefix='/api/documents')
app.register_blueprint(messages_bp, url_prefix='/api/messaging')
app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
app.register_blueprint(subscriptions_bp, url_prefix='/subscriptions')

# Static file serving (for SPA frontend)
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
        return "Static folder not configured", 404

    full_path = os.path.join(static_folder_path, path)
    if path != "" and os.path.exists(full_path):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return "index.html not found", 404

# Health check
@app.route('/api/health')
def health_check():
    return {'status': 'healthy', 'service': 'HRIC Platform API'}, 200

# Run server
if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=8000, debug=True)
