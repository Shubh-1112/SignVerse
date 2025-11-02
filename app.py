import os
from flask import Flask, render_template, request, redirect, session, url_for, flash, jsonify
import json
import time
from datetime import datetime
from dotenv import load_dotenv
import mysql.connector
import requests
from flask_socketio import SocketIO, join_room, leave_room, emit
from collections import deque
from ultralytics import YOLO
from PIL import Image
import io, base64, numpy as np
import threading, re
from functools import wraps
from urllib.parse import quote_plus

def login_required(f):
    """Decorator to require login for protected routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({"success": False, "message": "You must be logged in to access this page."}), 401
            else:
                flash("You must be logged in to access this page.")
                return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY") or "mysecret"
app.config['SECRET_KEY'] = app.secret_key

# Configure SQLAlchemy for chat subsystem (separate DB)
chat_db_uri = os.getenv("CHAT_DATABASE_URI")
if not chat_db_uri:
    # Build from existing MySQL env with default DB name 'chatting_db'
    _host = os.getenv("MYSQL_HOST") or "localhost"
    _user = os.getenv("MYSQL_USER") or "root"
    _password = os.getenv("MYSQL_PASSWORD") or ""
    _chat_db = os.getenv("CHAT_DATABASE") or "chatting_db"
    # URL-encode credentials to safely handle special characters like '@' in passwords
    enc_user = quote_plus(_user)
    enc_pass = quote_plus(_password)
    chat_db_uri = f"mysql+mysqlconnector://{enc_user}:{enc_pass}@{_host}/{_chat_db}"
app.config['SQLALCHEMY_DATABASE_URI'] = chat_db_uri
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize chat blueprint and models
try:
    from chat import init_chat
    init_chat(app, socketio)

    # Back-compat proxy routes so existing chat JS paths continue to work
    from flask import Response

    def _proxy(path):
        # Preserve method and body using 307 redirect to the /chat-prefixed endpoint
        return redirect(f"/chat{path}", code=307)

    @app.route('/register_chat', methods=['POST'])
    def _proxy_register_chat():
        return _proxy('/register_chat')

    @app.route('/login_chat', methods=['POST'])
    def _proxy_login_chat():
        return _proxy('/login_chat')

    @app.route('/set_password_chat', methods=['POST'])
    def _proxy_set_password_chat():
        return _proxy('/set_password_chat')

    @app.route('/update_profile_chat', methods=['POST'])
    def _proxy_update_profile_chat():
        return _proxy('/update_profile_chat')

    @app.route('/upload_avatar', methods=['POST'])
    def _proxy_upload_avatar():
        return _proxy('/upload_avatar')

    @app.route('/add_friend', methods=['POST'])
    def _proxy_add_friend():
        return _proxy('/add_friend')

    @app.route('/accept_request', methods=['POST'])
    def _proxy_accept_request():
        return _proxy('/accept_request')

    @app.route('/decline_request', methods=['POST'])
    def _proxy_decline_request():
        return _proxy('/decline_request')

    @app.route('/get_messages_chat', methods=['GET'])
    def _proxy_get_messages_chat():
        return redirect('/chat/get_messages_chat', code=302)

    @app.route('/user_data_chat', methods=['GET'])
    def _proxy_user_data_chat():
        return redirect('/chat/user_data_chat', code=302)

    @app.route('/is_online', methods=['GET'])
    def _proxy_is_online():
        return redirect('/chat/is_online', code=302)

    @app.route('/online_friends', methods=['GET'])
    def _proxy_online_friends():
        return redirect('/chat/online_friends', code=302)

    @app.route('/send_message', methods=['POST'])
    def _proxy_send_message():
        return _proxy('/send_message')

    @app.route('/upload_attachment', methods=['POST'])
    def _proxy_upload_attachment():
        return _proxy('/upload_attachment')

except Exception as _e:
    print("[WARN] Chat subsystem initialization failed:", _e)

# --------------------- DB CONNECTION ---------------------
mydb = mysql.connector.connect(
    host=os.getenv("MYSQL_HOST") or "localhost",
    user=os.getenv("MYSQL_USER") or "root",
    password=os.getenv("MYSQL_PASSWORD") or "",
    database=os.getenv("MYSQL_DATABASE") or "signverse_app"
)

# --------------------- TABLE CREATION ---------------------
cur = mydb.cursor()
cur.execute("""
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    password VARCHAR(100) NOT NULL,
    contact VARCHAR(20),
    date_of_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_of_birth DATETIME,
    email VARCHAR(50)
);
""")
cur.execute("""
CREATE TABLE IF NOT EXISTS feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    feedback TEXT,
    likes INT DEFAULT 0,
    dislikes INT DEFAULT 0,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
""")
cur.execute("""
CREATE TABLE IF NOT EXISTS feedback_reactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    feedback_id INT NOT NULL,
    user_id INT NOT NULL,
    reaction ENUM('like','dislike') NOT NULL,
    UNIQUE(feedback_id, user_id),
    FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
""")
cur.execute("""
CREATE TABLE IF NOT EXISTS lesson_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    lesson_number INT NOT NULL,
    completed_until INT DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE(user_id, lesson_number),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
