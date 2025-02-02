# app.py
from flask import Flask, request, jsonify
from flask_login import LoginManager, current_user
from auth import auth_bp, login_manager  # Assuming auth.py defines both
from routes import routes_bp
from flask_cors import CORS
from flask_bootstrap import Bootstrap
import os
import logging
from dotenv import load_dotenv
from config import Config  # If you have a config.py for other settings


# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# Initialize Flask App
app = Flask(__name__, static_folder='static')
app.secret_key = "some_super_secret_key"

# Optional: Load additional config
app.config.from_object('config.Config')

# Initialize Flask extensions
bootstrap = Bootstrap(app)
CORS(app)

# Initialize Flask-Login
login_manager = LoginManager(app)
login_manager.login_view = 'auth.login'

# Import and register Blueprints

app.register_blueprint(auth_bp, url_prefix="/auth")
app.register_blueprint(routes_bp)  # Add prefix if needed

# Import database-related functions and models
from db_utils import get_user_session
from models_user_kv import User

# ------------------------------------------------------------------------------
# FLASK-LOGIN USER LOADER
# ------------------------------------------------------------------------------
@login_manager.user_loader
def load_user(username):
    """
    Load the user based on username (stored in database).
    """
    session = get_user_session(username)
    user = session.query(User).filter_by(username=username).first()
    session.close()
    return user  # or None if not found

# ------------------------------------------------------------------------------
# ROOT ROUTE (SERVES A STATIC INDEX)
# ------------------------------------------------------------------------------
@app.route('/')
def serve_static_index():
    """Serve the static index page."""
    return app.send_static_file('index.html')


# ------------------------------------------------------------------------------
# DEBUG: LIST ROUTES
# ------------------------------------------------------------------------------
@app.route('/routes/', methods=['GET'])
def list_routes():
    """List all available routes."""
    output = [str(rule) for rule in app.url_map.iter_rules()]
    return jsonify(output)

# ------------------------------------------------------------------------------
# OPTIONAL: ADD HEADERS AFTER REQUEST
# ------------------------------------------------------------------------------
@app.after_request
def add_corp_headers(response):
    """Modify response headers for security purposes."""
    response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
    return response

# ------------------------------------------------------------------------------
# MAIN ENTRY
# ------------------------------------------------------------------------------
if __name__ == '__main__':
    app.run(debug=True)  # Debug mode for development
