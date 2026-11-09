from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError
from app import db
from app.models import User, Driver
from email_validator import validate_email, EmailNotValidError
from datetime import datetime

auth_bp = Blueprint('auth', __name__)

def _clean(value):
    if value is None:
        return ''
    return str(value).strip()

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}

    phone = _clean(data.get('phone'))
    email = _clean(data.get('email')).lower()
    password = data.get('password') or ''
    name = _clean(data.get('name') or data.get('username'))
    license_number = _clean(data.get('license_number'))

    if not phone or not email or not password or not name or not license_number:
        return jsonify({'message': 'Name, phone, email, license number, and password are required'}), 400

    try:
        validate_email(email, check_deliverability=False)
    except EmailNotValidError as exc:
        return jsonify({'message': str(exc)}), 400

    if User.query.filter_by(phone=phone).first() or Driver.query.filter_by(phone=phone).first():
        return jsonify({'message': 'Phone number already exists'}), 400

    email_taken = (
        User.query.filter(db.func.lower(User.email) == email).first()
        or Driver.query.filter(db.func.lower(Driver.email) == email).first()
    )
    if email_taken:
        return jsonify({'message': 'Email already exists'}), 400

    if Driver.query.filter_by(license_number=license_number).first():
        return jsonify({'message': 'License number already registered'}), 400

    license_expiry = None
    if data.get('license_expiry'):
        try:
            license_expiry = datetime.strptime(_clean(data['license_expiry']), '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'message': 'License expiry must be YYYY-MM-DD'}), 400

    user = User(
        phone=phone,
        username=name,
        email=email,
        role='driver'
    )
    user.set_password(password)
    driver = Driver(
        phone=phone,
        name=name,
        email=email,
        license_number=license_number,
        license_expiry=license_expiry,
        status='available'
    )
    db.session.add(user)
    db.session.add(driver)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'message': 'Phone, email, or license number already exists'}), 400

    return jsonify({
        'message': 'Registration successful',
        'user': user.to_dict()
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    phone = _clean(data.get('phone'))
    password = data.get('password') or ''

    if not phone or not password:
        return jsonify({'message': 'Missing phone or password'}), 400

    user = User.query.filter_by(phone=phone).first()

    if not user or not user.check_password(password):
        return jsonify({'message': 'Invalid phone or password'}), 401

    access_token = create_access_token(identity=str(user.phone))
    refresh_token = create_refresh_token(identity=str(user.phone))

    return jsonify({
        'message': 'Login successful',
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict()
    }), 200

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    current_user_phone = get_jwt_identity()
    access_token = create_access_token(identity=current_user_phone)
    return jsonify({'access_token': access_token}), 200

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    current_user_phone = get_jwt_identity()
    user = User.query.filter_by(phone=current_user_phone).first()
    
    if not user:
        return jsonify({'message': 'User not found'}), 404

    user_data = user.to_dict()

    # Enrich with driver name if available
    driver = Driver.query.filter_by(phone=current_user_phone).first()
    if driver and driver.name:
        user_data['display_name'] = driver.name
    else:
        user_data['display_name'] = user.username or None
    
    return jsonify({'user': user_data}), 200
