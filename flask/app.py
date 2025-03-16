from flask import Flask, jsonify, render_template, Response
from pymongo import MongoClient, DESCENDING
from bson import ObjectId
from datetime import datetime, timezone
import random
from bson import json_util

port_number = 6789

app = Flask(__name__, static_url_path='')

class DataModel:
    def __init__(self):
        try:
            self.mongo_client = MongoClient("mongodb://localhost:27017")
            self.db = self.mongo_client['microgrid']
        except Exception as e:
            print(f"MongoDB connection failed: {str(e)}")
            self.mongo_client = None

    def ensure_indexes(self):
        for collection_name in self.db.list_collection_names():
            collection = self.db[collection_name]
            if 'datetime_-1' not in collection.index_information():
                collection.create_index([('datetime', DESCENDING)])
                print(f"Index created on datetime field for collection: {collection_name}")

    def get_latest_data(self, collection_name, limit=1):
        if not self.mongo_client:
            return []
        collection = self.db[collection_name]
        return list(collection.find().sort('datetime', DESCENDING).limit(limit))

    def get_collections(self):
        if not self.mongo_client:
            return []
        return self.db.list_collection_names()

def modify_data_recursively(data):
    if isinstance(data, dict):
        new_data = {}
        for key, value in data.items():
            if key == '_id':
                new_data[key] = ObjectId()  # Generate new ObjectId
            elif key == 'datetime':
                new_data[key] = datetime.now(timezone.utc)  # Current UTC datetime
            elif isinstance(value, (int, float)):
                # Apply percentage change without rounding
                percent = random.randint(-5, 2) / 100  # -5% to +2%
                new_value = value * (1 + percent)
                new_data[key] = new_value  # Preserve full precision
            else:
                new_data[key] = modify_data_recursively(value)
        return new_data
    elif isinstance(data, list):
        return [modify_data_recursively(item) for item in data]
    else:
        return data

@app.route('/api/data/<collection>/<int:limit>')
@app.route('/api/data/<collection>')
def get_data(collection, limit=1):
    data_model = DataModel()
    data = data_model.get_latest_data(collection, limit)

    if limit == 1:
        modified_data = [modify_data_recursively(item) for item in data]
    else:
        modified_data = data

    return Response(
        response=json_util.dumps(modified_data),
        status=200,
        mimetype='application/json'
    )

@app.route('/')
def index():
    return render_template('data_view.html')

@app.route('/api/collections')
def get_collections():
    data_model = DataModel()
    collections = data_model.get_collections()
    return jsonify(collections)

if __name__== '__main__':
    app.run(debug=True, port=port_number)