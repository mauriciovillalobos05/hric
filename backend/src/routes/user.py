from flask import Blueprint, jsonify, request
from ..models.user import Users, db

users_bp = Blueprint('Users', __name__)

@users_bp.route('/users', methods=['GET'])
def get_Userss():
    Userss = Users.query.all()
    return jsonify([Users.to_dict() for Users in Userss])

@users_bp.route('/users', methods=['POST'])
def create_Users():
    
    data = request.json
    Users = Users(Usersname=data['Usersname'], email=data['email'])
    db.session.add(Users)
    db.session.commit()
    return jsonify(Users.to_dict()), 201

@users_bp.route('/users/<uuid:Users_id>', methods=['GET'])
def get_Users(users_id):
    Users = Users.query.get_or_404(users_id)
    return jsonify(Users.to_dict())

@users_bp.route('/users/<uuid:Users_id>', methods=['PUT'])
def update_Users(users_id):
    Users = Users.query.get_or_404(users_id)
    data = request.json
    Users.Usersname = data.get('Usersname', Users.Usersname)
    Users.email = data.get('email', Users.email)
    db.session.commit()
    return jsonify(Users.to_dict())

@users_bp.route('/users/<uuid:Users_id>', methods=['DELETE'])
def delete_users(users_id):
    Users = Users.query.get_or_404(users_id)
    db.session.delete(Users)
    db.session.commit()
    return '', 204
