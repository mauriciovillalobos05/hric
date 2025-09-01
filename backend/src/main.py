# src/main.py
import os
from dotenv import load_dotenv
from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_migrate import Migrate

from src.extensions import db
from src.socketio import socketio
from src.routes.auth import auth_bp
from src.routes.subscriptions import subscriptions_bp

load_dotenv()

def create_app():
    app = Flask(
        __name__,
        static_folder=os.path.join(os.path.dirname(__file__), "static"),
    )
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "hric-platform-secret-key-2025")

    # ----- CORS (only front-end origins) -----
    # Example: ALLOWED_ORIGINS="https://hric-unh3.vercel.app,http://localhost:5173"
    allowed_origins = [
        o.strip()
        for o in os.getenv(
            "ALLOWED_ORIGINS",
            "https://hric-unh3.vercel.app,http://localhost:5173",
        ).split(",")
        if o.strip()
    ]

    # API CORS
    CORS(app, resources={r"/api/*": {"origins": allowed_origins}})

    # Socket.IO CORS — init ONCE
    socketio.init_app(app, cors_allowed_origins=allowed_origins)

    # ----- Database -----
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not found in environment variables.")
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    app.config["SQLALCHEMY_DATABASE_URI"] = db_url
    engine_opts = {"pool_pre_ping": True}

    # If using Supabase and no explicit sslmode in the URL, enforce SSL
    if "supabase.co" in db_url and "sslmode=" not in db_url:
        engine_opts["connect_args"] = {"sslmode": "require"}

    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = engine_opts
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Uploads
    app.config["UPLOAD_FOLDER"] = os.path.join(os.path.dirname(__file__), "uploads")
    app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Init extensions
    db.init_app(app)
    Migrate(app, db, compare_type=True, compare_server_default=True)

    # Ensure models are registered with SQLAlchemy’s metadata
    with app.app_context():
        import src.models  # noqa: F401

    # Blueprints
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(subscriptions_bp, url_prefix="/api/subscriptions")

    # Static (fallback to index.html for SPA)
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve(path):
        static_folder_path = app.static_folder
        full_path = os.path.join(static_folder_path, path)
        if path and os.path.exists(full_path):
            return send_from_directory(static_folder_path, path)
        index_path = os.path.join(static_folder_path, "index.html")
        return (
            send_from_directory(static_folder_path, "index.html")
            if os.path.exists(index_path)
            else ("index.html not found", 404)
        )

    @app.route("/api/health")
    def health_check():
        return {"status": "healthy", "service": "HRIC Platform API"}, 200

    return app


if __name__ == "__main__":
    app = create_app()
    socketio.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), debug=True)