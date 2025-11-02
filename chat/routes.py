import json
import os
import random
import string
from datetime import datetime
from flask import render_template, request, jsonify, send_from_directory, session, redirect, url_for, current_app
from werkzeug.security import generate_password_hash, check_password_hash

from . import db
from .models import User, FriendRequest, Message

# Helper functions

def generate_unique_code():
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        if not User.query.filter_by(code=code).first():
            return code

def get_user_friends(user_id):
    user = User.query.get(user_id)
    if not user:
        return []
    try:
        friend_ids = json.loads(user.friends) if user.friends else []
    except json.JSONDecodeError:
        friend_ids = []
    friends = []
    for friend_id in friend_ids:
        friend = User.query.get(friend_id)
        if friend:
            friends.append({
                'id': friend.id,
                'username': friend.username,
                'code': friend.code,
                'avatar_url': friend.avatar_url
            })
    return friends

def get_user_requests(user_id):
    user = User.query.get(user_id)
    if not user:
        return []
    try:
        request_ids = json.loads(user.friend_requests) if user.friend_requests else []
    except json.JSONDecodeError:
        request_ids = []
    requests = []
    for request_id in request_ids:
        req = FriendRequest.query.get(request_id)
        if req and req.status == 'pending':
            sender = User.query.get(req.sender_id)
            if sender:
                requests.append({
                    'id': req.id,
                    'username': sender.username,
                    'code': sender.code
                })
    return requests

def get_user_friend_ids(user_id):
    user = User.query.get(user_id)
    if not user:
        return []
    return json.loads(user.friends) if user.friends else []