""")
mydb.commit()
cur.close()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        name = request.form.get('username')
        password = request.form.get('password')

        try:
            cursor = mydb.cursor(dictionary=True)
            cursor.execute("SELECT * FROM users WHERE name = %s AND password = %s", (name, password))
            user = cursor.fetchone()
            cursor.close()

            if user:
                session['user_id'] = user['id']
                session['name'] = user['name']
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({"success": True, "message": "Login successful"})
                return redirect(url_for('home'))
            else:
                error = "Invalid credentials"
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({"success": False, "message": "Invalid credentials"}), 401
        except mysql.connector.Error as e:
            print("MySQL Error:", e)
            error = "Database error"
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({"success": False, "message": "Database error"}), 500
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    try:
        if 'user_id' not in session:
            return jsonify({"success": False, "message": "User is not logged in"}), 401
        session.clear()
        return jsonify({"success": True, "message": "Logout successful"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/login-status')
def login_status():
    """Check if user is logged in"""
    if 'user_id' in session:
        return jsonify({
            "logged_in": True,
            "user_id": session['user_id'],
            "username": session.get('name', '')
        })
    else:
        return jsonify({"logged_in": False})

@app.route('/profile')
def profile():
    if 'user_id' not in session:
        return redirect('/login')

    user_id = session['user_id']
    cur = mydb.cursor(dictionary=True)
    cur.execute("SELECT name, email, date_of_birth, contact FROM users WHERE id = %s", (user_id,))
    user = cur.fetchone()
    cur.close()

    if not user:
        flash("User not found")
        return redirect('/login')

    return render_template('profile.html', user=user)

@app.route('/verify_edit', methods=['GET', 'POST'])
def verify_edit():
    # Check if this is a forgot password request
    forgot_password = request.args.get('forgot_password') == 'true' or session.get('forgot_password_flow', False)
    
    if request.method == 'POST':
        # For normal profile editing, require login
        if not forgot_password and 'user_id' not in session:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({"success": False, "message": "You must be logged in to access this page."}), 401
            else:
                flash("You must be logged in to access this page.")
                return redirect(url_for('login'))

        # Handle both form data and JSON
        if request.is_json:
            data = request.get_json()
            verify_type = data.get('verify_type')
            password_input = data.get('password')
            contact_input = data.get('contact')
            email_input = data.get('email')
            dob_input = data.get('dob')
            username_input = data.get('username') if forgot_password else None
        else:
            verify_type = request.form.get('verify_type')
            password_input = request.form.get('password')
            contact_input = request.form.get('contact')
            email_input = request.form.get('email')
            dob_input = request.form.get('dob')
            username_input = request.form.get('username') if forgot_password else None

        # For forgot password flow, find user by username instead of session
        if forgot_password and username_input:
            cur = mydb.cursor(dictionary=True)
            cur.execute("SELECT id, password, contact, email, date_of_birth FROM users WHERE name = %s", (username_input,))
            user_data = cur.fetchone()
            cur.close()
            
            if not user_data:
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({"success": False, "message": "Username not found"}), 404
                else:
                    flash("Username not found")
                    return redirect(url_for('verify_edit', forgot_password='true'))
                    
            user_id = user_data['id']
            user = user_data
        else:
            user_id = session['user_id']

            cur = mydb.cursor(dictionary=True)
            cur.execute("SELECT password, contact, email, date_of_birth FROM users WHERE id = %s", (user_id,))
            user = cur.fetchone()
            cur.close()

        if not user:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({"success": False, "message": "User not found"}), 404
            else:
                flash("User not found")
                return redirect(url_for('verify_edit'))

        if not dob_input:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({"success": False, "message": "Date of birth is required"}), 400
            else:
                flash("Date of birth is required")
                return redirect(url_for('verify_edit'))

        # Check DOB
        if user['date_of_birth'].strftime('%Y-%m-%d') != dob_input:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({"success": False, "message": "Incorrect date of birth"}), 400
            else:
                flash("Incorrect date of birth")
                return redirect(url_for('verify_edit'))

        # Check the specific field
        if verify_type == 'password':
            if user['password'] == password_input:
                session['verified'] = True
                if forgot_password:
                    session['forgot_password_flow'] = True
                    session['forgot_password_user_id'] = user_id
                    session['password_only_edit'] = True  # Only allow password editing
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({"success": True, "redirect": "/edit_profile"})
                else:
                    return redirect(url_for('edit_profile'))
            else:
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({"success": False, "message": "Incorrect password"}), 400
                else:
                    flash("Incorrect password")
                    return redirect(url_for('verify_edit'))
        elif verify_type == 'contact':
            if user['contact'] == contact_input:
                session['verified'] = True
                if forgot_password:
                    session['forgot_password_flow'] = True
                    session['forgot_password_user_id'] = user_id
                    session['password_only_edit'] = True  # Only allow password editing
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({"success": True, "redirect": "/edit_profile"})
                else:
                    return redirect(url_for('edit_profile'))
            else:
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({"success": False, "message": "Incorrect contact number"}), 400
                else:
                    flash("Incorrect contact number")
                    return redirect(url_for('verify_edit'))
        elif verify_type == 'email':
            if user['email'] == email_input:
                session['verified'] = True
                if forgot_password:
                    session['forgot_password_flow'] = True
                    session['forgot_password_user_id'] = user_id
                    session['password_only_edit'] = True  # Only allow password editing
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({"success": True, "redirect": "/edit_profile"})
                else:
                    return redirect(url_for('edit_profile'))
            else:
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({"success": False, "message": "Incorrect email address"}), 400
                else:
                    flash("Incorrect email address")
                    return redirect(url_for('verify_edit'))
        else:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({"success": False, "message": "Invalid verification type"}), 400
            else:
                flash("Invalid verification type")
                return redirect(url_for('verify_edit'))

    # Store forgot password state in session for form processing
    if forgot_password:
        session['forgot_password_flow'] = True
    
    logged_in = 'user_id' in session
    return render_template('verify_edit.html', logged_in=logged_in, forgot_password=forgot_password)

@app.route('/edit_profile', methods=['GET', 'POST'])
def edit_profile():
    # Check if this is a forgot password flow
    forgot_password_flow = session.get('forgot_password_flow', False)
    password_only = session.get('password_only_edit', False)
    
    # For forgot password flow, use the stored user ID
    if forgot_password_flow:
        if 'forgot_password_user_id' not in session:
            flash("Invalid session. Please start the password reset process again.")
            return redirect('/login')
        user_id = session['forgot_password_user_id']
    else:
        if 'user_id' not in session:
            return redirect('/login')
        user_id = session['user_id']

    if 'verified' not in session or not session['verified']:
        flash("Please verify your identity first")
        return redirect('/verify_edit')

    user_id = session['user_id']
    cur = mydb.cursor(dictionary=True)
    cur.execute("SELECT name, email, contact FROM users WHERE id = %s", (user_id,))
    user = cur.fetchone()
    cur.close()

    if not user:
        flash("User not found")
        return redirect('/login')

    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        contact = request.form.get('contact')
        password = request.form.get('password')

        update_fields = []
        update_values = []

        # If in password-only mode (forgot password flow), only allow password changes
        if password_only:
            if password:
                update_fields.append("password = %s")
                update_values.append(password)
            else:
                flash("Please enter a new password")
                return render_template('edit_profile.html', user=user, password_only=password_only, forgot_password_flow=forgot_password_flow)
        else:
            # Normal profile editing - allow all fields
            if name:
                update_fields.append("name = %s")
                update_values.append(name)
            if email:
                update_fields.append("email = %s")
                update_values.append(email)
            if contact:
                update_fields.append("contact = %s")
                update_values.append(contact)
            if password:
                update_fields.append("password = %s")
                update_values.append(password)

        if update_fields:
            update_values.append(user_id)
            query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = %s"
            cur = mydb.cursor()
            cur.execute(query, update_values)
            mydb.commit()
            cur.close()
            
            # Clean up session flags
            session.pop('verified', None)
            
            if forgot_password_flow:
                # Clean up forgot password session data
                session.pop('forgot_password_flow', None)
                session.pop('forgot_password_user_id', None)
                session.pop('password_only_edit', None)
                flash("Password updated successfully! Please login with your new password.")
                return redirect('/login')
            else:
                flash("Profile updated successfully")
                return redirect('/profile')
        else:
            if password_only:
                flash("Please enter a new password")
            else:
                flash("No changes made")

    return render_template('edit_profile.html', user=user, password_only=password_only, forgot_password_flow=forgot_password_flow)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        first_name = request.form['firstName']
        last_name = request.form['lastName']
        full_name = f"{first_name} {last_name}"
        password = request.form['password']
        confirm_password = request.form['confirmPassword']
        contact = request.form.get('contact')
        email = request.form.get('email')
        dob = request.form.get('dob')

        if password != confirm_password:
            flash("❌ Passwords do not match. Please try again.")
            return redirect('/register')

        cur = mydb.cursor()
        cur.execute(
            "INSERT INTO users (name, password, contact, email, date_of_birth) VALUES (%s, %s, %s, %s, %s)",
            (full_name, password, contact, email, dob)
        )
        mydb.commit()
        cur.close()
        flash("✅ Registered successfully. Please log in.")
        return redirect('/login')

    return render_template("register.html")

@app.route('/submit_feedback', methods=['POST'])
def submit_feedback():
    first_name = request.form.get('first_name') or request.form.get('feedback_name') or ''
    last_name = request.form.get('last_name') or ''
    feedback_text = request.form.get('feedback') or request.form.get('feedback_text') or ''

    if not first_name or not feedback_text:
        return jsonify(success=False, message="⚠️ Please provide your name and feedback.")

    cur = mydb.cursor()
    cur.execute(
        "INSERT INTO feedback (first_name, last_name, feedback) VALUES (%s, %s, %s)",
        (first_name, last_name, feedback_text)
    )
    mydb.commit()
    new_id = cur.lastrowid
    cur.close()

    return jsonify({
        "success": True,
        "id": new_id,
        "first_name": first_name,
        "last_name": last_name,
        "feedback": feedback_text,
        "likes": 0,
        "dislikes": 0,
        "submitted_at": datetime.now().strftime("%Y-%m-%d %H:%M")
    })

@app.route('/view_feedback')
def view_feedback():
    if 'user_id' not in session:
        return redirect('/login')

    user_id = session['user_id']

    cur = mydb.cursor(dictionary=True)
    cur.execute("""
        SELECT f.id, f.first_name, f.last_name, f.feedback, 
               (SELECT COUNT(*) FROM feedback_reactions r WHERE r.feedback_id=f.id AND r.reaction='like') AS likes,
               (SELECT COUNT(*) FROM feedback_reactions r WHERE r.feedback_id=f.id AND r.reaction='dislike') AS dislikes,
               f.submitted_at,
               (SELECT reaction FROM feedback_reactions r WHERE r.feedback_id=f.id AND r.user_id=%s) AS user_reaction
        FROM feedback f 
        ORDER BY f.submitted_at DESC
    """, (user_id,))
    feedbacks = cur.fetchall() or []
    cur.close()

    for f in feedbacks:
        # Format datetime
        if isinstance(f['submitted_at'], datetime):
            f['submitted_at'] = f['submitted_at'].strftime("%Y-%m-%d %H:%M")
        # Flags for frontend button highlighting
        f['userLiked'] = f['user_reaction'] == 'like'
        f['userDisliked'] = f['user_reaction'] == 'dislike'

    # Get total stats
    cur = mydb.cursor()
    cur.execute("SELECT COUNT(*) FROM feedback")
    total_feedback = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM feedback_reactions WHERE reaction='like'")
    total_likes = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM feedback_reactions WHERE reaction='dislike'")
    total_dislikes = cur.fetchone()[0]
    cur.close()

    stats = {
        "total_feedback": int(total_feedback or 0),
        "total_likes": int(total_likes or 0),
        "total_dislikes": int(total_dislikes or 0)
    }

    return render_template('feedback.html', feedbacks=feedbacks, stats=stats, username=session.get('name'))

@app.route('/react_feedback/<int:feedback_id>/<action>', methods=['POST'])
def react_feedback(feedback_id, action):
    if 'user_id' not in session:
        return jsonify(success=False, message="Login required"), 403

    user_id = session['user_id']
    if action not in ("like", "dislike"):
        return jsonify(success=False, message="Invalid action"), 400

    cur = mydb.cursor(dictionary=True)
    # Check if user already reacted
    cur.execute("SELECT reaction FROM feedback_reactions WHERE feedback_id=%s AND user_id=%s", (feedback_id, user_id))
    existing = cur.fetchone()

    if existing:
        if existing['reaction'] == action:
            # Undo reaction → delete record
            cur.execute("DELETE FROM feedback_reactions WHERE feedback_id=%s AND user_id=%s", (feedback_id, user_id))
        else:
            # Switch reaction → update record
            cur.execute("UPDATE feedback_reactions SET reaction=%s WHERE feedback_id=%s AND user_id=%s", (action, feedback_id, user_id))
    else:
        # Add new reaction
        cur.execute("INSERT INTO feedback_reactions (feedback_id, user_id, reaction) VALUES (%s, %s, %s)", (feedback_id, user_id, action))

    mydb.commit()

    # Recalculate counts for this feedback
    cur.execute("SELECT COUNT(*) AS likes FROM feedback_reactions WHERE feedback_id=%s AND reaction='like'", (feedback_id,))
    likes = cur.fetchone()['likes']
    cur.execute("SELECT COUNT(*) AS dislikes FROM feedback_reactions WHERE feedback_id=%s AND reaction='dislike'", (feedback_id,))
    dislikes = cur.fetchone()['dislikes']

    # Update feedback table for compatibility (optional)
    cur.execute("UPDATE feedback SET likes=%s, dislikes=%s WHERE id=%s", (likes, dislikes, feedback_id))
    mydb.commit()

    # --- compute global totals from the reactions table ---
    cur.execute("SELECT COUNT(*) AS total_feedback FROM feedback")
    total_feedback = cur.fetchone()['total_feedback']
    cur.execute("SELECT COUNT(*) AS total_likes FROM feedback_reactions WHERE reaction='like'")
    total_likes = cur.fetchone()['total_likes']
    cur.execute("SELECT COUNT(*) AS total_dislikes FROM feedback_reactions WHERE reaction='dislike'")
    total_dislikes = cur.fetchone()['total_dislikes']

    # --- return the current user's reaction for this feedback (after the change) ---
    cur.execute("SELECT reaction FROM feedback_reactions WHERE feedback_id=%s AND user_id=%s", (feedback_id, user_id))
    user_row = cur.fetchone()
    user_reaction = user_row['reaction'] if user_row else None

    cur.close()
    return jsonify({
        "success": True,
        "likes": int(likes or 0),
        "dislikes": int(dislikes or 0),
        "total_feedback": int(total_feedback or 0),
        "total_likes": int(total_likes or 0),
        "total_dislikes": int(total_dislikes or 0),
        "user_reaction": user_reaction  # will be 'like' / 'dislike' / None
    })

@app.route('/feedback_stats')
@login_required
def feedback_stats():
    cur = mydb.cursor()
    cur.execute("SELECT COUNT(*) FROM feedback")
    total_feedback = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM feedback_reactions WHERE reaction='like'")
    total_likes = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM feedback_reactions WHERE reaction='dislike'")
    total_dislikes = cur.fetchone()[0]
    cur.close()

    return jsonify({
        "total_feedback": int(total_feedback or 0),
        "total_likes": int(total_likes or 0),
        "total_dislikes": int(total_dislikes or 0)
    })

@app.route('/api/chatbot', methods=['POST'])
def chatbot():
    data = request.get_json()
    user_message = data.get('message', '')
    if not user_message:
        return jsonify({'error': 'No message provided'}), 400

    # Initialize conversation history in session if not present
    if 'conversation' not in session:
        session['conversation'] = []

    # Append user message to conversation history
    session['conversation'].append({'role': 'user', 'content': user_message})

    # Prepare messages payload for Ollama
    messages = session['conversation']

    ollama_url = 'http://localhost:11434/api/generate'
    prompt = user_message
    payload = {
        'model': 'Sign_Setu',  # Use your custom mistral model name here
        'prompt': prompt,
        'stream': False
    }

    max_retries = 3
    retry_delay = 1  # seconds
    timeout_seconds = 120  # Increased timeout for slower hardware

    for attempt in range(max_retries):
        try:
            response = requests.post(ollama_url, json=payload, timeout=timeout_seconds)
            response.raise_for_status()

            # Parse streaming-safe response
            output_text = ""
            for line in response.text.strip().splitlines():
                try:
                    chunk = json.loads(line)
                    output_text += chunk.get("response", "")
                except:
                    continue

            # Clean up any markdown/code block markers
            output_text = output_text.replace("```json", "").replace("```", "").strip()

            # Try to parse final JSON if possible
            try:
                result_json = json.loads(output_text)
                bot_reply = result_json.get("corrected") or result_json.get("reply") or output_text
            except Exception:
                bot_reply = output_text

            if not bot_reply:
                return jsonify({'error': 'No reply content from Ollama'}), 500

            # Append bot reply to conversation history
            session['conversation'].append({'role': 'assistant', 'content': bot_reply})
            session.modified = True

            return jsonify({'reply': bot_reply})
        except requests.exceptions.RequestException as e:
            print(f"Ollama error on attempt {attempt + 1}: {e}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
            else:
                return jsonify({'error': f'Failed to get response from Ollama after {max_retries} attempts: {str(e)}'}), 500
            # Clean up any markdown/code block markers

# Path where alphabet and digit images are stored
IMAGE_DIR = os.path.join("static", "images")

rooms = {}  # room_id -> list of usernames

@socketio.on('join')
def on_join(data):
    username = data['username']
    room = data['room']
    join_room(room)

    if room not in rooms:
        rooms[room] = []
    rooms[room].append(username)

    # Notify existing users about the new user
    emit('user-joined', {'username': username, 'room': room}, room=room, include_self=False)

    # Send list of existing users to the new user
    existing_users = [u for u in rooms[room] if u != username]
    if existing_users:
        emit('existing-users', {'users': existing_users, 'room': room})

    print(f"{username} joined room {room}. Users now: {rooms[room]}")

@socketio.on('leave')
def on_leave(data):
    username = data['username']
    room = data['room']
    leave_room(room)
    if room in rooms and username in rooms[room]:
        rooms[room].remove(username)

        # Auto-delete room when it becomes empty
        if not rooms[room]:
            del rooms[room]
            print(f"Room {room} deleted - no users remaining")

    emit('user-left', {'username': username, 'room': room}, room=room)
    print(f"{username} left room {room}. Users now: {rooms.get(room, [])}")

# Chat message handling
@socketio.on('chat-message')
def on_chat_message(data):
    room = data['room']
    emit('chat-message', data, room=room, include_self=False)

# Text-Sign message handling
@socketio.on('text-sign-message')
def on_text_sign_message(data):
    # Broadcast the text-sign data to all others in the room
    room = data.get('room')
    if room:
        emit('text-sign-message', data, room=room, include_self=False)

# WebRTC signaling
@socketio.on('signal')
def on_signal(data):
    room = data['room']
    emit('signal', data, room=room, include_self=False)

# Sign-Text notification handling
@socketio.on('sign-text-notification')
def on_sign_text_notification(data):
    room = data.get('room')
    notification_type = data.get('type')
    sender = data.get('sender')
    
    if room and notification_type and sender:
        # Broadcast the notification to all others in the room
        emit('sign-text-notification', data, room=room, include_self=False)
        print(f"Sign-text notification: {sender} -> {notification_type} in room {room}")

@app.route('/get_images', methods=['POST'])
def get_images():
    data = request.get_json()
    input_text = data.get('input', '')

    # Remove leading and trailing whitespace from the input
    input_text = input_text.strip()

    if not input_text:
        return jsonify({'error': 'No input provided'}), 400

    image_files = []

    for char in input_text:
        if char.isalpha():  # letters
            filename = f"{char.upper()}.jpeg"
        elif char.isdigit():  # digits
            filename = f"{char}.jpeg"
        elif char in [" ", ".", ",", "?"]:
            # special chars handled by frontend
            image_files.append({'special': char})
            continue
        else:
            continue  # ignore unsupported symbols

        filepath = os.path.join(IMAGE_DIR, filename)
        if os.path.exists(filepath):
            image_files.append({'img': f"/static/images/{filename}"})

    return jsonify({'images': image_files})

@app.route("/grammar_correction", methods=["POST"])
def grammar_correction():
    try:
        data = request.get_json()
        text = data.get("text", "").strip()
        if not text:
            return jsonify({"error": "No input text"}), 400

        prompt = (
            f"Correct the grammar of this sentence:\n\n{text}\n\n"
            "Respond ONLY in JSON format like this:\n"
            '{ "corrected": "<corrected sentence>", "explanation": "<short explanation>" }'
        )

        response = requests.post(
            "http://localhost:11434/api/generate",
            json={"model": "gemma2:2b", "prompt": prompt}
        )

        if response.status_code != 200:
            return jsonify({"error": f"Ollama error {response.status_code}"}), 500

        # ---------------------------
        # STREAM-SAFE PARSING
        # ---------------------------
        output_text = ""
        for line in response.text.strip().splitlines():
            try:
                chunk = json.loads(line)
                output_text += chunk.get("response", "")
            except:
                continue

        # Clean up any Markdown or code block markers
        output_text = output_text.replace("```json", "").replace("```", "").strip()

        # Parse final JSON safely
        try:
            result = json.loads(output_text)
        except Exception:
            result = {"corrected": output_text, "explanation": "Could not parse JSON"}

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/style_enhance", methods=["POST"])
def style_enhance():
    try:
        data = request.get_json()
        text = (data.get("text") or "").strip()
        style = (data.get("style") or "").strip().lower()
        if not text:
            return jsonify({"error": "No input text"}), 400
        allowed = {"formal", "professional", "persuasive", "casual", "poetic"}
        if style not in allowed:
            return jsonify({"error": f"Unsupported style '{style}'"}), 400

        # Build a controlled prompt for rewriting
        prompt = (
            f"Rewrite the following text in a {style} style, improving clarity and tone.\n"
            f"Keep meaning intact and avoid adding extra information.\n\n"
            f"Text:\n{text}\n\n"
            "Respond ONLY in JSON like this (no extra keys):\n"
            '{ "result": "<rewritten text>" }'
        )

        response = requests.post(
            "http://localhost:11434/api/generate",
            json={"model": "gemma2:2b", "prompt": prompt}
        )
        if response.status_code != 200:
            return jsonify({"error": f"Ollama error {response.status_code}"}), 500

        output_text = ""
        for line in response.text.strip().splitlines():
            try:
                chunk = json.loads(line)
                output_text += chunk.get("response", "")
            except Exception:
                continue
        output_text = output_text.replace("```json", "").replace("```", "").strip()
        try:
            result = json.loads(output_text)
        except Exception:
            result = {"result": output_text}
        return jsonify({"result": result.get("result", "").strip()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/style_enhancement", methods=["POST"])
def style_enhancement():
    try:
        data = request.get_json()
        text = data.get("text", "").strip()
        style = data.get("style", "").strip()

        if not text:
            return jsonify({"error": "No input text"}), 400
        if not style:
            return jsonify({"error": "No style selected"}), 400

        prompt = (
            f"Take the following sentence and rewrite it in the style of '{style}'.\n\n"
            f"Sentence: {text}\n\n"
            'Respond ONLY in JSON format like this:\n'
            '{ "enhanced": "<sentence rewritten in selected style>" }'
        )

        response = requests.post(
            "http://localhost:11434/api/generate",
            json={"model": "gemma2:2b", "prompt": prompt}
        )

        if response.status_code != 200:
            return jsonify({"error": f"Ollama error {response.status_code}"}), 500

        # ---------------------------
        # STREAM-SAFE PARSING
        # ---------------------------
        output_text = ""
        for line in response.text.strip().splitlines():
            try:
                chunk = json.loads(line)
                output_text += chunk.get("response", "")
            except:
                continue

        # Clean up any Markdown/code block markers
        output_text = output_text.replace("```json", "").replace("```", "").strip()

        # Parse final JSON safely
        try:
            result = json.loads(output_text)
        except Exception:
            result = {"enhanced": output_text}

        enhanced_text = result.get("enhanced", "")
        # Remove any prefix like "Professional version:" or "Persuasive version:"
        if ":" in enhanced_text:
            enhanced_text = ":".join(enhanced_text.split(":")[1:]).strip()

        return jsonify({"enhanced": enhanced_text})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/video')
@login_required
def video():
    return render_template('video.html')

@app.route('/learning')
@login_required
def learning():
    return render_template('learning.html')

@app.route('/learning-hub')
@login_required
def learning_hub():
    return render_template('learning_mode.html')

@app.route('/lesson1')
@login_required
def lesson1():
    return render_template('lesson1.html')

@app.route('/lesson2')
@login_required
def lesson2():
    return render_template('lesson2.html')

@app.route('/lesson3')
@login_required
def lesson3():
    return render_template('lesson3.html')

@app.route('/test1')
@login_required
def test1():
    return render_template('test1.html')

@app.route('/real_time_translation')
@login_required
def real_time_translation():
    return render_template('real_time_translation_fixed.html')

@app.route('/text-to-sign')
def text_to_sign():
    return render_template('text-to-sign-fixed.html')

# -------------------------
# Config
# -------------------------
MODEL_PATH = "models/best_m_train.pt"
CONF_THRESHOLD = 0.3
SPACE_AFTER = 3.5
FULLSTOP_AFTER = 12
STABLE_SIGN_SECONDS = 1.75
COMMA_AFTER = 8

# -------------------------
# Load model
# -------------------------
model = YOLO(MODEL_PATH)
CLASS_NAMES = model.names if isinstance(model.names, dict) else {i: n for i, n in enumerate(model.names)}

# -------------------------
# Persistent state
# -------------------------
char_buffer = deque(maxlen=256)
sentence = ""
hand_present = False
last_label = None
label_start_time = 0.0
last_accepted_label = None
last_accepted_time = 0.0
ACCEPT_COOLDOWN = 0.0
space_added = False
comma_added = False
fullstop_added = False
last_hand_time = time.time()
pause_detection = False  # <-- pause detection while user edits

state_lock = threading.Lock()

# -------------------------
# Helper functions
# -------------------------
def flush_char_buffer_as_word():
    global sentence
    if char_buffer:
        word = "".join(char_buffer)
        if word:
            word = word.replace(" ", "")
            sentence += word
        char_buffer.clear()

def accept_token(token: str):
    global sentence
    if pause_detection:
        return
    if token == "SPACE":
        flush_char_buffer_as_word()
        sentence += " "
        return
    if token == "CLEAR":
        sentence = ""
        char_buffer.clear()
        return
    if len(token) > 1:
        flush_char_buffer_as_word()
        sentence += token
        return
    char_buffer.append(token)

def pick_label_from_result(res):
    try:
        boxes = res.boxes
        if boxes is None or len(boxes) == 0:
            return None, None, None
        confs = boxes.conf.cpu().numpy()
        classes = boxes.cls.cpu().numpy().astype(int)
        xyxy = boxes.xyxy.cpu().numpy()
        best_i = int(np.argmax(confs))
        conf = float(confs[best_i])
        if conf < CONF_THRESHOLD:
            return None, None, None
        cls_idx = int(classes[best_i])
        label = CLASS_NAMES.get(cls_idx, str(cls_idx))
        x1, y1, x2, y2 = [float(v) for v in xyxy[best_i]]
        return label, conf, (x1, y1, x2, y2)
    except:
        return None, None, None

def format_sentence(raw_sentence):
    raw_sentence = re.sub(r'\s+', ' ', raw_sentence.strip())
    formatted = ""
    capitalize_next = True
    word_buffer = ""
    for c in raw_sentence:
        if c.isalpha():
            word_buffer += c.lower()
        else:
            if word_buffer:
                if capitalize_next:
                    formatted += word_buffer[0].upper() + word_buffer[1:]
                    capitalize_next = False
                else:
                    formatted += word_buffer
                word_buffer = ""
            formatted += c
            if c in ".!?":
                capitalize_next = True
            else:
                capitalize_next = False
    if word_buffer:
        if capitalize_next:
            formatted += word_buffer[0].upper() + word_buffer[1:]
        else:
            formatted += word_buffer
    return formatted

# -------------------------
# Routes
# -------------------------
@app.route("/sign-to-text")
def index():
    return render_template("sign-to-text-fixed.html")

@app.route("/detect", methods=["POST"])
def detect():
    global sentence, hand_present, last_label, label_start_time
    global last_accepted_label, last_accepted_time
    global space_added, fullstop_added, comma_added,last_hand_time, pause_detection

    data = request.json
    if not data or "image" not in data:
        return jsonify({"error": "No image"}), 400

    try:
        img_data = base64.b64decode(data["image"].split(",")[1])
        img = Image.open(io.BytesIO(img_data)).convert("RGB")
    except Exception as e:
        return jsonify({"error": f"bad image: {e}"}), 400

    results = model(img)
    label, conf, bbox = pick_label_from_result(results[0])
    now = time.time()
    boxes = []

    if bbox and label:
        x1, y1, x2, y2 = bbox
        boxes.append({"class": label, "conf": conf, "x1": int(x1), "y1": int(y1),
                      "x2": int(x2), "y2": int(y2)})

    with state_lock:
        countdowns = {}

        # Pause detection while editing
        if pause_detection:
            return jsonify({"boxes": boxes, "sentence": sentence, "countdowns": countdowns})

        # ---- Hand detected ----
        if label:
            hand_present = True
            last_hand_time = now
            comma_added = False     
            space_added = False
            fullstop_added = False

            if label != last_label:
                last_label = label
                label_start_time = now

            elapsed = now - label_start_time
            remaining = max(0.0, STABLE_SIGN_SECONDS - elapsed)
            countdowns["hold"] = {"type": "hold", "label": label, "remaining": round(remaining, 2),
                                  "duration": STABLE_SIGN_SECONDS}

            if remaining <= 0:
                if last_label and (last_accepted_label != last_label or
                                   (now - last_accepted_time) >= ACCEPT_COOLDOWN):
                    accept_token(last_label)
                    flush_char_buffer_as_word()
                    last_accepted_label = last_label
                    last_accepted_time = now
                last_label = None
                label_start_time = 0.0

        # ---- No hand detected ----
        else:
            elapsed = now - last_hand_time

    # 1. COMMA countdown
            if space_added and not comma_added:
                remaining_comma = max(0.0, COMMA_AFTER - elapsed)
                countdowns["comma"] = {
            "type": "comma",
            "remaining": round(remaining_comma, 2),
            "duration": COMMA_AFTER
        }
                if elapsed >= COMMA_AFTER:
                    sentence = sentence.rstrip() + ", "
                    comma_added = True

    # 2. SPACE countdown
            elif hand_present and not space_added:
                remaining_space = max(0.0, SPACE_AFTER - elapsed)
                countdowns["space"] = {
            "type": "space",
            "remaining": round(remaining_space, 2),
            "duration": SPACE_AFTER
        }
                if elapsed >= SPACE_AFTER:
                    sentence += " "
                    space_added = True

    # 3. FULLSTOP countdown
            elif space_added and not fullstop_added:
                remaining_fullstop = max(0.0, FULLSTOP_AFTER - elapsed)
                countdowns["fullstop"] = {
            "type": "fullstop",
            "remaining": round(remaining_fullstop, 2),
            "duration": FULLSTOP_AFTER
        }
                if elapsed >= FULLSTOP_AFTER:
                    sentence = sentence.rstrip() + ". "
                    fullstop_added = True
                    hand_present = False
                    last_label = None

    formatted_sentence = format_sentence(sentence.strip())
    return jsonify({"boxes": boxes, "sentence": formatted_sentence, "countdowns": countdowns})

@app.route("/reset", methods=["POST"])
def reset():
    global sentence, char_buffer, hand_present, last_label, last_accepted_label, last_accepted_time
    global space_added, fullstop_added, last_hand_time, pause_detection
    with state_lock:
        sentence = ""
        char_buffer.clear()
        hand_present = False
        last_label = None
        last_accepted_label = None
        last_accepted_time = 0.0
        space_added = False
        fullstop_added = False
        last_hand_time = time.time()
        pause_detection = False
    return jsonify({"ok": True, "sentence": sentence})

@app.route("/set_sentence", methods=["POST"])
def set_sentence():
    global sentence, pause_detection, last_label, label_start_time, last_accepted_label, last_accepted_time
    global space_added, fullstop_added, hand_present

    data = request.json
    if not data or "sentence" not in data:
        return jsonify({"error": "no sentence provided"}), 400

    with state_lock:
        sentence = data["sentence"]
        pause_detection = data.get("pause", True)

        # Reset timers if detection is resumed
        if not pause_detection:
            last_label = None
            label_start_time = time.time()
            last_accepted_label = None
            last_accepted_time = 0.0
            space_added = False
            fullstop_added = False
            hand_present = False

    return jsonify({"ok": True, "sentence": sentence})

@app.route("/resume_detection", methods=["POST"])
def resume_detection():
    global pause_detection, last_label, label_start_time, last_accepted_label, last_accepted_time
    global space_added, fullstop_added, hand_present

    with state_lock:
        pause_detection = False
        # Reset timers and detection state
        last_label = None
        label_start_time = time.time()       # reset hold timer
        last_accepted_label = None
        last_accepted_time = 0.0
        space_added = False
        fullstop_added = False
        hand_present = False

    return jsonify({"ok": True})

@app.route("/set_confidence_threshold", methods=["POST"])
def set_confidence_threshold():
    global CONF_THRESHOLD

    try:
        data = request.get_json()
        if not data or "confidence_threshold" not in data:
            return jsonify({"success": False, "message": "No confidence_threshold provided"}), 400

        confidence_threshold = float(data["confidence_threshold"])

        # Validate the range (0.1 to 0.9 as per the slider)
        if not (0.1 <= confidence_threshold <= 0.9):
            return jsonify({"success": False, "message": "Confidence threshold must be between 0.1 and 0.9"}), 400

        # Update the global confidence threshold
        CONF_THRESHOLD = confidence_threshold

        return jsonify({
            "success": True,
            "message": f"Confidence threshold updated to {confidence_threshold}",
            "confidence_threshold": confidence_threshold
        })

    except ValueError:
        return jsonify({"success": False, "message": "Invalid confidence_threshold value"}), 400
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/language_conversion", methods=["POST"])
def language_conversion():
    try:
        data = request.get_json()
        text = data.get("text", "").strip()
        target_language = data.get("language", "").strip()
        
        if not text:
            return jsonify({"error": "No input text"}), 400
        if not target_language:
            return jsonify({"error": "No target language specified"}), 400

        # Define supported Indian languages
        supported_languages = {
            "hindi": "Hindi",
            "bengali": "Bengali", 
            "tamil": "Tamil",
            "telugu": "Telugu",
            "marathi": "Marathi",
            "gujarati": "Gujarati",
            "kannada": "Kannada",
            "malayalam": "Malayalam",
            "punjabi": "Punjabi",
            "urdu": "Urdu"
        }
        
        if target_language.lower() not in supported_languages:
            return jsonify({"error": f"Unsupported language: {target_language}"}), 400
        
        language_name = supported_languages[target_language.lower()]
        
        prompt = (
            f"Translate the following English text to {language_name}:\n\n{text}\n\n"
            "Respond ONLY in JSON format like this:\n"
            '{ "translated": "<translated text>", "language": "' + language_name + '" }'
        )

        response = requests.post(
            "http://localhost:11434/api/generate",
            json={"model": "gemma2:2b", "prompt": prompt}
        )

        if response.status_code != 200:
            return jsonify({"error": f"Ollama error {response.status_code}"}), 500

        # STREAM-SAFE PARSING
        output_text = ""
        for line in response.text.strip().splitlines():
            try:
                chunk = json.loads(line)
                output_text += chunk.get("response", "")
            except:
                continue

        # Clean up any Markdown or code block markers
        output_text = output_text.replace("```json", "").replace("```", "").strip()

        # Parse final JSON safely
        try:
            result = json.loads(output_text)
        except Exception:
            result = {"translated": output_text, "language": language_name}

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/sentence_correction", methods=["POST"])
def gram_correction():
    try:
        data = request.get_json()
        text = data.get("text", "").strip()
        if not text:
            return jsonify({"error": "No input text"}), 400

        prompt = (
            f"Correct the grammar of this sentence:\n\n{text}\n\n"
            "Respond ONLY in JSON format like this:\n"
            '{ "corrected": "<corrected sentence>", "explanation": "<short explanation>" }'
        )

        response = requests.post(
            "http://localhost:11434/api/generate",
            json={"model": "gemma2:2b", "prompt": prompt}
        )

        if response.status_code != 200:
            return jsonify({"error": f"Ollama error {response.status_code}"}), 500

        # ---------------------------
        # STREAM-SAFE PARSING
        # ---------------------------
        output_text = ""
        for line in response.text.strip().splitlines():
            try:
                chunk = json.loads(line)
                output_text += chunk.get("response", "")
            except:
                continue

        # Clean up any Markdown or code block markers
        output_text = output_text.replace("```json", "").replace("```", "").strip()

        # Parse final JSON safely
        try:
            result = json.loads(output_text)
        except Exception:
            result = {"corrected": output_text, "explanation": "Could not parse JSON"}

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --------------------- LESSON PROGRESS API ---------------------
@app.route('/api/lesson-progress/<int:lesson_number>', methods=['GET'])
@login_required
def get_lesson_progress(lesson_number):
    """Get user's progress for a specific lesson"""
    try:
        user_id = session['user_id']
        cur = mydb.cursor(dictionary=True)
        cur.execute(
            "SELECT completed_until, is_completed FROM lesson_progress WHERE user_id = %s AND lesson_number = %s",
            (user_id, lesson_number)
        )
        progress = cur.fetchone()
        cur.close()
        
        if progress:
            return jsonify({
                "completed_until": progress['completed_until'],
                "is_completed": bool(progress['is_completed'])
            })
        else:
            return jsonify({"completed_until": 0, "is_completed": False})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/lesson-progress/<int:lesson_number>', methods=['POST'])
