# auth.py
from flask import Blueprint, request, jsonify, render_template, redirect, url_for, flash
from flask_login import LoginManager, login_user, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from utils import generate_token, get_seed  # Import the token generation function
from db_utils import get_user_session   # function that opens username_db.db + creates tables
from models_user_kv import User
from forms import RegistrationForm, LoginForm
from cryptography.fernet import Fernet
import os
import base64

auth_bp = Blueprint('auth', __name__)

# You can put the LoginManager setup here or in app.py; 
# but we'll show it inline for clarity:
login_manager = LoginManager()

# ------------------------------------------------------------------------------
# PASSPHRASE ENCRYPTOR
# ------------------------------------------------------------------------------

def encrypt_passphrase(passphrase, seed):
    """Encrypts a passphrase using the SEED."""
    
    # Ensure the seed is 32 bytes (truncate or pad)
    key = base64.urlsafe_b64encode(seed[:32].ljust(32).encode())  
    
    cipher = Fernet(key)
    return cipher.encrypt(passphrase.encode()).decode()

def decrypt_passphrase(encrypted_passphrase, seed):
    """Decrypts the passphrase using the SEED."""

    # Ensure the seed is exactly 32 bytes (truncate or pad)
    key = base64.urlsafe_b64encode(seed[:32].ljust(32).encode())  
    
    cipher = Fernet(key)
    return cipher.decrypt(encrypted_passphrase.encode()).decode()

# ------------------------------------------------------------------------------
# USER LOADER for Flask-Login
# ------------------------------------------------------------------------------
@login_manager.user_loader
def load_user(username):
    """
    Tells Flask-Login how to load a user object from an 'ID'.
    Here, we treat the username itself as the user ID.
    """
    session = get_user_session(username)
    user = session.query(User).filter_by(username=username).first()
    session.close()
    return user  # Can be None if no such user


# ------------------------------------------------------------------------------
# REGISTRATION ROUTE
# ------------------------------------------------------------------------------
@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    """
    Creates a new 'username_db.db' if it doesn't exist, 
    adds a 'User' row with hashed password to the 'users' table,
    and then closes the per-user session.
    """
    form = RegistrationForm()
    if request.method == 'POST' and form.validate_on_submit():
        username = form.username.data
        password_raw = form.password.data
        
        # Hash the password before storing
        hashed_password = generate_password_hash(password_raw)

        # Open this user's DB file (username_db.db)
        session = get_user_session(username)

        # Check if user already exists in that file
        existing_user = session.query(User).filter_by(username=username).first()
        if existing_user:
            session.close()
            flash("User already exists.", "danger")
            return redirect(url_for('auth.register'))

        # Generate a random passphrase
        passphrase = base64.urlsafe_b64encode(os.urandom(16)).decode()  # 16-byte passphrase

        # Encrypt passphrase using SEED
        seed = get_seed()
        encrypted_passphrase = encrypt_passphrase(passphrase, seed)

        # Otherwise, create a new User row
        new_user = User(username=username, password=hashed_password, encrypted_passphrase=encrypted_passphrase)
        session.add(new_user)
        session.commit()
        session.close()

        flash(f"Registration successful! Your passphrase is: {passphrase}  Please save it securely.", "success")

        next_page = request.args.get('next')
        return redirect(url_for('auth.login', next=next_page) if next_page else url_for('auth.login'))

    
    # If GET request or form not valid, render the registration template
    return render_template('register.html', form=form)


# ------------------------------------------------------------------------------
# LOGIN ROUTE
# ------------------------------------------------------------------------------
@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    """
    Authenticates a user by:
      1) Reading the 'username' from the form
      2) Opening 'username_db.db'
      3) Looking up the user in 'users' table
      4) Verifying password with check_password_hash
      5) Logging them in via Flask-Login if valid
    """
    form = LoginForm()
    if request.method == 'POST' and form.validate_on_submit():
        username = form.username.data
        password_raw = form.password.data

        # Open the user's DB
        session = get_user_session(username)
        user = session.query(User).filter_by(username=username).first()
        print("DEBUG user type:", user, type(user))
                
        if not user:
            session.close()
            flash("User does not exist.", "danger")
            return redirect(url_for('auth.login'))

        if check_password_hash(user.password, password_raw):
            # User/password is valid
            login_user(user)  # user.get_id() should return 'username'
            token = generate_token(user.username)  
            session.close()

            # Decrypt user's passphrase
            seed = get_seed()
            decrypted_passphrase = decrypt_passphrase(user.encrypted_passphrase, seed)

            # Check for a `next` parameter (in query string or form data)
            next_page = request.args.get('next') or request.form.get('next')
            if next_page:
                # Redirect to the next page with the token & username in URL
                return redirect(f'{next_page}?token={token}&username={user.username}&passphrase={decrypted_passphrase}')

            # If no `next` specified, return JSON with token & username
            flash("Login successful.", "success")
            return jsonify({'token': token, 'username': user.username,'passphrase': decrypted_passphrase}), 200
        else:
            session.close()
            flash("Invalid password.", "danger")
            return redirect(url_for('auth.login'))

    # If GET or form not valid, render login template
    return render_template('login.html', form=form)


# ------------------------------------------------------------------------------
# LOGOUT ROUTE
# ------------------------------------------------------------------------------
@auth_bp.route("/logout")
def logout():
    """
    Logs out the current user via Flask-Login.
    """
    if current_user.is_authenticated:
        logout_user()
        flash("You have been logged out.", "info")
    return redirect(url_for('auth.login'))
