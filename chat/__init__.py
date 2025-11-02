from flask import Blueprint, current_app, session, jsonify
from flask_sqlalchemy import SQLAlchemy

# SQLAlchemy instance dedicated to chat DB
# The main app will configure SQLALCHEMY_DATABASE_URI to the chat DB
# so we don't need binds as the main app uses mysql.connector for its own tables.
db = SQLAlchemy()

chat_bp = Blueprint(
    'chat_bp',
    __name__,
    template_folder='../templates/chat',
)

# We will register routes and socket handlers from sibling modules

def init_chat(app, socketio):
    """Initialize chat subsystem: DB, models, routes, and socket handlers."""
    # Ensure SQLAlchemy is initialized with the app
    db.init_app(app)

    # Import models to ensure tables are known
    from . import models  # noqa: F401

    # Register routes
    from .routes import register_routes
    register_routes(chat_bp, socketio)
    app.register_blueprint(chat_bp, url_prefix='/chat')

    # Register Socket.IO event handlers
    from .sockets import register_socketio_handlers
    register_socketio_handlers(socketio)

    # Create tables in the chat DB if not present
    with app.app_context():
        db.create_all()