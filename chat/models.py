from datetime import datetime
from . import db

class User(db.Model):
    __tablename__ = 'user_chat'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False)
    code = db.Column(db.String(8), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=True)
    avatar_url = db.Column(db.String(255), nullable=True)
    friends = db.Column(db.Text, default='[]')  # JSON string of friend IDs
    friend_requests = db.Column(db.Text, default='[]')  # JSON string of request IDs
    chats = db.Column(db.Text, default='{}')  # JSON string of chat data
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # Optional link to main users table id; not enforced by FK to avoid cross-DB constraints
    main_user_id = db.Column(db.Integer, nullable=True, index=True)

class FriendRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user_chat.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('user_chat.id'), nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, accepted, declined
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.String(50), nullable=False)  # user1_id_user2_id
    sender_id = db.Column(db.Integer, db.ForeignKey('user_chat.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

class Attachment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.String(50), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('user_chat.id'), nullable=False)
    file_url = db.Column(db.String(255), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
