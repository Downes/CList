# models_user_kv.py
from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base
from flask_login import UserMixin

Base = declarative_base()

class User(Base, UserMixin):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    username = Column(String(100), unique=True, nullable=False)
    password = Column(String(100), nullable=False)
    encrypted_passphrase = Column(Text, nullable=False) 

class KeyValue(Base):
    __tablename__ = 'key_values'
    id = Column(Integer, primary_key=True)
    key = Column(String(200), unique=True, nullable=False)
    value = Column(Text, nullable=False)

