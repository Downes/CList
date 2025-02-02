import os
import json
import time
from flask import Blueprint, request, jsonify
from markupsafe import escape
from models_user_kv import KeyValue, User
from utils import login_required_json, get_seed  # Import the decorator from utils.py
from db_utils import get_user_session
from functools import wraps
import jwt
from config import Config  


DISCUSSION_EXPIRY = 300  # Expire after 5 minutes of inactivity

routes_bp = Blueprint('routes', __name__)


def token_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'No authorization header found'}), 401
        
        # Expect 'Bearer <token>'
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return jsonify({'error': 'Invalid Authorization header format'}), 401

        token = parts[1]

        try:
            data = jwt.decode(token, Config.SECRET_KEY, algorithms=['HS256'])
            # If your JWT has 'user_id' as the username, do:
            username = data.get('user_id')
            if not username:
                return jsonify({'error': 'Token missing user_id'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401

        # Optional: if you want to verify the user actually exists in their DB
        session = get_user_session(username)
        user = session.query(User).filter_by(username=username).first()
        session.close()
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Now call the original route, passing just the username or user object
        # For simplicity, let's pass the username to the route
        return f(username, *args, **kwargs)
    return decorated_function



@routes_bp.route('/get_kvs/', methods=['GET'])
@token_required
def get_kvs(username):
    seed = get_seed()  # Only loads SEED if needed
    session = get_user_session(username)
    kvs = session.query(KeyValue).all()
    results = [{'key': kv.key, 'value': kv.value} for kv in kvs]
    session.close()
    return jsonify(results)


@routes_bp.route('/add_kv/', methods=['POST'])
@token_required
def add_kv(username):
    session = get_user_session(username)

    data = request.get_json()
    key = data.get('key')
    value = data.get('value')

    if key and value:
        existing_kv = session.query(KeyValue).filter_by(key=key).first()
        if existing_kv:
            session.close()
            return jsonify({'error': 'Key already exists'}), 400
        
        new_kv = KeyValue(key=key, value=value)
        session.add(new_kv)
        session.commit()
        session.close()
        return jsonify({'message': 'Key-Value pair added successfully'})
    
    session.close()
    return jsonify({'error': 'Key or value is missing'}), 400


@routes_bp.route('/update_kv/', methods=['POST'])
@token_required
def update_kv(username):
    session = get_user_session(username)

    data = request.get_json()
    key = data.get('key')
    new_value = data.get('value')

    if key and new_value:
        existing_kv = session.query(KeyValue).filter_by(key=key).first()
        if existing_kv:
            existing_kv.value = new_value
            session.commit()
            session.close()
            return jsonify({'message': 'Key-Value pair updated successfully'})
        else:
            session.close()
            return jsonify({'error': 'Key does not exist'}), 404

    session.close()
    return jsonify({'error': 'Key or value is missing'}), 400


@routes_bp.route('/delete_kv/', methods=['POST'])
@token_required
def delete_kv(username):
    session = get_user_session(username)

    data = request.get_json()
    key = data.get('key')

    if key:
        existing_kv = session.query(KeyValue).filter_by(key=key).first()
        if existing_kv:
            session.delete(existing_kv)
            session.commit()
            session.close()
            return jsonify({'message': 'Key-Value pair deleted successfully'})
        else:
            session.close()
            return jsonify({'error': 'Key not found'}), 404

    session.close()
    return jsonify({'error': 'Key is missing'}), 400



DISCUSSIONS_FILE = os.path.join(os.path.dirname(__file__), 'discussions.json')

@routes_bp.route('/api/discussions', methods=['POST', 'GET', 'DELETE'])
def manage_discussions():
    # Ensure the JSON file exists
    if not os.path.exists(DISCUSSIONS_FILE):
        if request.method != 'POST':  # POST can create discussions.json if needed
            return jsonify({'error': 'No discussions file found'}), 404
        with open(DISCUSSIONS_FILE, 'w') as f:
            json.dump([], f)  # Initialize with an empty list

    if request.method == 'POST':
        data = request.get_json()
        discussion_name = data.get('name')
        peer_id = data.get('peerId')

        if not discussion_name or not peer_id:
            return jsonify({'error': 'Discussion name and Peer ID are required'}), 400

        try:
            with open(DISCUSSIONS_FILE, 'r') as f:
                discussions = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            print("Invalid or missing discussions file. Reinitializing.")
            discussions = []
            with open(DISCUSSIONS_FILE, 'w') as f:
                json.dump(discussions, f)

        # Update or add the discussion
        for discussion in discussions:
            if discussion['name'] == discussion_name:
                discussion['timestamp'] = int(time.time())
                break
        else:
            discussions.append({'name': discussion_name, 'peerId': peer_id, 'timestamp': int(time.time())})

        with open(DISCUSSIONS_FILE, 'w') as f:
            json.dump(discussions, f)

        return jsonify({'message': 'Discussion advertised successfully'}), 201

    elif request.method == 'GET':
        # Fetch all discussions
        with open(DISCUSSIONS_FILE, 'r') as f:
            discussions = json.load(f)

        # Remove expired discussions
        current_time = int(time.time())
        discussions = [d for d in discussions if current_time - d['timestamp'] <= DISCUSSION_EXPIRY]

        with open(DISCUSSIONS_FILE, 'w') as f:
            json.dump(discussions, f)

        return jsonify(discussions), 200

    elif request.method == 'DELETE':
        # Remove a discussion
        data = request.get_json()
        discussion_name = data.get('name')

        if not discussion_name:
            return jsonify({'error': 'Discussion name is required'}), 400

        try:
            with open(DISCUSSIONS_FILE, 'r') as f:
                discussions = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            print("Invalid or missing discussions file. Reinitializing.")
            discussions = []
            with open(DISCUSSIONS_FILE, 'w') as f:
                json.dump(discussions, f)

        updated_discussions = [d for d in discussions if d['name'] != discussion_name]

        if len(updated_discussions) == len(discussions):
            return jsonify({'error': 'Discussion not found'}), 404

        with open(DISCUSSIONS_FILE, 'w') as f:
            json.dump(updated_discussions, f)

        return jsonify({'message': 'Discussion removed successfully'}), 200