def register_routes(bp, socketio):
    # Entry pages
    @bp.route('/')
    def landing():
        # Require main app login
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return render_template('chatting.html')

    @bp.route('/chat')
    def chat_page():
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return render_template('chat.html')

    # Static passthrough for uploads (served from root static folder)
    @bp.route('/static/<path:filename>')
    def static_files(filename):
        # Serve uploads from root static/uploads to keep shared location
        if filename.startswith('uploads/'):
            response = send_from_directory('static', filename, cache_timeout=0)
            response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            response.headers['Pragma'] = 'no-cache'
            return response
        # Otherwise serve original chat static assets from chatting folder
        chat_static_dir = os.path.join(current_app.root_path, 'chatting ', 'static')
        return send_from_directory(chat_static_dir, filename)

    # Bootstrap current user (create or fetch chat user for logged-in main user)
    @bp.route('/bootstrap_current', methods=['POST'])
    def bootstrap_current():
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        main_user_id = int(session['user_id'])
        main_username = session.get('name') or f'User{main_user_id}'
        user = User.query.filter_by(main_user_id=main_user_id).first()
        if not user:
            # Create new chat user mapped to main account
            code = generate_unique_code()
            user = User(username=main_username, code=code, main_user_id=main_user_id)
            db.session.add(user)
            db.session.commit()
        friends = get_user_friends(user.id)
        friend_requests = get_user_requests(user.id)
        return jsonify({
            'id': user.id,
            'username': user.username,
            'code': user.code,
            'avatar_url': user.avatar_url,
            'friends': friends,
            'friendRequests': friend_requests
        })

    # Original API routes (now under /chat prefix)
    @bp.route('/register_chat', methods=['POST'])
    def register_chat():
        data = request.json
        username = data.get('username')
        password = data.get('password')
        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400
        code = generate_unique_code()
        user = User(
            username=username,
            code=code,
            password_hash=generate_password_hash(password)
        )
        db.session.add(user)
        db.session.commit()
        return jsonify({
            'id': user.id,
            'username': user.username,
            'code': user.code,
            'avatar_url': user.avatar_url,
            'friends': [],
            'friendRequests': []
        })

    @bp.route('/login_chat', methods=['POST'])
    def login_chat():
        data = request.json
        code = (data.get('code') or '').upper()
        password = data.get('password')
        user = User.query.filter_by(code=code).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        if user.password_hash:
            if not password or not check_password_hash(user.password_hash, password):
                return jsonify({'error': 'Invalid password'}), 401
        else:
            return jsonify({'error': 'Password not set for this account'}), 403
        friends = get_user_friends(user.id)
        friend_requests = get_user_requests(user.id)
        return jsonify({
            'id': user.id,
            'username': user.username,
            'code': user.code,
            'avatar_url': user.avatar_url,
            'friends': friends,
            'friendRequests': friend_requests
        })

    @bp.route('/set_password_chat', methods=['POST'])
    def set_password_chat():
        data = request.json
        code = (data.get('code') or '').upper()
        new_password = data.get('password')
        if not code or not new_password:
            return jsonify({'error': 'Code and password are required'}), 400
        user = User.query.filter_by(code=code).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        user.password_hash = generate_password_hash(new_password)
        db.session.commit()
        return jsonify({'message': 'Password set successfully'})

    @bp.route('/update_profile_chat', methods=['POST'])
    def update_profile_chat():
        data = request.json
        user_id = data.get('user_id')
        username = data.get('username')
        avatar_url = data.get('avatar_url')
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        name_changed = False
        avatar_changed = False
        if username and username != user.username:
            user.username = username
            name_changed = True
        if avatar_url is not None and avatar_url != user.avatar_url:
            user.avatar_url = avatar_url
            avatar_changed = True
        db.session.commit()
        friends = get_user_friends(user.id)
        friend_requests = get_user_requests(user.id)
        response = {
            'id': user.id,
            'username': user.username,
            'code': user.code,
            'avatar_url': user.avatar_url,
            'friends': friends,
            'friendRequests': friend_requests
        }
        if name_changed or avatar_changed:
            for fid in get_user_friend_ids(user.id):
                socketio.emit('friend_profile_updated', {
                    'friend_id': user.id,
                    'username': user.username,
                    'avatar_url': user.avatar_url
                }, room=str(fid))
        return jsonify(response)

    @bp.route('/upload_avatar', methods=['POST'])
    def upload_avatar():
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
        file = request.files['file']
        user_id = request.form.get('user_id')
        if not user_id:
            return jsonify({'error': 'user_id is required'}), 400
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        uploads_dir = os.path.join('static', 'uploads')
        os.makedirs(uploads_dir, exist_ok=True)
        filename = f"avatar_{user_id}_{int(datetime.utcnow().timestamp())}.png"
        file_path = os.path.join(uploads_dir, filename)
        file.save(file_path)
        url_path = f"/static/uploads/{filename}"
        user = User.query.get(user_id)
        if user:
            user.avatar_url = url_path
            db.session.commit()
        return jsonify({'avatar_url': url_path})

    @bp.route('/add_friend', methods=['POST'])
    def add_friend():
        data = request.json
        user_id = data.get('user_id')
        friend_code = (data.get('friend_code') or '').upper()
        user = User.query.get(user_id)
        friend = User.query.filter_by(code=friend_code).first()
        if not user or not friend:
            return jsonify({'error': 'User or friend not found'}), 404
        if user.id == friend.id:
            return jsonify({'error': 'Cannot add yourself'}), 400
        existing_friend_ids = json.loads(user.friends) if user.friends else []
        if friend.id in existing_friend_ids:
            return jsonify({'error': 'Already friends'}), 400
        friend_request = FriendRequest(sender_id=user.id, receiver_id=friend.id)
        db.session.add(friend_request)
        db.session.commit()
        try:
            receiver_requests = json.loads(friend.friend_requests) if friend.friend_requests else []
        except json.JSONDecodeError:
            receiver_requests = []
        receiver_requests.append(friend_request.id)
        friend.friend_requests = json.dumps(receiver_requests)
        db.session.commit()
        socketio.emit('friend_request', {
            'sender_id': user.id,
            'sender_username': user.username,
            'sender_code': user.code
        }, room=str(friend.id))
        return jsonify({'message': 'Friend request sent'})

    @bp.route('/accept_request', methods=['POST'])
    def accept_request():
        data = request.json
        user_id = data.get('user_id')
        request_id = data.get('request_id')
        friend_request = FriendRequest.query.get(request_id)
        if not friend_request or friend_request.receiver_id != user_id:
            return jsonify({'error': 'Invalid request'}), 400
        friend_request.status = 'accepted'
        db.session.commit()
        sender = User.query.get(friend_request.sender_id)
        receiver = User.query.get(friend_request.receiver_id)
        try:
            sender_friends = json.loads(sender.friends) if sender.friends else []
        except json.JSONDecodeError:
            sender_friends = []
        try:
            receiver_friends = json.loads(receiver.friends) if receiver.friends else []
        except json.JSONDecodeError:
            receiver_friends = []
        if receiver.id not in sender_friends:
            sender_friends.append(receiver.id)
            sender.friends = json.dumps(sender_friends)
        if sender.id not in receiver_friends:
            receiver_friends.append(sender.id)
            receiver.friends = json.dumps(receiver_friends)
        try:
            receiver_requests = json.loads(receiver.friend_requests) if receiver.friend_requests else []
        except json.JSONDecodeError:
            receiver_requests = []
        if friend_request.id in receiver_requests:
            receiver_requests.remove(friend_request.id)
            receiver.friend_requests = json.dumps(receiver_requests)
        db.session.commit()
        socketio.emit('request_accepted', {
            'receiver_id': receiver.id,
            'receiver_username': receiver.username,
            'receiver_code': receiver.code
        }, room=str(sender.id))
        return jsonify({'message': 'Friend request accepted'})

    @bp.route('/decline_request', methods=['POST'])
    def decline_request():
        data = request.json
        user_id = data.get('user_id')
        request_id = data.get('request_id')
        friend_request = FriendRequest.query.get(request_id)
        if not friend_request or friend_request.receiver_id != user_id:
            return jsonify({'error': 'Invalid request'}), 400
        friend_request.status = 'declined'
        db.session.commit()
        receiver = User.query.get(friend_request.receiver_id)
        try:
            receiver_requests = json.loads(receiver.friend_requests) if receiver.friend_requests else []
        except json.JSONDecodeError:
            receiver_requests = []
        if friend_request.id in receiver_requests:
            receiver_requests.remove(friend_request.id)
            receiver.friend_requests = json.dumps(receiver_requests)
            db.session.commit()
        socketio.emit('request_declined', {
            'receiver_id': receiver.id,
            'receiver_username': receiver.username,
            'receiver_code': receiver.code
        }, room=str(friend_request.sender_id))
        return jsonify({'message': 'Friend request declined'})

    @bp.route('/send_message', methods=['POST'])
    def send_message():
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        sender_id = data.get('sender_id')
        receiver_id = data.get('receiver_id')
        text = (data.get('text') or '').strip()
        if not all([sender_id, receiver_id, text]):
            return jsonify({'error': 'Missing required fields'}), 400
        try:
            sender_id = int(sender_id)
            receiver_id = int(receiver_id)
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid user IDs'}), 400
        sender = User.query.get(sender_id)
        receiver = User.query.get(receiver_id)
        if not sender or not receiver:
            return jsonify({'error': 'Invalid sender or receiver'}), 404
        try:
            sender_friends = json.loads(sender.friends) if sender.friends else []
        except json.JSONDecodeError:
            return jsonify({'error': 'Invalid friends data'}), 500
        if receiver_id not in sender_friends:
            return jsonify({'error': 'Users are not friends'}), 403
        chat_id = f"{min(sender_id, receiver_id)}_{max(sender_id, receiver_id)}"
        message = Message(chat_id=chat_id, sender_id=sender_id, text=text)
        db.session.add(message)
        db.session.commit()
        message_data = {
            'chat_id': chat_id,
            'sender_id': sender_id,
            'text': text,
            'timestamp': message.timestamp.isoformat() + 'Z'
        }
        socketio.emit('new_message', message_data, room=str(sender_id))
        socketio.emit('new_message', message_data, room=str(receiver_id))
        return jsonify({'message': 'Message sent', 'message_id': message.id, 'timestamp': message.timestamp.isoformat() + 'Z'})

    @bp.route('/upload_attachment', methods=['POST'])
    def upload_attachment():
        sender_id = request.form.get('sender_id', type=int)
        receiver_id = request.form.get('receiver_id', type=int)
        if not sender_id or not receiver_id:
            return jsonify({'error': 'sender_id and receiver_id are required'}), 400
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        uploads_dir = os.path.join('static', 'uploads')
        os.makedirs(uploads_dir, exist_ok=True)
        _, ext = os.path.splitext(file.filename)
        safe_ext = ext if len(ext) <= 10 else ''
        fname = f"attach_{min(sender_id, receiver_id)}_{max(sender_id, receiver_id)}_{int(datetime.utcnow().timestamp())}{safe_ext}"
        file_path = os.path.join(uploads_dir, fname)
        file.save(file_path)
        url_path = f"/static/uploads/{fname}"
        chat_id = f"{min(sender_id, receiver_id)}_{max(sender_id, receiver_id)}"
        message = Message(chat_id=chat_id, sender_id=sender_id, text=url_path)
        db.session.add(message)
        db.session.commit()
        socketio.emit('new_message', {
            'chat_id': chat_id,
            'sender_id': sender_id,
            'text': url_path,
            'timestamp': message.timestamp.isoformat() + 'Z'
        }, room=str(chat_id))
        return jsonify({'file_url': url_path})

    @bp.route('/get_messages_chat', methods=['GET'])
    def get_messages_chat():
        user_id = request.args.get('user_id')
        friend_id = request.args.get('friend_id')
        chat_id = f"{min(int(user_id), int(friend_id))}_{max(int(user_id), int(friend_id))}"
        messages = Message.query.filter_by(chat_id=chat_id).order_by(Message.timestamp).all()
        return jsonify([
            {
                'id': msg.id,
                'sender_id': msg.sender_id,
                'text': msg.text,
                'timestamp': msg.timestamp.isoformat() + 'Z'
            }
            for msg in messages
        ])

    @bp.route('/user_data_chat', methods=['GET'])
    def user_data_chat():
        code = request.args.get('code', type=str)
        user_id = request.args.get('user_id', type=int)
        user = None
        if user_id is not None:
            user = User.query.get(user_id)
        elif code:
            user = User.query.filter_by(code=(code or '').upper()).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        friends = get_user_friends(user.id)
        friend_requests = get_user_requests(user.id)
        return jsonify({
            'id': user.id,
            'username': user.username,
            'code': user.code,
            'avatar_url': user.avatar_url,
            'friends': friends,
            'friendRequests': friend_requests
        })

    @bp.route('/is_online', methods=['GET'])
    def is_online():
        # Handled via Socket.IO presence; provided for API parity
        user_id = request.args.get('user_id', type=int)
        # This endpoint will be filled by sockets module via shared state
        from .sockets import online_user_ids
        return jsonify({'user_id': user_id, 'online': user_id in online_user_ids})

    @bp.route('/online_friends', methods=['GET'])
    def online_friends():
        from .sockets import online_user_ids
        user_id = request.args.get('user_id', type=int)
        friend_ids = set(get_user_friend_ids(user_id))
        return jsonify({'online_friend_ids': [fid for fid in friend_ids if fid in online_user_ids]})

    @bp.route('/get_gallery_images', methods=['GET'])
    def get_gallery_images():
        """Get images for the image gallery - using existing sign language images"""
        try:
            # Use existing sign language alphabet images
            images = []
            # Create list of alphabet images
            for char in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
                image_url = f'/static/images/{char}.jpeg'
                images.append({
                    'url': image_url,
                    'alt': f'Sign language letter {char}',
                    'name': f'Letter {char}'
                })
            
            # Add some example images if available
            static_images_dir = os.path.join(current_app.static_folder, 'images')
            if os.path.exists(static_images_dir):
                for filename in os.listdir(static_images_dir):
                    if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
                        if not filename.endswith('.jpeg') or len(filename) != 6:  # Skip alphabet images
                            continue
                        image_url = f'/static/images/{filename}'
                        if image_url not in [img['url'] for img in images]:
                            images.append({
                                'url': image_url,
                                'alt': f'Image {filename}',
                                'name': filename
                            })
            
            return jsonify({'images': images})
        
        except Exception as e:
            print(f"Error loading gallery images: {e}")
            return jsonify({'error': 'Failed to load images', 'images': []}), 500

    @bp.route('/send_image_gallery', methods=['POST'])
    def send_image_gallery():
        """Send selected images from gallery as a message"""
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        sender_id = data.get('sender_id')
        receiver_id = data.get('receiver_id')
        images = data.get('images', [])
        
        if not all([sender_id, receiver_id, images]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        try:
            sender_id = int(sender_id)
            receiver_id = int(receiver_id)
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid user IDs'}), 400
        
        sender = User.query.get(sender_id)
        receiver = User.query.get(receiver_id)
        if not sender or not receiver:
            return jsonify({'error': 'Invalid sender or receiver'}), 404
        
        # Verify friendship
        try:
            sender_friends = json.loads(sender.friends) if sender.friends else []
        except json.JSONDecodeError:
            return jsonify({'error': 'Invalid friends data'}), 500
        
        if receiver_id not in sender_friends:
            return jsonify({'error': 'Users are not friends'}), 403
        
        # Create gallery message
        chat_id = f"{min(sender_id, receiver_id)}_{max(sender_id, receiver_id)}"
        
        # Store as JSON with special type indicator
        message_data = {
            'type': 'image_gallery',
            'images': images,
            'count': len(images)
        }
        
        message = Message(
            chat_id=chat_id, 
            sender_id=sender_id, 
            text=json.dumps(message_data)
        )
        db.session.add(message)
        db.session.commit()
        
        # Emit to both users
        socket_message_data = {
            'chat_id': chat_id,
            'sender_id': sender_id,
            'text': json.dumps(message_data),
            'timestamp': message.timestamp.isoformat() + 'Z',
            'type': 'image_gallery'
        }
        
        socketio.emit('new_message', socket_message_data, room=str(sender_id))
        socketio.emit('new_message', socket_message_data, room=str(receiver_id))
        
        return jsonify({
            'message': 'Images sent successfully', 
            'message_id': message.id,
            'timestamp': message.timestamp.isoformat() + 'Z'
        })
