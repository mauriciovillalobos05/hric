import os
from dotenv import load_dotenv
from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_migrate import Migrate

from src.extensions import db
from src.routes.user import users_bp
from src.routes.auth import auth_bp
from src.routes.investor import investor_bp
from src.routes.matching import matching_bp
from src.routes.events import events_bp
from src.routes.documents import documents_bp
from src.routes.messaging import messages_bp
from src.routes.analytics import analytics_bp
from src.routes.subscriptions import subscriptions_bp
from src.routes.lookups import lookups_bp
from src.routes.enterprise_members import members_bp
from src.routes.startup import startup_bp
from src.routes.virtual_portfolios import vp_bp
from src.routes.simulations import sims_bp
from src.routes.gamification import game_bp
from src.routes.market_recs import recs_bp
from src.socketio import socketio
from src.routes.stripe_webhook import webhooks_bp
from src.routes.enterprise_profile import entrepreneur_bp

load_dotenv()

def create_app():
    app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
    app.config['SECRET_KEY'] = 'hric-platform-secret-key-2025'

    # CORS
    CORS(app, origins="*")

    # DB URL (normalize postgres:// → postgresql:// for SQLAlchemy)
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise RuntimeError("DATABASE_URL not found in environment variables.")
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {"pool_pre_ping": True}

    # Uploads
    app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Init extensions
    db.init_app(app)
    Migrate(app, db, compare_type=True, compare_server_default=True)
    socketio.init_app(app)

    # Ensure models are registered with SQLAlchemy’s metadata
    with app.app_context():
        import src.models  # <-- important for Alembic autogenerate

    # Blueprints
    app.register_blueprint(users_bp, url_prefix='/api')
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(investor_bp, url_prefix="/api/investors")
    app.register_blueprint(entrepreneur_bp, url_prefix="/api/entrepreneurs")
    app.register_blueprint(matching_bp, url_prefix='/api')
    app.register_blueprint(events_bp, url_prefix='/api')
    app.register_blueprint(documents_bp, url_prefix='/api')
    app.register_blueprint(messages_bp, url_prefix='/api')
    app.register_blueprint(analytics_bp, url_prefix='/api')
    app.register_blueprint(subscriptions_bp, url_prefix="/api/subscriptions")
    app.register_blueprint(lookups_bp, url_prefix="/api")
    app.register_blueprint(members_bp, url_prefix="/api")
    app.register_blueprint(startup_bp, url_prefix="/api")
    app.register_blueprint(vp_bp,    url_prefix="/api")
    app.register_blueprint(sims_bp,  url_prefix="/api")
    app.register_blueprint(game_bp,  url_prefix="/api")
    app.register_blueprint(recs_bp,  url_prefix="/api")
    app.register_blueprint(webhooks_bp, url_prefix="/stripe")

    # Static files
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

if __name__ == '__main__':
    app = create_app()
    socketio.run(app, host='0.0.0.0', port=8000, debug=True)