# app.py
from flask import Flask, request, jsonify, send_from_directory
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
app = Flask(__name__, static_folder='static',static_url_path='')
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
# SERVE STATIC PAGES FROM ROOT
# ------------------------------------------------------------------------------
@app.route('/')
def serve_static_index():
    """Serve the static index page."""
    return app.send_static_file('index.html')

# Serve any static file from the "static" directory (including subdirectories)
@app.route('/<path:filename>')
def serve_static_files(filename):
    logging.info(f"Trying to serve static file: {filename}")
    return send_from_directory('static', filename)

# Serve CSS, JS, and other static files without "/static/"
@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory('static/css', filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory('static/js', filename)

@app.route('/images/<path:filename>')
def serve_images(filename):
    return send_from_directory('static/images', filename)

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
