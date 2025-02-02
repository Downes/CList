# db_utils.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models_user_kv import Base  # import the models + Base above

def get_user_session(username):
    """Returns a Session for that user’s DB file, e.g. downes_db.db"""
    db_filename = f"{username}_db.db"
    db_path = os.path.join(os.getcwd(), db_filename)
    print("DEBUG: Creating/opening user DB:", db_path)

    engine = create_engine(f"sqlite:///{db_path}")
    # Create tables if not present
    Base.metadata.create_all(engine)

    Session = sessionmaker(bind=engine)
    return Session()

