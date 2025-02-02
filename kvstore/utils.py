# utils.py
from functools import wraps
from flask import request, jsonify
from flask_login import current_user
import jwt
from datetime import datetime, timedelta
from config import Config
import os
import logging
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")


# ------------------------------------------------------------------------------
# LOGIN FUNCTIONS
# ------------------------------------------------------------------------------

def login_required_json(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'error': 'You must be logged in to access this resource'}), 401
        return f(*args, **kwargs)
    return decorated_function

def generate_token(user_id):
    expiration = datetime.utcnow() + timedelta(hours=1)  # Token expires in 1 hour
    token = jwt.encode({
        'user_id': user_id,
        'exp': expiration
    }, Config.SECRET_KEY, algorithm='HS256')
    return token

# ------------------------------------------------------------------------------
# FUNCTION TO LOAD SEED ONLY WHEN NEEDED
# ------------------------------------------------------------------------------

# Store seed in a module-level variable to prevent multiple lookups
_seed = None

def get_seed():
    """Load SEED only when needed."""
    global _seed  # Store the seed to avoid redundant lookups

    if _seed is None:
        load_dotenv()
        seed = os.getenv("SEED")

        # If SEED is still missing, try loading from /etc/secrets.env (Apache/Gunicorn)
        if seed is None and os.path.exists("/etc/secrets.env"):
            with open("/etc/secrets.env") as f:
                for line in f:
                    if line.startswith("SEED="):
                        seed = line.strip().split("=", 1)[1]

        if seed is None:
            logging.error("SEED environment variable is not set! Ensure it is configured securely.")
            raise ValueError("Missing required SEED environment variable.")

        _seed = seed  # Cache seed in memory
        logging.info("SEED has been successfully loaded.")

    return _seed