@login_required
def update_lesson_progress(lesson_number):
    """Update user's progress for a specific lesson"""
    try:
        data = request.get_json()
        user_id = session['user_id']
        completed_until = data.get('completed_until', 0)
        is_completed = data.get('is_completed', False)
        
        cur = mydb.cursor()
        cur.execute(
            """
            INSERT INTO lesson_progress (user_id, lesson_number, completed_until, is_completed)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE 
            completed_until = VALUES(completed_until),
            is_completed = VALUES(is_completed),
            last_updated = CURRENT_TIMESTAMP
            """,
            (user_id, lesson_number, completed_until, is_completed)
        )
        mydb.commit()
        cur.close()
        
        return jsonify({"success": True, "message": "Progress updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/lesson-progress/all', methods=['GET'])
@login_required
def get_all_lesson_progress():
    """Get user's progress for all lessons"""
    try:
        user_id = session['user_id']
        cur = mydb.cursor(dictionary=True)
        cur.execute(
            "SELECT lesson_number, completed_until, is_completed FROM lesson_progress WHERE user_id = %s ORDER BY lesson_number",
            (user_id,)
        )
        progress_list = cur.fetchall()
        cur.close()
        
        # Convert to a dictionary for easier access
        progress = {}
        completed_levels = []
        for p in progress_list:
            lesson_num = p['lesson_number']
            progress[f'lesson{lesson_num}_completedUntil'] = p['completed_until']
            progress[f'lesson{lesson_num}Completed'] = '1' if p['is_completed'] else '0'
            if p['is_completed']:
                completed_levels.append(lesson_num)
        
        progress['completedLevels'] = completed_levels
        
        return jsonify(progress)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Run unified app on port 5001 as before
    socketio.run(app, host='0.0.0.0', port=5001, debug=True)
