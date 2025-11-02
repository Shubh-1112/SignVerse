from flask import request
from flask_socketio import SocketIO, join_room, leave_room

from .models import User

# In-memory presence tracking shared within this module
sid_to_user_id = {}
online_user_ids = set()

# Exported presence set
# Other modules import this symbol to read presence state
online_user_ids = set()


def register_socketio_handlers(socketio: SocketIO):
    @socketio.on('join_chat')
    def on_join(data):
        user_id = data['user_id']
        join_room(str(user_id))
        sid_to_user_id[request.sid] = user_id
        if user_id not in online_user_ids:
            online_user_ids.add(user_id)
            # Notify all friends
            try:
                from .routes import get_user_friend_ids
                for fid in get_user_friend_ids(user_id):
                    socketio.emit('user_online', {'user_id': user_id}, room=str(fid))
            except Exception:
                pass

    @socketio.on('leave_chat')
    def on_leave(data):
        user_id = data['user_id']
        leave_room(str(user_id))
        # Remove all sids for this user
        sids_to_remove = [sid for sid, uid in list(sid_to_user_id.items()) if uid == user_id]
        for sid in sids_to_remove:
            sid_to_user_id.pop(sid, None)
        if user_id not in sid_to_user_id.values() and user_id in online_user_ids:
            online_user_ids.discard(user_id)
            try:
                from .routes import get_user_friend_ids
                for fid in get_user_friend_ids(user_id):
                    socketio.emit('user_offline', {'user_id': user_id}, room=str(fid))
            except Exception:
                pass

    @socketio.on('join_room_chat')
    def on_join_chat(data):
        chat_id = data['chat_id']
        join_room(str(chat_id))

    @socketio.on('leave_room_chat')
    def on_leave_chat(data):
        chat_id = data['chat_id']
        leave_room(str(chat_id))

    @socketio.on('disconnect')
    def on_disconnect():
        # Map disconnecting sid to user
        user_id = sid_to_user_id.pop(request.sid, None)
        if user_id is not None:
            if user_id not in sid_to_user_id.values() and user_id in online_user_ids:
                online_user_ids.discard(user_id)
                try:
                    from .routes import get_user_friend_ids
                    for fid in get_user_friend_ids(user_id):
                        socketio.emit('user_offline', {'user_id': user_id}, room=str(fid))
                except Exception:
                    pass
