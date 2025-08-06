# src/main.py

import os
import sys
from dotenv import load_dotenv
from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_migrate import Migrate

from src.models.user import db
from src.routes.user import users_bp
from src.routes.auth import auth_bp
from src.routes.investor import investor_bp
from src.routes.investor_profile import investorprofile_bp
from src.routes.enterprise_profile import enterpriseprofile_bp
from src.routes.enterprise import enterprise_bp
from src.routes.matching import matching_bp
from src.routes.events import events_bp
from src.routes.documents import documents_bp
from src.routes.messaging import messages_bp
from src.routes.analytics import analytics_bp
from src.routes.subscriptions import subscriptions_bp
from src.socketio import socketio
from src.websockets import messages_ws
from src.routes.stripe_webhook import stripe_bp

load_dotenv()

def create_app():
    app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
    app.config['SECRET_KEY'] = 'hric-platform-secret-key-2025'

    # Enable CORS
    CORS(app, origins="*")

    # Load DB config
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
    if not app.config['SQLALCHEMY_DATABASE_URI']:
        raise RuntimeError("DATABASE_URL not found in environment variables.")
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max

    # Ensure upload directory exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Init extensions
    db.init_app(app)
    Migrate(app, db)
    socketio.init_app(app)

    # Register routes
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
    app.register_blueprint(investorprofile_bp, url_prefix='/investors')
    app.register_blueprint(enterpriseprofile_bp, url_prefix='/enterprise')
    app.register_blueprint(stripe_bp, url_prefix='/stripe')

    # Static file serving
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        static_folder_path = app.static_folder
        full_path = os.path.join(static_folder_path, path)
        if path and os.path.exists(full_path):
            return send_from_directory(static_folder_path, path)
        index_path = os.path.join(static_folder_path, 'index.html')
        return send_from_directory(static_folder_path, 'index.html') if os.path.exists(index_path) else ("index.html not found", 404)

    @app.route('/api/health')
    def health_check():
        return {'status': 'healthy', 'service': 'HRIC Platform API'}, 200

    return app

# Run server
if __name__ == '__main__':
    app = create_app()
    socketio.run(app, host='0.0.0.0', port=8000, debug=True)
